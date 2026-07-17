// valuation.js — 两阶段 DCF 估值模型
// 依赖: api.js (Api.*) + fmt.js (fmt.*)

// 模块解析期快照原始 URL,此时任何 DOMContentLoaded 都还没触发,
// 避免 i18n.init -> apply -> onI18nChange -> calc -> saveToUrl 抢先污染 location.search
const INITIAL_SEARCH = location.search;

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
  currentMcap: null,        // 流通市值 (CoinGecko)
  currentFdv: null,         // 全稀释市值 FDV
  circulatingHype: null,    // maxSupply - 已消失合计
  fetching: false,
  // 分享用: 最新一次 calc 的结果
  lastPrice: null,
  lastDiffPct: null,
  lastEv: null,
};

// ---- URL 参数持久化 ----
function loadFromUrl() {
  // 从模块解析期快照读取,此时 location.search 可能已被 saveToUrl 写成默认值
  const q = new URLSearchParams(INITIAL_SEARCH);
  const set = (id, key) => {
    const v = q.get(key);
    if (v != null && !isNaN(parseFloat(v))) document.getElementById(id).value = v;
  };
  set('in-baseProfit', 'p');
  set('in-supply', 's');
  set('in-growthAll', 'g');
  set('in-perpetual', 'gt');
  set('in-rf', 'rf');
  set('in-wacc', 'wacc');
  set('in-g1', 'g1'); set('in-g2', 'g2'); set('in-g3', 'g3'); set('in-g4', 'g4'); set('in-g5', 'g5');
  // 分享链接携带的当前价/市值(供 PE 与对比)，直接填 state，不需取数
  const curV = parseFloat(q.get('cur'));
  if (!isNaN(curV) && curV > 0) state.currentPrice = curV;
  const mcV = parseFloat(q.get('mc'));
  if (!isNaN(mcV) && mcV > 0) state.currentMcap = mcV;
  const sV = parseFloat(q.get('s'));
  if (!isNaN(sV) && sV > 0) {
    state.circulatingHype = sV;
    const supSrc = document.getElementById('src-supply');
    if (supSrc) {
      supSrc.textContent = (window.I18n ? I18n.t('val.supplyShared', { v: fmt.compact(sV) }) : '');
      supSrc.removeAttribute('data-i18n');
    }
  }
  if (q.get('mode') === 'peryear') toggleGrowthMode(true, true);
  // 跟随发起人语言 (不写 localStorage,避免污染朋友自己选的)
  const hl = q.get('hl');
  if ((hl === 'zh' || hl === 'en') && window.I18n) {
    if (typeof I18n.setTemp === 'function') I18n.setTemp(hl);
    else if (I18n.lang !== hl) I18n.set(hl);
  }
}
function saveToUrl() {
  const q = new URLSearchParams();
  q.set('p', document.getElementById('in-baseProfit').value);
  const supplyVal = document.getElementById('in-supply').value;
  if (supplyVal && parseFloat(supplyVal) > 0) q.set('s', supplyVal);
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
  // 保留 URL 中已有的 hl 参数 (跟随发起人语言)
  const prev = new URLSearchParams(location.search);
  const hl = prev.get('hl');
  if (hl === 'zh' || hl === 'en') q.set('hl', hl);
  history.replaceState(null, '', location.pathname + '?' + q.toString());
}

// ---- 分享 ----
function buildShareUrl() {
  // 先确保最新参数已写入
  saveToUrl();
  const q = new URLSearchParams(location.search);
  // 分享时把当前语言带上,朋友打开时语言一致
  const lang = (window.I18n && I18n.lang) || 'zh';
  q.set('hl', lang);
  // 携带供应量 + 当前价/市值,朋友打开无需取数即可算价格/PE
  if (state.circulatingHype) q.set('s', Math.round(state.circulatingHype));
  if (state.currentPrice) q.set('cur', state.currentPrice);
  if (state.currentMcap) q.set('mc', Math.round(state.currentMcap));
  return location.origin + location.pathname + '?' + q.toString();
}

function buildShareText() {
  const T = (k, v) => (window.I18n ? I18n.t(k, v) : k);
  const price = state.lastPrice;
  const diff = state.lastDiffPct;
  const cur = state.currentPrice;
  if (price != null && diff != null && cur != null) {
    const sign = diff >= 0 ? '+' : '';
    return T('val.shareText', {
      price: price.toFixed(2),
      cur: cur.toFixed(2),
      sign, diff: diff.toFixed(1),
    });
  }
  if (price != null) {
    return T('val.shareTextNoCmp', { price: price.toFixed(2) });
  }
  return T('val.shareTextFallback');
}

async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
    // 回退
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (e) {
    return false;
  }
}

function flashButton(btnId, i18nKey, revertKey, ms = 2000) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  const T = (k) => (window.I18n ? I18n.t(k) : k);
  btn.textContent = T(i18nKey);
  btn.setAttribute('data-i18n', i18nKey);
  setTimeout(() => {
    btn.textContent = T(revertKey);
    btn.setAttribute('data-i18n', revertKey);
  }, ms);
}

function setShareStatus(i18nKey, vars) {
  const el = document.getElementById('fetchStatus');
  if (!el) return;
  const T = (k, v) => (window.I18n ? I18n.t(k, v) : k);
  el.textContent = T(i18nKey, vars);
  el.setAttribute('data-i18n', i18nKey);
}

async function shareValuation() {
  const url = buildShareUrl();
  const text = buildShareText();
  const T = (k, v) => (window.I18n ? I18n.t(k, v) : k);
  // 优先尝试系统 Web Share (手机上体验好)
  if (navigator.share) {
    try {
      await navigator.share({ title: T('val.shareTitle'), text, url });
      setShareStatus('val.shareOk');
      return;
    } catch (e) {
      // 用户取消或不支持 -> 走剪贴板
      if (e && e.name === 'AbortError') return;
    }
  }
  // 回退: 拷贝 “文案 + 链接”
  const ok = await copyToClipboard(text + '\n' + url);
  if (ok) {
    flashButton('btnShare', 'val.shareBtnCopied', 'val.shareBtn');
    setShareStatus('val.shareRichCopied');
  } else {
    setShareStatus('val.shareFailed', { url });
  }
}

async function copyShareLink() {
  const url = buildShareUrl();
  const ok = await copyToClipboard(url);
  if (ok) {
    flashButton('btnShareLink', 'val.shareLinkCopied', 'val.shareLinkBtn');
    setShareStatus('val.shareLinkOk');
  } else {
    setShareStatus('val.shareFailed', { url });
  }
}

// ---- 展开/收起分年增长率 ----
function toggleGrowthMode(force, skipCopy) {
  const unified = document.getElementById('growth-unified');
  const peryear = document.getElementById('growth-perYear');
  const btn = document.getElementById('btnExpandGrowth');
  const isExpanded = force !== undefined ? force : peryear.classList.contains('hidden');
  const T = (k) => (window.I18n ? I18n.t(k) : k);
  if (isExpanded) {
    unified.classList.add('hidden');
    peryear.classList.remove('hidden');
    btn.textContent = T('val.growthCollapse');
    btn.setAttribute('data-i18n', 'val.growthCollapse');
    // skipCopy: 从分享链接载入时,分年值已由 URL 填好,不要用统一值覆盖
    if (!skipCopy) {
      const v = document.getElementById('in-growthAll').value;
      ['g1','g2','g3','g4','g5'].forEach(k => document.getElementById('in-'+k).value = v);
    }
  } else {
    unified.classList.remove('hidden');
    peryear.classList.add('hidden');
    btn.textContent = T('val.growthExpand');
    btn.setAttribute('data-i18n', 'val.growthExpand');
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
  const baseEl = document.getElementById('in-baseProfit');
  const rawBase = baseEl ? baseEl.value : '';
  const base = parseFloat(rawBase) || 0;
  const supplyEl = document.getElementById('in-supply');
  const supply = supplyEl ? (parseFloat(supplyEl.value) || 0) : 0;
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
  return { base, supply, growths, perp, rf, wacc };
}

// ---- 核心 DCF 计算 ----
function computeDCF(p) {
  const { base, growths, perp, wacc } = p;
  // 帮用户排查：打印每次计算的入参
  console.log('[HypeValue.DCF]', { base, growths, perp, wacc, currentMcap: state.currentMcap, currentPrice: state.currentPrice });
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

  // 供应量以输入框为准(可手改/分享链接携带); >0 时同步到 state
  if (p.supply > 0) state.circulatingHype = p.supply;

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
  const priceEl = document.getElementById('r-price');
  const T = (k, v) => (window.I18n ? I18n.t(k, v) : k);
  // 注意: 不再依赖 #r-supply 嵌套 span —— 一旦对 cmp 写 textContent/innerHTML,
  // 该子节点就被销毁, 下次 getElementById 返回 null 会导致 calc 崩溃(PE 永远渲染不到)。
  if (r.ev != null && state.circulatingHype) {
    const price = r.ev / state.circulatingHype;
    state.lastPrice = price;
    state.lastEv = r.ev;
    if (priceEl) priceEl.textContent = '$' + price.toFixed(2);
    if (cmp) {
      if (state.currentPrice) {
        const diff = (price / state.currentPrice - 1) * 100;
        state.lastDiffPct = diff;
        const sign = diff >= 0 ? '+' : '';
        const cls = diff >= 0 ? 'up' : 'down';
        cmp.innerHTML = T('val.priceVs', { cur: state.currentPrice.toFixed(2) })
          + `<span class="chg ${cls}">${sign}${diff.toFixed(1)}%</span>`;
      } else {
        state.lastDiffPct = null;
        cmp.textContent = `${T('val.priceSubDefault')} ${fmt.compact(state.circulatingHype)}`;
      }
    }
  } else {
    state.lastPrice = null;
    state.lastDiffPct = null;
    if (priceEl) priceEl.textContent = '—';
    if (cmp) {
      cmp.textContent = state.circulatingHype
        ? `${T('val.priceSubDefault')} ${fmt.compact(state.circulatingHype)}`
        : T('val.priceNeedSupply');
    }
  }

  // PE：双口径
  const peEl = document.getElementById('r-pe');
  const peSub = document.getElementById('r-peSub');
  if (p.base > 0) {
    const peCirc = state.currentMcap ? (state.currentMcap / p.base) : null;
    const adjFdv = (state.circulatingHype && state.currentPrice)
      ? state.circulatingHype * state.currentPrice : null;
    const peFdv  = adjFdv ? (adjFdv / p.base) : null;
    if (peCirc != null && peFdv != null) {
      peEl.innerHTML = `${peCirc.toFixed(1)}× <span style="color:var(--text-dim);font-size:14px;">/</span> ${peFdv.toFixed(1)}×`;
      peSub.innerHTML =
        `<span title="${T('val.peTipCirc', {v: fmt.usdCompact(state.currentMcap)})}" data-i18n="val.peCirc">${T('val.peCirc')}</span> / ` +
        `<span title="${T('val.peTipFdv', {v: fmt.usdCompact(adjFdv)})}" data-i18n="val.peFdvAdj">${T('val.peFdvAdj')}</span>` +
        T('val.pePart3', {base: fmt.usdCompact(p.base)});
    } else if (peCirc != null) {
      peEl.textContent = peCirc.toFixed(1) + '×';
      peSub.textContent = T('val.peCircOnly', {mcap: fmt.usdCompact(state.currentMcap), base: fmt.usdCompact(p.base)});
    } else {
      peEl.textContent = '—';
      peSub.textContent = T('val.peNeedMcap');
    }
  } else {
    peEl.textContent = '—';
    peSub.textContent = T('val.peNeedProfit');
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
  const T = (k, v) => (window.I18n ? I18n.t(k, v) : k);
  const years = ['Y1','Y2','Y3','Y4','Y5'];
  chart.setOption({
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#0a3d34', borderColor: '#145043', textStyle: { color: '#e6f5f1' },
      formatter: (params) => params.map(p => `${p.marker}${p.seriesName}: ${fmt.usdCompact(p.value)}`).join('<br/>')
    },
    legend: { data: [T('val.chartFcf'), T('val.chartPv')], textStyle: { color: '#8fb5ac' }, top: 0 },
    grid: { left: 60, right: 30, bottom: 30, top: 40 },
    xAxis: { type: 'category', data: years, axisLine: { lineStyle: { color: '#145043' } }, axisLabel: { color: '#8fb5ac' } },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: '#145043' } },
      axisLabel: { color: '#8fb5ac', formatter: (v) => fmt.usdCompact(v) },
      splitLine: { lineStyle: { color: '#0d4a3f' } },
    },
    series: [
      { name: T('val.chartFcf'), type: 'bar', data: r.fcf, itemStyle: { color: '#50d2c1', borderRadius: [4,4,0,0] } },
      { name: T('val.chartPv'), type: 'line', data: r.pv, smooth: true, symbolSize: 8, itemStyle: { color: '#ffb454' }, lineStyle: { width: 3 } },
    ],
  });
}

// ---- 一键取数 ----
// preserveInputs=true: 仅拉链上供应量/价格填充 state（供预测价格/PE 计算），
//                      不覆盖用户的输入参数（分享链接场景）
async function fetchDefaults(preserveInputs = false) {
  if (state.fetching) return;
  state.fetching = true;
  const btn = document.getElementById('btnFetch');
  const status = document.getElementById('fetchStatus');
  const T = (k, v) => (window.I18n ? I18n.t(k, v) : k);
  btn.disabled = true;
  btn.textContent = T('val.fetchBtnLoading');
  btn.setAttribute('data-i18n', 'val.fetchBtnLoading');
  status.textContent = T('val.fetchLoading');
  status.setAttribute('data-i18n', 'val.fetchLoading');

  const timeout = (ms) => new Promise((_, r) => setTimeout(() => r(new Error('timeout')), ms));
  const race = (p, ms) => Promise.race([p, timeout(ms)]);

  const results = await Promise.allSettled([
    race(Api.fees(), 30000),
    race(Api.hypeDetails(), 30000),
    race(Api.holders('HYPE'), 30000),
    race(Api.coingeckoHype(), 30000),
    race(Api.treasuryYield10y(), 30000),
    race(Api.allMids(), 30000),
  ]);

  const [feesR, detR, holdersR, cgR, rfR, midsR] = results;
  const errors = [];

  // 1. 利润基数 = 过去 360 天手续费 × 97%（分享链接时不覆盖用户参数）
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
    if (!preserveInputs) {
      document.getElementById('in-baseProfit').value = Math.round(base);
      document.getElementById('rng-baseProfit').value = Math.min(2000000000, Math.round(base));
    }
    document.getElementById('src-baseProfit').textContent = T('val.baseProfitOk', { fee: fmt.usdCompact(usdc360), base: fmt.usdCompact(base) });
    document.getElementById('src-baseProfit').removeAttribute('data-i18n');
  } else {
    errors.push(T('val.srcFees'));
    document.getElementById('src-baseProfit').textContent = T('val.baseProfitFail');
    document.getElementById('src-baseProfit').setAttribute('data-i18n', 'val.baseProfitFail');
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
    // 写入供应量输入框(preserveInputs 且已有值时不覆盖)
    const supEl = document.getElementById('in-supply');
    const supRng = document.getElementById('rng-supply');
    const supSrc = document.getElementById('src-supply');
    const hasSupplyInput = supEl && parseFloat(supEl.value) > 0;
    if (supEl && (!preserveInputs || !hasSupplyInput)) {
      supEl.value = Math.round(state.circulatingHype);
      if (supRng) supRng.value = Math.min(1000000000, Math.round(state.circulatingHype));
    }
    if (supSrc) {
      supSrc.textContent = T('val.supplyOk', { v: fmt.compact(state.circulatingHype) });
      supSrc.removeAttribute('data-i18n');
    }
  } else {
    errors.push(T('val.srcSupply'));
  }

  // 3. HYPE 当前价 + 市值 + FDV
  if (cgR.status === 'fulfilled' && cgR.value?.market_data) {
    state.currentPrice = cgR.value.market_data.current_price?.usd ?? null;
    state.currentMcap  = cgR.value.market_data.market_cap?.usd    ?? null;
    state.currentFdv   = cgR.value.market_data.fully_diluted_valuation?.usd ?? null;
  }

  // 3b. CoinGecko 挂了(免费接口常被限流/CORS)时,用 Hyperliquid allMids 兜底 HYPE 现货价,
  //     再用 价格 × 流通量 推算市值,保证 PE 能算出来。
  if (state.currentPrice == null && midsR.status === 'fulfilled' && midsR.value) {
    const hypeMid = parseFloat(midsR.value.HYPE);
    if (!isNaN(hypeMid) && hypeMid > 0) {
      state.currentPrice = hypeMid;
      if (state.currentMcap == null && state.circulatingHype) {
        state.currentMcap = hypeMid * state.circulatingHype;
      }
    }
  }
  if (state.currentPrice == null) errors.push(T('val.srcPrice') || 'HYPE 价格');

  // 4. 美债 10 年期（分享链接时不覆盖用户参数）
  if (rfR.status === 'fulfilled' && rfR.value != null) {
    if (!preserveInputs) {
      document.getElementById('in-rf').value = rfR.value.toFixed(2);
      document.getElementById('rng-rf').value = rfR.value.toFixed(2);
    }
    const rfEl = document.getElementById('src-rf');
    rfEl.textContent = T('val.rfOk', { v: rfR.value.toFixed(2) });
    rfEl.removeAttribute('data-i18n');
  } else {
    errors.push(T('val.srcRf'));
    const rfEl = document.getElementById('src-rf');
    rfEl.textContent = T('val.rfFail');
    rfEl.setAttribute('data-i18n', 'val.rfFail');
  }

  state.fetching = false;
  btn.disabled = false;
  btn.textContent = T('val.fetchBtnAgain');
  btn.setAttribute('data-i18n', 'val.fetchBtnAgain');
  if (errors.length === 0) {
    status.textContent = T('val.fetchOk');
    status.setAttribute('data-i18n', 'val.fetchOk');
  } else if (errors.length < 4) {
    status.textContent = T('val.fetchPartialFail', { errs: errors.join('、') });
    status.removeAttribute('data-i18n');
  } else {
    status.textContent = T('val.fetchAllFail', { errs: errors.join('、') });
    status.removeAttribute('data-i18n');
  }
  calc();
}

// ---- 初始化 ----
document.addEventListener('DOMContentLoaded', () => {
  // 联动
  pairInputSlider('in-baseProfit', 'rng-baseProfit');
  pairInputSlider('in-supply', 'rng-supply');
  pairInputSlider('in-growthAll', 'rng-growthAll');
  pairInputSlider('in-perpetual', 'rng-perpetual');
  pairInputSlider('in-rf', 'rng-rf');
  pairInputSlider('in-wacc', 'rng-wacc');

  // 分年输入
  ['g1','g2','g3','g4','g5'].forEach(k => {
    document.getElementById('in-'+k).addEventListener('input', calc);
  });

  document.getElementById('btnExpandGrowth').addEventListener('click', () => toggleGrowthMode());
  document.getElementById('btnFetch').addEventListener('click', () => fetchDefaults(false));
  const shareBtn = document.getElementById('btnShare');
  if (shareBtn) shareBtn.addEventListener('click', shareValuation);
  const shareLinkBtn = document.getElementById('btnShareLink');
  if (shareLinkBtn) shareLinkBtn.addEventListener('click', copyShareLink);

  // 用模块解析期快照,DOMContentLoaded 内取 location.search 已被 i18n 污染
  const initialQ = new URLSearchParams(INITIAL_SEARCH);
  // 带数据的分享链接: 必有供应量 s (或旧链接没 s 但有 p/g 等参数)。
  // 只要带了任何实际参数就算分享链接 -> 不取数，以免覆盖分享数据
  const hasSharedParams = ['p', 's', 'g', 'g1', 'gt', 'wacc'].some(k => initialQ.has(k));

  loadFromUrl();
  // 带数据: 不取数,直接用分享参数算; 不带数据: 取数
  if (hasSharedParams) {
    calc();
    // 分享链接若缺供应量(s)/现价(cur)才去拉链上数据补齐,不覆盖用户输入
    if (!state.circulatingHype || !state.currentPrice) fetchDefaults(true);
  } else {
    fetchDefaults(false);
  }
});

// 语言切换后重新渲染 chart 与动态文本
window.onI18nChange = () => calc();
