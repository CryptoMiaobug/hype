'use strict';
/* DCA recommendation page. Reads the same frozen PE archives as the PE pages, plus any validated
   increments those pages already cached in this browser. No network calls beyond the bundled JSON. */
(async () => {
  const D = DCACore, $ = id => document.getElementById(id);
  const en = () => window.I18n?.lang === 'en';
  const bi = (zh, e) => en() ? e : zh;
  const fmt = (n, d = 2) => n == null || !Number.isFinite(n) ? 'NA' : n.toLocaleString('en-US', { maximumFractionDigits: d });
  const fx = n => n == null || !Number.isFinite(n) ? 'NA' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const BASE_KEY = 'hypevalue-dca-base-v1', DEFAULT_BASE = 100;
  const day = /^\d{4}-\d{2}-\d{2}$/;
  const ASSETS = [
    { id: 'hype', name: 'HYPE', page: 'hype-pe.html', field: 'circ', core: () => window.PECore, cacheKey: 'hypevalue-pe-v1-hype', mergeSeedMarket: true,
      llama: 'https://api.llama.fi/summary/fees/hyperliquid?dataType=dailyHoldersRevenue', llamaId: 'parent#hyperliquid', gecko: 'hyperliquid', label: ['流通收入倍数', 'Circulating revenue multiple'] },
    { id: 'uni', name: 'UNI', page: 'uni-pe.html', field: 'circ', core: () => window.PECore, cacheKey: 'hypevalue-pe-v1-uni', mergeSeedMarket: true,
      llama: 'https://api.llama.fi/summary/fees/uniswap?dataType=dailyRevenue', llamaId: 'parent#uniswap', gecko: 'uniswap', label: ['流通销毁 PE', 'Circulating burn PE'] },
    { id: 'bnb', name: 'BNB', page: 'bnb-pe.html', field: 'pe', core: () => window.BNBCore, cacheKey: 'hypevalue-pe-v1-bnb', mergeSeedMarket: false,
      llama: 'https://api.llama.fi/summary/fees/bsc?dataType=dailyRevenue', llamaId: null, gecko: 'binancecoin', label: ['销毁 PE', 'Burn PE'] },
  ];
  const TIER_TEXT = {
    green: [['低于 20 分位', 'Below P20'], ['加倍定投', 'Double DCA']],
    yellow: [['20–50 分位', 'P20–P50'], ['正常定投', 'Normal DCA']],
    orange: [['50–80 分位', 'P50–P80'], ['减半定投', 'Half DCA']],
    red: [['高于 80 分位', 'Above P80'], ['停止定投', 'Pause DCA']],
  };
  const results = {};

  function readBase() {
    try { const v = Number(localStorage.getItem(BASE_KEY)); if (Number.isFinite(v) && v >= 0 && localStorage.getItem(BASE_KEY) !== null) return v; } catch { /* storage denied */ }
    return DEFAULT_BASE;
  }
  let base = readBase();

  async function json(url) {
    const r = await fetch(url, { signal: AbortSignal.timeout(25000), credentials: 'omit' });
    if (!r.ok) throw Error('HTTP ' + r.status);
    return r.json();
  }
  // Rebuild rows like the PE page: bundled rows always win; cached and freshly fetched raw values only fill
  // days after the archive. Fetch failures are not fatal: the card falls back to the latest valid day.
  async function rowsFor(a, seed) {
    const C = a.core();
    let cache = {};
    try { cache = JSON.parse(localStorage.getItem(a.cacheKey) || '{}'); if (cache.seedHash !== seed.sourceSHA256) cache = {}; } catch { cache = {}; }
    let rev = C.merge(seed.revenue, Object.fromEntries(Object.entries(cache.revenue || {}).filter(([d, v]) => day.test(d) && C.valid(v))));
    const cMkt = Object.fromEntries(Object.entries(cache.market || {}).filter(([d, v]) => day.test(d) && Array.isArray(v) && v.length === 2 && v.every(x => C.valid(x) && x > 0)));
    let prices = a.mergeSeedMarket ? C.merge(seed.market, cMkt) : cMkt;
    const end = C.yesterday();
    if (end <= seed.last) return { rows: seed.rows, notes: [] };
    let rows = C.calculate(seed, rev, prices, end);
    const notes = [];
    if (rows.some(r => r.source === 'browser' && (r.price == null || r.r30 == null))) {
      try { const d = await json(a.llama); if (a.llamaId && d.id !== a.llamaId) throw Error('id'); rev = C.merge(rev, C.revenue(d, end)); } catch { notes.push('revenue'); }
      try { prices = C.merge(prices, C.market(await json('https://api.coingecko.com/api/v3/coins/' + a.gecko + '/market_chart?vs_currency=usd&days=365&interval=daily'), end)); } catch { notes.push('market'); }
      rows = C.calculate(seed, rev, prices, end);
    }
    return { rows, notes };
  }

  function card(a) {
    const r = results[a.id];
    if (!r || r.error) return `<article class="dca-card dca-na"><h3>${a.name}</h3><p class="dca-muted">${bi('数据读取失败：', 'Load failed: ')}${r?.error ?? 'NA'}</p></article>`;
    const tt = TIER_TEXT[r.tier.key], amt = D.amount(base, r.tier);
    const pos = Math.max(0, Math.min(100, r.rank));
    return `<article class="dca-card" style="--tier:${r.tier.color}" aria-label="${a.name} ${bi(tt[1][0], tt[1][1])}">
      <header><h3>${a.name}</h3><span class="dca-badge">${bi(tt[1][0], tt[1][1])}</span></header>
      <div class="dca-amount"><span class="dca-big">$${fmt(amt)}</span><span class="dca-muted"> × ${r.tier.mult} · ${bi('基准', 'base')} $${fmt(base)}</span></div>
      <div class="dca-meter" role="img" aria-label="${bi('近1年分位', '1Y percentile')} ${fmt(r.rank, 0)}%"><i style="left:${pos}%"></i></div>
      <div class="dca-scale"><span>0</span><span>20</span><span>50</span><span>80</span><span>100</span></div>
      <dl>
        <dt>${bi(a.label[0], a.label[1])}</dt><dd>${fx(r.pe)} x</dd>
        <dt>${bi('近1年分位', '1Y percentile')}</dt><dd>${fmt(r.rank, 0)}% · ${bi(tt[0][0], tt[0][1])}</dd>
        <dt>P20 / P50 / P80</dt><dd>${fx(r.p20)} / ${fx(r.p50)} / ${fx(r.p80)} x</dd>
        <dt>${bi('数据日', 'As of')}</dt><dd>${r.date} UTC${r.stale ? bi('（最近有效日，新数据待上游发布）', ' (latest valid; newer data pending upstream)') : ''}</dd>
      </dl>
      <a class="dca-link" href="${a.page}">${bi('查看 PE 走势 →', 'View PE chart →')}</a>
    </article>`;
  }

  function render() {
    $('cards').innerHTML = ASSETS.map(card).join('');
    const total = ASSETS.reduce((s, a) => { const r = results[a.id]; return r && !r.error ? s + D.amount(base, r.tier) : s; }, 0);
    $('total').textContent = bi('本期合计推荐：$', 'Total this period: $') + fmt(total) + bi('（三个币种合计，每个基准 $', ' (3 assets combined, base $') + fmt(base) + bi('）', ' each)');
  }

  const input = $('base');
  input.value = base;
  input.addEventListener('input', () => {
    const v = Number(input.value);
    const ok = input.value !== '' && Number.isFinite(v) && v >= 0;
    input.setAttribute('aria-invalid', String(!ok));
    if (!ok) return;
    base = v;
    try { localStorage.setItem(BASE_KEY, String(v)); } catch { /* keep in memory */ }
    render();
  });

  await Promise.all(ASSETS.map(async a => {
    try {
      const res = await fetch('pe-data/' + a.id + '.json', { signal: AbortSignal.timeout(25000), credentials: 'omit' });
      if (!res.ok) throw Error('HTTP ' + res.status);
      const { rows, notes } = await rowsFor(a, await res.json());
      const r = D.evaluate(rows, a.field);
      results[a.id] = r ? { ...r, stale: r.date < a.core().yesterday(), notes } : { error: bi('有效 PE 不足', 'not enough valid PE') };
    } catch (e) { results[a.id] = { error: e.message }; }
  }));
  render();
  window.onI18nChange = render;
})();
