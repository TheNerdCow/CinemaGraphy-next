# CinemaGraphy — Feature Parity Matrix (Stage 0)

**Date:** 2026-10-15  
**Reference:** live cmplugin.ir + GitHub TheNerdCow/CinemaGraphy @ 3.2.20  
**Purpose:** Track required capabilities for the independent rewrite. Status values for the **new** product start as planning states; update only after independent implementation + tests.

Legend for **New product requirement**:

- **Essential** — required before any production migration consideration  
- **Preserve if verified** — keep only if reference behaviour is confirmed useful and maintainable  
- **Optional** — flag-gated or nice-to-have  
- **Do not port** — reject or redesign  

Legend for **Reference status**:

- **Confirmed** — observed in live manifest/UI or clear code path  
- **Partial** — present but conditional / degraded  
- **Needs verification** — claimed or coded; live success unknown  
- **Absent / unclear**

---

## Core Capability Matrix

| قابلیت | وضعیت فعلی (مرجع) | روش تأیید | الزام نسخه جدید |
|--------|-------------------|-----------|-----------------|
| نصب افزونه (manifest) | Confirmed | Live `/manifest.json` + stremioAddonsConfig | Essential |
| کاتالوگ جست‌وجوی هر منبع ایرانی | Confirmed in manifest; streams depend on BASEURL | Compare search results to site; stream play | Essential when source enabled |
| پخش هر منبع | Partial — depends on env + host health | Real stream request + play in Stremio | Essential when source supported |
| Stremio | Confirmed | Independent install + catalog/meta/stream | Essential |
| Nuvio | Claimed; shared protocol assumed | Contract review + independent client tests | Essential (adapter + tests); do not claim parity without evidence |
| صفحه اصلی و راهنما | Confirmed | UI review FA/EN + mobile | Essential |
| تنظیمات و manifest شخصی‌سازی‌شده | Confirmed (`/configure`, `/c/`) | Build config → install → validate | Preserve verified capabilities; redesign secret storage |
| استقرار چندمحیطی (Node, CF Worker, Docker) | Confirmed for Node/CF; Vercel constrained | Build + smoke per runtime | Essential for Node + CF; Docker essential; Vercel only if truly compatible |
| متادیتا بدون API Key اجباری | Partial — Cinemeta works; TMDB FA optional | Run without `TMDB_API_KEY` | Essential (Cinemeta primary) |
| کاتالوگ واقعی از صفحات منبع | Partial — FarsiPlex/F2Turkish browse; most Iranian are search-only | Scrape real list pages vs static lists | Essential for browse catalogs; search-only OK where site has no stable list |
| اتصال Catalog → Meta → Stream با شناسه پایدار | Confirmed pattern (`ip…___…`) | E2E same item | Essential; strict namespacing |
| Proxy تصویر TMDB | Confirmed | Valid path only | Optional; only if technical need |
| کاتالوگ‌های خارجی (101, Anime, IPTV) | Confirmed on live | Proxy + FA labels | Optional; toggleable; not required for base install |
| VIP providers (Digi/Ava cookies) | Needs verification | Authenticated stream test | Optional; personal configure only |
| FarsiPlex Iranian browse + direct MP4 | Confirmed code; flag default off | Enable + list + stream | Optional; high value if stable |
| F2 Turkish series catalog | Confirmed when flag on | List + search | Optional |
| Namakade | Optional / often off | — | Optional or defer |
| Subtitles resource | Declared | Proxy upstream | Preserve if verified |
| Admin panel / rate-limit (Node) | Present in lib | — | Optional for VPS |
| Status probe on landing | Confirmed | Latency/online flags | Preserve only with real probes; no fake counters |

---

## Provider-Level Parity Targets

| Provider | Reference | New product stance |
|----------|-----------|--------------------|
| F2Media | Active default | Essential candidate — reimplement from behaviour |
| PeepBoxTv | In manifest | Implement if BASEURL/API still viable |
| Cinamatic | In manifest | Implement if site structure allows |
| AslMoviez | In manifest | Same |
| SerialBlog | In manifest; thin code | Verify usefulness; drop if dead |
| DigiMovie | VIP | Optional authenticated adapter |
| AvaMovie | VIP | Optional authenticated adapter |
| DonyayeSerial | In manifest | Reimplement; watch domain changes |
| Animex | Search (+ historical catalog) | Stream provider essential if active; catalog optional |
| F2 Turkish | Flag | Optional catalog adapter |
| FarsiPlex | Flag | Optional but priority for real list catalogs |
| IPTV (via Bridge) | External | Optional external catalog adapter |
| Namakade | Optional | Defer unless strong need |

---

## Client Adapter Requirements

| Client | Manifest | Catalog | Meta | Stream | Tests required |
|--------|----------|---------|------|--------|----------------|
| Stremio | Essential | Essential | Essential | Essential | `tests/clients/stremio/` with fixtures |
| Nuvio | Essential once contract verified | Same | Same | Same | `tests/clients/nuvio/`; mark NOT VERIFIED until independent proof |

---

## Metadata Strategy Targets (for Stage 3)

| Priority | Source | Condition |
|----------|--------|-----------|
| 1 | Cinemeta | Valid IMDb id available |
| 2 | Provider-native meta | When provider mode chosen and data complete |
| 3 | Public fallbacks (Kitsu for anime, etc.) | Only when allowed and non-fabricated |
| — | TMDB | Optional enrichment (FA text/posters); never hard-required |
| — | Fabricated titles/posters | **Forbidden** |

---

## Deployment Parity Targets

| Environment | Reference | New product |
|-------------|-----------|-------------|
| Cloudflare Workers | Supported | Essential smoke |
| Node.js local | Supported | Essential |
| Docker / VPS | Documented | Essential |
| Vercel | Historical; currently limited | Investigate; mark unsupported if runtime incompatible |

---

## Security / Safety Parity (non-negotiable for new product)

- No mandatory paid API key for base streams  
- SSRF controls on any server-side fetch/proxy  
- No public open URL fetcher  
- Secrets not logged; prefer not embedding secrets in shareable URLs  
- Provider failure isolation  
- Timeout / concurrency limits  
- No circumvention of CAPTCHA / login walls  

---

## Stage 0 Decision Gates

Before Stage 1 coding:

1. Accept this matrix as the parity contract.  
2. Accept REFERENCE_AUDIT.md unknowns list.  
3. Approve independent architecture doc (Stage 1).  
4. Explicit owner confirmation that production (`cmplugin.ir` / current GitHub master) remains untouched.

**No new implementation code in this stage.**
