import fs from 'fs'
import path from 'path'
import https from 'https'

const DATA_DIR = path.join(process.cwd(), 'data')
// const UBER_10K_URL = 'https://d18rn0p25nwr6d.cloudfront.net/CIK-0001543151/3a777642-b38c-4588-9219-2e90af78f0c9.pdf'

async function downloadFile(url: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath)
    
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    }, response => {
      if (response.statusCode !== 200) {
        fs.unlink(outputPath, () => {})
        reject(new Error(`Failed to download file: ${response.statusCode} ${response.statusMessage}`))
        return
      }

      const contentLength = response.headers['content-length']
      let downloadedBytes = 0

      response.on('data', chunk => {
        downloadedBytes += chunk.length
        if (contentLength) {
          const progress = (downloadedBytes / parseInt(contentLength)) * 100
          process.stdout.write(`\rDownloading... ${progress.toFixed(1)}%`)
        }
      })

      response.pipe(file)
      
      file.on('finish', () => {
        process.stdout.write('\n')
        file.close()
        resolve()
      })

      file.on('error', err => {
        fs.unlink(outputPath, () => {})
        reject(err)
      })
    }).on('error', err => {
      fs.unlink(outputPath, () => {})
      reject(err)
    })
  })
}

async function validateFile(filePath: string): Promise<boolean> {
  try {
    const stats = fs.statSync(filePath)
    console.log(stats.size)
    console.log(stats)
    return stats.size > 5000
    // The Uber 10-K file should be several MB in size
    // return stats.size > 1000000 // At least 1MB
  } catch (error) {
    return false
  }
}

async function main() {
  // Create data directory if it doesn't exist
//   if (!fs.existsSync(DATA_DIR)) {
//     fs.mkdirSync(DATA_DIR, { recursive: true })
//   }

//   const outputPath = path.join(DATA_DIR, 'uber_2021.pdf')
  const outputPath = path.join(DATA_DIR, 'large.txt')
  console.log('Downloading test data...')
  try {
    // await downloadFile(UBER_10K_URL, outputPath)
    
    if (await validateFile(outputPath)) {
      console.log('Download complete and file validated successfully!')
    } else {
      throw new Error('Downloaded file appears to be invalid or corrupt')
    }
  } catch (error) {
    console.error('Error downloading file:', error.message)
    process.exit(1)
  }
}

if (require.main === module) {
  main().catch(console.error)
} 