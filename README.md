# CinemaGraphy-next

**Independent modular rewrite** of [CinemaGraphy](https://github.com/TheNerdCow/CinemaGraphy).

Clean-room · new git history · **does not** replace production (`cmplugin.ir`).

## Status: `0.2.7` (stabilization)

| Area | State |
|------|--------|
| Core config (`full` / `streams` / `catalogs`) | Done |
| SSRF-safe HTTP client | Done |
| Internal IDs + Stremio id mapping | Done |
| Stremio manifest + catalog/meta/stream routes | Done |
| F2Media search / browse catalogs / streams | Done |
| Metadata | **Cinemeta + MetaHub** (no API key) |
| Unit / provider fixture tests | `npm test` |
| Nuvio dedicated adapter | Not yet (Stremio protocol works in Nuvio clients) |
| Cloudflare Workers runtime | Not yet |

## Metadata

- Primary: public [Cinemeta](https://v3-cinemeta.strem.io) (no key).
- Posters / backgrounds: `images.metahub.space` when an IMDb id is known.
- Stream playback does **not** depend on metadata success.

## Local run

```bash
git clone https://github.com/TheNerdCow/CinemaGraphy-next.git
cd CinemaGraphy-next
npm install
cp .env.example .env
npm test
npm start
# http://127.0.0.1:7000/manifest.json
# http://127.0.0.1:7000/health
```

Streams-only mode:

```bash
ADDON_MODE=streams npm start
```

## Production (unchanged)

- https://cmplugin.ir  
- https://github.com/TheNerdCow/CinemaGraphy  

## License

ISC
