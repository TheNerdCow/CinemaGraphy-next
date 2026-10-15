# CinemaGraphy — Stage 0 Reference Audit

**Date:** 2026-10-15  
**Reference repository:** https://github.com/TheNerdCow/CinemaGraphy  
**Live production:** https://cmplugin.ir (manifest version **3.2.20**)  
**License (reference):** ISC  
**Full detailed audit** also kept in project workspace `artifacts/docs-stage0/REFERENCE_AUDIT.md`.

This document is the independent behavioural specification baseline for a clean-room reimplementation. **No code was copied.**

---

## 1. Endpoints & install

| Path | Purpose |
|------|---------|
| `https://cmplugin.ir/` | Landing |
| `/manifest.json` | Public Stremio/Nuvio manifest |
| `/configure` | Personalised manifest builder → `/c/{base64url}/manifest.json` |
| `/guide` | Bilingual guide |
| `/catalog/:type/:id[/:extra].json` | Catalogs |
| `/meta/:type/:id.json` | Metadata |
| `/stream/:type/:id.json` | Streams |
| TMDB image proxy | Path-validated |

**Manifest (3.2.20):** id `com.cinemagraphy.stremio`, resources catalog/meta/stream/subtitles, types movie/series/tv, configurable, Persian default name.

**Runtimes:** Node/Express, Cloudflare Worker, Docker/VPS; Vercel secondary/constrained.

---

## 2. Providers (inventory)

| key | Style | Notes |
|-----|-------|-------|
| f2media | Search + streams | Default active BASEURL |
| peepboxtv | Search | Often empty BASEURL on public |
| cinamatic | Search HTML | |
| aslmoviez | Search HTML | |
| serialblog | Search | Thin; verify usefulness |
| digimovie | VIP cookie | Configure-only recommended |
| avamovie | VIP cookie | Configure-only |
| donyayeserial | Search | Domain changes historically |
| animex | Search (+ optional catalog) | |
| f2turkish | Browse catalog | Flag ENABLE_F2_TURKISH |
| farsiplex | Browse + direct MP4 | Flag ENABLE_FARSIPLEX |
| namakade | Optional | Often off |
| iptv | External manifest proxy | Last in list |

Empty `*_BASEURL` = provider off for streams.

---

## 3. Catalogs

- Search-only Iranian provider catalogs (`{key}_movies` / `_series`, search required)
- Browse: f2turkish_series, farsiplex_movies/series (flagged)
- External proxied: 101, Anime, IPTV Bridge (FA name translation + order)

**ID pattern:** `ip{provider}___{itemId}` (+ season/episode for streams). Also tt / tmdb: / kitsu: / farsiplex: / iptv:.

**Title matching for streams** against Cinemeta items is a risk area — confidence threshold required in rewrite.

---

## 4. Metadata

- Primary: Cinemeta via IMDb when available
- Optional TMDB FA enrichment (not required for streams)
- Provider-native meta when chosen
- Never fabricate title/year/poster

---

## 5. Security notes from reference

- `/c/` config can embed secrets — UI warns
- TMDB image proxy path validation present
- In-memory caches; Worker timeout soft-limits
- Sensitive key redaction helpers exist in lib/security.js (reference)

---

## 6. Tests gap

Unit tests for some providers/utils exist; limited live fixtures; no independent Nuvio suite; no full E2E automation against production.

---

## 7. Unknowns

See `docs/UNKNOWNS.md`.

---

## Summary for architecture

Monolithic Express + mirrored Worker; search-first Iranian providers; optional browse + external catalogs; Cinemeta-first meta; personalised manifests; multi-runtime. Rewrite treats this as **behavioural requirements only**.
