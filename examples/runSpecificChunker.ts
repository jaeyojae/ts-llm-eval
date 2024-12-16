import { OpenAI } from 'openai'
import fs from 'fs'
import path from 'path'
import { OramaNativeChunkingStep } from '../src/utils/pipeline/steps/OramaNativeChunkingStep'

async function testSpecificChunker(
  chunkerType: string,
  options: any = {}
) {
  if (chunkerType !== 'orama') {
    throw new Error('Only Orama chunker is supported in this test')
  }

  const chunker = new OramaNativeChunkingStep(options)

  const testContent = fs.readFileSync(
    path.join(__dirname, 'data/medium.txt'),
    'utf-8'
  )
  
  console.log(`Testing ${chunkerType} with options:`, options)
  const result = await chunker.process(testContent)
  
  console.log('\nPerformance Metrics:')
  console.table(result.performance)
  
  console.log('\nSample Chunks:')
  console.log(result.chunks.slice(0, 3))
}

// Get chunker type from command line args
const chunkerType = process.argv[2]
if (!chunkerType) {
  throw new Error('Please specify a chunker type (e.g., orama)')
}

testSpecificChunker(chunkerType, {
  type: 'document',
  maxTokensPerChunk: 500
}).catch(console.error) 