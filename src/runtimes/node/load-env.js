/**
 * Optional .env loader — does not crash if file is missing.
 * Format: KEY=VALUE lines (no export keyword required).
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

export function loadEnvFile(filePath = '.env') {
  const full = resolve(process.cwd(), filePath)
  if (!existsSync(full)) return false
  const text = readFileSync(full, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq <= 0) continue
    const key = t.slice(0, eq).trim()
    let val = t.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) {
      process.env[key] = val
    }
  }
  return true
}
