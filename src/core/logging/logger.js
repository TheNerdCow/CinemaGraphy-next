/**
 * Minimal structured logger (no secrets).
 */

export function createLogger(level = 'info') {
  const levels = { error: 0, warn: 1, info: 2, debug: 3 }
  const threshold = levels[level] ?? 2

  function log(lvl, msg, meta) {
    if ((levels[lvl] ?? 9) > threshold) return
    const line = {
      t: new Date().toISOString(),
      level: lvl,
      msg,
      ...(meta && typeof meta === 'object' ? { meta } : {}),
    }
    const out = lvl === 'error' ? console.error : console.log
    out(JSON.stringify(line))
  }

  return {
    error: (msg, meta) => log('error', msg, meta),
    warn: (msg, meta) => log('warn', msg, meta),
    info: (msg, meta) => log('info', msg, meta),
    debug: (msg, meta) => log('debug', msg, meta),
  }
}
