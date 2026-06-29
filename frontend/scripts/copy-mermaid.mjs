import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const src = path.join(root, 'node_modules', 'mermaid', 'dist', 'mermaid.min.js')
const destDir = path.join(root, 'public', 'vendor')
const dest = path.join(destDir, 'mermaid.min.js')

try {
  if (!fs.existsSync(src)) {
    console.warn('[mermaid] mermaid.min.js not found in node_modules, skip copy')
    process.exit(0)
  }

  fs.mkdirSync(destDir, { recursive: true })
  fs.copyFileSync(src, dest)
  console.log('[mermaid] copied to public/vendor:', dest)
} catch (error) {
  console.warn('[mermaid] failed to copy mermaid bundle:', error)
  process.exit(0)
}
