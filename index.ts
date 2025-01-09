import 'dotenv/config'
import { Neo4jVectorStore } from './vectorstore'
import neo4j from 'neo4j-driver'
import { OpenAI } from 'openai'
import { ChunkingEvaluator } from './src/utils/evaluation/ChunkingEvaluator'

async function main() {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  })

  // Initialize the chunking evaluator
  const evaluator = new ChunkingEvaluator({
    openAIApiKey: process.env.OPENAI_API_KEY || '',
    dataDirectory: './data/',
    numQuestions: 20,
    numPages: 20,
    // chunkSizes: [128, 256, 512, 1024, 2048],
    chunkSizes: [1024, 2048],
    evaluationModel: 'gpt-4',
    queryModel: 'gpt-3.5-turbo'
  })

  // Run the evaluation
  console.log('Starting chunking evaluation...')
  const results = await evaluator.evaluateChunkSizes()

  // Print results in a table
  console.table(results.map(result => ({
    'Chunk Size': result.chunkSize,
    'Response Time (s)': result.averageResponseTime.toFixed(2),
    'Faithfulness': result.averageFaithfulness.toFixed(2),
    'Relevancy': result.averageRelevancy.toFixed(2)
  })))

  // Find optimal chunk size based on combined metrics
  const optimalResult = results.reduce((best, current) => {
    const currentScore = 
      (1 / current.averageResponseTime) * 0.3 + // Lower response time is better
      current.averageFaithfulness * 0.4 +      // Higher faithfulness is better
      current.averageRelevancy * 0.3           // Higher relevancy is better
    
    const bestScore = 
      (1 / best.averageResponseTime) * 0.3 +
      best.averageFaithfulness * 0.4 +
      best.averageRelevancy * 0.3

    return currentScore > bestScore ? current : best
  })

  console.log(`\nOptimal chunk size: ${optimalResult.chunkSize}`)
  console.log(`- Average Response Time: ${optimalResult.averageResponseTime.toFixed(2)}s`)
  console.log(`- Average Faithfulness: ${optimalResult.averageFaithfulness.toFixed(2)}`)
  console.log(`- Average Relevancy: ${optimalResult.averageRelevancy.toFixed(2)}`)
}

// Run the evaluation if this file is executed directly
if (require.main === module) {
  main().catch(console.error)
}