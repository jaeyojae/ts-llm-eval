import { Pipeline, PipelineStep, ChunkerResult } from '../../types/pipeline'

export class TextPipeline implements Pipeline<string> {
  private steps: PipelineStep<string>[] = []

  addStep(step: PipelineStep<string>): void {
    this.steps.push(step)
  }

  async execute(input: string): Promise<ChunkerResult> {
    let result: ChunkerResult = { chunks: [input] }
    for (const step of this.steps) {
      result = await step.process(result.chunks.join('\n'))
    }
    return result
  }

  async executeBatch(inputs: string[]): Promise<ChunkerResult[]> {
    return Promise.all(inputs.map(input => this.execute(input)))
  }
} 