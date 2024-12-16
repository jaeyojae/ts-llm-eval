import { PipelineStep, ChunkerResult } from '../../../types/pipeline'
import {
  SimpleDirectoryReader,
  VectorStoreIndex,
  SummaryIndex,
  OpenAIEmbedding,
  Document,
  serviceContextFromDefaults,
  ServiceContext,
  VectorIndexRetriever,
  getResponseSynthesizer
} from 'llamaindex'
import { QueryEngineTool } from '../tools/QueryEngineTool'

export interface LocalDocumentLoaderOptions {
  directory?: string
  recursive?: boolean
  extensions?: string[]
  excludeHidden?: boolean
  metadata?: Record<string, any>
  indexType?: 'vector' | 'summary' | 'both'
  openAIApiKey: string
}

export class LocalDocumentLoaderStep implements PipelineStep<string | null> {
  name = 'LocalDocumentLoader'
  private options: Required<Omit<LocalDocumentLoaderOptions, 'metadata'>> & { metadata: Record<string, any> }
  private embedModel: OpenAIEmbedding
  private serviceContext: ServiceContext
  private queryTool: QueryEngineTool

  constructor(options: LocalDocumentLoaderOptions) {
    this.options = {
      directory: 'node_modules/llamaindex/examples',
      recursive: true,
      extensions: ['.txt', '.md', '.json', '.pdf', '.docx'],
      excludeHidden: true,
      metadata: {},
      indexType: 'vector',
      ...options
    }
    
    this.embedModel = new OpenAIEmbedding({ 
      apiKey: options.openAIApiKey 
    })

    this.serviceContext = serviceContextFromDefaults({
      embedModel: this.embedModel
    })

    this.queryTool = new QueryEngineTool({
      openAIApiKey: options.openAIApiKey,
      name: 'document_search',
      description: 'Search through loaded documents and find relevant information'
    })
  }

  private async createVectorIndex(documents: Document[]): Promise<string> {
    const index = await VectorStoreIndex.fromDocuments(documents, {
      serviceContext: this.serviceContext
    })
    
    const retriever = new VectorIndexRetriever({ index })
    const responseSynthesizer = getResponseSynthesizer('compact')
    
    const queryEngine = index.asQueryEngine({
      retriever,
      responseSynthesizer,
      similarityTopK: 3
    })

    const response = await queryEngine.query({
      query: "Please analyze these documents and provide a comprehensive summary. " +
             "Make sure to cite your sources for each piece of information."
    })
    
    return response.response
  }

  private async createSummaryIndex(documents: Document[]): Promise<string> {
    const summaryIndex = await SummaryIndex.fromDocuments(documents, {
      serviceContext: this.serviceContext
    })
    
    const queryEngine = summaryIndex.asQueryEngine()
    const response = await queryEngine.query({
      query: "Please provide a detailed summary of these documents, citing sources for key information"
    })
    
    return response.response
  }

  async process(input: string | null): Promise<ChunkerResult> {
    try {
      const reader = new SimpleDirectoryReader()
      
      // Load documents using the simpler API
      const rawDocuments = await reader.loadData(input || this.options.directory)

      // Filter documents based on extensions and hidden files
      const filteredDocuments = rawDocuments.filter(doc => {
        const filename = doc.metadata?.filename || ''
        const isHiddenFile = filename.startsWith('.')
        const hasValidExtension = this.options.extensions.some(ext => 
          filename.toLowerCase().endsWith(ext.toLowerCase())
        )
        
        return (!this.options.excludeHidden || !isHiddenFile) && hasValidExtension
      })

      // Add document IDs and metadata
      const documents = filteredDocuments.map((doc, index) => {
        if (!doc.metadata) {
          doc.metadata = {}
        }
        
        // Generate or preserve document ID
        doc.metadata.doc_id = doc.metadata.doc_id || `doc_${index}`
        
        // Add original filename to metadata if not present
        if (!doc.metadata.filename && input) {
          doc.metadata.filename = input.split('/').pop()
        }
        
        return doc
      })

      let result: string;
      switch (this.options.indexType) {
        case 'vector':
          result = await this.createVectorIndex(documents)
          break
        
        case 'summary':
          result = await this.createSummaryIndex(documents)
          break
        
        case 'both': {
          const [vectorSummary, indexSummary] = await Promise.all([
            this.createVectorIndex(documents),
            this.createSummaryIndex(documents)
          ])
          result = `Vector Index Summary:\n${vectorSummary}\n\nSummary Index:\n${indexSummary}`
          break
        }
        
        default:
          result = documents.map(doc => doc.text).join('\n\n')
      }

      return {
        chunks: [result],
        performance: {
          totalTime: 0,
          chunksCreated: 1,
          averageChunkSize: result.length,
          tokensProcessed: result.length,
          memoryUsage: 0,
          chunkSizeDistribution: {
            min: result.length,
            max: result.length,
            median: result.length
          },
          chunkStats: {
            avgSentencesPerChunk: 0,
            minSentencesPerChunk: 0,
            maxSentencesPerChunk: 0,
            avgWordsPerChunk: 0,
            minWordsPerChunk: 0,
            maxWordsPerChunk: 0
          }
        }
      }
    } catch (error) {
      throw new Error(`Failed to load or process documents: ${error.message}`)
    }
  }
} 