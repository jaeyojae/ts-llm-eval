import { PipelineStep, ChunkerResult } from '../../../types/pipeline'
import { OpenAI } from 'openai'
import { Document } from 'langchain/document'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { encode } from 'gpt-tokenizer'
import { SemanticChunkMetadata } from '../../../types/chunking'

export interface SemanticChunkingOptions {
  chunkSize?: number
  chunkOverlap?: number
  semanticSimilarityThreshold?: number
  openaiModel?: string
}

export class SemanticChunkingStep implements PipelineStep<string> {
  name = 'SemanticChunking'
  private openai: OpenAI
  private options: Required<SemanticChunkingOptions>
  private embeddingApiCalls: number = 0

  constructor(
    openaiApiKey: string,
    options: SemanticChunkingOptions = {}
  ) {
    this.openai = new OpenAI({ apiKey: openaiApiKey })
    this.options = {
      chunkSize: 500,
      chunkOverlap: 50,
      semanticSimilarityThreshold: 0.8,
      openaiModel: 'text-embedding-3-small',
      ...options
    }
  }

  private countTokens(text: string): number {
    return encode(text).length
  }

  private async getEmbedding(text: string): Promise<number[]> {
    this.embeddingApiCalls++
    
    const response = await this.openai.embeddings.create({
      model: this.options.openaiModel,
      input: text,
    })
    return response.data[0].embedding
  }

  private calculateCosineSimilarity(embedding1: number[], embedding2: number[]): number {
    const dotProduct = embedding1.reduce((sum, val, i) => sum + val * embedding2[i], 0)
    const magnitude1 = Math.sqrt(embedding1.reduce((sum, val) => sum + val * val, 0))
    const magnitude2 = Math.sqrt(embedding2.reduce((sum, val) => sum + val * val, 0))
    return dotProduct / (magnitude1 * magnitude2)
  }

  private async initialChunking(text: string): Promise<string[]> {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: this.options.chunkSize,
      chunkOverlap: this.options.chunkOverlap,
    })
    
    const docs = await splitter.createDocuments([text])
    return docs.map(doc => doc.pageContent)
  }

  private async semanticMerging(chunks: string[]): Promise<string[]> {
    if (chunks.length <= 1) return chunks

    const embeddings = await Promise.all(chunks.map(chunk => this.getEmbedding(chunk)))
    const mergedChunks: string[] = []
    let currentChunk = chunks[0]
    let currentEmbedding = embeddings[0]

    for (let i = 1; i < chunks.length; i++) {
      const similarity = this.calculateCosineSimilarity(currentEmbedding, embeddings[i])

      if (similarity >= this.options.semanticSimilarityThreshold) {
        // Merge chunks if they are semantically similar
        currentChunk += ' ' + chunks[i]
        // Get new embedding for merged chunk
        currentEmbedding = await this.getEmbedding(currentChunk)
      } else {
        // Store current chunk and start new one
        mergedChunks.push(currentChunk)
        currentChunk = chunks[i]
        currentEmbedding = embeddings[i]
      }
    }

    // Add the last chunk
    mergedChunks.push(currentChunk)
    return mergedChunks
  }

  async process(text: string): Promise<ChunkerResult> {
    try {
      const startTime = performance.now()
      const startMemory = process.memoryUsage().heapUsed
      this.embeddingApiCalls = 0

      // First pass: Split into initial chunks
      const initialChunks = await this.initialChunking(text)
      
      // Second pass: Merge semantically similar chunks
      const mergedChunks = await this.semanticMerging(initialChunks)
      
      // Calculate token metrics
      const tokenCounts = mergedChunks.map(chunk => this.countTokens(chunk))

      // Calculate sentence and word stats
      const sentenceCounts = mergedChunks.map(chunk => 
        chunk.split(/[.!?]+/).filter(s => s.trim().length > 0).length
      )
      const wordCounts = mergedChunks.map(chunk =>
        chunk.split(/\s+/).filter(w => w.trim().length > 0).length
      )

      // Calculate overlaps
      const overlapSizes: number[] = []
      for (let i = 1; i < mergedChunks.length; i++) {
        const prevChunk = mergedChunks[i - 1]
        const currentChunk = mergedChunks[i]
        let overlap = 0
        for (let j = 1; j <= Math.min(prevChunk.length, currentChunk.length); j++) {
          if (prevChunk.slice(-j) === currentChunk.slice(0, j)) {
            overlap = j
          }
        }
        overlapSizes.push(overlap)
      }

      const endTime = performance.now()
      const endMemory = process.memoryUsage().heapUsed

      return {
        chunks: mergedChunks,
        performance: {
          totalTime: endTime - startTime,
          chunksCreated: mergedChunks.length,
          averageChunkSize: mergedChunks.length ? tokenCounts.reduce((a, b) => a + b, 0) / mergedChunks.length : 0,
          tokensProcessed: tokenCounts.reduce((a, b) => a + b, 0),
          memoryUsage: endMemory - startMemory,
          chunkSizeDistribution: {
            min: mergedChunks.length ? Math.min(...tokenCounts) : 0,
            max: mergedChunks.length ? Math.max(...tokenCounts) : 0,
            median: mergedChunks.length ? 
              tokenCounts.sort((a, b) => a - b)[Math.floor(tokenCounts.length / 2)] : 0
          },
          chunkStats: {
            avgSentencesPerChunk: sentenceCounts.reduce((a, b) => a + b, 0) / mergedChunks.length,
            minSentencesPerChunk: Math.min(...sentenceCounts),
            maxSentencesPerChunk: Math.max(...sentenceCounts),
            avgWordsPerChunk: wordCounts.reduce((a, b) => a + b, 0) / mergedChunks.length,
            minWordsPerChunk: Math.min(...wordCounts),
            maxWordsPerChunk: Math.max(...wordCounts)
          },
          overlapStats: {
            averageOverlap: overlapSizes.length ? 
              overlapSizes.reduce((a, b) => a + b, 0) / overlapSizes.length : 0,
            minOverlap: overlapSizes.length ? Math.min(...overlapSizes) : 0,
            maxOverlap: overlapSizes.length ? Math.max(...overlapSizes) : 0,
            overlapRatio: overlapSizes.length ? 
              (overlapSizes.reduce((a, b) => a + b, 0) / overlapSizes.length) / this.options.chunkSize : 0
          }
        }
      }
    } catch (err) {
      const error = err as Error
      throw new Error(`Chunking failed: ${error.message || 'Unknown error'}`)
    }
  }
} 