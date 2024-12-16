import { PipelineStep, ChunkerResult } from '../../../types/pipeline'
import { NLPChunker } from '@orama/chunker'
import { encode } from 'gpt-tokenizer'
import { NLPChunkMetadata } from '../../../types/chunking'

export interface OramaNativeChunkingOptions {
  maxTokensPerChunk?: number
  minTokensPerChunk?: number
  trackMetadata?: boolean
  language?: string
  type?: 'document' | 'sentence' | 'paragraph'
  overlap?: number
  semanticSplitting?: boolean
  nlpOptions?: {
    sentenceThreshold?: number
    paragraphThreshold?: number
    useSentenceTransformers?: boolean
  }
}

interface ChunkResult {
  content: string
  metadata?: Partial<NLPChunkMetadata>
}

export class OramaNativeChunkingStep implements PipelineStep<string> {
  name = 'OramaNativeChunking'
  private chunker: NLPChunker
  private options: Required<OramaNativeChunkingOptions>

  constructor(options: OramaNativeChunkingOptions = {}) {
    this.options = {
      maxTokensPerChunk: 500,
      minTokensPerChunk: 100,
      trackMetadata: true,
      language: 'english',
      type: 'document',
      overlap: 50,
      semanticSplitting: true,
      nlpOptions: {
        sentenceThreshold: 0.7,
        paragraphThreshold: 0.5,
        useSentenceTransformers: true,
        ...options.nlpOptions
      },
      ...options
    }

    this.chunker = new NLPChunker()
  }

  private countTokens(text: string): number {
    return encode(text).length
  }

  async process(text: string): Promise<ChunkerResult> {
    try {
      const startTime = performance.now()
      const startMemory = process.memoryUsage().heapUsed

      const rawChunks = await this.chunker.chunk(text, this.options.maxTokensPerChunk)
      
      const chunks: ChunkResult[] = rawChunks.map((content, index) => ({
        content,
        metadata: this.options.trackMetadata ? {
          chunkId: `chunk_${index}`,
          startIndex: 0, // Orama doesn't provide position info
          endIndex: content.length,
          tokenCount: this.countTokens(content),
          chunkIndex: index,
          totalChunks: rawChunks.length,
          sentenceScore: 1.0, // Default score since Orama doesn't provide this
          paragraphScore: 1.0,
          languageConfidence: this.options.language === 'english' ? 1.0 : 0.8
        } : undefined
      }))

      const endTime = performance.now()
      const endMemory = process.memoryUsage().heapUsed

      // Calculate sentence and word stats
      const sentenceCounts = chunks.map(chunk => 
        chunk.content.split(/[.!?]+/).filter(s => s.trim().length > 0).length
      )
      const wordCounts = chunks.map(chunk =>
        chunk.content.split(/\s+/).filter(w => w.trim().length > 0).length
      )

      // Calculate overlaps
      const overlapSizes: number[] = []
      for (let i = 1; i < chunks.length; i++) {
        const prevChunk = chunks[i - 1].content
        const currentChunk = chunks[i].content
        let overlap = 0
        for (let j = 1; j <= Math.min(prevChunk.length, currentChunk.length); j++) {
          if (prevChunk.slice(-j) === currentChunk.slice(0, j)) {
            overlap = j
          }
        }
        overlapSizes.push(overlap)
      }

      const tokenCounts = chunks.map(chunk => this.countTokens(chunk.content))

      return {
        chunks: chunks.map(chunk => chunk.content),
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
          },
          overlapStats: {
            averageOverlap: overlapSizes.length ? 
              overlapSizes.reduce((a, b) => a + b, 0) / overlapSizes.length : 0,
            minOverlap: overlapSizes.length ? Math.min(...overlapSizes) : 0,
            maxOverlap: overlapSizes.length ? Math.max(...overlapSizes) : 0,
            overlapRatio: overlapSizes.length ? 
              (overlapSizes.reduce((a, b) => a + b, 0) / overlapSizes.length) / this.options.maxTokensPerChunk : 0
          }
        }
      }
    } catch (error) {
      const err = error as Error
      throw new Error(`Chunking failed: ${err.message || 'Unknown error'}`)
    }
  }
} 