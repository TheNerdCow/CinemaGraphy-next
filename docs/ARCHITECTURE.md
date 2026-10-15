# CinemaGraphy — Independent Architecture (Stage 1)

**Date:** 2026-10-15  
**Status:** Design approved for implementation planning — **no production deploy**  
**Principle:** Clean-room, modular, configurable by feature flags and user manifest. Reference behaviour from Stage 0 audit only; **no code ported**.

---

## 1. Goals that drive structure

| Goal | Architectural consequence |
|------|---------------------------|
| Change anything without dirtying core | Strict layers: Core ← Providers ← Clients ← Runtimes ← Web |
| Some users want **sources only, no catalogs** | First-class **Addon Modes**: `full` \| `streams` \| `catalogs` \| custom resource mask |
| Extensive personalization | Typed **Config** object (server env + optional user overlay); every provider/catalog/meta/external is toggleable |
| No mandatory API keys | Meta pipeline: Cinemeta → optional public fallbacks → controlled empty; TMDB never required for streams |
| Multi-runtime | Business logic only in Core + Providers; thin runtime adapters |
| Safe evolution | One provider = one package-like module; registry by key; fail-open isolation |

---

## 2. Layer model

```
┌─────────────────────────────────────────────────────────┐
│  Web (landing, configure, guide) — HTML/CSS/light JS    │
├─────────────────────────────────────────────────────────┤
│  Runtime adapters: Node (Express) | Cloudflare Worker   │
│                    | Docker entry | (Vercel if viable)  │
├─────────────────────────────────────────────────────────┤
│  Client adapters: StremioAdapter | NuvioAdapter         │
│  (manifest shape, id encoding, response mapping)        │
├─────────────────────────────────────────────────────────┤
│  Providers (one module each) + ProviderRegistry         │
├─────────────────────────────────────────────────────────┤
│  Core: models, ids, cache, http policy, meta, matching, │
│        config, logging, errors, concurrency             │
└─────────────────────────────────────────────────────────┘
```

**Rules**

- Providers never import Express, Wrangler, or HTML templates.
- Clients never scrape websites.
- Runtimes never contain title-matching or quality-sort business rules.
- Web never calls providers directly; it only builds install URLs / displays status from a status port.

---

## 3. Core responsibilities

### 3.1 Models (internal, client-agnostic)

- `CatalogDescriptor` — id, type, name, extras (search/skip/genre), pageSize, sourceKey
- `CatalogItem` — internalId, type, title, year?, poster?, providerKey?, externalRefs?
- `MetaRecord` — id, type, name, description, poster, background, genres, videos[], idLinks
- `StreamOffer` — url | externalUrl, title, quality?, size?, audio?, subtitles?, providerKey, diagnostics?
- `ProviderError` — code, providerKey, retriable, message (safe for logs)

### 3.2 Identity

- **Internal stable id:** namespaced, never guess IMDb/TMDB.
  - Pattern proposal: `cg:{providerKey}:{opaqueItemId}` for provider-native items.
  - Client adapters map to Stremio-style `ip…___…` / `tt…` / `tmdb:…` / `farsiplex:…` as needed for compatibility.
- Collision prevention: provider key is mandatory namespace.
- Title-only stream resolution uses explicit **MatchScore** with threshold; below threshold → no stream (no wrong attachment).

### 3.3 Config (personalization spine)

Single typed config, merge order:

1. Server environment (defaults + secrets)
2. Optional user overlay (from secure token later; short-term base64 config path with **redaction warnings**)
3. Request-level flags only if already decoded safely

**Feature flags (examples)**

| Flag / field | Effect |
|--------------|--------|
| `mode` | `full` \| `streams` \| `catalogs` |
| `resources.catalog` | bool |
| `resources.meta` | bool |
| `resources.stream` | bool |
| `resources.subtitles` | bool |
| `providers.enabled[]` | allow-list; empty = all server-enabled |
| `providers.{key}.baseUrl` | per-user override when allowed |
| `catalogs.external[]` | manifest URLs + enable |
| `catalogs.browse.{farsiplex\|f2turkish\|…}` | bool |
| `meta.lang` | `fa` \| `en` |
| `ui.lang` | `fa` \| `en` |
| `meta.tmdbKey` | optional; never required |
| `timeouts.providerMs` | number |
| `nameSuffix` | string for addon list |

**Streams-only users:** `mode=streams` → manifest resources omit catalog (or empty catalogs), keep stream (+ optional meta for resolution). Addon id/name suffix distinguishes installs (parity with reference behaviour).

### 3.4 Cache, HTTP, concurrency

- Interface `CacheStore`: get/set/delete with TTL (memory impl first; KV later behind same interface).
- Interface `HttpClient`: get/text/json with timeout, redirect limit, size limit, **SSRF guard** (block private/link-local/metadata IPs, non-http(s)).
- `ConcurrencyLimiter` per provider key.
- Provider failure never fails the whole response; aggregate partial results.

### 3.5 Meta strategy (Core service)

1. If client id resolves to IMDb → Cinemeta  
2. Else provider-native meta if provider supports it  
3. Optional public fallbacks only when policy allows and data is real  
4. Never invent title/year/poster  

Documented in `docs/METADATA_STRATEGY.md` at implementation time.

---

## 4. Provider adapters

### Contract (every provider)

```ts
interface Provider {
  readonly key: string           // stable slug: f2media, cinamatic, ...
  readonly capabilities: {
    search: boolean
    browseCatalogs: CatalogDescriptor[]  // may be empty
    streams: boolean
    providerMeta: boolean
    auth?: 'none' | 'cookie' | 'login'
  }
  isEnabled(config: AppConfig): boolean
  search(query: string, ctx: RequestContext): Promise<CatalogItem[]>
  listCatalog?(catalogId: string, extras: Extras, ctx): Promise<CatalogItem[]>
  getDetail(itemId: string, type: ContentType, ctx): Promise<DetailData | null>
  getStreams(detail: DetailData, videoRef: VideoRef, ctx): Promise<StreamOffer[]>
  resolveExternalId?(detail: DetailData): { imdb?: string } | null
}
```

- One file (or folder) per provider under `src/providers/{key}/`.
- Shared HTML helpers in `src/providers/_shared/` only if generic (timeout HTML fetch, entity decode) — **no site-specific selectors in shared**.
- Registry: `ProviderRegistry.register(provider)`; Core iterates enabled only.
- Disabled / missing baseUrl → not registered for that request config.
- VIP providers: capabilities.auth set; secrets only from server env or explicit user overlay with UI warning.

### Initial provider set (implementation order)

1. **f2media** (highest live default value)  
2. **farsiplex** (real browse catalogs + direct MP4 — good modularity showcase)  
3. **cinamatic**, **donyayeserial**, **animex**  
4. Others after fixture tests prove structure  
5. External catalog proxy as a special “provider” of type `external-manifest`

SerialBlog / dead hosts: implement only after live probe; otherwise mark NOT IMPLEMENTED.

---

## 5. Client adapters

### StremioAdapter

- Build manifest from `AppConfig` + registry capabilities  
- Map internal ids ↔ Stremio path ids  
- Shape catalog/meta/stream/subtitles JSON  
- `behaviorHints.configurable`, resource list driven by mode flags  

### NuvioAdapter

- Separate module; **do not assume identical** to Stremio until Stage 2 contract check  
- Own fixtures under `tests/clients/nuvio/`  
- Until verified: may share transport but must have explicit mapping table documented  

Both adapters receive Core services via dependency injection; they do not construct providers.

---

## 6. Runtime adapters

| Runtime | Role |
|---------|------|
| `runtimes/node` | Express routes → Client adapters; static/web pages; optional admin + rate limit |
| `runtimes/cloudflare` | Fetch handler; same route map; Workers-compatible HttpClient/Cache |
| `runtimes/docker` | Node image, non-root, healthcheck, env-only secrets |
| Vercel | **Investigate only**; if scrape fan-out or duration fails policy → document as unsupported |

Shared: path parsing (`/manifest.json`, `/catalog/...`, `/meta/...`, `/stream/...`, `/c/:config/...`, `/configure`, `/guide`).

---

## 7. Web frontend

- Server-rendered HTML (or minimal static) from `src/web/`  
- **No heavy SPA framework** unless a measured need appears  
- Pages: home, configure, guide, (optional status)  
- Configure UI must expose:
  - Mode: full / streams-only / catalogs-only  
  - Per-provider enable  
  - Browse catalog toggles  
  - External catalog URL slots  
  - Meta language, UI language  
  - Optional TMDB key  
  - Timeouts / name suffix  
  - Clear security warning for shareable config links  
- Mobile-first, real RTL, `prefers-reduced-motion`, no fake counters  

Visual identity: dark cinematic glass — **reimplemented**, not pasted CSS from reference.

---

## 8. Personalization depth (product requirement)

Users must be able to:

1. Install **streams-only** (sources) without Iranian search catalogs in the list  
2. Install **catalog-heavy** without some stream providers  
3. Enable only FarsiPlex + Cinemeta-style meta  
4. Add external 101/anime/IPTV without touching Iranian providers  
5. Run without any TMDB key  
6. Override timeouts and display name  

Implementation path for config transport:

- **Phase A:** base64url JSON in path (compatibility with current user habits) + aggressive warnings + allow-list of keys  
- **Phase B (preferred):** opaque short token → server-side config store (KV/Redis/file) so secrets never sit in URLs  

Architecture must not hard-code Phase A as the only option; ConfigLoader interface allows both.

---

## 9. Security baseline

- SSRF guard on all server-side HTTP  
- No open “fetch any URL” public endpoint  
- Redirect validation  
- Response size + timeout limits  
- Secret redaction in logs  
- Provider isolation  
- VIP cookies not on public default Worker env  

---

## 10. Repository layout (new empty repo)

```
src/
  core/
    models/
    config/
    ids/
    meta/
    cache/
    http/
    match/
    logging/
  providers/
    _shared/
    f2media/
    farsiplex/
    cinamatic/
    ...
    external/
  clients/
    stremio/
    nuvio/
  runtimes/
    node/
    cloudflare/
    shared/
  web/
tests/
  unit/
  integration/
  clients/stremio/
  clients/nuvio/
  providers/
docs/
  REFERENCE_AUDIT.md
  FEATURE_PARITY.md
  ARCHITECTURE.md
  METADATA_STRATEGY.md
  DEPLOYMENT_MATRIX.md
  PROGRESS.md
.env.example
Dockerfile
package.json
```

Only create files when they have real content — no empty shells for “completeness”.

---

## 11. Implementation order (after this architecture is accepted)

1. **Scaffold** new repo: package.json, core models + config + http SSRF + cache memory  
2. **StremioAdapter** minimal: empty/full manifest from config modes (streams-only vs full)  
3. **One provider** (f2media) with fixtures + unit tests  
4. **E2E path:** install → search catalog → meta → stream (fixture first)  
5. **Configure + landing** web pages (mode toggles)  
6. **Node runtime** smoke  
7. **Cloudflare** adapter smoke  
8. Next providers one-by-one with parity rows updated  
9. Nuvio adapter when contract evidence exists  
10. External catalogs as optional module  

**Production reference stays untouched** until parity matrix shows Essential rows PASS with tests.

---

## 12. Success criteria for modularity

- Add a provider without editing Core or Client files (only registry entry).  
- Switch user to streams-only by config alone (no code branch spaghetti).  
- Disable all external catalogs without breaking Iranian streams.  
- Replace CacheStore memory → KV without provider changes.  
- Run tests for one provider offline via fixtures.

---

## 13. Explicit non-goals (this rewrite)

- Copying functions/classes from TheNerdCow/CinemaGraphy  
- Replacing live cmplugin.ir without owner sign-off + rollback plan  
- Claiming Nuvio parity without independent tests  
- Fabricating metadata or stream URLs  
- Circumventing CAPTCHA/login walls  
