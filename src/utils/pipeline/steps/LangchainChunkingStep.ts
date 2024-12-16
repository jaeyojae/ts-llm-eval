import { PipelineStep, ChunkerResult } from '../../../types/pipeline'
import { 
  RecursiveCharacterTextSplitter,
  TokenTextSplitter,
  CharacterTextSplitter,
  MarkdownTextSplitter,
  TextSplitter
} from 'langchain/text_splitter'
import { Document } from 'langchain/document'
import { encode } from 'gpt-tokenizer'

export type SplitterType = 'recursive' | 'token' | 'character' | 'markdown'

export interface LangchainChunkingOptions {
  splitterType?: SplitterType
  chunkSize?: number
  chunkOverlap?: number
  trackMetadata?: boolean
  separators?: string[]
  keepSeparator?: boolean
}

export class LangchainChunkingStep implements PipelineStep<string> {
  name = 'LangchainChunking'
  private splitter: TextSplitter
  private options: Required<LangchainChunkingOptions>

  constructor(options: LangchainChunkingOptions = {}) {
    this.options = {
      splitterType: 'recursive',
      chunkSize: 500,
      chunkOverlap: 50,
      trackMetadata: true,
      separators: ['\n\n', '\n', ' ', ''],
      keepSeparator: true,
      ...options
    }

    switch (this.options.splitterType) {
      case 'recursive':
        this.splitter = new RecursiveCharacterTextSplitter({
          chunkSize: this.options.chunkSize,
          chunkOverlap: this.options.chunkOverlap,
          separators: this.options.separators,
          keepSeparator: this.options.keepSeparator
        })
        break
      case 'token':
        this.splitter = new TokenTextSplitter({
          chunkSize: this.options.chunkSize,
          chunkOverlap: this.options.chunkOverlap
        })
        break
      case 'character':
        this.splitter = new CharacterTextSplitter({
          chunkSize: this.options.chunkSize,
          chunkOverlap: this.options.chunkOverlap,
          separator: this.options.separators[0]
        })
        break
      case 'markdown':
        this.splitter = new MarkdownTextSplitter({
          chunkSize: this.options.chunkSize,
          chunkOverlap: this.options.chunkOverlap
        })
        break
    }
  }

  private countTokens(text: string): number {
    return encode(text).length
  }

  private trackSeparators(text: string): Map<string, number> {
    const stats = new Map<string, number>()
    for (const separator of this.options.separators) {
      const count = (text.match(new RegExp(separator, 'g')) || []).length
      stats.set(separator, count)
    }
    return stats
  }

  private calculateOverlap(chunks: Document[]): number[] {
    const overlaps: number[] = []
    for (let i = 1; i < chunks.length; i++) {
      const prevChunk = chunks[i - 1].pageContent
      const currentChunk = chunks[i].pageContent
      let overlap = 0

      // Find overlap by comparing end of prev chunk with start of current chunk
      for (let j = 1; j <= Math.min(prevChunk.length, currentChunk.length); j++) {
        if (prevChunk.slice(-j) === currentChunk.slice(0, j)) {
          overlap = j
        }
      }
      overlaps.push(overlap)
    }
    return overlaps
  }

  async process(text: string): Promise<ChunkerResult> {
    try {
      const startTime = performance.now()
      const startMemory = process.memoryUsage().heapUsed

      // Track separator usage
      const separatorStats = this.trackSeparators(text)

      const docs = await this.splitter.createDocuments([text])
      
      // Track chunk lengths
      const chunkLengths = docs.map(doc => doc.pageContent.length)
      
      // Calculate overlaps
      const overlapSizes = this.calculateOverlap(docs)

      const endTime = performance.now()
      const endMemory = process.memoryUsage().heapUsed

      const chunks = docs.map(doc => doc.pageContent)
      const tokenCounts = chunks.map(chunk => this.countTokens(chunk))

      // Calculate sentence and word stats
      const sentenceCounts = chunks.map(chunk => 
        chunk.split(/[.!?]+/).filter(s => s.trim().length > 0).length
      )
      const wordCounts = chunks.map(chunk =>
        chunk.split(/\s+/).filter(w => w.trim().length > 0).length
      )

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
          },
          overlapStats: {
            averageOverlap: overlapSizes.length ? 
              overlapSizes.reduce((a, b) => a + b, 0) / overlapSizes.length : 0,
            minOverlap: overlapSizes.length ? Math.min(...overlapSizes) : 0,
            maxOverlap: overlapSizes.length ? Math.max(...overlapSizes) : 0,
            overlapRatio: overlapSizes.length ? 
              (overlapSizes.reduce((a, b) => a + b, 0) / overlapSizes.length) / this.options.chunkSize : 0
          },
          separatorStats: Object.fromEntries(separatorStats)
        }
      }
    } catch (err) {
      const error = err as Error
      throw new Error(`Chunking failed: ${error.message || 'Unknown error'}`)
    }
  }
} 