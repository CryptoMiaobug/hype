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

    renderFeesCharts(rows);
  });

  // EVM rolling-24h
  Api.evmRolling24h().then((e) => {
    if (!e || !e.success) return;
    document.getElementById('s-evmtx').textContent = fmt.compact(e.txs);
    document.getElementById('s-evmusers').textContent = fmt.compact(e.unique_users);
    // hype_burned 单位 1e18 (wei)
    const burned = Number(e.hype_burned) / 1e18;
    document.getElementById('s-burn').textContent = fmt.compact(burned) + ' HYPE';
  });

  // EVM stats（累计合约数）
  Api.evmStats().then((e) => {
    if (!e || !e.stats) return;
    // 无直接合约总数字段，用 tokens_indexed 兜底显示
    const c = e.stats.contracts_deployed ?? e.stats.tokens_indexed;
    if (c != null) document.getElementById('s-contracts').textContent = fmt.compact(c);
  });
}

// ---- fees 图表 ----
function renderFeesCharts(rows) {
  const times = rows.map((r) => new Date(r.time * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
  const cumulative = rows.map((r) => +(r.total_fees / FEES_SCALE).toFixed(0));

  // 每日增量
  const daily = rows.map((r, i) => {
    if (i === 0) return 0;
    return +((r.total_fees - rows[i - 1].total_fees) / FEES_SCALE).toFixed(0);
  });

  const common = {
    grid: { left: 60, right: 20, top: 20, bottom: 40 },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: times, axisLabel: { color: '#8fb5ac' }, axisLine: { lineStyle: { color: '#145043' } } },
    yAxis: { type: 'value', axisLabel: { color: '#8fb5ac', formatter: (v) => fmt.compact(v) }, splitLine: { lineStyle: { color: '#145043' } } },
    textStyle: { color: '#e6f5f1' },
  };

  const c1 = echarts.init(document.getElementById('chartFees'));
  c1.setOption({ ...common, series: [{ type: 'line', data: cumulative, smooth: true, areaStyle: { color: 'rgba(80,210,193,.2)' }, lineStyle: { color: '#50d2c1' }, itemStyle: { color: '#50d2c1' }, showSymbol: false }] });

  const c2 = echarts.init(document.getElementById('chartDailyFees'));
  c2.setOption({ ...common, series: [{ type: 'bar', data: daily, itemStyle: { color: '#1fd286' } }] });

  window.addEventListener('resize', () => { c1.resize(); c2.resize(); });
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
