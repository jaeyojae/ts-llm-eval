import { Driver } from 'neo4j-driver'
import { OpenAI } from 'openai'
import { TfIdf } from 'natural'
import { TextPipeline } from './src/utils/pipeline/TextPipeline'
import { TextPreprocessStep } from './src/utils/pipeline/steps/TextPreprocessStep'
import { LlamaIndexChunkingStep } from './src/utils/pipeline/steps/LlamaIndexChunkingStep'
import { LocalDocumentLoaderStep } from './src/utils/pipeline/steps/LocalDocumentLoaderStep'
import { OramaNativeChunkingStep } from './src/utils/pipeline/steps/OramaNativeChunkingStep'
import { LangchainChunkingStep } from './src/utils/pipeline/steps/LangchainChunkingStep'

interface Document {
  id: string
  content: string
  embedding?: number[]
  tfidf?: Record<string, number>
}

export class Neo4jVectorStore {
  private pipeline: TextPipeline

  constructor(
    private driver: Driver,
    private openai: OpenAI,
    private chunkSize: number = 500,
    private docStorePath: string = 'node_modules/llamaindex/examples'
  ) {
    this.pipeline = new TextPipeline()
    
    this.pipeline.addStep(new LocalDocumentLoaderStep({
      directory: this.docStorePath,
      recursive: true,
      extensions: ['.txt', '.md', '.json', '.pdf', '.docx'],
      excludeHidden: true,
      indexType: 'both',
      openAIApiKey: process.env.OPENAI_API_KEY || ''
    }))
    
    this.pipeline.addStep(new TextPreprocessStep())
    this.pipeline.addStep(new LlamaIndexChunkingStep({
      chunkSize: this.chunkSize,
      chunkOverlap: 50,
      openAIApiKey: process.env.OPENAI_API_KEY || ''
    }))
    this.pipeline.addStep(new OramaNativeChunkingStep({
      maxTokensPerChunk: 500,
      minTokensPerChunk: 100,
      type: 'document',
      overlap: 50,
      language: 'english',
      semanticSplitting: true,
      trackMetadata: true,
      nlpOptions: {
        sentenceThreshold: 0.7,
        paragraphThreshold: 0.5,
        useSentenceTransformers: true
      }
    }))
    this.pipeline.addStep(new LangchainChunkingStep({
      splitterType: 'recursive',
      chunkSize: 500,
      chunkOverlap: 50,
      trackMetadata: true,
      separators: ['\n\n', '\n', ' ', ''],
      keepSeparator: true
    }))
  }

  private async processText(text: string): Promise<string[]> {
    return this.pipeline.execute(text)
  }

  private async createEmbeddings(chunks: string[]): Promise<Document[]> {
    const tfidf = new TfIdf()
    chunks.forEach(chunk => tfidf.addDocument(chunk))

    const documents: Document[] = []
    
    for (let i = 0; i < chunks.length; i++) {
      const embedding = await this.openai.embeddings.create({
        model: "text-embedding-3-small",
        input: chunks[i],
      })

      const tfidfScores: Record<string, number> = {}
      tfidf.listTerms(i).forEach(item => {
        tfidfScores[item.term] = item.tfidf
      })

      documents.push({
        id: `chunk_${i}`,
        content: chunks[i],
        embedding: embedding.data[0].embedding,
        tfidf: tfidfScores
      })
    }

    return documents
  }

  async storeDocuments(text: string) {
    const chunks = await this.processText(text)
    const documents = await this.createEmbeddings(chunks)

    const session = this.driver.session()
    try {
      await session.executeWrite(tx => {
        return tx.run(`
          UNWIND $documents as doc
          CREATE (c:Chunk {
            id: doc.id,
            content: doc.content,
            embedding: doc.embedding,
            tfidf: doc.tfidf
          })
        `, { documents })
      })
    } finally {
      await session.close()
    }
  }

  async searchBM25(query: string, topK: number = 5) {
    const preprocessedQuery = await this.pipeline.execute(query)
    const session = this.driver.session()
    try {
      const result = await session.executeRead(tx => {
        return tx.run(`
          CALL db.index.fulltext.queryNodes("chunkContent", $query) 
          YIELD node, score
          RETURN node.id as id, node.content as content, score
          ORDER BY score DESC
          LIMIT $topK
        `, { query: preprocessedQuery, topK })
      })

      return result.records.map(record => ({
        id: record.get('id'),
        content: record.get('content'),
        score: record.get('score')
      }))
    } finally {
      await session.close()
    }
  }

  async searchVector(query: string, topK: number = 5) {
    const preprocessedQuery = await this.pipeline.execute(query)
    const embedding = await this.openai.embeddings.create({
      model: "text-embedding-3-small",
      input: preprocessedQuery,
    })

    const session = this.driver.session()
    try {
      const result = await session.executeRead(tx => {
        return tx.run(`
          MATCH (c:Chunk)
          WITH c, gds.similarity.cosine(c.embedding, $embedding) AS score
          ORDER BY score DESC
          LIMIT $topK
          RETURN c.id as id, c.content as content, score
        `, { 
          embedding: embedding.data[0].embedding,
          topK 
        })
      })

      return result.records.map(record => ({
        id: record.get('id'),
        content: record.get('content'),
        score: record.get('score')
      }))
    } finally {
      await session.close()
    }
  }

  private reciprocalRankFusion(results: Array<{id: string, content: string, score: number}>[]) {
    const k = 60 // RRF constant

    const scores = new Map<string, number>()
    
    results.forEach(resultSet => {
      resultSet.forEach((result, rank) => {
        const rrf = 1 / (k + rank + 1)
        scores.set(
          result.id,
          (scores.get(result.id) || 0) + rrf
        )
      })
    })

    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
  }

  async searchWithContext(query: string, topK: number = 5): Promise<string> {
    const preprocessedQuery = await this.pipeline.execute(query)
    
    const [bm25Results, vectorResults] = await Promise.all([
      this.searchBM25(preprocessedQuery, topK),
      this.searchVector(preprocessedQuery, topK)
    ])

    const fusedResults = this.reciprocalRankFusion([bm25Results, vectorResults])
      .slice(0, topK)

    const context = fusedResults
      .map(([id]) => {
        const result = [...bm25Results, ...vectorResults]
          .find(r => r.id === id)
        return result?.content
      })
      .filter(Boolean)
      .join('\n\n')

    return context
  }

  async storeLocalDocuments(specificFile?: string) {
    const chunks = await this.processText(specificFile || null)
    const documents = await this.createEmbeddings(chunks)

    const session = this.driver.session()
    try {
      await session.executeWrite(tx => {
        return tx.run(`
          UNWIND $documents as doc
          CREATE (c:Chunk {
            id: doc.id,
            content: doc.content,
            embedding: doc.embedding,
            tfidf: doc.tfidf
          })
        `, { documents })
      })
    } finally {
      await session.close()
    }
  }

  private async compareChunkingPerformance(text: string) {
    const results = await Promise.all([
      this.oramaChunker.process(text),
      this.llamaChunker.process(text),
      this.semanticChunker.process(text)
    ])

    const comparison = results.map(result => ({
      chunker: result.name,
      performance: result.performance
    }))

    console.table(comparison)
    return comparison
  }
}