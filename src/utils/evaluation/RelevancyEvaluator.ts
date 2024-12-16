import { ServiceContext } from 'llamaindex'
import { QueryResponse } from './ChunkingEvaluator'

export interface RelevancyEvaluationResult {
  passing: boolean
  score: number
  feedback: string
}

export interface RelevancyEvaluatorOptions {
  serviceContext: ServiceContext
}

export class RelevancyEvaluator {
  private serviceContext: ServiceContext

  constructor(options: RelevancyEvaluatorOptions) {
    this.serviceContext = options.serviceContext
  }

  async evaluateResponse(
    query: string,
    response: QueryResponse
  ): Promise<RelevancyEvaluationResult> {
    const prompt = `You are evaluating the relevancy of an AI response to a given query. A relevant response should directly address the query and provide information that helps answer the question or fulfill the request.

Query:
${query}

Response to evaluate:
${response.response}

Source Context:
${response.sourceNodes?.map(node => node.text).join('\n\n') || 'No source context provided'}

Please evaluate the relevancy of the response by answering the following questions:
1. Does the response directly address the main focus of the query?
2. Is the information provided in the response relevant to answering the question?
3. Does the response contain unnecessary or tangential information not related to the query?
4. Is the level of detail appropriate for the query?

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
      console.error('Failed to parse relevancy evaluation:', error)
      return {
        passing: false,
        score: 0,
        feedback: 'Failed to evaluate relevancy due to parsing error'
      }
    }
  }
} 