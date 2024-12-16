import { ChunkingPerformanceMetrics } from './chunking'

export interface ChunkerResult {
  chunks: string[]
  performance?: ChunkingPerformanceMetrics
}

export interface PipelineStep<T> {
  name: string;
  process(input: T): Promise<ChunkerResult>;
}

export interface Pipeline<T> {
  addStep(step: PipelineStep<T>): void;
  execute(input: T): Promise<ChunkerResult>;
  executeBatch(inputs: T[]): Promise<ChunkerResult[]>;
}