import { PipelineStep, ChunkerResult } from '../../../types/pipeline'
import { encode } from 'gpt-tokenizer'

export class ChunkingStep implements PipelineStep<string> {
  name = 'Chunking'
  
  constructor(private chunkSize: number = 500) {}

  private countTokens(text: string): number {
    return encode(text).length
  }

  async process(text: string): Promise<ChunkerResult> {
    const words = text.split(' ')
    const chunks: string[] = []
    let currentChunk: string[] = []
    let currentSize = 0

    for (const word of words) {
      if (currentSize + word.length > this.chunkSize) {
        chunks.push(currentChunk.join(' '))
        currentChunk = []
        currentSize = 0
      }
      currentChunk.push(word)
      currentSize += word.length + 1
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '))
    }

    const tokensPerChunk = chunks.map(chunk => this.countTokens(chunk))

    return {
      chunks,
      performance: {
        totalTime: 0, // Basic implementation doesn't track time
        chunksCreated: chunks.length,
        averageChunkSize: tokensPerChunk.reduce((a, b) => a + b, 0) / chunks.length,
        tokensProcessed: tokensPerChunk.reduce((a, b) => a + b, 0),
        memoryUsage: 0, // Basic implementation doesn't track memory
        chunkSizeDistribution: {
          min: Math.min(...tokensPerChunk),
          max: Math.max(...tokensPerChunk),
          median: tokensPerChunk.sort((a, b) => a - b)[Math.floor(tokensPerChunk.length / 2)]
        },
        chunkStats: {
          avgSentencesPerChunk: 0,
          minSentencesPerChunk: 0,
          maxSentencesPerChunk: 0,
          avgWordsPerChunk: 0,
          minWordsPerChunk: 0,
          maxWordsPerChunk: 0
        }
      }
    }
  }
} 