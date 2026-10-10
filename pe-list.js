'use strict';
/* PE overview list: one row per asset with price, PE, 1Y percentile and DCA suggestion.
   Data = bundled archive + increments the coin pages cached in this browser + a live fill for missing days,
   computed with the same cores as the coin pages, so numbers match them. */
Object.assign(I18N_DICT.zh, {
  'list.colPayout': '回馈率', 'list.payoutPaused': '回馈暂停', 'list.title': 'PE 监控总览', 'list.subtitle': '各币种 PE、近 1 年分位与定投建议 · 点击币种查看详情 · 非会计利润 PE · 非实时行情',
  'list.note': 'PE = 流通市值 ÷ 年化回馈额（HYPE：持币人收入；UNI：协议销毁价值代理；BNB：季度 Auto-Burn + Gas 销毁；AAVE：DAO 协议收入，非实际回购）。分位 = 近 365 日有效流通 PE 中低于当前值的天数占比；定投建议 = 平时定投金额 × 建议比例（低于 20 分位 200%，20–50 分位 100%，50–80 分位 50%，80 分位以上 0%）。价格为 D+1 00:00 UTC 近似收盘。回馈率 = 实际回馈持币人金额 ÷ 协议收入（DefiLlama dailyHoldersRevenue ÷ dailyRevenue），显示近 30 日，小字为近 1 年；近 30 日低于 10% 标「回馈暂停」。BNB 只有 Gas 销毁来自链上收入（100% 销毁），季度 Auto-Burn 按公式从存量销毁，与收入无关，单独显示其占年化回馈额的比例。仅供研究，不是投资建议。',
});
Object.assign(I18N_DICT.en, {
  'list.colPayout': 'Payout ratio', 'list.payoutPaused': 'Payout paused', 'list.title': 'PE Monitor Overview', 'list.subtitle': 'PE, 1-year percentile and DCA suggestion per asset · tap an asset for details · not accounting-profit PE · not real-time',
  'list.note': 'PE = circulating market cap ÷ annualized value returned to holders (HYPE: holders revenue; UNI: protocol burn-value proxy; BNB: quarterly Auto-Burn + gas burn; AAVE: DAO protocol revenue, not executed buybacks). Percentile = share of valid days in the last 365 with circulating PE below the current value. DCA suggestion = your usual DCA amount × the ratio (below P20 200%, P20–P50 100%, P50–P80 50%, above P80 0%). Prices are approximate closes at D+1 00:00 UTC. Payout ratio = value actually returned to holders ÷ protocol revenue (DefiLlama dailyHoldersRevenue ÷ dailyRevenue), last 30 days with the 1-year figure below; under 10% over 30 days is flagged “payout paused”. For BNB only the gas burn is funded by on-chain revenue (100% burned); the quarterly Auto-Burn is formula-driven from existing supply and unrelated to revenue, so its share of the annualized value is shown separately. Research only, not investment advice.',
});
(async () => {
  const D = DCACore, $ = id => document.getElementById(id);
  const bi = (zh, en) => window.I18n?.lang === 'en' ? en : zh;
  const num = (n, d = 2) => Number.isFinite(n) ? n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : 'NA';
  const usd = n => !Number.isFinite(n) ? 'NA' : '$' + (n >= 1e9 ? num(n / 1e9, 2) + 'B' : n >= 1e6 ? num(n / 1e6, 2) + 'M' : num(n, 0));
  const price = n => !Number.isFinite(n) ? 'NA' : '$' + num(n, n >= 1 ? 2 : 4);
  const chg = (a, b) => Number.isFinite(a) && Number.isFinite(b) && b > 0 ? (a / b - 1) * 100 : null;
  const signed = v => v == null ? 'NA' : `<span class="${v >= 0 ? 'up' : 'down'}">${v >= 0 ? '+' : ''}${num(v, 1)}%</span>`;
  const day = /^\d{4}-\d{2}-\d{2}$/;
  const ASSETS = [
    { id: 'hype', name: 'HYPE', full: 'Hyperliquid', page: 'hype-pe.html', field: 'circ', core: () => window.PECore, mergeSeedMarket: true,
      llama: 'https://api.llama.fi/summary/fees/hyperliquid?dataType=dailyHoldersRevenue', llamaId: 'parent#hyperliquid', gecko: 'hyperliquid', basis: ['持币人收入', 'Holders revenue'] },
    { id: 'uni', name: 'UNI', full: 'Uniswap', page: 'uni-pe.html', field: 'circ', core: () => window.PECore, mergeSeedMarket: true,
      llama: 'https://api.llama.fi/summary/fees/uniswap?dataType=dailyRevenue', llamaId: 'parent#uniswap', gecko: 'uniswap', basis: ['销毁价值代理', 'Burn-value proxy'] },
    { id: 'bnb', name: 'BNB', full: 'BNB Chain', page: 'bnb-pe.html', field: 'pe', core: () => window.BNBCore, mergeSeedMarket: false,
      llama: 'https://api.llama.fi/summary/fees/bsc?dataType=dailyRevenue', llamaId: null, gecko: 'binancecoin', basis: ['季度 Auto-Burn + Gas 销毁', 'Quarterly Auto-Burn + gas burn'] },
    { id: 'aave', name: 'AAVE', full: 'Aave', page: 'aave-pe.html', field: 'circ', core: () => window.PECore, mergeSeedMarket: true,
      llama: 'https://api.llama.fi/summary/fees/aave?dataType=dailyRevenue', llamaId: 'parent#aave', gecko: 'aave', basis: ['DAO 协议收入', 'DAO protocol revenue'] },
  ];
  const data = {};
  let payout = null; // { seed } from PayoutCore.load; null until loaded / on failure

  async function json(url) {
    const r = await fetch(url, { signal: AbortSignal.timeout(25000), credentials: 'omit' });
    if (!r.ok) throw Error('HTTP ' + r.status);
    return r.json();
  }
  // Same precedence as the coin pages: bundled rows win; cached/fetched raw inputs only fill later days.
  async function rowsFor(a, seed) {
    const C = a.core();
    let cache = {};
    try { cache = JSON.parse(localStorage.getItem('hypevalue-pe-v1-' + a.id) || '{}'); if (cache.seedHash !== seed.sourceSHA256) cache = {}; } catch { cache = {}; }
    let rev = C.merge(seed.revenue, Object.fromEntries(Object.entries(cache.revenue || {}).filter(([d, v]) => day.test(d) && C.valid(v))));
    const cMkt = Object.fromEntries(Object.entries(cache.market || {}).filter(([d, v]) => day.test(d) && Array.isArray(v) && v.length === 2 && v.every(x => C.valid(x) && x > 0)));
    let prices = a.mergeSeedMarket ? C.merge(seed.market, cMkt) : cMkt;
    const end = C.yesterday();
    if (end <= seed.last) return seed.rows;
    let rows = C.calculate(seed, rev, prices, end);
    if (rows.some(r => r.source === 'browser' && (r.price == null || r.r30 == null))) {
      try { const d = await json(a.llama); if (a.llamaId && d.id !== a.llamaId) throw Error('id'); rev = C.merge(rev, C.revenue(d, end)); } catch { /* keep NA */ }
      try { prices = C.merge(prices, C.market(await json('https://api.coingecko.com/api/v3/coins/' + a.gecko + '/market_chart?vs_currency=usd&days=365&interval=daily'), end)); } catch { /* keep NA */ }
      rows = C.calculate(seed, rev, prices, end);
    }
    return rows;
  }

  function summarize(a, rows) {
    const ev = D.evaluate(rows, a.field);
    if (!ev) return null;
    const i = rows.findIndex(r => r.date === ev.date), r = rows[i], ago = rows[i - 30];
    const year = rows.slice(-365).map(x => x[a.field]).filter(Number.isFinite);
    return { ...ev, row: r, price: r.price, mcap: r.mcap, annual: r.annual, full: a.field === 'circ' ? r.full : null,
      price30: chg(r.price, ago?.price), pe30: chg(ev.pe, ago?.[a.field]), min: Math.min(...year), max: Math.max(...year),
      stale: ev.date < a.core().yesterday() };
  }

  function row(a) {
    const s = data[a.id];
    const name = `<a class="pl-coin" href="${a.page}"><b>${a.name}</b><small>${a.full}</small></a>`;
    if (!s) return `<tr data-href="${a.page}"><td class="pl-sticky">${name}</td><td colspan="10" class="pe-muted">${bi('加载中…', 'Loading…')}</td></tr>`;
    if (s.error) return `<tr data-href="${a.page}"><td class="pl-sticky">${name}</td><td colspan="10" class="pe-muted">${bi('读取失败：', 'Load failed: ')}${s.error}</td></tr>`;
    const t = s.tier, pos = Math.max(0, Math.min(100, s.rank));
    return `<tr data-href="${a.page}" style="--tier:${t.color}">
      <td class="pl-sticky">${name}</td>
      <td><div class="pl-rank"><span>${Math.round(s.rank)}%</span><div class="dca-meter" role="img" aria-label="${bi('近1年分位', '1Y percentile')} ${Math.round(s.rank)}%"><i style="left:${pos}%"></i></div></div></td>
      <td><span class="pl-dca"><b>${t.ratio}%</b><span class="dca-badge">${bi(t.action[0], t.action[1])}</span></span></td>
      <td class="num">${price(s.price)}<small>${bi('30日 ', '30d ')}${signed(s.price30)}</small></td>
      <td class="num">${usd(s.mcap)}</td>
      <td class="num"><b>${num(s.pe)} x</b><small>${bi('30日 ', '30d ')}${signed(s.pe30)}</small></td>
      <td class="num">${s.full == null ? '—' : num(s.full) + ' x'}</td>
      <td class="num pl-band">${num(s.p20)} / ${num(s.p50)} / ${num(s.p80)}<small>${bi('区间 ', 'range ')}${num(s.min)} – ${num(s.max)}</small></td>
      <td class="num">${usd(s.annual)}<small>${bi(a.basis[0], a.basis[1])}</small></td>
      <td class="num">${payoutCell(a, s)}</td>
      <td class="num">${s.date}${s.stale ? `<small>${bi('最近有效日', 'latest valid')}</small>` : ''}</td>
    </tr>`;
  }

  const pct = v => v == null ? 'NA' : num(v * 100, 1) + '%';
  // Payout ratio cell: actual holder payout ÷ protocol revenue (30d, 1y below). BNB splits gas burn vs Auto-Burn.
  function payoutCell(a, s) {
    const P = window.PayoutCore;
    if (!P) return '—';
    if (a.id === 'bnb') {
      const b = P.bnb(s.row);
      if (!b) return 'NA';
      return `<span title="${bi('Gas 销毁来自链上收入，100% 销毁', 'Gas burn is funded by on-chain revenue, 100% burned')}">${bi('Gas 100%', 'Gas 100%')}</span><small>${bi('Auto-Burn 占 ', 'Auto-Burn ')}${pct(b.autoShare)}${bi('（非收入来源）', ' (not revenue-funded)')}</small>`;
    }
    const src = payout?.seed?.assets?.[a.id];
    if (!src) return payout === false ? 'NA' : '…';
    const p = P.summary(src, s.date);
    const flag = p.paused ? ` <span class="pl-flag">${bi('回馈暂停', 'Payout paused')}</span>` : '';
    return `<b>${pct(p.w30.ratio)}</b>${flag}<small>${bi('近1年 ', '1Y ')}${pct(p.w365.ratio)}${p.end < s.date ? ' · ' + p.end : ''}</small>`;
  }

  function render() {
    $('pe-list').innerHTML = ASSETS.map(row).join('');
  }

  // Whole row is clickable; the coin name stays a real link for keyboard and screen-reader users.
  $('pe-list').addEventListener('click', e => {
    if (e.target.closest('a')) return;
    const tr = e.target.closest('tr[data-href]');
    if (tr) location.href = tr.dataset.href;
  });
  window.onI18nChange = render;
  render();

  const payoutJob = window.PayoutCore
    ? PayoutCore.load(json, PECore.yesterday()).then(r => { payout = r; }, () => { payout = false; }).then(render)
    : Promise.resolve();
  await Promise.all([payoutJob, ...ASSETS.map(async a => {
    try {
      const rows = await rowsFor(a, await json('pe-data/' + a.id + '.json'));
      data[a.id] = summarize(a, rows) ?? { error: bi('有效 PE 不足', 'not enough valid PE') };
    } catch (e) { data[a.id] = { error: e.message }; }
    render();
  })]);
})();
