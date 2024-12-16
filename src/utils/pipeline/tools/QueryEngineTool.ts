import { 
  VectorStoreIndex, 
  OpenAIEmbedding,
  Document,
  serviceContextFromDefaults,
  ServiceContext,
  VectorIndexRetriever,
  getResponseSynthesizer,
  BaseRetriever,
  BaseSynthesizer
} from 'llamaindex'

export interface QueryEngineToolOptions {
  name?: string
  description?: string
  openAIApiKey: string
  includeSourceNodes?: boolean
}

export interface QueryResponse {
  content: string
  sources: Array<{
    content: string
    metadata?: {
      filename?: string
      page_number?: number
      doc_id?: string
      chunk_id?: string
      [key: string]: any
    }
  }>
}

export class QueryEngineTool {
  private vectorIndex: VectorStoreIndex | null = null
  private retriever: BaseRetriever | null = null
  private responseSynthesizer: BaseSynthesizer | null = null
  private embedModel: OpenAIEmbedding
  private serviceContext: ServiceContext
  private options: Required<QueryEngineToolOptions>

  name: string
  description: string

  constructor(options: QueryEngineToolOptions) {
    this.options = {
      name: 'search_documents',
      description: 'Useful for searching through documents and finding relevant information. ' +
                  'Input should be a natural language query about the documents.',
      includeSourceNodes: true,
      ...options
    }
    
    this.name = this.options.name
    this.description = this.options.description
    
    this.embedModel = new OpenAIEmbedding({ 
      apiKey: options.openAIApiKey 
    })

    this.serviceContext = serviceContextFromDefaults({
      embedModel: this.embedModel
    })
  }

  async setup(documents: Document[]): Promise<void> {
    const documentsWithIds = documents.map((doc, index) => {
      if (!doc.metadata) {
        doc.metadata = {}
      }
      doc.metadata.doc_id = doc.metadata.doc_id || `doc_${index}`
      return doc
    })

    this.vectorIndex = await VectorStoreIndex.fromDocuments(documentsWithIds, {
      serviceContext: this.serviceContext
    })
    
    this.retriever = new VectorIndexRetriever({ index: this.vectorIndex })
    this.responseSynthesizer = getResponseSynthesizer('compact')
  }

  private formatSourceInfo(response: any): QueryResponse {
    const sourceNodes = response.sourceNodes || []
    
    return {
      content: response.response,
      sources: sourceNodes.map(node => ({
        content: node.text,
        metadata: {
          filename: node.metadata?.filename,
          page_number: node.metadata?.page_number,
          doc_id: node.metadata?.doc_id,
          chunk_id: node.metadata?.chunk_id,
          ...node.metadata
        }
      }))
    }
  }

  async call(input: string): Promise<string> {
    if (!this.vectorIndex || !this.retriever || !this.responseSynthesizer) {
      throw new Error('QueryEngine not initialized. Call setup() first.')
    }

    try {
      const queryEngine = this.vectorIndex.asQueryEngine({
        retriever: this.retriever,
        responseSynthesizer: this.responseSynthesizer,
        similarityTopK: 3
      })

      const response = await queryEngine.query({
        query: input
      })
      
      const formattedResponse = this.formatSourceInfo(response)
      
      // Format the response with source information
      let finalResponse = formattedResponse.content + '\n\nSources:\n'
      formattedResponse.sources.forEach((source, index) => {
        finalResponse += `\n[${index + 1}] `
        
        if (source.metadata?.doc_id) {
          finalResponse += `Document ID: ${source.metadata.doc_id}`
          if (source.metadata?.chunk_id) {
            finalResponse += `, Chunk: ${source.metadata.chunk_id}`
          }
          finalResponse += '\n'
        }
        
        if (source.metadata?.filename) {
          finalResponse += `File: ${source.metadata.filename}`
          if (source.metadata?.page_number) {
            finalResponse += `, Page: ${source.metadata.page_number}`
          }
          finalResponse += '\n'
        }
        
        finalResponse += `Excerpt: "${source.content.substring(0, 200)}..."\n`
      })

      return finalResponse
    } catch (error) {
      throw new Error(`Failed to query documents: ${error.message}`)
    }
  }
} 