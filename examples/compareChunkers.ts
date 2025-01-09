import fs from 'fs'
import path from 'path'
import { PipelineStep, ChunkerResult } from '../src/types/pipeline'
import { ChunkingPerformanceMetrics } from '../src/types/chunking'
import { LangchainChunkingStep } from '../src/utils/pipeline/steps/LangchainChunkingStep'
import { OramaNativeChunkingStep } from '../src/utils/pipeline/steps/OramaNativeChunkingStep'
import { BasicChunkingStep, SplitMethod } from '../src/utils/pipeline/steps/BasicChunkingStep'

interface ChunkerTestResult {
  chunker: string
  performance: ChunkingPerformanceMetrics
  chunkCount: number
  chunksPerSecond: number
  avgChunkSize: number
  memoryMB: number
  overlapRatio?: number
  sentencesPerChunk?: number
  wordsPerChunk?: number
}

async function compareChunkers() {
  // Initialize chunkers
  const chunkers: PipelineStep<string>[] = [
    // Advanced chunkers
    {
      chunker: new LangchainChunkingStep({
        splitterType: 'recursive',
        chunkSize: 500
      }),
      description: 'LangChain recursive chunking with smart overlap'
    },
    {
      chunker: new OramaNativeChunkingStep({
        maxTokensPerChunk: 500,
        type: 'document'
      }),
      description: 'Orama NLP-based document chunking'
    },
    // Basic chunking methods
    {
      chunker: new BasicChunkingStep({
        method: 'paragraph',
        chunkSize: 500,
        chunkOverlap: 50
      }),
      description: 'Simple paragraph-based splitting'
    },
    {
      chunker: new BasicChunkingStep({
        method: 'sentence',
        chunkSize: 500,
        chunkOverlap: 50
      }),
      description: 'Simple sentence-based splitting'
    },
    {
      chunker: new BasicChunkingStep({
        method: 'word',
        chunkSize: 500,
        chunkOverlap: 50
      }),
      description: 'Simple word-based splitting'
    }
  ].map(({ chunker }) => chunker)

  // Generate test data if it doesn't exist
  const dataDir = path.join(__dirname, 'data')
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
    await import('./data/generateTestData')
  }

  // Load test documents
  const testFiles = {
    small: fs.readFileSync(path.join(__dirname, 'data/small.txt'), 'utf-8'),
    // medium: fs.readFileSync(path.join(__dirname, 'data/medium.txt'), 'utf-8'),
    // large: fs.readFileSync(path.join(__dirname, 'data/large.txt'), 'utf-8'),
  }

  // Run comparisons
  for (const [size, content] of Object.entries(testFiles)) {
    console.log(`\nTesting ${size} document:`)
    console.log('-'.repeat(50))
    console.log(chunkers);
    const results = await Promise.all(
      chunkers.map(async chunker => {
        const result = await chunker.process(content)
        const analysis: ChunkerTestResult = {
          // chunker: chunker.options.method ? chunker.name + ' - ' + chunker.options.method : chunker.name, 
          chunker: chunker.name,
          chunkCount: result.chunks.length,
          chunksPerSecond: result.chunks.length / (result.performance.totalTime / 1000),
          avgChunkSize: result.performance.averageChunkSize,
          memoryMB: result.performance.memoryUsage / 1024 / 1024,
          overlapRatio: result.performance.overlapStats?.overlapRatio,
          sentencesPerChunk: result.performance.chunkStats?.avgSentencesPerChunk,
          wordsPerChunk: result.performance.chunkStats?.avgWordsPerChunk,
          performance: result.performance
        }
        return analysis
      })
    )
    
    // Print summary table
    console.log('\nChunking Performance Summary:')
    console.table(results.map(r => ({
      'Chunker Type': r.chunker,
      'Chunks': r.chunkCount,
      'Chunks/sec': r.chunksPerSecond.toFixed(2),
      'Avg Size': r.avgChunkSize.toFixed(2),
      'Memory (MB)': r.memoryMB.toFixed(2),
      'Overlap': r.overlapRatio?.toFixed(2) || 'N/A',
      'Sentences/Chunk': r.sentencesPerChunk?.toFixed(2) || 'N/A',
      'Words/Chunk': r.wordsPerChunk?.toFixed(2) || 'N/A'
    })))

    // Print detailed stats for each chunker
    console.log('\nDetailed Statistics:')
    for (const result of results) {
      console.log(`\n${result.chunker} Statistics:`)
      console.log('  Chunk Size Distribution:', result.performance.chunkSizeDistribution)
      console.log('  Chunk Stats:', result.performance.chunkStats)
      if (result.performance.overlapStats) {
        console.log('  Overlap Stats:', result.performance.overlapStats)
      }
      if ('separatorStats' in result.performance) {
        console.log('  Separator Usage:', result.performance.separatorStats)
      }
    }
  }
}

compareChunkers().catch(console.error) 