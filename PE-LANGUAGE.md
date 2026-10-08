# PE bilingual presentation (2026-10-08)

Both PE pages reuse `i18n.js`, its CN/EN topbar switcher, `hs_lang` preference and system-language default. `pe-i18n.js` extends the existing dictionary for static PE content and translates dynamic presentation strings; it does not change `pe-core.js`, seed JSON, supply assumptions, cache keys or API requests. Navigation uses the existing `nav.*` tags.

`window.onI18nChange` redraws current rows with the selected range, translates chart accessibility labels and loading/error counter states, and leaves ready visitor counts intact. A language change performs no fetches. ECharts options are replaced to avoid stale translated series names. CSV column names and stored source/status identifiers remain the original machine-readable schema; table presentation is translated.

English methodology explicitly distinguishes HYPE holders-revenue proxy from UNI burn-value proxy; neither is described as verified actual buybacks. Full source links and all limitations remain available in both languages. Each page retains one existing GoatCounter tracking script plus the display-only visitor counter.

Validation:
- `node --check pe.js && node --check pe-i18n.js`
- `node test-pe.cjs`: 13 calculation tests and 4 UI smoke scenarios.
- `node test-pe-chart.cjs`: both assets, daily bars/zero/gaps, distinct colors, linked UTC axes, ranges, frozen data and API increments.
- `node test-pe-i18n.cjs`: both initial languages, system defaults, cross-page persistence, all static/dynamic text, ARIA, tooltips, table status, rate limits, unchanged values/range and zero requests on switching, visitor ready/error states, one tracker.
- `node test-visit-counter.cjs`: unchanged shared counters, live public endpoint HTTP 200 and CORS `*`.

Limits: these are VM/DOM-contract tests, not full browser rendering. OpenClaw browser navigation to the live PE page was blocked by policy; no workaround was attempted. Actual desktop/mobile visual layout, touch interaction and browser CORS need manual acceptance. GitHub CLI Pages metadata lookup returned HTTP 401; deployment is checked separately using public HTTPS resources after push.

## Site-wide browser-language hardening (2026-10-08)

Published entry inventory: `/` (same as `/index.html`), `/valuation.html`,
`/hype-pe.html`, `/uni-pe.html`, `/battlefield/` (same as
`/battlefield/index.html`). No other HTML entries are present in this Pages tree.
All use the same `i18n.js` and `hs_lang` key. Only stored `zh`/`en` count as a
manual choice; otherwise `/^zh(?:[-_]|$)/i` on `navigator.language` selects
Chinese (including traditional-Chinese locale tags), everything else including
missing language selects English. Automatic detection never writes storage.
Storage read/write exceptions no longer prevent initialization or switching.
When storage is blocked, switching works in memory; persistence across navigation
cannot be guaranteed without browser storage. Chinese UI remains the existing
simplified-Chinese translation, including for traditional-Chinese system locales.
Legacy valuation `?hl=` links no longer override the viewer's language.

Both PE pages now include explicit CN/EN controls in HTML; shared initialization
binds those controls instead of creating duplicates. Small-screen CSS keeps the
controls with the logo on the first row, navigation below. Both pages' language,
PE JS and CSS URLs have fresh cache versions. Other entry points' shared language
URLs are versioned too. Data and formulas are untouched.

Investigation: the previous bilingual task was already completed at d54e241 and
live HYPE HTML already loaded bilingual assets when this task began. Therefore a
HYPE-only missing switch could not be reproduced visually or definitively blamed
on stale cache. Verified defects were unguarded localStorage access (could abort
before mounting controls), acceptance of invalid stored language, overly broad
`startsWith('zh')`, and differing/unversioned language assets across pages.

Battlefield deployment inspected: `hyper-battlefield/deploy.sh` builds Vite and
copies dist into this repository. Its published HTML already references the shared
`../i18n.js`, and its UI/ChatRoom code uses I18n rendering hooks. Only the published
HTML cache URL was adjusted; no rebuild, external source changes, deployment script
execution, data/websocket changes or asset replacement were needed. Future full
battlefield rebuilds may remove that URL cache version; the shared language logic
still resides here, but maintainers should retain/reapply versioning on rebuild.

Additional validation: `node test-site-language.cjs` exercises all five entry
contracts for zh-CN/TW/HK/Hans/Hant, en/ja/fr, missing/invalid language, manual
preference, invalid/blocked storage, auto-not-persisted, real switch event binding
and cross-page preference. `test-pe-i18n.cjs` additionally exercises actual PE
static/dynamic rendering for the locale and denied-storage matrix, with no added
requests on switching. Existing calculations and chart/range regressions pass.
These are VM/DOM-contract tests, NOT visual browser acceptance. Browser tool
navigation was again explicitly blocked by policy; no bypass was attempted.
Battlefield WebGL/chat/audio and mobile/desktop appearance were not visually tested.
