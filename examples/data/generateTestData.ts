import fs from 'fs'
import path from 'path'

function generateTestData() {
  // Small document (~1KB)
  const smallDoc = `
    This is a small test document.
    It contains a few paragraphs of text.
    Perfect for quick testing.
    
    Second paragraph with some basic content.
    Testing line breaks and formatting.
  `.repeat(2)

  // Medium document (~50KB)
  const mediumDoc = `
    This is a medium-sized document.
    It contains multiple paragraphs and sections.
    
    Section 1:
    Detailed content about various topics.
    Including technical terms and specifications.
    
    Section 2:
    More structured content with lists:
    - Item 1 with description
    - Item 2 with details
    - Item 3 with examples
    
    Section 3:
    Concluding paragraphs with summary.
  `.repeat(50)

  // Large document (~500KB)
  const largeDoc = `
    This is a large document for testing.
    It contains extensive content across many sections.
    
    Chapter 1:
    Detailed technical specifications...
    
    Chapter 2:
    Implementation guidelines...
    
    Chapter 3:
    Performance considerations...
  `.repeat(500)

  const dataDir = path.join(__dirname)
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }

  fs.writeFileSync(path.join(dataDir, 'small.txt'), smallDoc)
  fs.writeFileSync(path.join(dataDir, 'medium.txt'), mediumDoc)
  fs.writeFileSync(path.join(dataDir, 'large.txt'), largeDoc)
}

generateTestData() 