/**
 * Bootstrap: restore full server from base64 parts (one-time), then run it.
 */
import { writeFileSync, existsSync, readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const bodyPath = join(__dirname, 'server-body.js')

function loadParts() {
  const chunks = []
  for (let i = 0; i < 16; i++) {
    const p = join(__dirname, `_srv_b64_${i}.txt`)
    if (!existsSync(p)) break
    chunks.push(readFileSync(p, 'utf8').trim())
  }
  if (!chunks.length) throw new Error('missing _srv_b64_*.txt parts — restore incomplete')
  return Buffer.from(chunks.join(''), 'base64').toString('utf8')
}

if (!existsSync(bodyPath) || readFileSync(bodyPath, 'utf8').length < 10000) {
  writeFileSync(bodyPath, loadParts())
}

await import(pathToFileURL(bodyPath).href)
