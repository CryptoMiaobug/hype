/* DCA suggestion: where the latest PE sits within the last 365 days of valid PE values.
   Tier boundaries are the same 1Y P20/P50/P80 dashed lines drawn on the PE charts.
   evaluate() is pure; panel() returns HTML for the PE pages (no amounts, only a % of the normal DCA). */
(function (root) {
'use strict';
// Linear-interpolated percentile (numpy 'linear'), identical to pe.js / bnb-pe.js.
const pct = (vals, q) => { const v = vals.filter(Number.isFinite).sort((a, b) => a - b); if (!v.length) return null; const i = (v.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return v[lo] + (v[hi] - v[lo]) * (i - lo); };

// Weekly buy/sell plan (one action per week).
// side 'buy': ratio = % of the usual weekly buy amount; side 'sell': ratio = % of the INITIAL position sold that week; 'hold' = neither.
// ink = badge text colour (white where dark text lacks contrast, WCAG >= 4.5 checked in test-dca.cjs).
const tier = (key, side, ratio, color, range, action, ink = '#0b1f1b') => ({ key, side, ratio, color, ink, range, action });
// Altcoin PE tiers, low -> high percentile. lo/hi = percentile bounds (lower bound inclusive).
const TIERS = [
  { ...tier('t300', 'buy', 300, '#16A34A', ['0–10 分位', 'P0–P10'], ['三倍买入', 'Triple buy']), lo: 0, hi: 10 },
  { ...tier('t200', 'buy', 200, '#22C55E', ['10–20 分位', 'P10–P20'], ['加倍买入', 'Double buy']), lo: 10, hi: 20 },
  { ...tier('t150', 'buy', 150, '#4ADE80', ['20–30 分位', 'P20–P30'], ['1.5 倍买入', '1.5× buy']), lo: 20, hi: 30 },
  { ...tier('t125', 'buy', 125, '#A3E635', ['30–40 分位', 'P30–P40'], ['小幅加码', 'Slightly more']), lo: 30, hi: 40 },
  { ...tier('t100', 'buy', 100, '#BEF264', ['40–50 分位', 'P40–P50'], ['正常买入', 'Normal buy']), lo: 40, hi: 50 },
  { ...tier('t75', 'buy', 75, '#FDE047', ['50–60 分位', 'P50–P60'], ['小幅减少', 'Slightly less']), lo: 50, hi: 60 },
  { ...tier('t50', 'buy', 50, '#FACC15', ['60–70 分位', 'P60–P70'], ['减半买入', 'Half buy']), lo: 60, hi: 70 },
  { ...tier('t25', 'buy', 25, '#EAB308', ['70–80 分位', 'P70–P80'], ['少量买入', 'Quarter buy']), lo: 70, hi: 80 },
  { ...tier('s2', 'sell', 2, '#FB923C', ['80–85 分位', 'P80–P85'], ['少量卖出', 'Light sell']), lo: 80, hi: 85 },
  { ...tier('s3', 'sell', 3, '#F97316', ['85–90 分位', 'P85–P90'], ['分批卖出', 'Scale out']), lo: 85, hi: 90 },
  { ...tier('s5', 'sell', 5, '#EF4444', ['90–95 分位', 'P90–P95'], ['加快卖出', 'Faster sell']), lo: 90, hi: 95 },
  { ...tier('s8', 'sell', 8, '#DC2626', ['95–100 分位', 'P95–P100'], ['重点卖出', 'Heavy sell'], '#ffffff'), lo: 95, hi: 100 },
];
// Buffer state: just came down from the sell zone into P70–P80 and has not yet been below P70 -> neither buy nor sell.
const HOLD = tier('hold', 'hold', 0, '#9CA3AF', ['缓冲（刚从卖出区回落）', 'Buffer (just left sell zone)'], ['暂停', 'Pause']);
// Rank 0-100 -> tier index (lower bound inclusive).
const tierIndex = rank => { const i = TIERS.findIndex(t => rank < t.hi); return i < 0 ? TIERS.length - 1 : i; };
// Meter background: segment per tier at its percentile bounds.
const gradient = () => 'linear-gradient(90deg,' + TIERS.map(t => `${t.color} ${t.lo}% ${t.hi}%`).join(',') + ')';

// Count of sorted values strictly below x.
const below = (s, x) => { let lo = 0, hi = s.length; while (lo < hi) { const m = (lo + hi) >> 1; if (s[m] < x) lo = m + 1; else hi = m; } return lo; };

// rows: [{date, <field>}...] in date order. win = trailing rows (365 = last year); 0 = all rows (default).
function evaluate(rows, field, win = 0) {
  const year = win ? rows.slice(-win) : rows, vals = year.map(r => r[field]).filter(Number.isFinite);
  const latest = [...rows].reverse().find(r => Number.isFinite(r[field]));
  if (!latest || vals.length < 2) return null;
  const pe = latest[field], sorted = vals.slice().sort((a, b) => a - b), rk = x => 100 * below(sorted, x) / sorted.length;
  // Rank: share of the window strictly below the current value (0-100).
  const rank = rk(pe), base = TIERS[tierIndex(rank)];
  // Buffer: in P70–P80, walk back through the window; if P80+ is reached before anything below P70, pause.
  let buffer = false;
  if (rank >= 70 && rank < 80) for (let i = year.length - 1; i >= 0; i--) {
    const v = year[i][field]; if (!Number.isFinite(v)) continue;
    const r = rk(v); if (r < 70) break; if (r >= 80) { buffer = true; break; }
  }
  const from = year.find(r => Number.isFinite(r[field]))?.date;
  return { date: latest.date, from, pe, p20: pct(vals, 0.2), p50: pct(vals, 0.5), p80: pct(vals, 0.8), rank, base, tier: buffer ? HOLD : base, buffer, n: vals.length };
}

// BTC tiers on the MVRV Z-Score value (not percentile). hi = upper bound (exclusive).
const BTC_TIERS = [
  { ...tier('z300', 'buy', 300, '#16A34A', ['Z < 0', 'Z < 0'], ['三倍买入', 'Triple buy']), hi: 0 },
  { ...tier('z200', 'buy', 200, '#22C55E', ['Z 0–0.5', 'Z 0–0.5'], ['加倍买入', 'Double buy']), hi: 0.5 },
  { ...tier('z150', 'buy', 150, '#4ADE80', ['Z 0.5–1', 'Z 0.5–1'], ['1.5 倍买入', '1.5× buy']), hi: 1 },
  { ...tier('z100', 'buy', 100, '#A3E635', ['Z 1–1.5', 'Z 1–1.5'], ['正常买入', 'Normal buy']), hi: 1.5 },
  { ...tier('z50', 'buy', 50, '#FDE047', ['Z 1.5–1.75', 'Z 1.5–1.75'], ['减半买入', 'Half buy']), hi: 1.75 },
  { ...tier('z25', 'buy', 25, '#EAB308', ['Z 1.75–2', 'Z 1.75–2'], ['少量买入', 'Quarter buy']), hi: 2 },
  { ...tier('zhold', 'hold', 0, '#9CA3AF', ['Z 2–2.5', 'Z 2–2.5'], ['中性，不买不卖', 'Neutral, no trade']), hi: 2.5 },
  { ...tier('zs05', 'sell', 0.5, '#FDBA74', ['Z 2.5–3', 'Z 2.5–3'], ['少量卖出', 'Light sell']), hi: 3 },
  { ...tier('zs1', 'sell', 1, '#FB923C', ['Z 3–4', 'Z 3–4'], ['分批卖出', 'Scale out']), hi: 4 },
  { ...tier('zs2', 'sell', 2, '#F97316', ['Z 4–5', 'Z 4–5'], ['加快卖出', 'Faster sell']), hi: 5 },
  { ...tier('zs5', 'sell', 5, '#EF4444', ['Z 5–7', 'Z 5–7'], ['重点卖出', 'Heavy sell']), hi: 7 },
  { ...tier('zs10', 'sell', 10, '#DC2626', ['Z ≥ 7', 'Z ≥ 7'], ['大幅卖出', 'Major sell'], '#ffffff'), hi: Infinity },
];
const btcTierIndex = z => BTC_TIERS.findIndex(t => z < t.hi);
// Meter: equal-width segment per tier; outer tiers drawn as Z -1..0 and 7..8.
const BTC_EDGES = [-1, ...BTC_TIERS.map(t => t.hi === Infinity ? 8 : t.hi)];
const btcPos = z => { const i = btcTierIndex(z), lo = BTC_EDGES[i], hi = BTC_EDGES[i + 1], f = Math.max(0, Math.min(1, (z - lo) / (hi - lo))); return 100 * (i + f) / BTC_TIERS.length; };
const btcGradient = () => 'linear-gradient(90deg,' + BTC_TIERS.map((t, i) => `${t.color} ${(100 * i / BTC_TIERS.length).toFixed(3)}% ${(100 * (i + 1) / BTC_TIERS.length).toFixed(3)}%`).join(',') + ')';
// rows from BTCCore.derive ({date, z, ...}); uses the latest row with a Z value.
function btcEvaluate(rows) {
  const latest = [...(rows || [])].reverse().find(r => r.z != null && Number.isFinite(r.z));
  if (!latest) return null;
  return { date: latest.date, z: latest.z, mvrv: latest.mvrv, tier: BTC_TIERS[btcTierIndex(latest.z)] };
}

// Action text: "买 150%" / "卖 5%" / "暂停".
const actionText = (t, bi) => t.side === 'buy' ? bi('买 ', 'Buy ') + t.ratio + '%' : t.side === 'sell' ? bi('卖 ', 'Sell ') + t.ratio + '%' : bi('暂停', 'Pause');
const detailText = (t, bi) => t.side === 'buy' ? bi('本周买入 = 平时每周买入额 × ', 'This week = your usual weekly buy × ') + t.ratio + '%'
  : t.side === 'sell' ? bi('本周卖出 = 初始仓位的 ', 'This week sell ') + t.ratio + bi('%（按初始仓位，卖完为止）', '% of the initial position (until sold out)')
  : bi('本周不买也不卖', 'No buy and no sell this week');
const ruleText = (x, bi) => `${bi(x.range[0], x.range[1])} · ${x.side === 'buy' ? bi('买 ', 'buy ') + x.ratio + '%' : x.side === 'sell' ? bi('卖初始仓位 ', 'sell ') + x.ratio + bi('%', '% of initial') : bi('不买不卖', 'no trade')} · ${bi(x.action[0], x.action[1])}`;

// HTML for the in-page DCA panel. bi(zh, en) picks the current language.
// Percentile window shared by the overview and every coin page (same localStorage key): 365 = last 1 year, 0 = all bundled history.
const WIN_KEY = 'pe-list-window';
// store = the page's localStorage (passed in so pages and tests use their own).
// Default = all history; only an explicit '1y' choice switches to the last 365 days.
function getWin(store = root.localStorage) { try { return store?.getItem(WIN_KEY) === '1y' ? 365 : 0; } catch { return 0; } }
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

// Shared footnote for both panels.
const commonRules = bi => bi('每周固定一天看一次（例如周六），按当天档位操作。卖出比例按初始仓位计（每周卖同样份额，不是按剩余仓位），不设底仓，卖完为止；想长期持有的部分请单独放，不计入初始仓位。', 'Check once a week on a fixed day (e.g. Saturday) and act on that day\'s tier. Sell ratios are of the initial position (the same slice each week, not a share of what is left); no core is kept, sell until done. Keep any long-term holding separate from the initial position.');

function panel(rows, field, bi, win = 0) {
  const r = evaluate(rows, field, win);
  const f = n => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const head = '<div class="dca-head"><h3>' + bi('每周买卖建议', 'Weekly buy / sell') + '</h3>' + toggle(win, bi) + '</div>';
  const lab = win ? bi('近1年分位', '1Y percentile') : bi('全部分位', 'All-time percentile');
  if (!r) return head + '<p class="pe-muted">' + bi('有效 PE 不足，暂无建议', 'Not enough valid PE for a suggestion') + '</p>';
  const t = r.tier, pos = Math.max(0, Math.min(100, r.rank));
  const rules = TIERS.map(x => `<li style="--c:${x.color}"${x === r.base && !r.buffer ? ' class="on"' : ''}>${ruleText(x, bi)}</li>`).join('')
    + `<li style="--c:${HOLD.color}"${r.buffer ? ' class="on"' : ''}>${bi('缓冲：从 80 分位以上回落到 70–80 分位、且之后未跌破 70 分位 · 不买不卖', 'Buffer: back in P70–P80 after P80+, not yet below P70 · no trade')}</li>`;
  return head + `<div class="dca-body" style="--tier:${t.color};--ink:${t.ink}">
    <div class="dca-main"><span class="dca-ratio">${actionText(t, bi)}</span><span class="dca-badge">${bi(t.action[0], t.action[1])}</span></div>
    <p class="pe-muted">${detailText(t, bi)}${r.buffer ? bi('（缓冲：刚从卖出区回落，跌破 70 分位后恢复买入）', ' (buffer: just left the sell zone; buying resumes below P70)') : ''}</p>
    <div class="dca-meter" style="background:${gradient()}" role="img" aria-label="${lab} ${Math.round(r.rank)}%"><i style="left:${pos}%"></i></div>
    <div class="dca-scale" aria-hidden="true">${[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(v => `<span style="left:${v}%">${v}</span>`).join('')}</div>
    <p class="dca-metrics"><span>${bi('当前 PE ', 'Current PE ')}${f(r.pe)} x</span> · <span>${lab} ${Math.round(r.rank)}%</span> · <span>P20/P50/P80 ${f(r.p20)} / ${f(r.p50)} / ${f(r.p80)} x</span> · <span>${bi('样本 ', 'sample ')}${r.from} – ${r.date} · ${r.n}${bi(' 个有效日', ' valid days')}</span></p>
    <ul class="dca-rules">${rules}</ul>
    <p class="pe-muted dca-note">${commonRules(bi)}${bi('从卖出区回落到 70–80 分位时暂停（不买不卖），跌破 70 分位才恢复买入，避免刚卖完又买回。', ' After the sell zone, P70–P80 is a pause (no trade); buying resumes only below P70, so you do not buy straight back.')}</p>
    <p class="pe-muted dca-note">${win ? bi('分位 = 近 365 日有效 PE 中低于当前值的天数占比，与上图虚线同口径。', 'Percentile = share of valid days in the last 365 with PE below the current value, same basis as the dashed lines on the chart. ') : bi('分位 = 本站已存全部日期的有效 PE 中低于当前值的天数占比，与上图虚线同口径。', 'Percentile = share of all valid days stored on this site with PE below the current value, same basis as the dashed lines on the chart. ')}${bi('仅供研究，不是投资建议。', 'Research only, not investment advice.')}</p>
  </div>`;
}

// BTC panel on the MVRV page: tier by Z value, all-time (Z itself is computed on full history).
function btcPanel(rows, bi) {
  const head = '<div class="dca-head"><h3>' + bi('每周买卖建议', 'Weekly buy / sell') + '</h3></div>';
  const r = btcEvaluate(rows);
  if (!r) return head + '<p class="pe-muted">' + bi('暂无 Z 值', 'No Z-Score yet') + '</p>';
  const t = r.tier, f = n => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const rules = BTC_TIERS.map(x => `<li style="--c:${x.color}"${x === t ? ' class="on"' : ''}>${ruleText(x, bi)}</li>`).join('');
  const scale = BTC_EDGES.map((v, i) => `<span style="left:${(100 * i / BTC_TIERS.length).toFixed(3)}%">${i === 0 ? '' : i === BTC_EDGES.length - 1 ? '' : v}</span>`).join('');
  return head + `<div class="dca-body" style="--tier:${t.color};--ink:${t.ink}">
    <div class="dca-main"><span class="dca-ratio">${actionText(t, bi)}</span><span class="dca-badge">${bi(t.action[0], t.action[1])}</span></div>
    <p class="pe-muted">${detailText(t, bi)}</p>
    <div class="dca-meter" style="background:${btcGradient()}" role="img" aria-label="MVRV Z-Score ${f(r.z)}"><i style="left:${btcPos(r.z).toFixed(2)}%"></i></div>
    <div class="dca-scale" aria-hidden="true">${scale}</div>
    <p class="dca-metrics"><span>MVRV Z-Score ${f(r.z)}</span> · <span>MVRV ${f(r.mvrv)}</span> · <span>${bi('数据日 ', 'as of ')}${r.date} UTC</span></p>
    <ul class="dca-rules">${rules}</ul>
    <p class="pe-muted dca-note">${commonRules(bi)}${bi('Z 2–2.5 为中性区：历史上这段之后 1 年收益中位数为负，不再买入，也还没到卖出起点。', ' Z 2–2.5 is the neutral zone: historically the median 1-year return after it was negative, so no buying, but not yet a sell signal.')}</p>
    <p class="pe-muted dca-note">${bi('档位按 Z 值本身划分（不是分位），依据 2013 年以来周线回测：各轮 Z 峰值逐轮下降（约 10.7 / 10.1 / 7.2 / 3.35），所以卖出从 Z 2.5 起步。历史不代表未来。仅供研究，不是投资建议。', 'Tiers use the Z value itself (not a percentile), based on a weekly backtest since 2013. Cycle Z peaks keep falling (about 10.7 / 10.1 / 7.2 / 3.35), so selling starts at Z 2.5. Past cycles do not guarantee future ones. Research only, not investment advice.')}</p>
  </div>`;
}

const api = { pct, TIERS, HOLD, tierIndex, gradient, evaluate, panel, getWin, setWin, windowRows, winLabel, toggle, bindToggle, WIN_KEY,
  BTC_TIERS, btcTierIndex, btcPos, btcGradient, btcEvaluate, btcPanel, actionText };
if (typeof module !== 'undefined') module.exports = api; else root.DCACore = api;
})(globalThis);
