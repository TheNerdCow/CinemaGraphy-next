/**
 * Daramet donations API — server-side proxy only.
 * Env: DARAMET_API_TOKEN (from https://panel.daramet.com)
 */
export function registerDarametRoutes(app, { log } = {}) {
  let donationsCache = { ts: 0, data: null }

  app.get('/api/donations', async (_req, res) => {
    const token = String(process.env.DARAMET_API_TOKEN || '').trim()
    if (!token) {
      return res.json({ ok: false, donations: [], error: 'token_missing' })
    }
    const now = Date.now()
    if (donationsCache.data && now - donationsCache.ts < 90_000) {
      return res.json(donationsCache.data)
    }
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 12_000)
      const r = await fetch('https://daramet.com/api/Donates/Messages', {
        method: 'GET',
        headers: {
          Authorization: token,
          Accept: 'application/json',
          'User-Agent': 'CinemaGraphy-next/0.6',
        },
        signal: controller.signal,
      })
      clearTimeout(timer)
      if (!r.ok) {
        return res.json({ ok: false, donations: [], error: 'upstream_' + r.status })
      }
      const raw = await r.json()
      const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : [])
      const donations = list
        .map((item) => {
          const d = item?.donator_data ?? item ?? {}
          const amountRial = Number(d.amount ?? d.Amount ?? 0) || 0
          const ts = Number(d.timestamp ?? d.time ?? d.created_at ?? 0) || 0
          const msg = String(d.message ?? d.Message ?? d.msg ?? '').trim()
          const name = String(d.name ?? d.Name ?? d.donator ?? d.username ?? '').trim()
          return {
            id: String(d.id ?? d.ID ?? ts + '-' + amountRial),
            message: msg,
            name: name,
            amountRial,
            amountToman: Math.floor(amountRial / 10),
            timestamp: ts,
          }
        })
        .filter((d) => d.amountRial > 0)
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        .slice(0, 12)
      const payload = { ok: true, donations }
      donationsCache = { ts: now, data: payload }
      res.json(payload)
    } catch (err) {
      log?.warn?.('daramet donations fetch failed', { err: String(err?.message || err) })
      if (donationsCache.data) return res.json(donationsCache.data)
      res.json({ ok: false, donations: [], error: 'fetch_failed' })
    }
  })
}
