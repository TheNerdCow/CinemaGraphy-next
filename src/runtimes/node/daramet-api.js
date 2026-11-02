/**
 * Daramet donations API — server-side proxy only.
 * Env: DARAMET_API_TOKEN (from https://panel.daramet.com)
 */
export function registerDarametRoutes(app, { log } = {}) {
  let donationsCache = { ts: 0, data: null }

  async function fetchUpstream(token) {
    const urls = [
      'https://daramet.com/api/Donates/Messages',
      'https://daramet.com/api/Donates',
    ]
    const authStyles = [token, token.startsWith('Bearer ') ? token : `Bearer ${token}`]
    let lastStatus = 0
    for (const url of urls) {
      for (const auth of authStyles) {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 12_000)
        try {
          const r = await fetch(url, {
            method: 'GET',
            headers: {
              Authorization: auth,
              Accept: 'application/json',
              'User-Agent': 'CinemaGraphy-next/0.6',
            },
            signal: controller.signal,
          })
          clearTimeout(timer)
          lastStatus = r.status
          if (!r.ok) continue
          const raw = await r.json()
          return { ok: true, raw, status: r.status }
        } catch (err) {
          clearTimeout(timer)
          lastStatus = 0
        }
      }
    }
    return { ok: false, status: lastStatus }
  }

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
      const result = await fetchUpstream(token)
      if (!result.ok) {
        return res.json({ ok: false, donations: [], error: 'upstream_' + (result.status || 'fail') })
      }
      const raw = result.raw
      const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : [])
      const donations = list
        .map((item) => {
          const d = item?.donator_data ?? item ?? {}
          const amountRial = Number(d.amount ?? d.Amount ?? 0) || 0
          const ts = Number(d.timestamp ?? d.time ?? d.created_at ?? 0) || 0
          const msg = String(d.message ?? d.Message ?? d.msg ?? '').trim()
          let name = String(d.name ?? d.Name ?? d.donator ?? d.username ?? d.supporter ?? '').trim()
          // if no name field, short Persian/Latin message can be the display name
          if (!name && msg && msg.length <= 32 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(msg) && !/^\d{5,}$/.test(msg)) {
            name = msg
          }
          return {
            id: String(d.id ?? d.ID ?? ts + '-' + amountRial),
            message: name && msg === name ? '' : msg,
            name,
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
