// api.js — 数据层封装
// 所有接口均为公开、免 key、CORS: *，前端可直连。
// 数据源：
//   官方 Hyperliquid: https://api.hyperliquid.xyz/info (POST + type)
//   hypurrscan 公开:  https://api.hypurrscan.io/*
//   HyperEVM 索引层:  https://trace.hypurrscan.io/api/v1/indexed/*

const HL_INFO = 'https://api.hyperliquid.xyz/info';
const HPS = 'https://api.hypurrscan.io';
const TRACE = 'https://trace.hypurrscan.io/api/v1';

// 通用 fetch，带超时与错误吞掉（数据缺失时返回 null，页面留空）
async function safeFetch(url, opts = {}, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...opts, signal: ctrl.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) {
    console.warn('fetch failed:', url, e.message);
    return null;
  } finally {
    clearTimeout(t);
  }
}

// 官方 info POST
function hlInfo(type, extra = {}) {
  return safeFetch(HL_INFO, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, ...extra }),
  });
}

const Api = {
  // ---- 大盘统计 ----
  globalStats: () => hlInfo('globalStats'),                       // {totalVolume, dailyVolume, nUsers}
  fees: () => safeFetch(`${HPS}/fees`),                           // [{time,total_fees,total_spot_fees}]
  evmRolling24h: () => safeFetch(`${TRACE}/indexed/rolling-24h`), // {txs,gas_used,unique_users,contracts_deployed,hype_burned}
  evmStats: () => safeFetch(`${TRACE}/indexed/stats`),            // {stats:{transactions,...}}
  spotUSDC: () => safeFetch(`${HPS}/spotUSDC`),

  // ---- 行情 ----
  metaAndAssetCtxs: () => hlInfo('metaAndAssetCtxs'),  // [ {universe:[...]}, [ctx...] ]
  spotMetaAndAssetCtxs: () => hlInfo('spotMetaAndAssetCtxs'),
  allMids: () => hlInfo('allMids'),
  predictedFundings: () => hlInfo('predictedFundings'),
  candleSnapshot: (coin, interval, startTime, endTime) =>
    hlInfo('candleSnapshot', { req: { coin, interval, startTime, endTime } }),

  // ---- 地址查询 ----
  clearinghouseState: (user) => hlInfo('clearinghouseState', { user }),
  spotClearinghouseState: (user) => hlInfo('spotClearinghouseState', { user }),
  openOrders: (user) => hlInfo('frontendOpenOrders', { user }),
  userFills: (user) => hlInfo('userFills', { user }),
  delegatorSummary: (user) => hlInfo('delegatorSummary', { user }),
  delegations: (user) => hlInfo('delegations', { user }),

  // ---- 榜单/EVM（可能为空，留空处理）----
  richList: (limit = 50) => safeFetch(`${TRACE}/indexed/native-rich-list?limit=${limit}`),
  whaleTransfers: (limit = 30) => safeFetch(`${TRACE}/indexed/whale-transfers?limit=${limit}`),
  dailyStats: (days = 30) => safeFetch(`${TRACE}/indexed/daily-stats?days=${days}`),

  // ---- 搜索 ----
  search: (q) => safeFetch(`${HPS}/search/${encodeURIComponent(q)}`),
};

// 工具：格式化
const fmt = {
  usd(n, dp = 0) {
    if (n == null || isNaN(n)) return '—';
    return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: dp });
  },
  compact(n) {
    if (n == null || isNaN(n)) return '—';
    const x = Number(n);
    const a = Math.abs(x);
    if (a >= 1e9) return (x / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return (x / 1e6).toFixed(2) + 'M';
    if (a >= 1e3) return (x / 1e3).toFixed(2) + 'K';
    return x.toFixed(0);
  },
  usdCompact(n) {
    if (n == null || isNaN(n)) return '—';
    return '$' + fmt.compact(n);
  },
  num(n) {
    if (n == null || isNaN(n)) return '—';
    return Number(n).toLocaleString('en-US');
  },
  pct(n, dp = 2) {
    if (n == null || isNaN(n)) return '—';
    return (Number(n) * 100).toFixed(dp) + '%';
  },
  addr(a) {
    if (!a) return '—';
    return a.slice(0, 6) + '…' + a.slice(-4);
  },
};

// fees 接口单位换算：total_fees 为 1e6（USDC 6 位小数）
const FEES_SCALE = 1e6;
