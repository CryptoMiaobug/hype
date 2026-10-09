/* BNB burn-PE pure calculations (UTC). Frozen seed rows always win over cache/API. */
(function (root) {
'use strict';
const DAY = 86400000;
const valid = x => typeof x === 'number' && Number.isFinite(x) && x >= 0;
const date = t => new Date(t).toISOString().slice(0, 10);
const time = d => Date.parse(d + 'T00:00:00Z');
const yesterday = (now = Date.now()) => date(Math.floor(now / DAY) * DAY - DAY);

// DefiLlama /summary/fees/bsc?dataType=dailyRevenue -> {date: usd|null}
function revenue(data, end) {
  if (!data || data.id !== 'chain#bsc' || !Array.isArray(data.totalDataChart)) throw Error('收入响应格式不符');
  const out = {};
  for (const [t, v] of data.totalDataChart) {
    if (!Number.isInteger(t) || t % 86400) continue;
    const d = date(t * 1000);
    if (d > end) continue;
    if (Object.hasOwn(out, d)) throw Error('收入日期重复');
    out[d] = valid(v) ? v : null;
  }
  return out;
}

// CoinGecko market_chart: only exact D+1 00:00 UTC points, paired price + market cap, assigned to D.
function market(data, end) {
  if (!data || !Array.isArray(data.prices) || !Array.isArray(data.market_caps)) throw Error('行情响应缺少序列');
  const caps = new Map();
  for (const [t, v] of data.market_caps) { if (caps.has(t)) throw Error('市值时间戳重复'); caps.set(t, v); }
  const out = {}, seen = new Set();
  for (const [t, p] of data.prices) {
    if (seen.has(t)) throw Error('价格时间戳重复');
    seen.add(t);
    if (!Number.isInteger(t) || t % DAY) continue;
    const d = date(t - DAY), m = caps.get(t);
    if (d <= end && valid(p) && p > 0 && valid(m) && m > 0) out[d] = [p, m];
  }
  return out;
}

const merge = (base, extra) => { const out = { ...base }; for (const [k, v] of Object.entries(extra)) if (out[k] == null && v != null) out[k] = v; return out; };

// Sum of the latest 4 verified quarterly burns executed on or before day d.
function quarterly(burns, d) {
  const done = burns.filter(b => b.date <= d).slice(-4);
  return { used: done.map(b => b.n), usd: done.length === 4 ? done.reduce((s, b) => s + b.usd, 0) : null, last: done.at(-1) || null };
}

function row(seed, d, rev, pm) {
  const q = quarterly(seed.burns, d);
  let sum = 0, missing = 0;
  for (let i = 0; i < 30; i++) { const v = rev[date(time(d) - i * DAY)]; if (valid(v)) sum += v; else missing++; }
  const r30 = missing ? null : sum, gas = missing ? null : sum * 365 / 30;
  const annual = q.usd != null && gas != null ? q.usd + gas : null;
  const price = pm ? pm[0] : null, mcap = pm ? pm[1] : null;
  const status = missing ? '收入窗口缺 ' + missing + ' 天' : !pm ? '缺价格/市值' : q.usd == null ? '季度销毁不足4次' : annual === 0 ? '零分母' : 'ok';
  return { date: d, price, mcap, mcapSource: pm ? 'coingecko' : null, supply: pm ? mcap / price : null, quarterly: q.usd, burnsUsed: q.used, r30, gas, annual, pe: annual > 0 && mcap ? mcap / annual : null, status, source: 'browser' };
}

function calculate(seed, rev, prices, end) {
  const rows = seed.rows.map(r => ({ ...r, status: 'ok', source: 'bundled' }));
  for (let t = time(seed.last) + DAY; t <= time(end); t += DAY) { const d = date(t); rows.push(row(seed, d, rev, prices[d])); }
  return rows;
}

// Days since the latest burn in the seed; quarterly burns are added manually.
const staleDays = (seed, d) => Math.round((time(d) - time(seed.burns.at(-1).date)) / DAY);

const api = { DAY, valid, date, time, yesterday, revenue, market, merge, quarterly, row, calculate, staleDays };
if (typeof module !== 'undefined') module.exports = api; else root.BNBCore = api;
})(globalThis);
