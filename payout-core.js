/* Payout ratio = value actually returned to holders ÷ protocol revenue, over full UTC windows.
   Pure functions; shared by the PE overview and coin pages. Missing days make the window NA (never zero-filled). */
(function (root) {
'use strict';
const DAY = 86400000;
const valid = x => typeof x === 'number' && Number.isFinite(x) && x >= 0;
const date = t => new Date(t).toISOString().slice(0, 10);
const time = d => Date.parse(d + 'T00:00:00Z');
// Below this 30-day ratio the overview flags the asset as "payout paused".
const PAUSE = 0.1;

// rev / hold: {date: usd|null}. Holder keys missing before revenue exists are treated as missing, not 0.
function ratioWindow(rev, hold, end, days) {
  let r = 0, h = 0, missing = 0;
  for (let i = 0; i < days; i++) {
    const d = date(time(end) - i * DAY);
    if (!valid(rev[d]) || !valid(hold[d])) { missing++; continue; }
    r += rev[d]; h += hold[d];
  }
  if (missing) return { days, end, rev: null, hold: null, ratio: null, missing };
  return { days, end, rev: r, hold: h, ratio: r > 0 ? h / r : null, missing: 0 };
}

// Summary for one asset from payout.json: 30d + 1y ratios, annualized actual payout.
// `end` is clamped to the latest day with both values, so a partial live fill never blanks the window.
function lastValid(asset, end) {
  return Object.keys(asset.revenue).filter(d => d <= end && valid(asset.revenue[d]) && valid(asset.holders[d])).sort().at(-1) ?? end;
}
function summary(asset, end) {
  end = lastValid(asset, end);
  const w30 = ratioWindow(asset.revenue, asset.holders, end, 30), w365 = ratioWindow(asset.revenue, asset.holders, end, 365);
  return { end, w30, w365, annual30: w30.hold == null ? null : w30.hold * 365 / 30, paused: w30.ratio != null && w30.ratio < PAUSE };
}

// Monthly UTC totals (complete-month flag) for the coin-page table.
function monthly(asset, end, months = 13) {
  const out = new Map();
  for (const [d, v] of Object.entries(asset.revenue)) {
    if (d > end) continue;
    const m = d.slice(0, 7), o = out.get(m) ?? { month: m, rev: 0, hold: 0, days: 0, missing: 0 };
    if (valid(v) && valid(asset.holders[d])) { o.rev += v; o.hold += asset.holders[d]; o.days++; } else o.missing++;
    out.set(m, o);
  }
  return [...out.values()].sort((a, b) => a.month < b.month ? 1 : -1).slice(0, months)
    .map(o => ({ ...o, ratio: o.rev > 0 && !o.missing ? o.hold / o.rev : null }));
}

// BNB: only gas burn is revenue-funded (100% burned per DefiLlama dailyRevenue); quarterly Auto-Burn is formula-driven.
function bnb(row) {
  if (!row || !valid(row.annual) || !(row.annual > 0) || !valid(row.gas) || !valid(row.quarterly)) return null;
  return { gasRatio: 1, autoShare: row.quarterly / row.annual, gasShare: row.gas / row.annual };
}

// DefiLlama totalDataChart -> {date: usd|null}, complete UTC days ≤ end only.
function parse(data, id, end) {
  if (!data || data.id !== id || !Array.isArray(data.totalDataChart)) throw Error('id');
  const out = {};
  for (const [t, v] of data.totalDataChart) {
    if (!Number.isInteger(t) || t % 86400) continue;
    const d = date(t * 1000);
    if (d <= end) out[d] = valid(v) ? v : null;
  }
  return out;
}

// Bundled payout.json, then (only if behind `end`) fill later days from DefiLlama. Bundled values always win.
// json(url) is injected so this stays testable; failures keep the bundled data.
async function load(json, end, ids = null) {
  const seed = await json('pe-data/payout.json');
  if (seed.last >= end) return { seed, live: false };
  let live = false;
  await Promise.all(Object.entries(seed.assets).filter(([k]) => !ids || ids.includes(k)).map(async ([, a]) => {
    const slug = a.llamaId.split('#')[1], base = 'https://api.llama.fi/summary/fees/' + slug + '?dataType=';
    try {
      const [r, h] = await Promise.all([json(base + 'dailyRevenue'), json(base + 'dailyHoldersRevenue')]);
      const pr = parse(r, a.llamaId, end), ph = parse(h, a.llamaId, end);
      for (const [d, v] of Object.entries(pr)) if (d > seed.last && a.revenue[d] == null) a.revenue[d] = v;
      for (const [d, v] of Object.entries(ph)) if (d > seed.last && a.holders[d] == null) a.holders[d] = v;
      live = true;
    } catch { /* keep bundled */ }
  }));
  return { seed, live };
}

const api = { PAUSE, window: ratioWindow, lastValid, summary, monthly, bnb, parse, load };
if (typeof module !== 'undefined') module.exports = api; else root.PayoutCore = api;
})(globalThis);
