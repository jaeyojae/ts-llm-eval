import 'dotenv/config'
import { ChunkingEvaluator } from '../src/utils/evaluation/ChunkingEvaluator'
import { LangchainChunkingStep } from '../src/utils/pipeline/steps/LangchainChunkingStep'
import { OramaNativeChunkingStep } from '../src/utils/pipeline/steps/OramaNativeChunkingStep'
import { BasicChunkingStep } from '../src/utils/pipeline/steps/BasicChunkingStep'
import { LlamaIndexChunkingStep } from '../src/utils/pipeline/steps/LlamaIndexChunkingStep'
import { SemanticChunkingStep } from '../src/utils/pipeline/steps/SemanticChunkingStep'
import { TextPipeline } from '../src/utils/pipeline/TextPipeline'
import { ChunkerResult, PipelineStep } from '../src/types/pipeline'

interface ChunkerConfig {
  name: string
  pipeline: TextPipeline
}

interface ChunkerEvaluation {
  name: string
  averageResponseTime: number
  averageFaithfulness: number
  averageRelevancy: number
  chunkStats: {
    avgChunksCreated: number
    avgChunkSize: number
    avgSentencesPerChunk: number
    avgWordsPerChunk: number
  }
}

async function evaluateChunker(
  config: ChunkerConfig,
  evaluator: ChunkingEvaluator,
  text: string
): Promise<ChunkerEvaluation> {
  const startTime = performance.now()
  
  // Process text through chunker
  const result = await config.pipeline.execute(text)
  
  // Evaluate chunks using the evaluator
  const faithfulness = await evaluator.evaluateFaithfulness(result.chunks)
  const relevancy = await evaluator.evaluateRelevancy(result.chunks)
  
  const endTime = performance.now()
  const processingTime = (endTime - startTime) / 1000 // Convert to seconds

  return {
    name: config.name,
    averageResponseTime: processingTime,
    averageFaithfulness: faithfulness,
    averageRelevancy: relevancy,
    chunkStats: {
      avgChunksCreated: result.chunks.length,
      avgChunkSize: result.performance?.averageChunkSize || 0,
      avgSentencesPerChunk: result.performance?.chunkStats?.avgSentencesPerChunk || 0,
      avgWordsPerChunk: result.performance?.chunkStats?.avgWordsPerChunk || 0
    }
  }
}

function createPipeline(step: PipelineStep<string>): TextPipeline {
  const pipeline = new TextPipeline()
  pipeline.addStep(step)
  return pipeline
}

async function main() {
  const openAIKey = process.env.OPENAI_API_KEY
  if (!openAIKey) {
    throw new Error('OPENAI_API_KEY environment variable is required. Please set it in your .env file or environment variables.')
  }

  // Initialize evaluator with the API key
  const evaluator = new ChunkingEvaluator({
    openAIApiKey: openAIKey,
    dataDirectory: './data/',
    numQuestions: 20,
    numPages: 20
  })

  // Load test data
  const testData = await evaluator.loadTestData()

  // Initialize different chunkers
  const chunkers: ChunkerConfig[] = [
    // LangChain chunker with different methods
    {
      name: 'LangChain Recursive',
      pipeline: createPipeline(new LangchainChunkingStep({
        splitterType: 'recursive',
        chunkSize: 512,
        chunkOverlap: 50
      }))
    },
    {
      name: 'LangChain Token',
      pipeline: createPipeline(new LangchainChunkingStep({
        splitterType: 'token',
        chunkSize: 512,
        chunkOverlap: 50
      }))
    },

    // Orama chunker
    {
      name: 'Orama Native',
      pipeline: createPipeline(new OramaNativeChunkingStep({
        maxTokensPerChunk: 512,
        type: 'document',
        overlap: 50,
        semanticSplitting: true
      }))
    },

    // Basic chunkers with different methods
    {
      name: 'Basic Paragraph',
      pipeline: createPipeline(new BasicChunkingStep({
        method: 'paragraph',
        chunkSize: 512,
        chunkOverlap: 50
      }))
    },
    {
      name: 'Basic Sentence',
      pipeline: createPipeline(new BasicChunkingStep({
        method: 'sentence',
        chunkSize: 512,
        chunkOverlap: 50
      }))
    },

    // LlamaIndex chunker
    {
      name: 'LlamaIndex',
      pipeline: createPipeline(new LlamaIndexChunkingStep({
        chunkSize: 512,
        chunkOverlap: 50,
        openAIApiKey: process.env.OPENAI_API_KEY || ''
      }))
    },

    // Semantic chunker
    {
      name: 'Semantic',
      pipeline: createPipeline(new SemanticChunkingStep(process.env.OPENAI_API_KEY, {
        chunkSize: 512,
        chunkOverlap: 50,
        semanticSimilarityThreshold: 0.8
      }))
    }
  ]

  // Evaluate each chunker
  const results: ChunkerEvaluation[] = []
  for (const chunker of chunkers) {
    console.log(`Evaluating ${chunker.name}...`)
    const result = await evaluateChunker(chunker, evaluator, testData)
    results.push(result)
  }

  // Print results
  console.log('\nChunking Evaluation Results:')
  console.table(results.map(r => ({
    'Chunker': r.name,
    'Response Time (s)': r.averageResponseTime.toFixed(2),
    'Faithfulness': r.averageFaithfulness.toFixed(2),
    'Relevancy': r.averageRelevancy.toFixed(2),
    'Avg Chunks': r.chunkStats.avgChunksCreated,
    'Avg Chunk Size': Math.round(r.chunkStats.avgChunkSize),
    'Avg Sentences/Chunk': Math.round(r.chunkStats.avgSentencesPerChunk),
    'Avg Words/Chunk': Math.round(r.chunkStats.avgWordsPerChunk)
  })))

  // Find best chunker based on combined metrics
  const bestChunker = results.reduce((best, current) => {
    const currentScore = 
      (1 / current.averageResponseTime) * 0.2 +  // Lower response time is better (20%)
      current.averageFaithfulness * 0.4 +       // Higher faithfulness is better (40%)
      current.averageRelevancy * 0.4            // Higher relevancy is better (40%)
    
    const bestScore = 
      (1 / best.averageResponseTime) * 0.2 +
      best.averageFaithfulness * 0.4 +
      best.averageRelevancy * 0.4

    return currentScore > bestScore ? current : best
  })

  console.log('\nBest performing chunker:', bestChunker.name)
  console.log('- Average Response Time:', bestChunker.averageResponseTime.toFixed(2), 's')
  console.log('- Average Faithfulness:', bestChunker.averageFaithfulness.toFixed(2))
  console.log('- Average Relevancy:', bestChunker.averageRelevancy.toFixed(2))
  console.log('- Average Chunks Created:', bestChunker.chunkStats.avgChunksCreated)
  console.log('- Average Chunk Size:', Math.round(bestChunker.chunkStats.avgChunkSize))
  console.log('- Average Sentences per Chunk:', Math.round(bestChunker.chunkStats.avgSentencesPerChunk))
  console.log('- Average Words per Chunk:', Math.round(bestChunker.chunkStats.avgWordsPerChunk))
}

if (require.main === module) {
  main().catch(console.error)
} 