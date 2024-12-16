// Common metadata across all chunking types
export interface BaseChunkMetadata {
  chunkId: string
  startIndex: number
  endIndex: number
  tokenCount: number
  chunkIndex: number
  totalChunks: number
  sourceDocument?: {
    id: string
    filename?: string
    pageNumber?: number
  }
}

// For semantic chunking
export interface SemanticChunkMetadata extends BaseChunkMetadata {
  semanticSimilarityScore: number
  topicRelevance?: number
  embeddingVector?: number[]
  nextChunkOverlap?: number
  prevChunkOverlap?: number
}

// For NLP-based chunking
export interface NLPChunkMetadata extends BaseChunkMetadata {
  sentenceScore?: number
  paragraphScore?: number
  languageConfidence?: number
  entityMentions?: string[]
  sentimentScore?: number
  readabilityScore?: number
}

// For LlamaIndex chunking
export interface LlamaIndexChunkMetadata extends BaseChunkMetadata {
  nodeId: string
  nodeType: string
  relationships?: {
    parentId?: string
    childIds?: string[]
    nextId?: string
    prevId?: string
  }
  summaryText?: string
  keyTerms?: string[]
}

export interface ChunkingPerformanceMetrics {
  totalTime: number          // Total processing time in ms
  chunksCreated: number      // Number of chunks created
  averageChunkSize: number   // Average tokens per chunk
  tokensProcessed: number    // Total tokens processed
  memoryUsage: number        // Memory used during chunking
  chunkSizeDistribution: {   // Distribution of chunk sizes
    min: number
    max: number
    median: number
  }
  // Common metrics across all chunkers
  chunkStats: {
    avgSentencesPerChunk: number
    minSentencesPerChunk: number
    maxSentencesPerChunk: number
    avgWordsPerChunk: number
    minWordsPerChunk: number
    maxWordsPerChunk: number
  }
  // Separator usage (if applicable)
  separatorStats?: {
    [separator: string]: number
  }
  // Overlap metrics
  overlapStats?: {
    averageOverlap: number
    minOverlap: number
    maxOverlap: number
    overlapRatio: number  // overlap size / chunk size
  }
} 