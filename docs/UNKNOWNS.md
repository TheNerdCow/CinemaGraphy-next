# Stage 0 — Unknowns and Open Questions

Items that must not be assumed “working” in the new product without independent verification.

1. **Live stream success rates** for each Iranian provider from Cloudflare Worker egress and from outside Iran.
2. **HTML selector stability** of Cinamatic, F2Media, DonyayeSerial, Animex, AslMoviez, PeepBoxTv (sites change frequently).
3. **DigiMovie / AvaMovie** session lifetime and whether cookie-based VIP remains practical without interactive login.
4. **SerialBlog** real usefulness (file is tiny; may be effectively dead).
5. **Nuvio** protocol differences vs Stremio (if any). Official Nuvio docs may be incomplete; needs practical testing.
6. **Third-party catalog manifests** (101, anime catalogs, IPTV Bridge) uptime and ToS for proxying.
7. **FarsiPlex / FarsiLand CDN** long-term stability and access policy.
8. **Vercel** current plan limits and whether long-running scrape + multi-provider fan-out is viable.
9. **Legal/ToS** status of automated access to each origin — document; never claim “all providers work” without tests.
10. **Episode numbering edge cases** (specials, multi-part, Persian season labels) across providers.
11. Whether **title-only matching** for streams against Cinemeta items produces acceptable false-positive rates in practice.
12. Exact behaviour of **subtitle** proxy path under failure of upstream SubSource-style addon.

These become explicit BLOCKED / NOT VERIFIED rows in the parity matrix until resolved.
