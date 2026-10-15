# Progress checkpoint

**Updated:** 2026-10-15

## Completed

- [x] Stage 0 — REFERENCE_AUDIT.md  
- [x] Stage 0 — FEATURE_PARITY.md  
- [x] Stage 0 — UNKNOWNS.md  
- [x] Stage 1 — ARCHITECTURE.md (modular, streams-only mode, deep personalization)
- [x] GitHub repo created: TheNerdCow/CinemaGraphy-next (independent, private)

## In progress / next

- [ ] Scaffold package.json + Core (models, AppConfig, modes, HttpClient+SSRF, memory Cache)  
- [ ] StremioAdapter: manifest for full vs streams-only  
- [ ] Provider #1 (f2media) + fixtures  
- [ ] Node runtime smoke  
- [ ] Web: configure page with mode + provider toggles  

## Hard rules still in force

- No changes to live cmplugin.ir / production master (TheNerdCow/CinemaGraphy)  
- No code copied from reference implementation  
- No deployment to production  
- Secrets never committed  

## Repos

| Repo | Role |
|------|------|
| https://github.com/TheNerdCow/CinemaGraphy | Production / reference (do not break) |
| https://github.com/TheNerdCow/CinemaGraphy-next | Independent rewrite (this project) |
