# RAG Evaluation Framework

A comprehensive framework for evaluating and comparing different text chunking strategies in TypeScript, with a focus on performance, faithfulness, and relevancy metrics. To be continued friends...

## Features

- Multiple chunking strategies:
  - LangChain (Recursive, Token-based)
  - Orama Native (NLP-based)
  - LlamaIndex
  - Semantic Chunking
  - Basic Chunking (Paragraph, Sentence, Word-based)
- Performance metrics:
  - Processing time
  - Memory usage
  - Chunk size distribution
  - Overlap statistics
- Quality metrics:
  - Faithfulness evaluation
  - Relevancy assessment
  - Semantic coherence
- Detailed analytics:
  - Sentences per chunk
  - Words per chunk
  - Token distribution
  - Overlap ratios

## Prerequisites

- Node.js (v16 or higher)
- pnpm package manager
- OpenAI API key

## Installation

1. Clone the repository:
```bash
git clone git@github.com:jaeyojae/ts-llm-eval.git
cd ts-llm-eval
```

2. Install dependencies:
```bash
pnpm install
```

3. Create a `.env` file in the root directory and add your OpenAI API key:
```env
OPENAI_API_KEY=your_api_key_here
```

## Usage

### Generate Test Data

Generate sample test data for evaluation:

```bash
pnpm run generate:data
```

### Download Test Documents

Download real-world test documents:

```bash
pnpm run download:testdata
```

### Compare Chunking Methods

Run a comparison of different chunking strategies:

```bash
pnpm run test:chunkers
```

### Evaluate Specific Chunker

Test a specific chunking method:

```bash
pnpm run test:specific orama
```

### Evaluate Chunking Performance

Run comprehensive chunking evaluation:

```bash
pnpm run evaluate:methods
```

## Project Structure

```
.
├── src/
│   ├── types/              # Type definitions
│   ├── utils/
│   │   ├── evaluation/     # Evaluation tools
│   │   └── pipeline/       # Chunking pipeline
│   └── index.ts
├── examples/               # Example usage
├── data/                   # Test data
├── scripts/               # Utility scripts
└── tests/                 # Test cases
```

## Chunking Strategies

### LangChain Chunking
- Recursive character text splitting
- Token-based splitting
- Configurable chunk size and overlap

### Orama Native Chunking
- NLP-based document splitting
- Semantic boundary detection
- Language-aware chunking

### LlamaIndex Chunking
- Vector store integration
- Semantic chunking
- Document hierarchy preservation

### Basic Chunking
- Paragraph-based splitting
- Sentence-based splitting
- Word-based splitting
- Character-based splitting

## Evaluation Metrics

### Performance Metrics
- Processing time per chunk
- Memory usage
- Chunk size distribution
- Overlap statistics

### Quality Metrics
- Faithfulness score
- Relevancy score
- Semantic coherence
- Context preservation

## Contributing

TODO:

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

I acknowledge a many things in life.

