import { WordTokenizer } from 'natural'
import { removeStopwords } from 'stopword'

export class TextPreprocessor {
  private tokenizer: WordTokenizer

  constructor() {
    this.tokenizer = new WordTokenizer()
  }

  /**
   * Preprocesses text by applying multiple cleaning steps
   */
  process(text: string): string {
    return this.removeStopwords(
      this.tokenize(
        this.cleanText(text)
      )
    )
  }

  /**
   * Cleans text by removing unwanted characters and standardizing format
   */
  private cleanText(text: string): string {
    let processed = text.toLowerCase()
    
    // Remove HTML tags
    processed = processed.replace(/<[^>]*>/g, '')
    
    // Remove URLs
    processed = processed.replace(/https?:\/\/\S+/g, '')
    
    // Remove email addresses
    processed = processed.replace(/[\w\.-]+@[\w\.-]+\.\w+/g, '')
    
    // Remove special characters and numbers, keeping only letters and spaces
    processed = processed.replace(/[^a-z\s]/g, ' ')
    
    // Remove extra whitespace
    processed = processed.replace(/\s+/g, ' ').trim()
    
    return processed
  }

  /**
   * Tokenizes text into individual words
   */
  private tokenize(text: string): string[] {
    return this.tokenizer.tokenize(text) || []
  }

  /**
   * Removes common stopwords from tokenized text
   */
  private removeStopwords(tokens: string[]): string {
    return removeStopwords(tokens).join(' ')
  }

  /**
   * Processes a batch of texts
   */
  processBatch(texts: string[]): string[] {
    return texts.map(text => this.process(text))
  }

  /**
   * Custom method to add domain-specific preprocessing steps
   */
  customProcess(text: string, options: {
    removeUrls?: boolean,
    removeEmails?: boolean,
    removeNumbers?: boolean,
    customPatterns?: RegExp[]
  } = {}): string {
    let processed = text.toLowerCase()

    if (options.removeUrls) {
      processed = processed.replace(/https?:\/\/\S+/g, '')
    }

    if (options.removeEmails) {
      processed = processed.replace(/[\w\.-]+@[\w\.-]+\.\w+/g, '')
    }

    if (options.removeNumbers) {
      processed = processed.replace(/\d+/g, '')
    }

    if (options.customPatterns) {
      options.customPatterns.forEach(pattern => {
        processed = processed.replace(pattern, '')
      })
    }

    return this.process(processed)
  }
} 