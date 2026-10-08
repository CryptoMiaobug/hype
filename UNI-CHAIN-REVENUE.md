# UNI dailyRevenue chain breakdown — 2026-10-08

## Scope and provenance
- Presentation-only UNI change: six stacked bar series (Ethereum, Arbitrum, Robinhood Chain, Base, Polygon, Others), independent lower USD axis, linked UTC pointers and 30/90/all categories. Original three curves, seven-column valuation table, CSV, price/market cap/supply/PE algorithms and original `pe-data/uni.json` remain unchanged. HYPE does not load the chain module or snapshot.
- Supplement `pe-data/uni-chains.json`: DefiLlama `/summary/fees/uniswap?dataType=dailyRevenue`, fetched 2026-10-08T08:00:59.794214+00:00, cutoff 2026-10-07 UTC. Raw nested chain/version observations retained (1117 days). Not dailyFees, executed burns, or Robinhood company revenue.
- Sum numeric nonnegative versions within each reported chain. Empty/invalid/null/negative values => NA, explicit zero stays zero. Missing chain keys are not asserted zero. Others sums reported non-main chains; any invalid member makes that group NA. Daily reported total is NA if any reported chain is invalid; absent chains are not inferred. Bars can still display valid individual chains on such days.
- Snapshot reconciliation against original raw revenue: 1084 matching days, 32 differing days (comparison tolerance $0.01; UI shows actual signed difference, no normalization). Historical revisions are NOT pushed into valuation inputs. Tooltip explicitly shows original valuation-proxy revenue, reported chain total, signed difference, individual chains/percentages (including zero), and missing main-chain NA. Long tooltips scroll and accept pointer entry.

## 30-day panel and cache
- Window always ends at device UTC yesterday, not the selected chart range or last available row. The panel lists ALL reported chains separately, observed USD, share and per-chain coverage /30. Snapshot has 30/30 valid reported-day coverage ending 2026-10-07.
- Aggregation includes only days with a valid reported total. Per-chain coverage counts only valid observations on those days. An absent key never becomes zero; shares describe reported amounts, NOT certified full economic coverage. Zero denominator gives NA percentages. Missing days are explicitly counted, not extrapolated. Range filters affect both chart grids; the panel remains the explicitly labelled latest 30 UTC days.
- Browser cache `hypevalue-uni-chains-v1` stores raw breakdown observations + fetch time in localStorage only. Snapshot first, validated cache second, successful newer API observations last. Revision precedence applies ONLY to chain presentation. No server writes. Source metadata is shown in both languages. The clear-chain-cache button restores snapshot without deleting valuation caches.
- Missing chain days OR valuation gaps trigger the existing single dailyRevenue request, reused for both purposes; no duplicate DefiLlama request. CoinGecko requested only for existing valuation gaps. 25s timeout, no retry loops, failure retains snapshot/cache with visible translated state. Complete chain/valuation coverage does not cause gratuitous API requests.

## Validation and limits
- `node --check pe.js`, `pe-chains.js`, `pe-i18n.js`.
- `node test-pe-chains.cjs`: validation, zero/null/negative, version aggregation, UTC future exclusion, duplicate dates, observed-only completeness, snapshot differences, original curves unchanged, 30/90/all, single API response, cache/clear/fallback, bilingual redraw.
- `node test-pe-i18n.cjs` now actually loads the chain module/snapshot for UNI: EN/CN static and dynamic chain UI, language switching without requests, range preserved, offline/429, storage denied, locale matrix. HYPE unchanged.
- Existing `test-pe.cjs`, `test-pe-chart.cjs` (legacy fallback/HYPE), `test-site-language.cjs`, `test-visit-counter.cjs` pass. `git diff --check` passes.
- Real browser is running/CDP ready; tool navigation to public UNI page returned `browser navigation blocked by policy`. No bypass attempted. Desktop/mobile rendering, touch/scroll UX and actual browser CORS remain **not visually verified**. VM/DOM/ECharts-option tests and HTTP deployment checks are not visual acceptance.

## Deployment
- Existing `main` GitHub Pages flow, explicit task-file staging only. Existing untracked `.gitignore` excluded. No remote URL/credential inspection or auth modifications.
- Both PE pages use `pe.js` and `pe-i18n.js` version `20261008chains`; UNI alone loads `pe-chains.js?v=20261008chains`. Existing CSS, language defaults/manual preferences and GoatCounter retained.
- Commit/push and public HTTPS byte-match results are reported by the execution handoff.
