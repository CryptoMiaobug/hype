'use strict';
/* PE overview list: one row per asset with price, PE, 1Y percentile and DCA suggestion.
   Data = bundled archive + increments cached in this browser (shared with the coin pages) + a live fill for missing days,
   computed with the same cores as the coin pages, so numbers match them. */
Object.assign(I18N_DICT.zh, {
  'list.win1y': '近1年分位', 'list.winAll': '全部分位', 'list.colPayout': '回馈率', 'list.payoutPaused': '回馈暂停', 'list.title': 'PE 监控总览', 'list.subtitle': '各币种 PE、分位（默认近 1 年，可切换全部）与每周买卖建议 · 点击币种查看详情 · 非会计利润 PE · 价格与 PE 按实时价',
  'list.note': 'PE = 流通市值 ÷ 年化回馈额（HYPE：持币人收入；UNI：协议销毁价值代理；BNB：季度 Auto-Burn + Gas 销毁；AAVE：DAO 协议收入，非实际回购）。分位 = 所选区间（近 1 年 = 近 365 日；全部 = 本站已存的全部日期，各币起点不同）内有效流通 PE 中低于当前值的天数占比，P20/P50/P80 与区间同口径；每周买卖建议（每周看一次）：买入 = 平时每周买入额 × 比例（0–10 分位 300%，10–20 分位 200%，20–30 分位 150%，30–40 分位 125%，40–50 分位 100%，50–60 分位 75%，60–70 分位 50%，70–80 分位 25%）；卖出 = 初始仓位的比例（80–85 分位 2%，85–90 分位 3%，90–95 分位 5%，95 分位以上 8%），不设底仓、卖完为止；从 80 分位以上回落到 70–80 分位、且之后未跌破 70 分位时暂停（不买不卖）。卖出档位未经回测，数据仅约一年。价格、流通 PE、分位与本周操作按 CoinGecko 实时价计算：实时 PE = 数据日收盘 PE × 实时价 ÷ 收盘价（年化回馈额仍截至数据日，30 日滚动，日间变化很小），再与历史每日收盘 PE 比较得出分位；P20/P50/P80 与区间只用收盘数据。小字「收盘」为数据日 D+1 00:00 UTC 近似收盘；实时价获取失败时全部按收盘计算。回馈率 = 实际回馈持币人金额 ÷ 协议收入（DefiLlama dailyHoldersRevenue ÷ dailyRevenue），显示近 30 日，小字为近 1 年；近 30 日低于 10% 标「回馈暂停」。BNB 的回馈主体是季度 Auto-Burn，按公式从存量销毁，与收入无关，回馈率显示「不适用」{auto}。仅供研究，不是投资建议。',
});
Object.assign(I18N_DICT.en, {
  'list.win1y': '1Y percentile', 'list.winAll': 'All-time percentile', 'list.colPayout': 'Payout ratio', 'list.payoutPaused': 'Payout paused', 'list.title': 'PE Monitor Overview', 'list.subtitle': 'PE, percentile (1Y by default, all-time switchable) and weekly buy / sell per asset · tap an asset for details · not accounting-profit PE · price and PE use the live price',
  'list.note': 'PE = circulating market cap ÷ annualized value returned to holders (HYPE: holders revenue; UNI: protocol burn-value proxy; BNB: quarterly Auto-Burn + gas burn; AAVE: DAO protocol revenue, not executed buybacks). Percentile = share of valid days in the selected window (1Y = last 365 days; All = all days stored on this site, start date differs by asset) with circulating PE below the current value; P20/P50/P80 use the same window. Weekly buy / sell (check once a week): buy = your usual weekly buy × the ratio (P0–P10 300%, P10–P20 200%, P20–P30 150%, P30–P40 125%, P40–P50 100%, P50–P60 75%, P60–P70 50%, P70–P80 25%); sell = that % of the initial position (P80–P85 2%, P85–P90 3%, P90–P95 5%, P95+ 8%), no core kept, until sold out; after P80+, a return to P70–P80 is a pause (no trade) until PE drops below P70. Sell tiers are not backtested; only about a year of data. Price, circulating PE, percentile and weekly action use the CoinGecko live price: live PE = the data date’s closing PE × live price ÷ closing price (the annualized value is still as of the data date; it is a 30-day rolling sum and barely moves day to day), then ranked against the daily closing PE history; P20/P50/P80 and the range use closes only. The small “close” figures are approximate closes at D+1 00:00 UTC; if the live price cannot be fetched, everything uses the close. Payout ratio = value actually returned to holders ÷ protocol revenue (DefiLlama dailyHoldersRevenue ÷ dailyRevenue), last 30 days with the 1-year figure below; under 10% over 30 days is flagged “payout paused”. For BNB the payout is dominated by the quarterly Auto-Burn, which is formula-driven from existing supply and unrelated to revenue, so the ratio shows N/A{auto}. Research only, not investment advice.',
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
  const data = {}, rowsBy = {};
  // Percentile window: 365 = last 1 year, 0 = all bundled history. Remembered per browser.
  let win = D.getWin(localStorage);
  let payout = null; // { seed } from PayoutCore.load; null until loaded / on failure
  let quotes = null; // { <gecko id>: { price, chg24, at } } from one CoinGecko simple/price call; null = use closes

  async function json(url) {
    const r = await fetch(url, { signal: AbortSignal.timeout(25000), credentials: 'omit' });
    if (!r.ok) throw Error('HTTP ' + r.status);
    return r.json();
  }
  // Same precedence as the coin pages: bundled rows win; cached/fetched raw inputs only fill later days.
  // Fetched increments are written back to the same localStorage key the coin page uses.
  async function rowsFor(a, seed, notes) {
    const C = a.core(), KEY = 'hypevalue-pe-v1-' + a.id;
    let cache = {};
    try { cache = JSON.parse(localStorage.getItem(KEY) || '{}'); if (cache.seedHash !== seed.sourceSHA256) cache = {}; } catch { cache = {}; }
    let rev = C.merge(seed.revenue, Object.fromEntries(Object.entries(cache.revenue || {}).filter(([d, v]) => day.test(d) && C.valid(v))));
    const cMkt = Object.fromEntries(Object.entries(cache.market || {}).filter(([d, v]) => day.test(d) && Array.isArray(v) && v.length === 2 && v.every(x => C.valid(x) && x > 0)));
    let prices = a.mergeSeedMarket ? C.merge(seed.market, cMkt) : cMkt;
    const end = C.yesterday();
    if (end <= seed.last) return seed.rows;
    let rows = C.calculate(seed, rev, prices, end);
    if (rows.some(r => r.source === 'browser' && (r.price == null || r.r30 == null))) {
      let got = false;
      try { const d = await json(a.llama); if (a.llamaId && d.id !== a.llamaId) throw Error(bi('协议标识不匹配', 'protocol id mismatch')); rev = C.merge(rev, C.revenue(d, end)); got = true; }
      catch (e) { notes.push(a.name + bi(' 收入获取失败：', ' revenue fetch failed: ') + e.message); }
      try { prices = C.merge(prices, C.market(await json('https://api.coingecko.com/api/v3/coins/' + a.gecko + '/market_chart?vs_currency=usd&days=365&interval=daily'), end)); got = true; }
      catch (e) { notes.push(a.name + bi(' 行情获取失败：', ' market fetch failed: ') + e.message); }
      if (got) {
        // Store only raw inputs beyond the bundled archive (same shape the coin pages read).
        const keep = Object.fromEntries(Object.entries(rev).filter(([d]) => !Object.hasOwn(seed.revenue, d)));
        const keepM = Object.fromEntries(Object.entries(prices).filter(([d]) => d > seed.last));
        try { localStorage.setItem(KEY, JSON.stringify({ seedHash: seed.sourceSHA256, revenue: keep, market: keepM, savedAt: new Date().toISOString() })); }
        catch { notes.push(a.name + bi(' 缓存写入失败，本次增量仅在内存中', ' cache write failed; increments kept in memory only')); }
      }
      rows = C.calculate(seed, rev, prices, end);
    }
    return rows;
  }

  // Live quote: price moves PE 1:1, while the 30-day revenue denominator barely moves day to day, so
  // live PE = close PE × live price / close price (denominator stays as of the data date). Percentile and
  // weekly action use the live PE against the closing history; P20/P50/P80 and range stay closing-only.
  // No quote (fetch failed / coin missing) -> everything falls back to the close, as before.
  function summarize(a, rows) {
    const close = D.evaluate(rows, a.field, win);
    if (!close) return null;
    const i = rows.findIndex(r => r.date === close.date), r = rows[i], ago = rows[i - 30];
    const span = win ? rows.slice(-win) : rows, year = span.map(x => x[a.field]).filter(Number.isFinite);
    const q = quotes?.[a.gecko], k = q && r.price > 0 ? q.price / r.price : null;
    const ev = k ? D.evaluate([...rows, { date: 'live', [a.field]: close.pe * k }], a.field, win) : null;
    const cur = ev ?? close, px = k ? q.price : r.price;
    return { ...close, rank: cur.rank, base: cur.base, tier: cur.tier, buffer: cur.buffer, pe: cur.pe,
      live: !!ev, quote: ev ? q : null, closePe: close.pe, closePrice: r.price,
      row: r, price: px, mcap: k ? r.mcap * k : r.mcap, annual: r.annual,
      full: a.field === 'circ' && r.full != null ? r.full * (k ?? 1) : null,
      price30: chg(px, ago?.price), pe30: chg(cur.pe, ago?.[a.field]), min: Math.min(...year), max: Math.max(...year),
      from: span.find(x => Number.isFinite(x[a.field]))?.date, stale: close.date < a.core().yesterday() };
  }
  const hhmm = t => new Date(t).toLocaleTimeString(window.I18n?.lang === 'en' ? 'en-US' : 'zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' });

  function row(a) {
    const s = data[a.id];
    const name = `<a class="pl-coin" href="${a.page}"><b>${a.name}</b><small>${a.full}</small></a>`;
    if (!s) return `<tr data-href="${a.page}"><td class="pl-sticky">${name}</td><td colspan="10" class="pe-muted">${bi('加载中…', 'Loading…')}</td></tr>`;
    if (s.error) return `<tr data-href="${a.page}"><td class="pl-sticky">${name}</td><td colspan="10" class="pe-muted">${bi('读取失败：', 'Load failed: ')}${s.error}</td></tr>`;
    const t = s.tier, pos = Math.max(0, Math.min(100, s.rank));
    return `<tr data-href="${a.page}" style="--tier:${t.color};--ink:${t.ink}">
      <td class="pl-sticky">${name}</td>
      <td><div class="pl-rank"><span>${Math.round(s.rank)}%</span><div class="dca-meter" style="background:${D.gradient()}" role="img" aria-label="${rankLabel()} ${Math.round(s.rank)}%"><i style="left:${pos}%"></i></div></div><small>${bi('自 ', 'since ')}${s.from}</small></td>
      <td><span class="pl-dca"><b>${D.actionText(t, bi)}</b><span class="dca-badge">${bi(t.action[0], t.action[1])}</span></span></td>
      <td class="num">${price(s.price)}${s.live ? `<small>${s.quote.chg24 == null ? '' : '24h ' + signed(s.quote.chg24) + ' · '}${bi('收盘 ', 'close ')}${price(s.closePrice)}</small>` : ''}<small>${bi('30日 ', '30d ')}${signed(s.price30)}</small></td>
      <td class="num">${usd(s.mcap)}</td>
      <td class="num"><b>${num(s.pe)} x</b>${s.live ? `<small>${bi('收盘 ', 'close ')}${num(s.closePe)} x</small>` : ''}<small>${bi('30日 ', '30d ')}${signed(s.pe30)}</small></td>
      <td class="num">${s.full == null ? '—' : num(s.full) + ' x'}</td>
      <td class="num pl-band">${num(s.p20)} / ${num(s.p50)} / ${num(s.p80)}<small>${bi('区间 ', 'range ')}${num(s.min)} – ${num(s.max)}</small></td>
      <td class="num">${usd(s.annual)}<small>${bi(a.basis[0], a.basis[1])}</small></td>
      <td class="num">${payoutCell(a, s)}</td>
      <td class="num">${s.date}${s.stale ? `<small>${bi('最近有效日', 'latest valid')}</small>` : ''}<small>${s.live ? bi('实时价 ', 'live price ') + hhmm(s.quote.at) : bi('收盘价', 'closing price')}</small></td>
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
      return `<span title="${bi('回馈主体为季度 Auto-Burn，按公式销毁，不来自收入', 'Payout is mostly the formula-driven quarterly Auto-Burn, not revenue-funded')}">${bi('不适用', 'N/A')}</span>`;
    }
    const src = payout?.seed?.assets?.[a.id];
    if (!src) return payout === false ? 'NA' : '…';
    const p = P.summary(src, s.date);
    const flag = p.paused ? ` <span class="pl-flag">${bi('回馈暂停', 'Payout paused')}</span>` : '';
    return `<b>${pct(p.w30.ratio)}</b>${flag}<small>${bi('近1年 ', '1Y ')}${pct(p.w365.ratio)}${p.end < s.date ? ' · ' + p.end : ''}</small>`;
  }

  // Footnote carries the live Auto-Burn share (moved out of the BNB table cell to keep the column short).
  function renderNote() {
    const el = $('list-note'), dict = I18N_DICT[window.I18n?.lang === 'en' ? 'en' : 'zh'];
    if (!el || !dict?.['list.note']) return;
    const b = data.bnb && !data.bnb.error && window.PayoutCore ? PayoutCore.bnb(data.bnb.row) : null;
    const auto = b ? bi('，目前 Auto-Burn 占年化回馈额的 ', ', with Auto-Burn currently ') + pct(b.autoShare) + bi('（非收入来源）', ' of the annualized value (not revenue-funded)') : '';
    el.textContent = dict['list.note'].replace('{auto}', auto);
  }

  const rankLabel = () => win ? bi('近1年分位', '1Y percentile') : bi('全部分位', 'All-time percentile');
  // Toggle buttons + rank column header follow the current window.
  function renderWindow() {
    const th = document.querySelector?.('[data-i18n="list.colRank"]');
    if (th) th.textContent = rankLabel();
    document.querySelector?.('.pl-win')?.setAttribute('aria-label', bi('分位区间', 'Percentile window'));
    document.querySelectorAll?.('[data-win]').forEach(b => { const on = +b.dataset.win === win; b.classList.toggle('active', on); b.setAttribute('aria-pressed', on); });
  }
  function render() {
    renderWindow();
    $('pe-list').innerHTML = ASSETS.map(row).join('');
    renderNote();
    fitCue();
  }
  // Right-edge fade only when the table really scrolls sideways.
  function fitCue() {
    const box = document.querySelector?.('.pl-scroll');
    if (box?.classList) box.classList.toggle('fits', box.scrollWidth <= box.clientWidth + 1);
  }
  window.addEventListener?.('resize', fitCue);

  // Whole row is clickable; the coin name stays a real link for keyboard and screen-reader users.
  $('pe-list').addEventListener('click', e => {
    if (e.target.closest('a')) return;
    const tr = e.target.closest('tr[data-href]');
    if (tr) location.href = tr.dataset.href;
  });
  window.onI18nChange = render;
  render();

  // Load (or reload via the refresh button): bundled archive + cache, then fill missing days from public APIs.
  const btn = $('refresh'), status = msg => { const el = $('status'); if (el) el.textContent = msg; };
  let seeds = {}, busy = false;
  // One request for all four live prices. Failure or a missing coin only means that row shows the close.
  async function loadQuotes(notes) {
    try {
      const d = await json('https://api.coingecko.com/api/v3/simple/price?ids=' + ASSETS.map(a => a.gecko).join(',') + '&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true');
      const out = {};
      for (const a of ASSETS) {
        const v = d?.[a.gecko];
        if (v && Number.isFinite(v.usd) && v.usd > 0) out[a.gecko] = { price: v.usd, chg24: Number.isFinite(v.usd_24h_change) ? v.usd_24h_change : null, at: Number.isFinite(v.last_updated_at) ? v.last_updated_at * 1000 : Date.now() };
      }
      quotes = out;
      const miss = ASSETS.filter(a => !out[a.gecko]).map(a => a.name);
      if (miss.length) notes.push(miss.join(' / ') + bi(' 无实时价格，按收盘价计算', ': no live price, using the close'));
    } catch (e) { quotes = null; notes.push(bi('实时价格获取失败，按收盘价计算：', 'Live price fetch failed, using closes: ') + e.message); }
  }
  const recompute = () => { for (const a of ASSETS) if (rowsBy[a.id]) data[a.id] = summarize(a, rowsBy[a.id]) ?? { error: bi('有效 PE 不足', 'not enough valid PE') }; };
  async function load() {
    if (busy) return; busy = true; if (btn) btn.disabled = true;
    status(bi('正在获取最新数据…', 'Fetching latest data…'));
    const notes = [];
    const quoteJob = loadQuotes(notes).then(() => { recompute(); render(); });
    const payoutJob = window.PayoutCore
      ? PayoutCore.load(json, PECore.yesterday()).then(r => { payout = r; }, () => { payout = false; }).then(render)
      : Promise.resolve();
    await Promise.all([payoutJob, ...ASSETS.map(async a => {
      try {
        seeds[a.id] ??= await json('pe-data/' + a.id + '.json');
        const rows = rowsBy[a.id] = await rowsFor(a, seeds[a.id], notes);
        data[a.id] = summarize(a, rows) ?? { error: bi('有效 PE 不足', 'not enough valid PE') };
      } catch (e) { data[a.id] = { error: e.message }; }
      render();
    }), quoteJob]);
    recompute(); render();
    const stale = ASSETS.filter(a => data[a.id]?.stale).map(a => a.name);
    const t = new Date().toLocaleTimeString(window.I18n?.lang === 'en' ? 'en-US' : 'zh-CN', { hour12: false });
    status([bi('更新于 ', 'Updated ') + t,
      stale.length ? stale.join(' / ') + bi(' 暂无昨日数据，显示最近有效日（上游可能尚未发布，稍后可再刷新）', ': no data for yesterday yet, showing latest valid day (upstream may not have published; retry later)') : '',
      ...notes].filter(Boolean).join(' · '));
    busy = false; if (btn) btn.disabled = false;
  }
  if (btn) btn.onclick = load;
  // Switching the window only recomputes from rows already loaded; no refetch.
  document.querySelectorAll?.('[data-win]').forEach(b => b.onclick = () => {
    win = D.setWin(+b.dataset.win, localStorage);
    recompute();
    render();
  });
  await load();
})();
