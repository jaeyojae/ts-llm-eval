import {
  SimpleDirectoryReader,
  VectorStoreIndex,
  ServiceContext,
  serviceContextFromDefaults,
  OpenAIEmbedding,
  Document,
  OpenAI,
  BaseQueryEngine,
  NodeWithScore,
  Metadata,
  BaseNode,
  EngineResponse,
  MetadataMode
} from 'llamaindex'
import fs from 'fs'
import path from 'path'

import { 
    // DatasetGenerator,
    FaithfulnessEvaluator,
    RelevancyEvaluator 
} from 'llamaindex'

// Import actual implementations, not just types
import { DatasetGenerator } from './DatasetGenerator'
// import { FaithfulnessEvaluator } from './FaithfulnessEvaluator'
// import { RelevancyEvaluator } from './RelevancyEvaluator'

export interface QueryResponse {
  response: string
  sourceNodes?: Array<{ text: string }>
}

export interface ChunkingEvaluationResult {
  chunkSize: number
  averageResponseTime: number
  averageFaithfulness: number
  averageRelevancy: number
}

export interface ChunkingEvaluatorOptions {
  openAIApiKey: string
  dataDirectory?: string
  numQuestions?: number
  numPages?: number
  chunkSizes?: number[]
  evaluationModel?: string
  queryModel?: string
}

// Helper function to safely extract text from a node
function getNodeText(node: NodeWithScore<Metadata>): string {
  if (!node || !node.node) {
    return ''
  }
  
  const baseNode = node.node
  
  // Try different methods to get the text content
  if (typeof baseNode.getContent === 'function') {
    try {
      return baseNode.getContent(MetadataMode.NONE)
    } catch (error) {
      console.error('Error getting content:', error)
    }
  }
  
  // Access text property safely
  const textContent = (baseNode as any).text
  if (typeof textContent === 'string') {
    return textContent
  }
  
  // Try content property
  const content = (baseNode as any).content
  if (typeof content === 'string') {
    return content
  }
  
  // Try getText method
  if (typeof (baseNode as any).getText === 'function') {
    try {
      return (baseNode as any).getText()
    } catch (error) {
      console.error('Error getting text:', error)
    }
  }
  
  return ''
}

export class ChunkingEvaluator {
  private openAIApiKey: string
  private dataDirectory: string
  private numQuestions: number
  private numPages: number
  private chunkSizes: number[]
  private evaluationModel: string
  private queryModel: string
  private faithfulnessEvaluator: FaithfulnessEvaluator
  private relevancyEvaluator: RelevancyEvaluator

  constructor(options: ChunkingEvaluatorOptions) {
    this.openAIApiKey = options.openAIApiKey
    this.dataDirectory = options.dataDirectory || './data/'
    this.numQuestions = options.numQuestions || 20
    this.numPages = options.numPages || 20
    this.chunkSizes = options.chunkSizes || [128, 256, 512, 1024, 2048]
    this.evaluationModel = options.evaluationModel || 'gpt-4'
    this.queryModel = options.queryModel || 'gpt-3.5-turbo'

    // Initialize evaluators
    const gpt4 = new OpenAI({
      apiKey: this.openAIApiKey,
      model: this.evaluationModel,
      temperature: 0
    })

    const serviceContextGPT4 = serviceContextFromDefaults({
      llm: gpt4
    })

    this.faithfulnessEvaluator = new FaithfulnessEvaluator({
      serviceContext: serviceContextGPT4
    })

    this.relevancyEvaluator = new RelevancyEvaluator({
      serviceContext: serviceContextGPT4
    })
  }

  async loadTestData(): Promise<string> {
    const filePath = path.join(this.dataDirectory, 'large.txt')
    if (!fs.existsSync(filePath)) {
      throw new Error(`Test data not found at ${filePath}. Please run the download script first.`)
    }

    const reader = new SimpleDirectoryReader()
    const documents = await reader.loadData(this.dataDirectory)
    return documents.map(doc => doc.text).join('\n\n')
  }

  private async loadDocuments(): Promise<Document[]> {
    const reader = new SimpleDirectoryReader()
    const documents = await reader.loadData(this.dataDirectory)
    return documents.slice(0, this.numPages)
  }

  private async generateQuestions(documents: Document[]): Promise<string[]> {
    const dataGenerator = new DatasetGenerator({
      openAIApiKey: this.openAIApiKey,
      model: this.evaluationModel
    })
    
    return await dataGenerator.generateQuestionsFromDocuments(
      documents,
      this.numQuestions
    )
  }

  async evaluateFaithfulness(chunks: string[]): Promise<number> {
    let totalScore = 0

    for (const chunk of chunks) {
      const mockResponse: QueryResponse = {
        response: chunk,
        sourceNodes: [{ text: chunk }]
      }

      const result = await this.faithfulnessEvaluator.evaluateResponse(mockResponse)
      totalScore += result.score
    }

    return totalScore / chunks.length
  }

  async evaluateRelevancy(chunks: string[]): Promise<number> {
    let totalScore = 0

    // Generate a generic query for relevancy evaluation
    const query = "What are the main points discussed in this section?"

    for (const chunk of chunks) {
      const mockResponse: QueryResponse = {
        response: chunk,
        sourceNodes: [{ text: chunk }]
      }

      const result = await this.relevancyEvaluator.evaluateResponse(query, mockResponse)
      totalScore += result.score
    }

    return totalScore / chunks.length
  }

  private async evaluateResponseTimeAndAccuracy(
    documents: Document[],
    questions: string[],
    chunkSize: number
  ): Promise<ChunkingEvaluationResult> {
    let totalResponseTime = 0
    let totalFaithfulness = 0
    let totalRelevancy = 0

    // Create vector index with specified chunk size
    const llm = new OpenAI({
      apiKey: this.openAIApiKey,
      model: this.queryModel,
      temperature: 0
    })

    const serviceContext = serviceContextFromDefaults({
      llm,
      chunkSize
    })

    const vectorIndex = await VectorStoreIndex.fromDocuments(
      documents,
      { serviceContext }
    )

    const queryEngine = vectorIndex.asQueryEngine()
    const numQuestions = questions.length

    for (const question of questions) {
      const startTime = performance.now()
      const response = await queryEngine.query({
        query: question
      }) as EngineResponse

      const elapsed = (performance.now() - startTime) / 1000 // Convert to seconds

      // Map LlamaIndex response to our QueryResponse type
      const mappedResponse: QueryResponse = {
        response: response.response,
        sourceNodes: response.sourceNodes?.map(node => ({
          text: getNodeText(node)
        }))
      }

      const faithfulnessResult = await this.faithfulnessEvaluator.evaluateResponse(
        mappedResponse
      )
      
      const relevancyResult = await this.relevancyEvaluator.evaluateResponse(
        question,
        mappedResponse
      )

      totalResponseTime += elapsed
      totalFaithfulness += faithfulnessResult.score
      totalRelevancy += relevancyResult.score
    }

    return {
      chunkSize,
      averageResponseTime: totalResponseTime / numQuestions,
      averageFaithfulness: totalFaithfulness / numQuestions,
      averageRelevancy: totalRelevancy / numQuestions
    }
  }

  async evaluateChunkSizes(): Promise<ChunkingEvaluationResult[]> {
    // Load evaluation documents
    const documents = await this.loadDocuments()
    
    // Generate evaluation questions
    const questions = await this.generateQuestions(documents)

    // Evaluate each chunk size
    const results: ChunkingEvaluationResult[] = []

    for (const chunkSize of this.chunkSizes) {
      const result = await this.evaluateResponseTimeAndAccuracy(
        documents,
        questions,
        chunkSize
      )
      
      results.push(result)
      
      console.log(
        `Chunk size ${chunkSize} - ` +
        `Average Response time: ${result.averageResponseTime.toFixed(2)}s, ` +
        `Average Faithfulness: ${result.averageFaithfulness.toFixed(2)}, ` +
        `Average Relevancy: ${result.averageRelevancy.toFixed(2)}`
      )
    }

    return results
  }
} 