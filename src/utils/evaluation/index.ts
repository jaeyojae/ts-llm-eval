import { ChunkingEvaluator } from './ChunkingEvaluator'

async function main() {
  const evaluator = new ChunkingEvaluator({
    openAIApiKey: process.env.OPENAI_API_KEY || '',
    dataDirectory: './data/large.txt',
    numQuestions: 20,
    numPages: 20,
    chunkSizes: [128, 256, 512, 1024, 2048]
  })
  
  const results = await evaluator.evaluateChunkSizes()
  console.table(results)
}

if (require.main === module) {
  main().catch(console.error)
}