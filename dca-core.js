/* DCA suggestion: where the latest PE sits within the last 365 days of valid PE values.
   Tier boundaries are the same 1Y P20/P50/P80 dashed lines drawn on the PE charts.
   evaluate() is pure; panel() returns HTML for the PE pages (no amounts, only a % of the normal DCA). */
(function (root) {
'use strict';
// Linear-interpolated percentile (numpy 'linear'), identical to pe.js / bnb-pe.js.
const pct = (vals, q) => { const v = vals.filter(Number.isFinite).sort((a, b) => a - b); if (!v.length) return null; const i = (v.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return v[lo] + (v[hi] - v[lo]) * (i - lo); };

// Ordered low -> high PE, one tier per 10 percentile points (80–100 is one tier).
// ratio = suggested % of the normal DCA amount; ink = badge text colour (white where dark text lacks contrast).
const TIERS = [
  { key: 't300', ratio: 300, color: '#16A34A', ink: '#0b1f1b', range: ['0–10 分位', 'P0–P10'], action: ['三倍定投', 'Triple DCA'] },
  { key: 't200', ratio: 200, color: '#22C55E', ink: '#0b1f1b', range: ['10–20 分位', 'P10–P20'], action: ['加倍定投', 'Double DCA'] },
  { key: 't150', ratio: 150, color: '#4ADE80', ink: '#0b1f1b', range: ['20–30 分位', 'P20–P30'], action: ['1.5 倍定投', '1.5× DCA'] },
  { key: 't125', ratio: 125, color: '#A3E635', ink: '#0b1f1b', range: ['30–40 分位', 'P30–P40'], action: ['小幅加码', 'Slightly more'] },
  { key: 't100', ratio: 100, color: '#FACC15', ink: '#0b1f1b', range: ['40–50 分位', 'P40–P50'], action: ['正常定投', 'Normal DCA'] },
  { key: 't75', ratio: 75, color: '#FBBF24', ink: '#0b1f1b', range: ['50–60 分位', 'P50–P60'], action: ['小幅减少', 'Slightly less'] },
  { key: 't50', ratio: 50, color: '#FB923C', ink: '#0b1f1b', range: ['60–70 分位', 'P60–P70'], action: ['减半定投', 'Half DCA'] },
  { key: 't25', ratio: 25, color: '#F87171', ink: '#0b1f1b', range: ['70–80 分位', 'P70–P80'], action: ['少量定投', 'Quarter DCA'] },
  { key: 't0', ratio: 0, color: '#DC2626', ink: '#ffffff', range: ['80–100 分位', 'P80–P100'], action: ['停止定投', 'Pause DCA'] },
];
// Rank 0-100 -> tier index. Lower bound inclusive, so rank 10 is already the 10–20 tier; ≥80 is one tier.
const tierIndex = rank => rank >= 80 ? 8 : Math.max(0, Math.floor(rank / 10));
// Meter background: same colours and boundaries as TIERS.
const gradient = () => 'linear-gradient(90deg,' + TIERS.map((t, i) => `${t.color} ${i * 10}% ${i === 8 ? 100 : (i + 1) * 10}%`).join(',') + ')';

// rows: [{date, <field>}...] in date order. win = number of trailing rows (default 365, same window as the chart bands); 0 = all rows.
function evaluate(rows, field, win = 365) {
  const year = win ? rows.slice(-win) : rows, vals = year.map(r => r[field]).filter(Number.isFinite);
  const latest = [...rows].reverse().find(r => Number.isFinite(r[field]));
  if (!latest || vals.length < 2) return null;
  const pe = latest[field];
  // Rank: share of the window strictly below the current value (0-100). Tier follows the rank so colour and number agree.
  const rank = 100 * vals.filter(v => v < pe).length / vals.length;
  const tier = TIERS[tierIndex(rank)];
  const from = year.find(r => Number.isFinite(r[field]))?.date;
  return { date: latest.date, from, pe, p20: pct(vals, 0.2), p50: pct(vals, 0.5), p80: pct(vals, 0.8), rank, tier, n: vals.length };
}

// HTML for the in-page DCA panel. bi(zh, en) picks the current language.
// Percentile window shared by the overview and every coin page (same localStorage key): 365 = last 1 year, 0 = all bundled history.
const WIN_KEY = 'pe-list-window';
// store = the page's localStorage (passed in so pages and tests use their own).
function getWin(store = root.localStorage) { try { return store?.getItem(WIN_KEY) === 'all' ? 0 : 365; } catch { return 365; } }
function setWin(win, store = root.localStorage) { try { store?.setItem(WIN_KEY, win ? '1y' : 'all'); } catch {} return win ? 365 : 0; }
// Rows used for the percentile and the chart's P20/P50/P80 bands.
const windowRows = (rows, win) => win ? rows.slice(-win) : rows;
const winLabel = (win, bi) => win ? bi('近1年', '1Y') : bi('全部', 'All-time');
// Toggle markup; pages delegate clicks on [data-dca-win] (see bindToggle).
function toggle(win, bi) {
  return `<span class="range-tabs dca-win" role="group" aria-label="${bi('分位区间', 'Percentile window')}">` + [[365, bi('近1年分位', '1Y percentile')], [0, bi('全部分位', 'All-time percentile')]]
    .map(([w, l]) => `<button type="button" data-dca-win="${w}"${w === win ? ' class="active"' : ''} aria-pressed="${w === win}">${l}</button>`).join('') + '</span>';
}
// Click delegation on a container; onChange(win) re-renders the page.
function bindToggle(el, onChange, store = root.localStorage) {
  if (!el?.addEventListener) return;
  el.addEventListener('click', e => { const b = e.target.closest?.('[data-dca-win]'); if (b) onChange(setWin(+b.dataset.dcaWin, store)); });
}

function panel(rows, field, bi, win = 365) {
  const r = evaluate(rows, field, win);
  const f = n => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const head = '<div class="dca-head"><h3>' + bi('DCA 定投建议', 'DCA suggestion') + '</h3>' + toggle(win, bi) + '</div>';
  const lab = win ? bi('近1年分位', '1Y percentile') : bi('全部分位', 'All-time percentile');
  if (!r) return head + '<p class="pe-muted">' + bi('有效 PE 不足，暂无建议', 'Not enough valid PE for a suggestion') + '</p>';
  const t = r.tier, pos = Math.max(0, Math.min(100, r.rank));
  const rules = TIERS.map(x => `<li style="--c:${x.color}"${x === t ? ' class="on"' : ''}>${bi(x.range[0], x.range[1])} · ${x.ratio}% · ${bi(x.action[0], x.action[1])}</li>`).join('');
  return head + `<div class="dca-body" style="--tier:${t.color};--ink:${t.ink}">
    <div class="dca-main"><span class="dca-ratio">${t.ratio}%</span><span class="dca-badge">${bi(t.action[0], t.action[1])}</span></div>
    <p class="pe-muted">${bi('建议本期定投 = 平时定投金额 × ', 'This period = your usual DCA amount × ')}${t.ratio}%</p>
    <div class="dca-meter" style="background:${gradient()}" role="img" aria-label="${lab} ${Math.round(r.rank)}%"><i style="left:${pos}%"></i></div>
    <div class="dca-scale" aria-hidden="true">${[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(v => `<span style="left:${v}%">${v}</span>`).join('')}</div>
    <p class="dca-metrics"><span>${bi('当前 PE ', 'Current PE ')}${f(r.pe)} x</span> · <span>${lab} ${Math.round(r.rank)}%</span> · <span>P20/P50/P80 ${f(r.p20)} / ${f(r.p50)} / ${f(r.p80)} x</span> · <span>${bi('样本 ', 'sample ')}${r.from} – ${r.date} · ${r.n}${bi(' 个有效日', ' valid days')}</span></p>
    <ul class="dca-rules">${rules}</ul>
    <p class="pe-muted dca-note">${win ? bi('分位 = 近 365 日有效 PE 中低于当前值的天数占比，与上图虚线同口径。', 'Percentile = share of valid days in the last 365 with PE below the current value, same basis as the dashed lines on the chart. ') : bi('分位 = 本站已存全部日期的有效 PE 中低于当前值的天数占比，与上图虚线同口径。', 'Percentile = share of all valid days stored on this site with PE below the current value, same basis as the dashed lines on the chart. ')}${bi('仅供研究，不是投资建议。', 'Research only, not investment advice.')}</p>
  </div>`;
}

const api = { pct, TIERS, tierIndex, gradient, evaluate, panel, getWin, setWin, windowRows, winLabel, toggle, bindToggle, WIN_KEY };
if (typeof module !== 'undefined') module.exports = api; else root.DCACore = api;
})(globalThis);
