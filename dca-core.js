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

// rows: [{date, <field>}...] in date order. Uses the last 365 rows (same window as the chart bands).
function evaluate(rows, field) {
  const year = rows.slice(-365), vals = year.map(r => r[field]).filter(Number.isFinite);
  const latest = [...rows].reverse().find(r => Number.isFinite(r[field]));
  if (!latest || vals.length < 2) return null;
  const pe = latest[field];
  // Rank: share of the window strictly below the current value (0-100). Tier follows the rank so colour and number agree.
  const rank = 100 * vals.filter(v => v < pe).length / vals.length;
  const tier = TIERS[tierIndex(rank)];
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
  return head + `<div class="dca-body" style="--tier:${t.color};--ink:${t.ink}">
    <div class="dca-main"><span class="dca-ratio">${t.ratio}%</span><span class="dca-badge">${bi(t.action[0], t.action[1])}</span></div>
    <p class="pe-muted">${bi('建议本期定投 = 平时定投金额 × ', 'This period = your usual DCA amount × ')}${t.ratio}%</p>
    <div class="dca-meter" style="background:${gradient()}" role="img" aria-label="${bi('近1年分位', '1Y percentile')} ${Math.round(r.rank)}%"><i style="left:${pos}%"></i></div>
    <div class="dca-scale" aria-hidden="true">${[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(v => `<span style="left:${v}%">${v}</span>`).join('')}</div>
    <p class="dca-metrics"><span>${bi('当前 PE ', 'Current PE ')}${f(r.pe)} x</span> · <span>${bi('近1年分位 ', '1Y percentile ')}${Math.round(r.rank)}%</span> · <span>P20/P50/P80 ${f(r.p20)} / ${f(r.p50)} / ${f(r.p80)} x</span> · <span>${r.date} UTC</span></p>
    <ul class="dca-rules">${rules}</ul>
    <p class="pe-muted dca-note">${bi('分位 = 近 365 日有效 PE 中低于当前值的天数占比，与上图虚线同口径。仅供研究，不是投资建议。', 'Percentile = share of valid days in the last 365 with PE below the current value, same basis as the dashed lines on the chart. Research only, not investment advice.')}</p>
  </div>`;
}

const api = { pct, TIERS, tierIndex, gradient, evaluate, panel };
if (typeof module !== 'undefined') module.exports = api; else root.DCACore = api;
})(globalThis);
