# CinemaGraphy-next

**Independent modular rewrite** of [CinemaGraphy](https://github.com/TheNerdCow/CinemaGraphy).

Clean-room · new git history · **does not** replace production (`cmplugin.ir`).

## Status: scaffold `0.1.0`

| Area | State |
|------|--------|
| Core config (`full` / `streams` / `catalogs`) | Done |
| SSRF-safe HTTP client | Done |
| Internal IDs + Stremio id mapping | Done |
| Stremio manifest builder | Done |
| Provider registry + stub | Done |
| Node runtime (`/manifest.json`, `/health`) | Done |
| Unit tests | **14 passing** |
| Real Iranian providers | Not yet |
| Cloudflare / configure UI | Not yet |

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Feature parity](docs/FEATURE_PARITY.md)
- [Reference audit](docs/REFERENCE_AUDIT.md)
- [Progress](docs/PROGRESS.md)

## Local run

```bash
git clone https://github.com/TheNerdCow/CinemaGraphy-next.git
cd CinemaGraphy-next
npm install
cp .env.example .env
npm test
npm start
# http://127.0.0.1:7000/manifest.json
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
