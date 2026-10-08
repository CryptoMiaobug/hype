const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('visit-counter.js', 'utf8');
async function run(reply, lang = 'zh') {
  const nodes = { vcTotal: { dataset: {} }, vcToday: { dataset: {} } };
  const urls = [];
  vm.runInNewContext(source, {
    document: { documentElement: { lang }, getElementById: id => nodes[id] },
    Date, AbortController, setTimeout, clearTimeout,
    fetch: async (url) => { urls.push(url); return reply(url); },
  });
  assert.equal(nodes.vcTotal.dataset.state, 'loading');
  await new Promise(resolve => setImmediate(resolve));
  return { nodes, urls };
}
(async () => {
  for (const page of ['index.html', 'hype-pe.html', 'uni-pe.html']) {
    const html = fs.readFileSync(page, 'utf8');
    for (const id of ['visitCounter', 'vcTotal', 'vcToday']) assert.equal(html.split(`id="${id}"`).length - 1, 1);
    assert.equal((html.match(/data-goatcounter=/g) || []).length, 1);
    assert.equal((html.match(/src="visit-counter.js/g) || []).length, 1);
    assert.match(html, /总访问量/); assert.match(html, /今日访问量/);
    if (page !== 'index.html') assert.doesNotMatch(html, /src="app.js|data-i18n="visit\./);
  }
  const live = await run(async url => ({ok:true, json:async () => url.includes('?') ? {count_unique:'0', count:'9'} : {count_unique:'1,234', count:'9999'}}));
  assert.equal(live.nodes.vcTotal.textContent, '1,234');
  assert.equal(live.nodes.vcToday.textContent, '0');
  assert.match(live.urls[0], /\/counter\/TOTAL.json$/);
  assert.match(live.urls[1], /start=\d{4}-\d{2}-\d{2}&end=\d{4}-\d{2}-\d{2}$/);
  for (const data of [{}, null, {count_unique:''}, {count_unique:'invalid'}, {count_unique:-1}, {count_unique:null}, {count_unique:'1,2'}]) {
    const result = await run(async () => ({ok:true,json:async () => data}));
    assert.equal(result.nodes.vcTotal.textContent, '暂不可用');
    assert.equal(result.nodes.vcTotal.dataset.state, 'error');
  }
  for (const reply of [async () => { throw Error('network'); }, async () => ({ok:false}), async () => ({ok:true,json:async () => {throw Error('JSON');}})]) {
    const result = await run(reply); assert.equal(result.nodes.vcToday.textContent, '暂不可用');
  }
  assert.equal((await run(async () => ({ok:true,json:async () => ({count:'42'})}))).nodes.vcTotal.textContent, '42');
  assert.equal((await run(async () => ({ok:false}), 'en')).nodes.vcTotal.textContent, 'Unavailable');
  // Exercise the real public endpoint, not fixtures; report CORS and current values.
  for (const url of live.urls) {
    const response = await fetch(url, { headers: {Origin:'https://hype.miao77.xyz'} });
    assert.equal(response.status, 200); assert.equal(response.headers.get('access-control-allow-origin'), '*');
    const data = await response.json();
    const result = await run(async () => ({ok:true,json:async () => data}));
    assert.equal(result.nodes.vcTotal.dataset.state, 'ready');
    console.log('Public API -> DOM:', url, result.nodes.vcTotal.textContent);
  }
  console.log('PASS: three page DOM contracts, unique tracking, loading, counts, UTC URLs, invalid data and network/HTTP/JSON failures, live public API.');
})().catch(e => { console.error(e); process.exitCode = 1; });
