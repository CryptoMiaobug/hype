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
