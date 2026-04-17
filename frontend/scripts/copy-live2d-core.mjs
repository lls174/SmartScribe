import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const src = path.join(root, 'node_modules', 'live2dcubismcore', 'live2dcubismcore.min.js')
const destDir = path.join(root, 'public')
const dest = path.join(destDir, 'live2dcubismcore.min.js')

try {
  if (!fs.existsSync(src)) {
    console.warn('[live2d] live2dcubismcore.min.js not found at:', src)
    process.exit(0)
  }

  fs.mkdirSync(destDir, { recursive: true })
  fs.copyFileSync(src, dest)
  console.log('[live2d] copied cubism core to public:', dest)
} catch (e) {
  console.warn('[live2d] failed to copy cubism core:', e)
  process.exit(0)
}

