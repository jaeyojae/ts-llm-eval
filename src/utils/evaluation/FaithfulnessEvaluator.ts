import { ServiceContext } from 'llamaindex'
import { QueryResponse } from './ChunkingEvaluator'

export interface FaithfulnessEvaluationResult {
  passing: boolean
  score: number
  feedback: string
}

export interface FaithfulnessEvaluatorOptions {
  serviceContext: ServiceContext
}

export class FaithfulnessEvaluator {
  private serviceContext: ServiceContext

  constructor(options: FaithfulnessEvaluatorOptions) {
    this.serviceContext = options.serviceContext
  }

  async evaluateResponse(response: QueryResponse): Promise<FaithfulnessEvaluationResult> {
    const prompt = `You are evaluating the faithfulness of an AI response. A faithful response should only contain information that can be directly derived from or supported by the source context. The response should not include any hallucinated or unsupported claims.

Response to evaluate:
${response.response}

Source Context:
${response.sourceNodes?.map(node => node.text).join('\n\n') || 'No source context provided'}

Please evaluate the faithfulness of the response by answering the following questions:
1. Does the response contain any information not supported by the source context?
2. Are there any claims or statements that go beyond what can be reasonably inferred from the context?
3. Is the response consistent with the information provided in the source context?

Provide your evaluation in the following JSON format:
{
  "passing": boolean,
  "score": number between 0 and 1,
  "feedback": "detailed explanation of the evaluation"
}`

    const llmResponse = await this.serviceContext.llm.complete({
      prompt
    })

    try {
      const evaluation = JSON.parse(llmResponse.text)
      return {
        passing: evaluation.passing,
        score: evaluation.score,
        feedback: evaluation.feedback
      }
    } catch (error) {
      console.error('Failed to parse faithfulness evaluation:', error)
      return {
        passing: false,
        score: 0,
        feedback: 'Failed to evaluate faithfulness due to parsing error'
      }
    }
  }
} 