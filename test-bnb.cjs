// BNB PE tests: core calculations, frozen-seed reproduction, UI smoke (offline/online), i18n.
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const C = require('./bnb-core.js');
const S = JSON.parse(fs.readFileSync(__dirname + '/pe-data/bnb.json'));
let n = 0; const test = (name, fn) => { fn(); console.log('PASS', name); n++; };
const close = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));

test('seed starts at burn #30 and uses verified burns from #27', () => {
  assert.equal(S.first, '2025-01-23');
  assert.deepEqual(S.burns.map(b => b.n), [27, 28, 29, 30, 31, 32, 33, 34, 35, 36]);
  assert.deepEqual(S.rows[0].burnsUsed, [27, 28, 29, 30]);
});
test('burn amounts are on-chain values (Pioneer excluded, #29 make-up included)', () => {
  const b = Object.fromEntries(S.burns.map(x => [x.n, x]));
  assert.ok(close(b[29].amount, 1772712.363));
  assert.ok(close(b[30].amount, 1524200.953));
  assert.ok(close(b[32].amount, 1595470.69));
  assert.ok(close(b[34].amount, 1371703.6655));
  for (const x of S.burns) assert.ok(close(x.usd, x.amount * x.medianPrice));
});
test('every frozen row reproduces from raw inputs in JS', () => {
  for (const r of S.rows) {
    const v = C.row(S, r.date, S.revenue, [r.price, r.mcap]);
    for (const k of ['quarterly', 'r30', 'gas', 'annual', 'pe']) assert.ok(close(v[k], r[k]), r.date + ' ' + k);
    assert.deepEqual(v.burnsUsed, r.burnsUsed);
  }
});
test('quarterly denominator steps only on burn dates', () => {
  const dates = new Set(S.burns.map(b => b.date));
  for (let i = 1; i < S.rows.length; i++) if (S.rows[i].quarterly !== S.rows[i - 1].quarterly) assert.ok(dates.has(S.rows[i].date), S.rows[i].date);
});
test('market cap: CoinGecko from anchor, backcast before, joined at anchor', () => {
  for (const r of S.rows) assert.equal(r.mcapSource, r.date >= S.anchor.date ? 'coingecko' : 'backcast');
  const i = S.rows.findIndex(r => r.date === S.anchor.date);
  assert.ok(Math.abs(S.rows[i - 1].supply - S.rows[i].supply) < 2000); // only one day of gas burn apart
});
test('backcast supply only drops (burns) and matches official supply within 0.1% after burns #30/#32', () => {
  const bc = S.rows.filter(r => r.mcapSource === 'backcast');
  for (let i = 1; i < bc.length; i++) assert.ok(bc[i].supply <= bc[i - 1].supply + 1e-6);
  const m = Object.fromEntries(S.rows.map(r => [r.date, r.supply]));
  assert.ok(Math.abs(m['2025-01-23'] / 142465780.15 - 1) < 0.001);
  assert.ok(Math.abs(m['2025-07-10'] / 139289513.94 - 1) < 0.001);
});
test('quarterly() needs 4 executed burns', () => {
  assert.equal(C.quarterly(S.burns, '2025-01-22').usd, null);
  assert.deepEqual(C.quarterly(S.burns, '2026-10-01').used, [33, 34, 35, 36]);
});
test('frozen rows never replaced by cache/API', () => {
  const rows = C.calculate(S, { ...S.revenue, [S.last]: 1 }, { [S.last]: [1, 1] }, S.last);
  assert.equal(rows.length, S.rows.length);
  assert.equal(rows.at(-1).pe, S.rows.at(-1).pe);
});
test('revenue parser: id check, null/negative to null, true zero kept, future dropped', () => {
  assert.throws(() => C.revenue({ id: 'x', totalDataChart: [] }, '2026-10-08'));
  const t = C.time('2026-10-07') / 1000;
  assert.deepEqual(C.revenue({ id: 'chain#bsc', totalDataChart: [[t - 172800, null], [t - 86400, -1], [t, 0], [t + 86400, 5]] }, '2026-10-07'), { '2026-10-05': null, '2026-10-06': null, '2026-10-07': 0 });
});
test('market parser: exact D+1 midnight pairs only', () => {
  const t = C.time('2026-10-09');
  assert.deepEqual(C.market({ prices: [[t, 700], [t + 5, 1]], market_caps: [[t, 9e10], [t + 5, 1]] }, '2026-10-08'), { '2026-10-08': [700, 9e10] });
});
test('increment day: missing gas day or price gives NA, complete gives PE', () => {
  const d = C.date(C.time(S.last) + C.DAY);
  const r = C.calculate(S, S.revenue, {}, d).at(-1);
  assert.equal(r.pe, null);
  const rev = { ...S.revenue, [d]: 50000 }, r2 = C.calculate(S, rev, { [d]: [700, 9.3e10] }, d).at(-1);
  assert.equal(r2.status, 'ok');
  assert.ok(close(r2.pe, 9.3e10 / (r2.quarterly + r2.gas)));
});
console.log(n + ' core tests passed');

// ---- UI smoke tests in a VM with a minimal DOM ----
function dict() { const ctx = { I18N_DICT: { zh: {}, en: {} }, window: {} }; ctx.window = ctx; vm.runInNewContext(fs.readFileSync(__dirname + '/bnb-i18n.js', 'utf8'), ctx); return ctx; }
async function smoke({ online, lang = 'zh' }) {
  const nodes = {}, requests = []; let option, saved;
  const make = () => ({ textContent: '', innerHTML: '', hidden: false, disabled: false, children: [], dataset: {}, append(x) { this.children.push(x); }, replaceChildren(...x) { this.children = x; }, setAttribute() {}, getAttribute() { return ''; }, click() {} });
  const buttons = [30, 90, 365, 0].map(r => ({ dataset: { range: r } }));
  const document = { getElementById: id => nodes[id] ??= make(), querySelectorAll: s => s === '[data-range]' ? buttons : [], createElement: make };
  const end = C.date(C.time(S.last) + 2 * C.DAY);
  const d1 = C.date(C.time(S.last) + C.DAY);
  const tsD1 = C.time(d1) / 1000, tsEnd = C.time(end) / 1000;
  const fetch = async url => {
    requests.push(url);
    if (url.startsWith('pe-data')) return { ok: true, json: async () => S };
    if (!online) throw Error('offline');
    if (url.includes('llama')) return { ok: true, json: async () => ({ id: 'chain#bsc', totalDataChart: [[tsD1, 40000], [tsEnd, 42000]] }) };
    return { ok: true, json: async () => ({ prices: [[(tsD1 + 86400) * 1000, 740], [(tsEnd + 86400) * 1000, 745]], market_caps: [[(tsD1 + 86400) * 1000, 9.85e10], [(tsEnd + 86400) * 1000, 9.9e10]] }) };
  };
  const d = dict();
  const win = { echarts: { init: () => ({ setOption(o) { option = o; }, resize() {}, on() {} }) }, addEventListener() {}, I18n: { lang, t: k => d.I18N_DICT[lang][k] || k }, BNBText: d.BNBText };
  d.I18n = win.I18n;
  const ctx = { BNBCore: { ...C, yesterday: () => end }, document, window: win, echarts: win.echarts, localStorage: { getItem: () => null, setItem(k, v) { saved = JSON.parse(v); } }, fetch, AbortSignal: { timeout() {} }, Blob, URL, setTimeout, console };
  await vm.runInNewContext(fs.readFileSync(__dirname + '/bnb-pe.js', 'utf8'), ctx);
  return { nodes, option, saved, requests, end, win };
}
(async () => {
  const off = await smoke({ online: false });
  assert.equal(off.nodes.refresh.disabled, false);
  assert.ok(off.nodes.status.textContent.includes('CORS'));
  assert.ok(off.nodes.cards.innerHTML.includes(S.last + ' UTC'));
  assert.ok(off.nodes.cards.innerHTML.includes('最近有效，非目标日'));
  assert.ok(!off.nodes.cards.innerHTML.includes('NA x'));
  assert.equal(off.nodes.burns.children.length, S.burns.length);
  assert.equal(off.nodes.tbody.children.length, 365);
  console.log('PASS UI offline keeps frozen history');

  const on = await smoke({ online: true });
  assert.ok(on.nodes.status.textContent.includes('已完整'), on.nodes.status.textContent);
  assert.equal(on.option.xAxis[0].data.at(-1), on.end);
  assert.equal(on.option.series[0].data.at(-1) > 0, true);
  assert.equal(on.option.series[2].type, 'bar');
  assert.equal(on.saved.revenue[on.end], 42000);
  assert.ok(!Object.keys(on.saved.revenue).some(k => k <= S.last)); // only increments cached
  assert.equal(on.requests.filter(u => !u.startsWith('pe-data')).length, 2);
  assert.ok(on.option.series[0].markLine.data.length >= 4); // quarterly burn markers within 1y
  console.log('PASS UI online increment fills target day');

  const e = await smoke({ online: false, lang: 'en' });
  assert.ok(e.nodes.cards.innerHTML.includes('Circulating PE'));
  assert.ok(e.nodes.cards.innerHTML.includes('latest valid, not target day'));
  assert.ok(!/[\u4e00-\u9fff]/.test(e.nodes.cards.innerHTML), e.nodes.cards.innerHTML);
  assert.ok(!/[\u4e00-\u9fff]/.test(e.nodes.asof.textContent), e.nodes.asof.textContent);
  assert.ok(!/[\u4e00-\u9fff]/.test(e.nodes.status.textContent), e.nodes.status.textContent);
  const tip = e.option.tooltip.formatter([{ axisValue: S.rows[10].date }]);
  assert.ok(!/[\u4e00-\u9fff]/.test(tip), tip);
  const zhKeys = Object.keys(dict().I18N_DICT.zh), enKeys = Object.keys(dict().I18N_DICT.en);
  assert.deepEqual(zhKeys.sort(), enKeys.sort());
  console.log('PASS UI English has no untranslated Chinese');
})().catch(err => { console.error(err); process.exitCode = 1; });
