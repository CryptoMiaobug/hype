/* DCA suggestion: where the latest PE sits within the last 365 days of valid PE values.
   Tier boundaries are the same 1Y P20/P50/P80 dashed lines drawn on the PE charts.
   evaluate() is pure; panel() returns HTML for the PE pages (no amounts, only a % of the normal DCA). */
(function (root) {
'use strict';
// Linear-interpolated percentile (numpy 'linear'), identical to pe.js / bnb-pe.js.
const pct = (vals, q) => { const v = vals.filter(Number.isFinite).sort((a, b) => a - b); if (!v.length) return null; const i = (v.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return v[lo] + (v[hi] - v[lo]) * (i - lo); };

// Ordered low -> high PE. ratio = suggested % of the normal DCA amount.
const TIERS = [
  { key: 'green', ratio: 200, color: '#4ADE80', range: ['低于 20 分位', 'Below P20'], action: ['加倍定投', 'Double DCA'] },
  { key: 'yellow', ratio: 100, color: '#FACC15', range: ['20–50 分位', 'P20–P50'], action: ['正常定投', 'Normal DCA'] },
  { key: 'orange', ratio: 50, color: '#FB923C', range: ['50–80 分位', 'P50–P80'], action: ['减半定投', 'Half DCA'] },
  { key: 'red', ratio: 0, color: '#F87171', range: ['高于 80 分位', 'Above P80'], action: ['停止定投', 'Pause DCA'] },
];

// rows: [{date, <field>}...] in date order. Uses the last 365 rows (same window as the chart bands).
function evaluate(rows, field) {
  const year = rows.slice(-365), vals = year.map(r => r[field]).filter(Number.isFinite);
  const latest = [...rows].reverse().find(r => Number.isFinite(r[field]));
  if (!latest || vals.length < 2) return null;
  const pe = latest[field];
  // Rank: share of the window strictly below the current value (0-100). Tier follows the rank so colour and number agree.
  const rank = 100 * vals.filter(v => v < pe).length / vals.length;
  const tier = TIERS[rank < 20 ? 0 : rank < 50 ? 1 : rank < 80 ? 2 : 3];
  return { date: latest.date, pe, p20: pct(vals, 0.2), p50: pct(vals, 0.5), p80: pct(vals, 0.8), rank, tier, n: vals.length };
}

// HTML for the in-page DCA panel. bi(zh, en) picks the current language.
function panel(rows, field, bi) {
  const r = evaluate(rows, field);
  const f = n => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const head = '<h3>' + bi('DCA 定投建议', 'DCA suggestion') + '</h3>';
  if (!r) return head + '<p class="pe-muted">' + bi('有效 PE 不足，暂无建议', 'Not enough valid PE for a suggestion') + '</p>';
  const t = r.tier, pos = Math.max(0, Math.min(100, r.rank));
  const rules = TIERS.map(x => `<li style="--c:${x.color}"${x === t ? ' class="on"' : ''}>${bi(x.range[0], x.range[1])} · ${x.ratio}% · ${bi(x.action[0], x.action[1])}</li>`).join('');
  return head + `<div class="dca-body" style="--tier:${t.color}">
    <div class="dca-main"><span class="dca-ratio">${t.ratio}%</span><span class="dca-badge">${bi(t.action[0], t.action[1])}</span></div>
    <p class="pe-muted">${bi('建议本期定投 = 平时定投金额 × ', 'This period = your usual DCA amount × ')}${t.ratio}%</p>
    <div class="dca-meter" role="img" aria-label="${bi('近1年分位', '1Y percentile')} ${Math.round(r.rank)}%"><i style="left:${pos}%"></i></div>
    <div class="dca-scale" aria-hidden="true"><span>0</span><span>20</span><span>50</span><span>80</span><span>100</span></div>
    <p class="dca-metrics"><span>${bi('当前 PE ', 'Current PE ')}${f(r.pe)} x</span> · <span>${bi('近1年分位 ', '1Y percentile ')}${Math.round(r.rank)}%</span> · <span>P20/P50/P80 ${f(r.p20)} / ${f(r.p50)} / ${f(r.p80)} x</span> · <span>${r.date} UTC</span></p>
    <ul class="dca-rules">${rules}</ul>
    <p class="pe-muted dca-note">${bi('分位 = 近 365 日有效 PE 中低于当前值的天数占比，与上图虚线同口径。仅供研究，不是投资建议。', 'Percentile = share of valid days in the last 365 with PE below the current value, same basis as the dashed lines on the chart. Research only, not investment advice.')}</p>
  </div>`;
}

const api = { pct, TIERS, evaluate, panel };
if (typeof module !== 'undefined') module.exports = api; else root.DCACore = api;
})(globalThis);
