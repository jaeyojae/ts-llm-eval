import { WordTokenizer } from 'natural'
import { removeStopwords } from 'stopword'
import { PipelineStep, ChunkerResult } from '../../../types/pipeline'

export interface TextPreprocessOptions {
  removeUrls?: boolean
  removeEmails?: boolean
  removeNumbers?: boolean
  removeHtmlTags?: boolean
  customPatterns?: RegExp[]
  toLowerCase?: boolean
  removeStopWords?: boolean
}

export class TextPreprocessStep implements PipelineStep<string> {
  name = 'TextPreprocess'
  private tokenizer: WordTokenizer
  private options: Required<TextPreprocessOptions>

  constructor(options: TextPreprocessOptions = {}) {
    this.tokenizer = new WordTokenizer()
    this.options = {
      removeUrls: true,
      removeEmails: true,
      removeNumbers: true,
      removeHtmlTags: true,
      toLowerCase: true,
      removeStopWords: true,
      customPatterns: [],
      ...options
    }
  }

  async process(text: string): Promise<ChunkerResult> {
    const startTime = performance.now()
    const startMemory = process.memoryUsage().heapUsed

    let processed = text

    if (this.options.toLowerCase) {
      processed = processed.toLowerCase()
    }

    if (this.options.removeHtmlTags) {
      processed = processed.replace(/<[^>]*>/g, '')
    }

    if (this.options.removeUrls) {
      processed = processed.replace(/https?:\/\/\S+/g, '')
    }

    if (this.options.removeEmails) {
      processed = processed.replace(/[\w\.-]+@[\w\.-]+\.\w+/g, '')
    }

    if (this.options.removeNumbers) {
      processed = processed.replace(/\d+/g, '')
    }

    if (this.options.customPatterns) {
      this.options.customPatterns.forEach(pattern => {
        processed = processed.replace(pattern, '')
      })
    }

    // Remove special characters and extra whitespace
    processed = processed.replace(/[^a-z\s]/g, ' ')
    processed = processed.replace(/\s+/g, ' ').trim()

    if (this.options.removeStopWords) {
      const tokens = this.tokenizer.tokenize(processed) || []
      processed = removeStopwords(tokens).join(' ')
    }

    const endTime = performance.now()
    const endMemory = process.memoryUsage().heapUsed

    // Calculate sentence and word stats
    const sentences = processed.split(/[.!?]+/).filter(s => s.trim().length > 0)
    const words = processed.split(/\s+/).filter(w => w.trim().length > 0)

    return {
      chunks: [processed],
      performance: {
        totalTime: endTime - startTime,
        chunksCreated: 1,
        averageChunkSize: processed.length,
        tokensProcessed: processed.length,
        memoryUsage: endMemory - startMemory,
        chunkSizeDistribution: {
          min: processed.length,
          max: processed.length,
          median: processed.length
        },
        chunkStats: {
          avgSentencesPerChunk: sentences.length,
          minSentencesPerChunk: sentences.length,
          maxSentencesPerChunk: sentences.length,
          avgWordsPerChunk: words.length,
          minWordsPerChunk: words.length,
          maxWordsPerChunk: words.length
        }
      }
    }
  }
} 