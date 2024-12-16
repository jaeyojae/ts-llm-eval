import { PipelineStep, ChunkerResult } from '../../../types/pipeline'
import { 
  Document as LlamaDocument,
  ServiceContext,
  serviceContextFromDefaults,
  OpenAIEmbedding,
  SentenceSplitter
} from 'llamaindex'
import { encode } from 'gpt-tokenizer'

export interface LlamaIndexChunkingOptions {
  chunkSize?: number
  chunkOverlap?: number
  includeSentenceStats?: boolean
  openAIApiKey: string
}

export class LlamaIndexChunkingStep implements PipelineStep<string> {
  name = 'LlamaIndexChunking'
  private splitter: SentenceSplitter
  private embedModel: OpenAIEmbedding
  private serviceContext: ServiceContext

  constructor(options: LlamaIndexChunkingOptions) {
    if (!options.openAIApiKey) {
      throw new Error('OpenAI API key is required for LlamaIndexChunkingStep')
    }

    this.embedModel = new OpenAIEmbedding({
      apiKey: options.openAIApiKey
    })

    this.serviceContext = serviceContextFromDefaults({
      embedModel: this.embedModel
    })

    this.splitter = new SentenceSplitter({
      chunkSize: options.chunkSize || 500,
      chunkOverlap: options.chunkOverlap || 50
    })
  }

  private countTokens(text: string): number {
    return encode(text).length
  }

  async process(text: string): Promise<ChunkerResult> {
    try {
      const startTime = performance.now()
      const startMemory = process.memoryUsage().heapUsed

      const document = new LlamaDocument({ text })
      const splitDocs = await this.splitter.splitText(text)
      const chunks = splitDocs
      
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