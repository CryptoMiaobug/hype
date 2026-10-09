/* DCA tier logic: where the latest PE sits within the last 365 days of valid PE values.
   Tier boundaries are the same 1Y P20/P50/P80 lines drawn on the PE charts. Pure, no DOM. */
(function (root) {
'use strict';
// Linear-interpolated percentile (numpy 'linear'), identical to pe.js / bnb-pe.js.
const pct = (vals, q) => { const v = vals.filter(Number.isFinite).sort((a, b) => a - b); if (!v.length) return null; const i = (v.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return v[lo] + (v[hi] - v[lo]) * (i - lo); };

// Tiers ordered low -> high PE. mult is applied to the user's base amount.
const TIERS = [
  { key: 'green', mult: 2, color: '#4ADE80' },
  { key: 'yellow', mult: 1, color: '#FACC15' },
  { key: 'orange', mult: 0.5, color: '#FB923C' },
  { key: 'red', mult: 0, color: '#F87171' },
];

// rows: [{date, <field>}...] in date order. Uses the last 365 rows (same window as the chart bands).
function evaluate(rows, field) {
  const year = rows.slice(-365), vals = year.map(r => r[field]).filter(Number.isFinite);
  const latest = [...rows].reverse().find(r => Number.isFinite(r[field]));
  if (!latest || vals.length < 2) return null;
  const pe = latest[field], p20 = pct(vals, 0.2), p50 = pct(vals, 0.5), p80 = pct(vals, 0.8);
  // Rank: share of the window strictly below the current value (0-100).
  const rank = 100 * vals.filter(v => v < pe).length / vals.length;
  const tier = TIERS[rank < 20 ? 0 : rank < 50 ? 1 : rank < 80 ? 2 : 3];
  return { date: latest.date, pe, p20, p50, p80, rank, tier, n: vals.length, from: year[0].date, to: year.at(-1).date };
}

// Round to cents; base must be a finite non-negative number.
const amount = (base, tier) => Number.isFinite(base) && base >= 0 ? Math.round(base * tier.mult * 100) / 100 : null;

const api = { pct, TIERS, evaluate, amount };
if (typeof module !== 'undefined') module.exports = api; else root.DCACore = api;
})(globalThis);
