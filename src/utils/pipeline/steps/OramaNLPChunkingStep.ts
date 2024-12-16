import { PipelineStep, ChunkerResult } from '../../../types/pipeline'
import { NLPChunker } from '@orama/chunker'
import { encode } from 'gpt-tokenizer'
import { NLPChunkMetadata } from '../../../types/chunking'
import { create, insert, search } from '@orama/orama'
import { SentenceTokenizer, WordTokenizer } from 'natural'

export interface OramaNLPChunkingOptions {
  maxChunkSize?: number
  minChunkSize?: number
  overlapSize?: number
  useSentenceBoundaries?: boolean
  useSemanticUnits?: boolean
  language?: string
  customStopwords?: string[]
}

interface SchemaType {
  sentence: string
  index: number
  tokenCount: number
}

interface ChunkMetadata {
  startIndex: number
  endIndex: number
  tokenCount: number
  sentenceCount: number
  semanticScore?: number
}

interface ChunkResult {
  chunks: string[]
  metadata: ChunkMetadata[]
}

export class OramaNLPChunkingStep implements PipelineStep<string> {
  name = 'OramaNLPChunking'
  private sentenceTokenizer: SentenceTokenizer
  private wordTokenizer: WordTokenizer
  private options: Required<OramaNLPChunkingOptions>

  constructor(options: OramaNLPChunkingOptions = {}) {
    this.options = {
      maxChunkSize: 500,
      minChunkSize: 100,
      overlapSize: 50,
      useSentenceBoundaries: true,
      useSemanticUnits: true,
      language: 'english',
      customStopwords: [],
      ...options
    }

    this.sentenceTokenizer = new SentenceTokenizer(['Mr', 'Mrs', 'Dr', 'Prof', 'Sr', 'Jr'])
    this.wordTokenizer = new WordTokenizer()
  }

  private countTokens(text: string): number {
    return encode(text).length
  }

  private async createSearchIndex(sentences: string[]) {
    const db = await create({
      schema: {
        sentence: 'string',
        index: 'number',
        tokenCount: 'number'
      },
      language: this.options.language
    })

    // Insert sentences into the search index
    for (let i = 0; i < sentences.length; i++) {
      await insert(db, {
        sentence: sentences[i],
        index: i,
        tokenCount: this.countTokens(sentences[i])
      })
    }

    return db
  }

  private async findSemanticBoundaries(sentences: string[]): Promise<number[]> {
    const db = await this.createSearchIndex(sentences)
    const boundaries: number[] = []
    let currentIndex = 0

    while (currentIndex < sentences.length) {
      const currentSentence = sentences[currentIndex]
      
      // Search for semantically similar sentences
      const results = await search(db, {
        term: currentSentence,
        properties: ['sentence'],
        limit: 5
      })

      // Find the best boundary based on semantic similarity
      const nextBoundary = results.hits
        .filter(hit => hit.document.index > currentIndex)
        .sort((a, b) => b.score - a.score)[0]

      if (nextBoundary) {
        boundaries.push(nextBoundary.document.index)
        currentIndex = nextBoundary.document.index
      } else {
        currentIndex++
      }
    }

    return boundaries
  }

  private async createChunks(text: string): Promise<ChunkResult> {
    const sentences = this.sentenceTokenizer.tokenize(text)
    const chunks: string[] = []
    const metadata: ChunkMetadata[] = []
    
    let currentChunk: string[] = []
    let currentTokenCount = 0
    let startIndex = 0

    // Get semantic boundaries if enabled
    const semanticBoundaries = this.options.useSemanticUnits 
      ? await this.findSemanticBoundaries(sentences)
      : []

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i]
      const sentenceTokens = this.countTokens(sentence)

      // Check if adding this sentence would exceed max chunk size
      if (currentTokenCount + sentenceTokens > this.options.maxChunkSize) {
        if (currentChunk.length > 0) {
          const chunkText = currentChunk.join(' ')
          chunks.push(chunkText)
          metadata.push({
            startIndex,
            endIndex: i - 1,
            tokenCount: currentTokenCount,
            sentenceCount: currentChunk.length
          })

          // Start new chunk with overlap
          if (this.options.overlapSize > 0) {
            const overlapSentences = currentChunk.slice(-2)
            currentChunk = overlapSentences
            currentTokenCount = this.countTokens(overlapSentences.join(' '))
            startIndex = i - overlapSentences.length
          } else {
            currentChunk = []
            currentTokenCount = 0
            startIndex = i
          }
        }
      }

      // Check semantic boundaries
      if (this.options.useSemanticUnits && semanticBoundaries.includes(i)) {
        if (currentChunk.length > 0) {
          const chunkText = currentChunk.join(' ')
          chunks.push(chunkText)
          metadata.push({
            startIndex,
            endIndex: i,
            tokenCount: currentTokenCount,
            sentenceCount: currentChunk.length,
            semanticScore: 1.0 // Semantic boundary
          })

          currentChunk = []
          currentTokenCount = 0
          startIndex = i
        }
      }

      currentChunk.push(sentence)
      currentTokenCount += sentenceTokens
    }

    // Add remaining sentences as the last chunk
    if (currentChunk.length > 0) {
      const chunkText = currentChunk.join(' ')
      chunks.push(chunkText)
      metadata.push({
        startIndex,
        endIndex: sentences.length - 1,
        tokenCount: currentTokenCount,
        sentenceCount: currentChunk.length
      })
    }

    return { chunks, metadata }
  }

  async process(text: string): Promise<ChunkerResult> {
    try {
      const startTime = performance.now()
      const startMemory = process.memoryUsage().heapUsed

      const { chunks, metadata } = await this.createChunks(text)
      const tokenCounts = chunks.map(chunk => this.countTokens(chunk))

      // Calculate sentence and word stats
      const sentenceCounts = chunks.map(chunk => 
        chunk.split(/[.!?]+/).filter(s => s.trim().length > 0).length
      )
      const wordCounts = chunks.map(chunk =>
        chunk.split(/\s+/).filter(w => w.trim().length > 0).length
      )

      const endTime = performance.now()
      const endMemory = process.memoryUsage().heapUsed

      return {
        chunks,
        performance: {
          totalTime: endTime - startTime,
          chunksCreated: chunks.length,
          averageChunkSize: chunks.length ? tokenCounts.reduce((a, b) => a + b, 0) / chunks.length : 0,
          tokensProcessed: tokenCounts.reduce((a, b) => a + b, 0),
          memoryUsage: endMemory - startMemory,
          chunkSizeDistribution: {
            min: chunks.length ? Math.min(...tokenCounts) : 0,
            max: chunks.length ? Math.max(...tokenCounts) : 0,
            median: chunks.length ? 
              tokenCounts.sort((a, b) => a - b)[Math.floor(tokenCounts.length / 2)] : 0
          },
          chunkStats: {
            avgSentencesPerChunk: sentenceCounts.reduce((a, b) => a + b, 0) / chunks.length,
            minSentencesPerChunk: Math.min(...sentenceCounts),
            maxSentencesPerChunk: Math.max(...sentenceCounts),
            avgWordsPerChunk: wordCounts.reduce((a, b) => a + b, 0) / chunks.length,
            minWordsPerChunk: Math.min(...wordCounts),
            maxWordsPerChunk: Math.max(...wordCounts)
          }
        }
      }
    } catch (err) {
      const error = err as Error
      throw new Error(`Chunking failed: ${error.message || 'Unknown error'}`)
    }
  }
} 