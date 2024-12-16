import { PipelineStep, ChunkerResult } from '../../../types/pipeline'
import { encode } from 'gpt-tokenizer'

export type SplitMethod = 'character' | 'word' | 'sentence' | 'paragraph'

export interface BasicChunkingOptions {
  method?: SplitMethod
  chunkSize?: number
  chunkOverlap?: number
  separators?: {
    sentence?: RegExp
    paragraph?: RegExp
    word?: RegExp
  }
}

export class BasicChunkingStep implements PipelineStep<string> {
  private options: Required<BasicChunkingOptions>
  private _name: string

  constructor(options: BasicChunkingOptions = {}) {
    this.options = {
      method: options.method || 'paragraph',
      chunkSize: 500,
      chunkOverlap: 50,
      separators: {
        sentence: /[.!?]+/g,
        paragraph: /\n\s*\n/g,
        word: /\s+/g,
        ...options.separators
      },
      ...options
    }

    const methodNames = {
      paragraph: 'Paragraph Splitter',
      sentence: 'Sentence Splitter',
      word: 'Word Splitter',
      character: 'Character Splitter'
    }
    this._name = methodNames[this.options.method] || 'Basic Chunker'
  }

  get name(): string {
    return this._name
  }

  private countTokens(text: string): number {
    return encode(text).length
  }

  private splitText(text: string): string[] {
    let chunks: string[] = []
    let currentChunk: string[] = []
    let currentSize = 0
    
    const getSeparator = () => {
      switch (this.options.method) {
        case 'sentence':
          return this.options.separators.sentence
        case 'paragraph':
          return this.options.separators.paragraph
        case 'word':
          return this.options.separators.word
        default:
          return null
      }
    }

    const separator = getSeparator()
    if (separator) {
      // Split by separator
      const segments = text.split(separator).filter(s => s.trim().length > 0)
      
      for (const segment of segments) {
        const segmentSize = this.countTokens(segment)
        
        if (currentSize + segmentSize > this.options.chunkSize && currentChunk.length > 0) {
          chunks.push(currentChunk.join(' '))
          // Keep last segment for overlap if needed
          if (this.options.chunkOverlap > 0 && currentChunk.length > 0) {
            currentChunk = [currentChunk[currentChunk.length - 1]]
            currentSize = this.countTokens(currentChunk[0])
          } else {
            currentChunk = []
            currentSize = 0
          }
        }
        
        currentChunk.push(segment)
        currentSize += segmentSize
      }
    } else {
      // Character-based splitting
      let i = 0
      while (i < text.length) {
        const chunk = text.slice(i, i + this.options.chunkSize)
        chunks.push(chunk)
        i += this.options.chunkSize - this.options.chunkOverlap
      }
    }

    // Add remaining chunk
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '))
    }

    return chunks
  }

  private calculateStats(chunks: string[]): {
    sentenceStats: { total: number, perChunk: number[] }
    wordStats: { total: number, perChunk: number[] }
    overlapSizes: number[]
  } {
    const stats = {
      sentenceStats: { total: 0, perChunk: [] as number[] },
      wordStats: { total: 0, perChunk: [] as number[] },
      overlapSizes: [] as number[]
    }

    chunks.forEach((chunk, i) => {
      // Count sentences
      const sentences = chunk.split(this.options.separators.sentence).filter(s => s.trim().length > 0)
      stats.sentenceStats.total += sentences.length
      stats.sentenceStats.perChunk.push(sentences.length)

      // Count words
      const words = chunk.split(this.options.separators.word).filter(w => w.trim().length > 0)
      stats.wordStats.total += words.length
      stats.wordStats.perChunk.push(words.length)

      // Calculate overlap with next chunk
      if (i < chunks.length - 1) {
        let overlap = 0
        const nextChunk = chunks[i + 1]
        for (let j = 1; j <= Math.min(chunk.length, nextChunk.length); j++) {
          if (chunk.slice(-j) === nextChunk.slice(0, j)) {
            overlap = j
          }
        }
        stats.overlapSizes.push(overlap)
      }
    })

    return stats
  }

  async process(text: string): Promise<ChunkerResult> {
    try {
      const startTime = performance.now()
      const startMemory = process.memoryUsage().heapUsed

      const chunks = this.splitText(text)
      const stats = this.calculateStats(chunks)
      const tokenCounts = chunks.map(chunk => this.countTokens(chunk))

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
            avgSentencesPerChunk: stats.sentenceStats.total / chunks.length,
            minSentencesPerChunk: Math.min(...stats.sentenceStats.perChunk),
            maxSentencesPerChunk: Math.max(...stats.sentenceStats.perChunk),
            avgWordsPerChunk: stats.wordStats.total / chunks.length,
            minWordsPerChunk: Math.min(...stats.wordStats.perChunk),
            maxWordsPerChunk: Math.max(...stats.wordStats.perChunk)
          },
          overlapStats: {
            averageOverlap: stats.overlapSizes.length ? 
              stats.overlapSizes.reduce((a, b) => a + b, 0) / stats.overlapSizes.length : 0,
            minOverlap: stats.overlapSizes.length ? Math.min(...stats.overlapSizes) : 0,
            maxOverlap: stats.overlapSizes.length ? Math.max(...stats.overlapSizes) : 0,
            overlapRatio: stats.overlapSizes.length ? 
              (stats.overlapSizes.reduce((a, b) => a + b, 0) / stats.overlapSizes.length) / this.options.chunkSize : 0
          }
        }
      }
    } catch (err) {
      const error = err as Error
      throw new Error(`Chunking failed: ${error.message || 'Unknown error'}`)
    }
  }
} 