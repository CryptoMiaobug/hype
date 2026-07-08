// app.js — 渲染逻辑
// 每个模块独立加载，某个数据源挂了不影响其它面板（留空处理）

// ---- 时钟 ----
function tickClock() {
  const el = document.getElementById('clock');
  if (el) el.textContent = new Date().toLocaleString('zh-CN', { hour12: false });
}
setInterval(tickClock, 1000);
tickClock();

// ---- 大盘统计 ----
async function loadOverview() {
  // HYPE 行情：CoinGecko（价格 / 市值 / FDV / 24h + 7d 涨跌 / 24h 成交）
  Api.coingeckoHype().then((d) => {
    if (!d || !d.market_data) return;
    const md = d.market_data;
    const price = md.current_price?.usd;
    const chg24 = md.price_change_percentage_24h;
    const chg7d = md.price_change_percentage_7d;
    const mcap = md.market_cap?.usd;
    const fdv = md.fully_diluted_valuation?.usd;
    const vol = md.total_volume?.usd;

    const setChg = (id, v) => {
      const el = document.getElementById(id);
      if (!el || v == null) return;
      const sign = v >= 0 ? '+' : '';
      el.textContent = `${sign}${v.toFixed(2)}%`;
      el.classList.remove('up', 'down');
      el.classList.add(v >= 0 ? 'up' : 'down');
    };
    if (price != null) document.getElementById('s-hypePrice').textContent = `$${price.toFixed(2)}`;
    if (price != null) { window.__hypeCurrentPrice = price; tryRenderValuationTeaser(); }
    setChg('s-hypeChg24', chg24);
    setChg('s-hypeChg7d', chg7d);
    if (mcap) document.getElementById('s-hypeMcap').textContent = fmt.usdCompact(mcap);
    if (fdv)  document.getElementById('s-hypeFdv').textContent  = fmt.usdCompact(fdv);
    if (vol)  document.getElementById('s-hypeVol').textContent  = fmt.usdCompact(vol);
  }).catch(() => {});

  // globalStats
  Api.globalStats().then((g) => {
    if (!g) return;
    document.getElementById('s-vol24').textContent = fmt.usdCompact(g.dailyVolume);
    document.getElementById('s-volTotal').textContent = fmt.usdCompact(g.totalVolume);
    document.getElementById('s-users').textContent = fmt.compact(g.nUsers);
  });

  // fees（24h = 最新 - 24h前，累计 = 最新）
  Api.fees().then((rows) => {
    if (!rows || !rows.length) return;
    const latest = rows[rows.length - 1];
    const total = latest.total_fees / FEES_SCALE;
    document.getElementById('s-feesTotal').textContent = fmt.usdCompact(total);

    // 找 ~24h 前的点
    const cutoff = latest.time - 86400;
    let prev = rows[0];
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i].time <= cutoff) { prev = rows[i]; break; }
    }
    const fees24 = (latest.total_fees - prev.total_fees) / FEES_SCALE;
    document.getElementById('s-fees24').textContent = fmt.usdCompact(fees24);

    // 价值测算入口卡需要 360 天手续费
    const cutoff360 = latest.time - 360 * 86400;
    let start360 = rows[0];
    for (const r of rows) { if (r.time <= cutoff360) start360 = r; else break; }
    const fees360 = (latest.total_fees - start360.total_fees) / FEES_SCALE;
    window.__hypeBase360Fees = fees360 * 0.97;
    tryRenderValuationTeaser();

    renderFeesCharts(rows);
  });

  // EVM rolling-24h
  Api.evmRolling24h().then((e) => {
    if (!e || !e.success) return;
    document.getElementById('s-evmtx').textContent = fmt.compact(e.txs);
    document.getElementById('s-evmusers').textContent = fmt.compact(e.unique_users);
  });

  // EVM stats（累计合约数）
  Api.evmStats().then((e) => {
    if (!e || !e.stats) return;
    // 无直接合约总数字段，用 tokens_indexed 兜底显示
    const c = e.stats.contracts_deployed ?? e.stats.tokens_indexed;
    if (c != null) document.getElementById('s-contracts').textContent = fmt.compact(c);
  });

  // AF 累计回购（援助基金持有的 HYPE：0x2222 主 AF + 0xfefe 现货 AF）
  // + HYPE 供应量（用于算 AF 占比 和 累计销毁）
  Promise.all([Api.holders('HYPE'), Api.hypeDetails()]).then(([d, det]) => {
    const total = det ? Number(det.totalSupply) : null;
    const maxS = det ? Number(det.maxSupply) : null;
    let afBal = 0;
    let gasBurn = 0;

    // AF 已销毁：仅 0xfefe 现货 AF 地址（2025/12 验证节点投票确认永久销毁）
    // 0x2222 是 L1<->EVM 桥接系统地址，不是 AF，不能算入
    let nullDead = 0;
    if (d && d.holders) {
      const AF_ADDR = '0xfefefefefefefefefefefefefefefefefefefefe';
      const NULL_ADDR = '0x0000000000000000000000000000000000000000';
      const DEAD_ADDR = '0x000000000000000000000000000000000000dead';
      const h = d.holders;
      afBal = Number(h[AF_ADDR] ?? h[AF_ADDR.toLowerCase()] ?? 0);
      nullDead = Number(h[NULL_ADDR] ?? h[NULL_ADDR.toLowerCase()] ?? 0)
               + Number(h[DEAD_ADDR] ?? h[DEAD_ADDR.toLowerCase()] ?? 0);
    }

    // 累计销毁 = maxSupply - totalSupply（Gas 直接从 supply 扣）
    if (maxS && total) {
      gasBurn = maxS - total;
    }

    // HyperCore 协议销毁：HIP-1 现货手续费销毁 + HIP-3 slash + 拍卖 gas
    // • 无公开 API 直接取，hl.eco 前端占位值 746K，待未来有实时数据时更新
    const HYPERCORE_BURN_STATIC = 746_000;

    // HYPE 已消失合计 = AF + HyperCore + Gas + Null/Dead
    if (afBal > 0 && gasBurn > 0 && maxS) {
      const gone = afBal + HYPERCORE_BURN_STATIC + gasBurn + nullDead;
      document.getElementById('s-goneTotal').textContent = fmt.compact(gone) + ' HYPE';
      document.getElementById('s-gonePct').textContent = (gone / maxS * 100).toFixed(2) + '%';
      document.getElementById('s-goneAF').textContent = fmt.compact(afBal) + ' HYPE';
      document.getElementById('s-goneHc').textContent = fmt.compact(HYPERCORE_BURN_STATIC) + ' HYPE';
      document.getElementById('s-goneGas').textContent = fmt.compact(gasBurn) + ' HYPE';
      document.getElementById('s-goneNull').textContent = fmt.compact(nullDead) + ' HYPE';

      // 交给价值测算入口卡使用
      window.__hypeSupplyData = { maxS, gone, circulating: maxS - gone };
      tryRenderValuationTeaser();
    }
  });
}

// ---- 仪表盘预测价格入口卡（与 valuation.js 默认参数一致）----
// 默认参数: growth=25%, perp=8%, wacc=10%, base = 360天手续费 × 97%
async function tryRenderValuationTeaser() {
  const sup = window.__hypeSupplyData;
  const price = window.__hypeCurrentPrice;
  const base = window.__hypeBase360Fees;
  if (!sup || !price || !base) return;

  const g = 0.25, perp = 0.08, wacc = 0.10;
  let prev = base, pv1 = 0;
  for (let i = 0; i < 5; i++) {
    prev = prev * (1 + g);
    pv1 += prev / Math.pow(1 + wacc, i + 1);
  }
  const tv = prev * (1 + perp) / (wacc - perp);
  const pvTv = tv / Math.pow(1 + wacc, 5);
  const ev = pv1 + pvTv;
  const predicted = ev / sup.circulating;

  document.getElementById('vt-price').textContent = '$' + predicted.toFixed(2);
  const diff = (predicted / price - 1) * 100;
  const sign = diff >= 0 ? '+' : '';
  const cls = diff >= 0 ? 'up' : 'down';
  document.getElementById('vt-cmp').innerHTML =
    `vs 当前 $${price.toFixed(2)} · <span class="chg ${cls}">${sign}${diff.toFixed(1)}%</span>`;
}

// ---- fees 图表 ----
let _dailyFeesChart = null;
let _dailyFeesRows = null;
let _dailyFeesCommon = null;

function renderDailyFeesChart(days) {
  if (!_dailyFeesRows || !_dailyFeesChart) return;
  const rows = _dailyFeesRows;
  // 取尾部 days 天（days=0 或 <=0 表示全部）
  const start = days > 0 ? Math.max(1, rows.length - days) : 1; // 首个点无前一天无法算增量，从x1开始
  const slice = rows.slice(start - 1); // 包含前一个点作为基准
  const times = slice.slice(1).map((r) => new Date(r.time * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
  const daily = slice.slice(1).map((r, i) => +((r.total_fees - slice[i].total_fees) / FEES_SCALE).toFixed(0));
  // 区间合计 = 区间末点累计 - 区间起点前一天累计
  const sumEl = document.getElementById('dailyFeesSum');
  if (sumEl) {
    const sum = daily.reduce((a, b) => a + b, 0);
    const label = days > 0 ? `${days}天合计` : `全部合计`;
    sumEl.textContent = `${label} ${fmt.usdCompact(sum)}`;
  }
  _dailyFeesChart.setOption({
    ..._dailyFeesCommon,
    xAxis: { ..._dailyFeesCommon.xAxis, data: times },
    series: [{ type: 'bar', data: daily, itemStyle: { color: '#1fd286' } }],
  });
}

function renderFeesCharts(rows) {
  // 带年份的完整日期："Nov 17, 2024"（tooltip 显示 + 坐标轴拆两行）
  const times = rows.map((r) => new Date(r.time * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
  const cumulative = rows.map((r) => +(r.total_fees / FEES_SCALE).toFixed(0));

  const common = {
    grid: { left: 60, right: 20, top: 20, bottom: 52 },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: times,
      axisLabel: {
        color: '#8fb5ac',
        // "Nov 17, 2024" -> 两行："Nov 17" / "2024"
        formatter: (v) => (v || '').replace(', ', '\n'),
        lineHeight: 14,
      },
      axisLine: { lineStyle: { color: '#145043' } },
    },
    yAxis: { type: 'value', axisLabel: { color: '#8fb5ac', formatter: (v) => fmt.compact(v) }, splitLine: { lineStyle: { color: '#145043' } } },
    textStyle: { color: '#e6f5f1' },
  };

  const c1 = echarts.init(document.getElementById('chartFees'));
  c1.setOption({ ...common, series: [{ type: 'line', data: cumulative, smooth: true, areaStyle: { color: 'rgba(80,210,193,.2)' }, lineStyle: { color: '#50d2c1' }, itemStyle: { color: '#50d2c1' }, showSymbol: false }] });

  // 每日增量图：默认 30 天，标签可切换
  _dailyFeesChart = echarts.init(document.getElementById('chartDailyFees'));
  _dailyFeesRows = rows;
  _dailyFeesCommon = common;
  renderDailyFeesChart(30);

  // 绑切换标签（只绑一次）
  const tabs = document.getElementById('dailyFeesRange');
  if (tabs && !tabs.dataset.bound) {
    tabs.dataset.bound = '1';
    tabs.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-days]');
      if (!btn) return;
      tabs.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      renderDailyFeesChart(Number(btn.dataset.days));
    });
  }

  window.addEventListener('resize', () => { c1.resize(); _dailyFeesChart.resize(); });
}

// ---- 永续行情 ----
async function loadPerps() {
  const d = await Api.metaAndAssetCtxs();
  const tbody = document.querySelector('#perpTable tbody');
  if (!d || !d[0] || !d[1]) { tbody.innerHTML = '<tr><td colspan="6" class="empty">数据暂不可用</td></tr>'; return; }

  const universe = d[0].universe;
  const ctxs = d[1];
  const rows = universe.map((u, i) => ({ name: u.name, ...ctxs[i] }))
    .filter((r) => r.midPx)
    .sort((a, b) => Number(b.dayNtlVlm) - Number(a.dayNtlVlm));

  document.getElementById('perpCount').textContent = rows.length + ' 币种';

  tbody.innerHTML = rows.map((r) => {
    const mark = Number(r.markPx);
    const prev = Number(r.prevDayPx);
    const chg = prev ? (mark - prev) / prev : 0;
    const cls = chg >= 0 ? 'up' : 'down';
    const sign = chg >= 0 ? '+' : '';
    const funding = Number(r.funding);
    const fcls = funding >= 0 ? 'up' : 'down';
    return `<tr>
      <td class="coin-name">${r.name}</td>
      <td class="num">${mark.toLocaleString('en-US', { maximumFractionDigits: 6 })}</td>
      <td class="num ${cls}">${sign}${(chg * 100).toFixed(2)}%</td>
      <td class="num ${fcls}">${(funding * 100).toFixed(4)}%</td>
      <td class="num">${fmt.usdCompact(Number(r.openInterest) * mark)}</td>
      <td class="num">${fmt.usdCompact(Number(r.dayNtlVlm))}</td>
    </tr>`;
  }).join('');
}

// ---- 现货行情 ----
async function loadSpot() {
  const d = await Api.spotMetaAndAssetCtxs();
  const tbody = document.querySelector('#spotTable tbody');
  if (!d || !d[0] || !d[1]) { tbody.innerHTML = '<tr><td colspan="4" class="empty">数据暂不可用</td></tr>'; return; }

  const tokens = d[0].tokens;       // [{name, index,...}]
  const universe = d[0].universe;   // [{name:"@1", tokens:[baseIdx, quoteIdx], index}]
  const ctxs = d[1];

  // 注意：universe 与 ctxs 不是同序数组，ctx.coin 才是关联键。
  // 先建 pair名(@N / PURR/USDC) -> base token 名 的映射，再遍历 ctxs 按 coin 关联。
  const baseNameByPair = {};
  universe.forEach((u) => {
    const baseTok = tokens[u.tokens[0]];
    baseNameByPair[u.name] = baseTok ? baseTok.name : u.name;
  });

  const rows = ctxs
    .filter((c) => c && c.midPx)
    .map((c) => ({ name: baseNameByPair[c.coin] || c.coin, ...c }))
    .sort((a, b) => Number(b.dayNtlVlm) - Number(a.dayNtlVlm));

  document.getElementById('spotCount').textContent = rows.length + ' 币种';

  tbody.innerHTML = rows.map((r) => {
    const px = Number(r.midPx || r.markPx);
    const prev = Number(r.prevDayPx);
    const chg = prev ? (px - prev) / prev : 0;
    const cls = chg >= 0 ? 'up' : 'down';
    const sign = chg >= 0 ? '+' : '';
    return `<tr>
      <td class="coin-name">${r.name}</td>
      <td class="num">${px.toLocaleString('en-US', { maximumFractionDigits: 6 })}</td>
      <td class="num ${cls}">${sign}${(chg * 100).toFixed(2)}%</td>
      <td class="num">${fmt.usdCompact(Number(r.dayNtlVlm))}</td>
    </tr>`;
  }).join('');
}

// ---- 富豪榜（可能为空）----
async function loadRichList() {
  const box = document.getElementById('richListBox');
  const d = await Api.richList(50);
  const list = Array.isArray(d) ? d : (d && d.holders) || (d && d.list) || null;
  if (!list || !list.length) { box.innerHTML = '<div class="empty">数据暂不可用（该索引接口未开放或为空）</div>'; return; }

  box.innerHTML = `<table><thead><tr><th>#</th><th>地址</th><th class="num">余额</th></tr></thead><tbody>${
    list.map((r, i) => {
      const addr = r.address || r.addr || r.account || '';
      const bal = r.balance ?? r.amount ?? r.value;
      return `<tr><td>${i + 1}</td><td><a href="#" title="${addr}">${fmt.addr(addr)}</a></td><td class="num">${fmt.compact(bal)}</td></tr>`;
    }).join('')
  }</tbody></table>`;
}

// ---- 启动 ----
loadOverview();
loadPerps();
loadSpot();
loadRichList();

// 定时刷新行情
setInterval(() => { loadPerps(); loadSpot(); }, 30000);
