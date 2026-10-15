# CinemaGraphy-next

**Independent modular rewrite** of [CinemaGraphy](https://github.com/TheNerdCow/CinemaGraphy) (Stremio / Nuvio addon).

> This is a **clean-room** project with a new git history.  
> It is **not** a fork and does **not** replace production (`cmplugin.ir` / `TheNerdCow/CinemaGraphy`) until feature parity is proven.

## Status

| Stage | State |
|-------|--------|
| 0 — Reference audit | Done |
| 1 — Architecture | Done |
| 2+ — Implementation | Not started |

## Where to read the design

| Document | Path |
|----------|------|
| **Architecture (start here)** | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| Reference behavioural audit | [`docs/REFERENCE_AUDIT.md`](docs/REFERENCE_AUDIT.md) |
| Feature parity matrix | [`docs/FEATURE_PARITY.md`](docs/FEATURE_PARITY.md) |
| Open unknowns | [`docs/UNKNOWNS.md`](docs/UNKNOWNS.md) |
| Progress checkpoint | [`docs/PROGRESS.md`](docs/PROGRESS.md) |

## Design highlights

- **Modular layers:** Core → Providers → Client adapters (Stremio / Nuvio) → Runtimes (Node / Cloudflare / Docker) → Web
- **Personalization:** `full` | `streams` (sources only, no catalogs) | `catalogs` modes; per-provider toggles; optional external catalogs
- **No mandatory API key** for base streaming (Cinemeta first; TMDB optional)
- **Clean-room:** reference repo used only for behaviour discovery, not code copy

## Production (unchanged)

- Live addon: https://cmplugin.ir  
- Reference source: https://github.com/TheNerdCow/CinemaGraphy  

## License

ISC (same family as the reference project; independent implementation).
