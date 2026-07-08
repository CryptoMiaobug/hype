// valuation.js — 两阶段 DCF 估值模型
// 依赖: api.js (Api.*) + fmt.js (fmt.*)

// ---- 时钟 ----
function tickClock() {
  const el = document.getElementById('clock');
  if (el) el.textContent = new Date().toLocaleString('zh-CN', { hour12: false });
}
setInterval(tickClock, 1000);
tickClock();

// ---- 状态 ----
const state = {
  currentPrice: null,       // HYPE 当前价 (USD)
  currentMcap: null,        // 当前市值 (USD)
  circulatingHype: null,    // maxSupply - 已消失合计
  fetching: false,
};

// ---- URL 参数持久化 ----
function loadFromUrl() {
  const q = new URLSearchParams(location.search);
  const set = (id, key) => {
    const v = q.get(key);
    if (v != null && !isNaN(parseFloat(v))) document.getElementById(id).value = v;
  };
  set('in-baseProfit', 'p');
  set('in-growthAll', 'g');
  set('in-perpetual', 'gt');
  set('in-rf', 'rf');
  set('in-wacc', 'wacc');
  set('in-g1', 'g1'); set('in-g2', 'g2'); set('in-g3', 'g3'); set('in-g4', 'g4'); set('in-g5', 'g5');
  if (q.get('mode') === 'peryear') toggleGrowthMode(true);
}
function saveToUrl() {
  const q = new URLSearchParams();
  q.set('p', document.getElementById('in-baseProfit').value);
  const peryear = !document.getElementById('growth-perYear').classList.contains('hidden');
  if (peryear) {
    q.set('mode', 'peryear');
    ['g1','g2','g3','g4','g5'].forEach(k => q.set(k, document.getElementById('in-'+k).value));
  } else {
    q.set('g', document.getElementById('in-growthAll').value);
  }
  q.set('gt', document.getElementById('in-perpetual').value);
  q.set('rf', document.getElementById('in-rf').value);
  q.set('wacc', document.getElementById('in-wacc').value);
  history.replaceState(null, '', location.pathname + '?' + q.toString());
}

// ---- 展开/收起分年增长率 ----
function toggleGrowthMode(force) {
  const unified = document.getElementById('growth-unified');
  const peryear = document.getElementById('growth-perYear');
  const btn = document.getElementById('btnExpandGrowth');
  const isExpanded = force !== undefined ? force : peryear.classList.contains('hidden');
  if (isExpanded) {
    unified.classList.add('hidden');
    peryear.classList.remove('hidden');
    btn.textContent = '统一 ▴';
    const v = document.getElementById('in-growthAll').value;
    ['g1','g2','g3','g4','g5'].forEach(k => document.getElementById('in-'+k).value = v);
  } else {
    unified.classList.remove('hidden');
    peryear.classList.add('hidden');
    btn.textContent = '分年设置 ▾';
  }
  calc();
}

// ---- 输入↔滑块联动 ----
function pairInputSlider(inputId, sliderId) {
  const inp = document.getElementById(inputId);
  const rng = document.getElementById(sliderId);
  if (!inp || !rng) return;
  inp.addEventListener('input', () => { rng.value = inp.value; calc(); });
  rng.addEventListener('input', () => { inp.value = rng.value; calc(); });
}

// ---- 获取当前参数 ----
function getParams() {
  const base = parseFloat(document.getElementById('in-baseProfit').value) || 0;
  const perp = (parseFloat(document.getElementById('in-perpetual').value) || 0) / 100;
  const rf = (parseFloat(document.getElementById('in-rf').value) || 0) / 100;
  const wacc = (parseFloat(document.getElementById('in-wacc').value) || 0) / 100;
  const peryear = !document.getElementById('growth-perYear').classList.contains('hidden');
  let growths;
  if (peryear) {
    growths = ['g1','g2','g3','g4','g5'].map(k => (parseFloat(document.getElementById('in-'+k).value) || 0) / 100);
  } else {
    const g = (parseFloat(document.getElementById('in-growthAll').value) || 0) / 100;
    growths = [g,g,g,g,g];
  }
  return { base, growths, perp, rf, wacc };
}

// ---- 核心 DCF 计算 ----
function computeDCF(p) {
  const { base, growths, perp, wacc } = p;
  // 前 5 年 FCF
  const fcf = [];
  let prev = base;
  for (let i = 0; i < 5; i++) {
    const cf = prev * (1 + growths[i]);
    fcf.push(cf);
    prev = cf;
  }
  // 折现因子 & PV
  const disc = fcf.map((_, i) => Math.pow(1 + wacc, i + 1));
  const pv = fcf.map((cf, i) => cf / disc[i]);
  const pv1 = pv.reduce((a, b) => a + b, 0);

  // 终值:WACC 必须严格大于 g
  let tv = null, pvTv = null;
  if (wacc > perp) {
    tv = fcf[4] * (1 + perp) / (wacc - perp);
    pvTv = tv / Math.pow(1 + wacc, 5);
  }
  const ev = pvTv != null ? pv1 + pvTv : null;
  return { fcf, disc, pv, pv1, tv, pvTv, ev, growths };
}

// ---- 渲染 ----
let chart = null;
function calc() {
  const p = getParams();
  const r = computeDCF(p);

  // WACC ≤ g 警告
  const warn = document.getElementById('valWarn');
  if (p.wacc <= p.perp) warn.classList.remove('hidden');
  else warn.classList.add('hidden');

  // 高亮卡片
  document.getElementById('r-pv1').textContent = fmt.usdCompact(r.pv1);
  document.getElementById('r-pvTv').textContent = r.pvTv != null ? fmt.usdCompact(r.pvTv) : 'N/A';
  document.getElementById('r-ev').textContent = r.ev != null ? fmt.usdCompact(r.ev) : 'N/A';

  // 预测价格
  const cmp = document.getElementById('r-priceCmp');
  const supEl = document.getElementById('r-supply');
  const priceEl = document.getElementById('r-price');
  if (r.ev != null && state.circulatingHype) {
    const price = r.ev / state.circulatingHype;
    priceEl.textContent = '$' + price.toFixed(2);
    supEl.textContent = fmt.compact(state.circulatingHype);
    if (state.currentPrice) {
      const diff = (price / state.currentPrice - 1) * 100;
      const sign = diff >= 0 ? '+' : '';
      const cls = diff >= 0 ? 'up' : 'down';
      cmp.innerHTML = `vs 当前 $${state.currentPrice.toFixed(2)} · <span class="chg ${cls}">${sign}${diff.toFixed(1)}%</span>`;
    } else {
      cmp.textContent = `流通盘 ${fmt.compact(state.circulatingHype)}`;
    }
  } else {
    priceEl.textContent = '—';
    cmp.textContent = state.circulatingHype ? `流通盘 ${fmt.compact(state.circulatingHype)}` : '需要供应量数据';
  }

  // PE = 当前市值 / 当期利润
  const peEl = document.getElementById('r-pe');
  const peSub = document.getElementById('r-peSub');
  if (state.currentMcap && p.base > 0) {
    const pe = state.currentMcap / p.base;
    peEl.textContent = pe.toFixed(1) + '×';
    peSub.innerHTML = `市值 ${fmt.usdCompact(state.currentMcap)} / 利润 ${fmt.usdCompact(p.base)}`;
  } else {
    peEl.textContent = '—';
    peSub.textContent = state.currentMcap ? '需要利润基数' : '需要当前市值';
  }

  // 明细表
  const body = document.getElementById('tblDCFBody');
  body.innerHTML = r.fcf.map((cf, i) => `
    <tr>
      <td>Y${i + 1}</td>
      <td>${(r.growths[i] * 100).toFixed(1)}%</td>
      <td>${fmt.usdCompact(cf)}</td>
      <td>${r.disc[i].toFixed(4)}</td>
      <td>${fmt.usdCompact(r.pv[i])}</td>
    </tr>
  `).join('');

  // 图表
  renderChart(r);

  // URL 持久化
  saveToUrl();
}

function renderChart(r) {
  if (!chart) chart = echarts.init(document.getElementById('chartDCF'));
  const years = ['Y1','Y2','Y3','Y4','Y5'];
  chart.setOption({
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#0a3d34', borderColor: '#145043', textStyle: { color: '#e6f5f1' },
      formatter: (params) => params.map(p => `${p.marker}${p.seriesName}: ${fmt.usdCompact(p.value)}`).join('<br/>')
    },
    legend: { data: ['预测利润', '折现现值'], textStyle: { color: '#8fb5ac' }, top: 0 },
    grid: { left: 60, right: 30, bottom: 30, top: 40 },
    xAxis: { type: 'category', data: years, axisLine: { lineStyle: { color: '#145043' } }, axisLabel: { color: '#8fb5ac' } },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: '#145043' } },
      axisLabel: { color: '#8fb5ac', formatter: (v) => fmt.usdCompact(v) },
      splitLine: { lineStyle: { color: '#0d4a3f' } },
    },
    series: [
      { name: '预测利润', type: 'bar', data: r.fcf, itemStyle: { color: '#50d2c1', borderRadius: [4,4,0,0] } },
      { name: '折现现值', type: 'line', data: r.pv, smooth: true, symbolSize: 8, itemStyle: { color: '#ffb454' }, lineStyle: { width: 3 } },
    ],
  });
}

// ---- 一键取数 ----
async function fetchDefaults() {
  if (state.fetching) return;
  state.fetching = true;
  const btn = document.getElementById('btnFetch');
  const status = document.getElementById('fetchStatus');
  btn.disabled = true;
  btn.textContent = '⏳ 取数中...';
  status.textContent = '正在拉取:手续费/供应量/HYPE 价格/美债收益率...';

  const timeout = (ms) => new Promise((_, r) => setTimeout(() => r(new Error('timeout')), ms));
  const race = (p, ms) => Promise.race([p, timeout(ms)]);

  const results = await Promise.allSettled([
    race(Api.fees(), 30000),
    race(Api.hypeDetails(), 30000),
    race(Api.holders('HYPE'), 30000),
    race(Api.coingeckoHype(), 30000),
    race(Api.treasuryYield10y(), 30000),
  ]);

  const [feesR, detR, holdersR, cgR, rfR] = results;
  const errors = [];

  // 1. 利润基数 = 过去 360 天手续费 × 97%
  if (feesR.status === 'fulfilled' && Array.isArray(feesR.value) && feesR.value.length > 0) {
    const rows = feesR.value;
    const latest = rows[rows.length - 1];
    const cutoff = latest.time - 360 * 86400;
    let start = rows[0];
    for (const r of rows) { if (r.time <= cutoff) start = r; else break; }
    const diff = latest.total_fees - start.total_fees;
    // hypurrscan total_fees 单位是 wei-ish (1e6 USDC)
    const usdc360 = diff / 1e6;
    const base = usdc360 * 0.97;
    document.getElementById('in-baseProfit').value = Math.round(base);
    document.getElementById('rng-baseProfit').value = Math.min(2000000000, Math.round(base));
    document.getElementById('src-baseProfit').textContent =
      `✓ 过去 360 天手续费 ${fmt.usdCompact(usdc360)} × 97% = ${fmt.usdCompact(base)}`;
  } else {
    errors.push('手续费');
    document.getElementById('src-baseProfit').textContent = '✗ 手续费拉取失败';
  }

  // 2. 供应量 & 已消失合计
  let maxS = null, afBal = 0, nullDead = 0;
  const HYPERCORE_STATIC = 746000;
  if (detR.status === 'fulfilled' && detR.value) {
    maxS = Number(detR.value.maxSupply);
    for (const [a, v] of detR.value.nonCirculatingUserBalances || []) {
      const al = a.toLowerCase();
      if (al === '0x0000000000000000000000000000000000000000' || al === '0x000000000000000000000000000000000000dead') {
        nullDead += Number(v);
      }
    }
  }
  if (holdersR.status === 'fulfilled' && holdersR.value?.holders) {
    const h = holdersR.value.holders;
    const AF = '0xfefefefefefefefefefefefefefefefefefefefe';
    afBal = Number(h[AF] ?? h[AF.toLowerCase()] ?? 0);
  }
  if (maxS) {
    // gasBurn 需要 totalSupply
    const total = Number(detR.value.totalSupply);
    const gasBurn = maxS - total;
    const gone = afBal + HYPERCORE_STATIC + gasBurn + nullDead;
    state.circulatingHype = maxS - gone;
  } else {
    errors.push('供应量');
  }

  // 3. HYPE 当前价 + 市值
  if (cgR.status === 'fulfilled' && cgR.value?.market_data) {
    state.currentPrice = cgR.value.market_data.current_price?.usd ?? null;
    state.currentMcap  = cgR.value.market_data.market_cap?.usd    ?? null;
  }

  // 4. 美债 10 年期
  if (rfR.status === 'fulfilled' && rfR.value != null) {
    document.getElementById('in-rf').value = rfR.value.toFixed(2);
    document.getElementById('rng-rf').value = rfR.value.toFixed(2);
    document.getElementById('src-rf').textContent = `✓ ${rfR.value.toFixed(2)}% (10 年期美债)`;
  } else {
    errors.push('美债利率');
    document.getElementById('src-rf').textContent = '✗ 美债利率拉取失败,请手动填';
  }

  state.fetching = false;
  btn.disabled = false;
  btn.textContent = '🔄 重新取数';
  if (errors.length === 0) {
    status.textContent = '✅ 全部数据已加载';
  } else if (errors.length < 4) {
    status.textContent = `⚠️ 部分失败: ${errors.join('、')}。可以手动填入或再次点击取数`;
  } else {
    status.textContent = `❌ 取数失败: ${errors.join('、')}。请手动填入或稍后重试`;
  }
  calc();
}

// ---- 初始化 ----
document.addEventListener('DOMContentLoaded', () => {
  // 联动
  pairInputSlider('in-baseProfit', 'rng-baseProfit');
  pairInputSlider('in-growthAll', 'rng-growthAll');
  pairInputSlider('in-perpetual', 'rng-perpetual');
  pairInputSlider('in-rf', 'rng-rf');
  pairInputSlider('in-wacc', 'rng-wacc');

  // 分年输入
  ['g1','g2','g3','g4','g5'].forEach(k => {
    document.getElementById('in-'+k).addEventListener('input', calc);
  });

  document.getElementById('btnExpandGrowth').addEventListener('click', () => toggleGrowthMode());
  document.getElementById('btnFetch').addEventListener('click', fetchDefaults);

  loadFromUrl();
  // 若 URL 无参数,自动触发一键取数
  if (!location.search) {
    fetchDefaults();
  } else {
    calc();
  }
});
