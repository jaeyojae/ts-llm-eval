import { Document, OpenAI } from 'llamaindex'

export interface DatasetGeneratorOptions {
  openAIApiKey: string
  model?: string
  temperature?: number
}

export class DatasetGenerator {
  private llm: OpenAI

  constructor(options: DatasetGeneratorOptions) {
    this.llm = new OpenAI({
      apiKey: options.openAIApiKey,
      model: options.model || 'gpt-4',
      temperature: options.temperature || 0
    })
  }

  async generateQuestionsFromDocuments(
    documents: Document[],
    numQuestions: number
  ): Promise<string[]> {
    const combinedText = documents
      .map(doc => doc.text)
      .join('\n\n')

    const prompt = `Given the following text, generate ${numQuestions} diverse and specific questions that can be answered using the information provided. The questions should cover different aspects and topics from the text. Format your response as a JSON array of strings containing only the questions.

Text:
${combinedText}

Generate ${numQuestions} questions:`

    const response = await this.llm.complete({
      prompt,
      stream: false
    })

    try {
      const questions = JSON.parse(response.text)
      if (Array.isArray(questions) && questions.length === numQuestions) {
        return questions
      }
      throw new Error('Invalid response format from LLM')
    } catch (error) {
      console.error('Failed to parse questions from LLM response:', error)
      // Fallback: try to extract questions line by line
      const lines = response.text
        .split('\n')
        .filter(line => line.trim().endsWith('?'))
        .slice(0, numQuestions)
      
      if (lines.length === 0) {
        throw new Error('Could not generate any valid questions')
      }
      return lines
    }
  }
} 