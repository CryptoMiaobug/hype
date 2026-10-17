#!/usr/bin/env node
// Daily append-only refresh of PE seeds (run by .github/workflows/pe-daily.yml).
//
// Targets: pe-data/{hype,uni,aave,bnb}.json, payout.json, hype-sources.json, uni-chains.json.
// Freeze day = UTC today - 2 (T-2) so DefiLlama has a full extra day to settle.
//
// Rules (agreed 2026-10-17):
//   * Never modify existing data: only dates > file.last are added; old keys/rows are verified unchanged.
//   * Each file is independent; a failed source skips only the files that need it.
//   * Stop at the first incomplete day (missing/invalid revenue, price, breakdown): no skipping ahead.
//   * Missed runs self-heal: every run fills (file.last, T-2].
//   * BNB: the next quarterly Auto-Burn is auto-recorded once bnbburn.info lists its tx AND the tx verifies on
//     BSC (see nextBurn). Rows stop BNB_MAX_BURN_AGE days after the latest recorded burn (logged as HELD).
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const FE = path.join(__dirname, '..', '..');
const DATA = process.env.PE_DATA_DIR || path.join(FE, 'pe-data');
const C = require(path.join(FE, 'pe-core.js')), B = require(path.join(FE, 'bnb-core.js'));
const P = require(path.join(FE, 'payout-core.js')), HS = require(path.join(FE, 'pe-sources.js')), UC = require(path.join(FE, 'pe-chains.js'));
const BNB_MAX_BURN_AGE = 75; // shortest historical burn gap is 80d; stop before a new burn could be missed

const now = new Date(process.env.PE_NOW || Date.now());
const END = C.date(Math.floor(now.getTime() / C.DAY) * C.DAY - 2 * C.DAY);
const STAMP = now.toISOString().replace(/\.\d+Z$/, 'Z');
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const file = n => path.join(DATA, n + '.json');
const read = n => JSON.parse(fs.readFileSync(file(n)));
const write = (n, o) => fs.writeFileSync(file(n), JSON.stringify(o));
const days = (from, to) => { const out = []; for (let t = C.time(from) + C.DAY; t <= C.time(to); t += C.DAY) out.push(C.date(t)); return out; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const report = [];
let failures = 0;

// ---- fetching (serialized, retry on 429/5xx) ----
const LLAMA = 'https://api.llama.fi/summary/fees/', CG = 'https://api.coingecko.com/api/v3/coins/';
const cache = new Map();
async function get(url) {
  if (cache.has(url)) return cache.get(url);
  if (global.__mockFetch) { const v = await global.__mockFetch(url); cache.set(url, v); return v; }
  let last;
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'pe-daily-append', Accept: 'application/json' }, signal: AbortSignal.timeout(60000) });
      if (r.ok) { const blob = await r.text(); const v = { json: JSON.parse(blob), sha: sha(blob) }; cache.set(url, v); return v; }
      last = Error('HTTP ' + r.status + ' ' + url);
      if (r.status !== 429 && r.status < 500) break;
    } catch (e) { last = e; }
    await sleep(15000 * (i + 1));
  }
  throw last;
}
const llama = (slug, type) => get(LLAMA + slug + '?dataType=' + type);
const gecko = id => get(CG + id + '/market_chart?vs_currency=usd&days=365&interval=daily');

// ---- safety: existing content must be untouched ----
function assertKept(name, before, after) {
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  if (Array.isArray(before.rows) && !same(after.rows.slice(0, before.rows.length), before.rows)) throw Error(name + ': old rows changed');
  for (const k of ['revenue', 'market']) if (before[k]) for (const [d, v] of Object.entries(before[k])) if (!same(after[k][d], v)) throw Error(name + ': ' + k + ' ' + d + ' changed');
  if (Array.isArray(before.totalDataChartBreakdown) && !same(after.totalDataChartBreakdown.slice(0, before.totalDataChartBreakdown.length), before.totalDataChartBreakdown)) throw Error(name + ': old breakdown changed');
  if (Array.isArray(before.burns) && !same(after.burns.slice(0, before.burns.length), before.burns)) throw Error(name + ': old burns changed');
  if (before.assets) for (const [a, o] of Object.entries(before.assets)) for (const k of ['revenue', 'holders']) for (const [d, v] of Object.entries(o[k])) if (!same(after.assets[a][k][d], v)) throw Error(name + ': ' + a + '.' + k + ' ' + d + ' changed');
}
// New keys only (> last), never fill old nulls.
const addNew = (base, extra, last, upto) => { const out = { ...base }; for (const [d, v] of Object.entries(extra)) if (d > last && d <= upto && !Object.hasOwn(out, d)) out[d] = v; return out; };
const trim = (o, upto) => Object.fromEntries(Object.entries(o).filter(([d]) => d <= upto).sort());

async function step(name, fn) {
  try { const msg = await fn(); report.push(name + ': ' + msg); }
  catch (e) { failures++; report.push(name + ': FAILED ' + e.message); }
}

// ---- HYPE / UNI / AAVE PE ----
async function pe(asset, slug, type, cgId) {
  const seed = read(asset), before = JSON.parse(JSON.stringify(seed));
  if (seed.last >= END) return 'up to date ' + seed.last;
  const [l, g] = [await llama(slug, type), await gecko(cgId)];
  if (l.json.id !== 'parent#' + slug) throw Error('unexpected id ' + l.json.id);
  const rev = addNew(seed.revenue, C.revenue(l.json, END), seed.last, END), mkt = addNew(seed.market, C.market(g.json, END), seed.last, END);
  const rows = C.calculate(seed, rev, mkt, END).slice(seed.rows.length), added = [];
  let stop = '';
  for (const r of rows) { if (r.status !== 'ok') { stop = ' (stopped at ' + r.date + ': ' + r.status + ')'; break; } added.push({ ...r, source: 'bundled' }); }
  if (!added.length) return 'nothing complete after ' + seed.last + stop;
  const last = added.at(-1).date;
  Object.assign(seed, {
    rows: [...seed.rows, ...added], revenue: trim(rev, last), market: trim(mkt, last), last, snapshot: STAMP.slice(0, 10),
    sourceSHA256: sha([seed.sourceSHA256, l.sha, g.sha].join(':')),
  });
  assertKept(asset, before, seed); write(asset, seed);
  return 'added ' + added.map(x => x.date + ' PE ' + x.circ.toFixed(2)).join(', ') + stop;
}

// ---- BNB quarterly Auto-Burn: discover via bnbburn.info, verify on BSC, then record ----
// Same rules as bnbPE/build_seed.py: amount = on-chain value sent to dEaD, usd = amount x bnbburn medianPrice,
// date = UTC date of the burn block. Only the next burn number is accepted; older burns are never touched.
const BURN_API = 'https://www.bnbburn.info/api/getQuarterBurns';
const BURN_FROM = '0x00389542170d59184dc056f942b3a8234d5318c9', DEAD = '0x000000000000000000000000000000000000dead';
const BURN_TOLERANCE = 0.01; // on-chain vs bnbburn amount (historic max ~0.1% excluding #29/#30 make-up burns)
const RPCS = (process.env.BSC_RPCS || 'https://bsc-dataseed.bnbchain.org,https://bsc-dataseed1.defibit.io,https://bsc-mainnet.public.blastapi.io').split(',');
async function rpc(method, params) {
  if (global.__mockRpc) return global.__mockRpc(method, params);
  let last;
  for (const url of RPCS) {
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(30000) });
      const j = await r.json();
      if (j.result != null) return j.result;
      last = Error(method + ' ' + url + ' ' + JSON.stringify(j.error || 'null result'));
    } catch (e) { last = e; }
  }
  throw last;
}
const weiToBnb = hex => { const w = BigInt(hex), u = 10n ** 18n; return Number(w / u) + Number(w % u) / 1e18; };

// Returns { burn } when a new burn was verified, { pending } when not published yet; throws on verification failure.
async function nextBurn(seed) {
  const prev = seed.burns.at(-1), n = prev.n + 1;
  let list; try { list = (await get(BURN_API)).json; } catch (e) { return { pending: 'bnbburn.info unreachable (' + e.message + '), retry next run' }; }
  const q = list.quarters?.find(x => x.rank === n);
  if (!q) return { pending: 'bnbburn.info has no entry #' + n };
  const m = /^https:\/\/bscscan\.com\/tx\/(0x[0-9a-fA-F]{64})$/.exec(q.txLink || '');
  if (!q.burnDate || !m) return { pending: '#' + n + ' ' + q.name + ' not executed yet' };
  const tx = m[1].toLowerCase(), price = Number(q.medianPrice), api = Number(q.amount);
  if (!(price > 0) || !(api > 0)) throw Error('#' + n + ' bnbburn medianPrice/amount invalid');
  if (seed.burns.some(b => b.tx.toLowerCase() === tx)) throw Error('#' + n + ' tx already recorded as another burn');
  let t, rc;
  try { [t, rc] = [await rpc('eth_getTransactionByHash', [tx]), await rpc('eth_getTransactionReceipt', [tx])]; } catch (e) { return { pending: '#' + n + ' listed but BSC RPC unreachable (' + e.message + '), retry next run' }; }
  if (!t || !rc) return { pending: '#' + n + ' tx not found on BSC yet, retry next run' };
  if (rc.status !== '0x1') throw Error('#' + n + ' tx failed on chain');
  if (t.from.toLowerCase() !== BURN_FROM || (t.to || '').toLowerCase() !== DEAD) throw Error('#' + n + ' tx is not ' + BURN_FROM + ' -> dEaD (' + t.from + ' -> ' + t.to + ')');
  const amount = weiToBnb(t.value);
  if (!(amount > 0) || Math.abs(amount - api) / api > BURN_TOLERANCE) throw Error('#' + n + ' on-chain ' + amount + ' vs bnbburn ' + api + ' differs >' + BURN_TOLERANCE * 100 + '%');
  const block = parseInt(t.blockNumber, 16), blk = await rpc('eth_getBlockByNumber', [t.blockNumber, false]);
  const time = new Date(parseInt(blk.timestamp, 16) * 1000).toISOString().replace(/\.\d+Z$/, 'Z'), date = time.slice(0, 10);
  if (block <= prev.block || date < prev.date) throw Error('#' + n + ' is not after #' + prev.n);
  return { burn: { n, quarter: q.name, tx, block, time, date, amount, apiAmount: api, medianPrice: price, usd: amount * price } };
}

// ---- BNB burn PE ----
async function bnb() {
  const seed = read('bnb'), before = JSON.parse(JSON.stringify(seed));
  let burnNote = '';
  try {
    const r = await nextBurn(seed);
    if (r.burn) {
      if (r.burn.date <= seed.last) throw Error('#' + r.burn.n + ' dated ' + r.burn.date + ' but rows already frozen through ' + seed.last + '; needs manual review');
      seed.burns.push(r.burn); seed.sources = { ...seed.sources, [STAMP + '/quarter_burns.json']: (await get(BURN_API)).sha };
      burnNote = 'BNB burn #' + r.burn.n + ' recorded (' + r.burn.quarter + ', ' + r.burn.date + ', ' + r.burn.amount.toFixed(3) + ' BNB, $' + Math.round(r.burn.usd).toLocaleString('en-US') + '); ';
      console.log('::notice::' + burnNote);
    } else burnNote = r.pending + '; ';
  } catch (e) { throw Error('burn check: ' + e.message + ' (rows not frozen)'); }
  const burnCap = C.date(C.time(seed.burns.at(-1).date) + BNB_MAX_BURN_AGE * C.DAY), end = END < burnCap ? END : burnCap;
  const capNote = end < END ? ' (capped at ' + end + ': latest recorded burn #' + seed.burns.at(-1).n + ' ' + seed.burns.at(-1).date + ' is >' + BNB_MAX_BURN_AGE + 'd old; waiting for burn #' + (seed.burns.at(-1).n + 1) + ')' : '';
  if (seed.last >= end) { if (burnNote.startsWith('BNB burn')) { seed.sourceSHA256 = sha(JSON.stringify(seed.sources, Object.keys(seed.sources).sort())); assertKept('bnb', before, seed); write('bnb', seed); } return burnNote + (capNote ? 'HELD at ' : 'up to date ') + seed.last + capNote; }
  const [l, g] = [await llama('bsc', 'dailyRevenue'), await gecko('binancecoin')];
  const rev = addNew(seed.revenue, B.revenue(l.json, end), seed.last, end), cg = B.market(g.json, end), added = [];
  let stop = '';
  for (const d of days(seed.last, end)) {
    const x = B.row(seed, d, rev, cg[d]);
    if (x.status !== 'ok') { stop = ' (stopped at ' + d + ': ' + x.status + ')'; break; }
    delete x.status; delete x.source; added.push(x);
  }
  if (!added.length) { if (burnNote.startsWith('BNB burn')) { seed.sourceSHA256 = sha(JSON.stringify(seed.sources, Object.keys(seed.sources).sort())); assertKept('bnb', before, seed); write('bnb', seed); } return burnNote + 'nothing complete after ' + seed.last + stop + capNote; }
  const last = added.at(-1).date;
  for (const x of added) seed.market[x.date] = [...cg[x.date], 'coingecko'];
  seed.rows.push(...added); seed.revenue = trim(rev, last); seed.last = last; seed.builtAt = STAMP;
  seed.sources = { ...seed.sources, [STAMP + '/bsc_dailyRevenue.json']: l.sha, [STAMP + '/cg_binancecoin.json']: g.sha };
  seed.sourceSHA256 = sha(JSON.stringify(seed.sources, Object.keys(seed.sources).sort()));
  assertKept('bnb', before, seed); write('bnb', seed);
  return burnNote + 'added ' + added.map(x => x.date + ' PE ' + x.pe.toFixed(2)).join(', ') + stop + capNote;
}

// ---- payout.json (hype/uni/aave revenue vs holders; one global `last`) ----
async function payout() {
  const seed = read('payout'), before = JSON.parse(JSON.stringify(seed));
  if (seed.last >= END) return 'up to date ' + seed.last;
  const parsed = {};
  for (const [a, o] of Object.entries(seed.assets)) {
    const slug = o.llamaId.split('#')[1];
    parsed[a] = { r: P.parse((await llama(slug, 'dailyRevenue')).json, o.llamaId, END), h: P.parse((await llama(slug, 'dailyHoldersRevenue')).json, o.llamaId, END) };
  }
  // Global last = last day where every asset has both values, consecutively.
  let last = seed.last, stop = '';
  for (const d of days(seed.last, END)) {
    const bad = Object.keys(parsed).find(a => !C.valid(parsed[a].r[d]) || !C.valid(parsed[a].h[d]));
    if (bad) { stop = ' (stopped at ' + d + ': ' + bad + ' incomplete)'; break; }
    last = d;
  }
  if (last === seed.last) return 'nothing complete after ' + seed.last + stop;
  const hashes = [seed.sourceSHA256];
  for (const [a, o] of Object.entries(seed.assets)) {
    o.revenue = trim(addNew(o.revenue, parsed[a].r, seed.last, last), last);
    o.holders = trim(addNew(o.holders, parsed[a].h, seed.last, last), last);
    const slug = o.llamaId.split('#')[1];
    hashes.push((await llama(slug, 'dailyRevenue')).sha, (await llama(slug, 'dailyHoldersRevenue')).sha);
  }
  Object.assign(seed, { last, snapshot: STAMP, sourceSHA256: sha(hashes.join(':')) });
  assertKept('payout', before, seed); write('payout', seed);
  return 'through ' + last + stop;
}

// ---- breakdown snapshots (display only) ----
async function breakdown(name, slug, type, parse, total) {
  const snap = read(name), before = JSON.parse(JSON.stringify(snap));
  if (snap.cutoff >= END) return 'up to date ' + snap.cutoff;
  const l = await llama(slug, type);
  if (l.json.id !== snap.id) throw Error('unexpected id ' + l.json.id);
  const parsed = parse(l.json, END), byDay = new Map();
  for (const e of l.json.totalDataChartBreakdown) if (Number.isInteger(e[0]) && e[0] % 86400 === 0) byDay.set(C.date(e[0] * 1000), e);
  const add = []; let stop = '';
  for (const d of days(snap.cutoff, END)) {
    if (total(parsed[d]) == null || !byDay.has(d)) { stop = ' (stopped at ' + d + ': incomplete breakdown)'; break; }
    add.push(byDay.get(d));
  }
  if (!add.length) return 'nothing complete after ' + snap.cutoff + stop;
  Object.assign(snap, { totalDataChartBreakdown: [...snap.totalDataChartBreakdown, ...add], cutoff: C.date(add.at(-1)[0] * 1000), fetchedAt: STAMP });
  assertKept(name, before, snap); write(name, snap);
  return 'through ' + snap.cutoff + stop;
}

async function main() {
  console.log('freeze through (T-2):', END);
  await step('hype', () => pe('hype', 'hyperliquid', 'dailyHoldersRevenue', 'hyperliquid'));
  await step('uni', () => pe('uni', 'uniswap', 'dailyRevenue', 'uniswap'));
  await step('aave', () => pe('aave', 'aave', 'dailyRevenue', 'aave'));
  await step('bnb', bnb);
  await step('payout', payout);
  await step('hype-sources', () => breakdown('hype-sources', 'hyperliquid', 'dailyHoldersRevenue', HS.parse, HS.total));
  await step('uni-chains', () => breakdown('uni-chains', 'uniswap', 'dailyRevenue', UC.parse, UC.total));
  console.log(report.join('\n'));
  // Partial success still commits (workflow commits whatever changed); exit 1 so GitHub e-mails on any failure.
  if (failures) process.exitCode = 1;
  const burn = report.find(l => l.includes('BNB burn #'));
  if (burn && process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, 'burn=' + burn.replace(/^bnb: /, '').split(';')[0] + '\n');
}
if (require.main === module) main();
module.exports = { main, END };
