# HYPE income sources — 2026-10-08

Presentation-only extension after UNI commit 27b7e88 (clean shared tracked files on entry; no concurrent edits observed). Session messaging tools unavailable; reused completed committed framework serially. Original pe-core.js, both original seed JSONs, PE calculations, table/CSV and semantic line colors unchanged.

## Data and accounting
Supplement pe-data/hype-sources.json: public DefiLlama /summary/fees/hyperliquid?dataType=dailyHoldersRevenue, raw nested component observations, fetchedAt/source/cutoff included; cutoff 2026-10-07 UTC. Two groups: Hyperliquid Perps and Hyperliquid Spot Orderbook, from Hyperliquid L1. Child API methodology confirms perps comprises trading buyback allocations, priority fees burn value and AQAv2 yield; spot comprises spot buyback allocations and HIP-1 auction burn value. Not pure trading fees or verified actual executed buybacks; no extra HIP-3 sum. hasLabelBreakdown and methodology labels do not alone prove five daily series.

649 overlapping historical raw revenue days match to $0.01, zero differences. Differences on subsequent revisions displayed explicitly (breakdown minus immutable valuation input), never scaled or written into historical inputs. Missing/invalid/negative/string values remain NA; explicit zero remains zero; unexpected components invalidate total rather than being silently dropped. Available individual components may still display on incomplete days.

Two lower-grid stacked bars, linked UTC axes, 30/90/all ranges. Scrollable bilingual tooltip includes original daily total, both components, same-day breakdown total and signed difference. Latest-30 panel ends at device UTC yesterday regardless of chart range; counts only days with both valid groups and reports coverage. Zero denominator -> NA share. Incomplete window is explicitly not a full 30-day total.

Snapshot first, browser-only localStorage source cache second, successful API revisions last (presentation only). One existing DefiLlama response reused for valuation gaps/source gaps; no duplicate request. Clear source cache leaves valuation and UNI caches untouched. Offline fallback and bilingual status retained. No server writes, cron, new dependencies or credentials.

## Validation / deployment
node test-pe-sources.cjs covers aggregate validation, unknown components, missing vs zero, duplicate/future UTC dates, 30-day coverage, reconciliation/difference, single API response, cache/clear/offline, language changes, ranges and untouched historical curves. test-pe-i18n.cjs now loads actual HYPE source module/snapshot as well as UNI; both locales, switch/no requests/range preservation/blocked storage/429 tested. All preexisting PE, chain, site-language and counter suites rerun.

Real browser available/CDP ready, but opening public hype-pe.html returned "browser navigation blocked by policy"; no bypass. Desktop/mobile appearance, touch and real browser CORS not visually accepted. DOM/ECharts-option and HTTP checks are not visual acceptance.

Only explicit task files staged. Existing untracked .gitignore excluded. Shared JS/i18n resource versions on both PE pages advanced to 20261008sources; UNI chain module unchanged. Language autodetection/manual preference, GoatCounter and footer preserved. Commit/push/online byte-match outcome in execution handoff.
