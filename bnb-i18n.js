// BNB PE page text. Extends the shared site dictionary (i18n.js); dynamic strings use BNBText.
(function () {
'use strict';
const zh = {
  'bnb.title': 'BNB PE 观察台',
  'bnb.subtitle': '最近 4 次季度 Auto-Burn + 30 日 Gas 实时销毁年化 · 非会计利润 PE · 非实时行情',
  'bnb.refresh': '联网补缺 / 重试', 'bnb.download': '下载当前 CSV', 'bnb.seed': '固化原始数据 JSON',
  'bnb.chartTitle': 'PE、价格与每日 Gas 销毁',
  'bnb.rangeGroup': '时间范围', 'bnb.r30': '近30日', 'bnb.r90': '近90日', 'bnb.r365': '近1年', 'bnb.rAll': '全部',
  'bnb.chartNote': '上图：流通 PE（左轴）与价格（右轴），虚线为近 1 年流通 PE 20/50/80 分位，竖线为季度销毁日。下图：每日 Gas 实时销毁（USD）。共用 UTC 日期。',
  'bnb.chartAria': '上方为 BNB 流通 PE 与价格，下方为每日 Gas 销毁柱状图；详细数值见下方表格',
  'bnb.burnsTitle': '季度 Auto-Burn（链上核实）',
  'bnb.burnsNote': '数量取 BSC 链上转入 0x…dEaD 的金额（不含 Pioneer Burn）；美元 = 数量 × bnbburn.info 季度中位价。每季度新公告发布后由维护者手动加入。',
  'bnb.colN': '次数', 'bnb.colQuarter': '季度', 'bnb.colBurnDate': '销毁日 UTC', 'bnb.colAmount': '链上数量 BNB', 'bnb.colMedian': '中位价 USD', 'bnb.colUsd': '折合 USD', 'bnb.colTx': '交易',
  'bnb.methodTitle': '计算口径与数据边界',
  'bnb.m1': '流通 PE = 流通市值 / 年化销毁额。年化销毁额 = 最近 4 次已执行的季度 Auto-Burn 美元合计 + Gas 实时销毁近 30 日合计 × 365/30。这是销毁价值代理，不是会计利润、手续费总额或回购。',
  'bnb.m2': '季度销毁从第 27 次（2024-04-24）起计入，这是第一次可在 BSC 链上核实的销毁；第 26 次及以前在已下线的 Beacon Chain 执行，不纳入。第 30 次（2025-01-23）后才凑满 4 个季度，曲线从这一天开始。数量统一取链上实际销毁量：第 29 次含补烧上季的 62,569.63 BNB，第 30、32、34 次剔除 Pioneer Burn。',
  'bnb.m3': '季度分母在每次销毁当天跳变，图表呈阶梯状；两次销毁之间只有 Gas 部分和市值在变。季度数据由维护者每季度手动更新，新一季公告发布前，页面继续使用最近 4 次。',
  'bnb.m4': 'Gas 实时销毁取 DefiLlama BSC dailyRevenue（BEP-95 销毁的 10% Gas 费，USD）。日 D 的价格和市值取 D+1 00:00 UTC 精确时点，作为近似收盘；30 日窗口缺任何一天即 NA。',
  'bnb.m5': '市值：最近 365 天取 CoinGecko 市值；更早的日期 = DefiLlama 价格 × 倒推供应量。倒推供应量 = CoinGecko 首日隐含流通量 + 之后每天的季度销毁和 Gas 销毁。两段在 2025-10-09 衔接，口径不同；CoinGecko 的流通量本身有日间波动（例如 2026-04-01 至 04-10 曾偏低约 319 万 BNB），按原值保留，不做修正。',
  'bnb.m6': '固化档案之后的日期，打开页面时按设备 UTC 昨日尝试从 DefiLlama 与 CoinGecko 补齐，增量只存本浏览器 localStorage。上游延迟、CORS、限流或网络失败时保留 NA。仅供研究，不是投资建议。',
  'bnb.sources': '来源：',
  'bnb.tableTitle': '每日数据 · UTC（新到旧）',
  'bnb.colDate': '日期', 'bnb.colPrice': '价格 USD', 'bnb.colPe': '流通 PE', 'bnb.colQ': '季度年化 USD', 'bnb.colGasDay': '当日 Gas 销毁 USD', 'bnb.colGas': 'Gas 年化 USD', 'bnb.colMcapSrc': '市值来源', 'bnb.colStatus': '状态/来源',
};
const en = {
  'bnb.title': 'BNB PE Dashboard',
  'bnb.subtitle': 'Latest 4 quarterly Auto-Burns + 30-day annualized gas burn · not an accounting P/E · not real-time',
  'bnb.refresh': 'Fetch gaps / Retry', 'bnb.download': 'Download CSV', 'bnb.seed': 'Frozen source JSON',
  'bnb.chartTitle': 'PE, price and daily gas burn',
  'bnb.rangeGroup': 'Time range', 'bnb.r30': '30 days', 'bnb.r90': '90 days', 'bnb.r365': '1 year', 'bnb.rAll': 'All',
  'bnb.chartNote': 'Top: circulating PE (left axis) and price (right axis); dashed lines are the 1-year circulating PE P20/P50/P80, vertical lines mark quarterly burns. Bottom: daily real-time gas burn (USD). Shared UTC dates.',
  'bnb.chartAria': 'Top: BNB circulating PE and price. Bottom: daily gas burn bars. Exact values are in the table below.',
  'bnb.burnsTitle': 'Quarterly Auto-Burns (verified on-chain)',
  'bnb.burnsNote': 'Amount is the on-chain BSC transfer to 0x…dEaD (Pioneer Burn excluded); USD = amount × bnbburn.info quarterly median price. New quarters are added manually after each announcement.',
  'bnb.colN': '#', 'bnb.colQuarter': 'Quarter', 'bnb.colBurnDate': 'Burn date UTC', 'bnb.colAmount': 'On-chain BNB', 'bnb.colMedian': 'Median price USD', 'bnb.colUsd': 'USD value', 'bnb.colTx': 'Tx',
  'bnb.methodTitle': 'Methodology and data limits',
  'bnb.m1': 'Circulating PE = circulating market cap / annualized burn. Annualized burn = USD sum of the latest 4 executed quarterly Auto-Burns + 30-day gas burn × 365/30. This is a burn-value proxy, not accounting profit, total fees or buybacks.',
  'bnb.m2': 'Quarterly burns are counted from #27 (2024-04-24), the first burn verifiable on BSC; #26 and earlier ran on the retired Beacon Chain and are excluded. A full 4-quarter window first exists after #30 (2025-01-23), where the series starts. Amounts are on-chain burns: #29 includes the 62,569.63 BNB make-up for the prior quarter; Pioneer Burn is excluded from #30, #32 and #34.',
  'bnb.m3': 'The quarterly denominator steps on each burn date, so the chart is stepped; between burns only the gas part and market cap move. Quarterly data is updated manually each quarter; until a new announcement the latest 4 burns stay in use.',
  'bnb.m4': 'Gas burn is DefiLlama BSC dailyRevenue (the 10% of gas fees burned under BEP-95, USD). Price and market cap for day D use the exact D+1 00:00 UTC point as an approximate close; any missing day in the 30-day window gives NA.',
  'bnb.m5': 'Market cap: CoinGecko for the last 365 days; earlier days = DefiLlama price × backcast supply, where backcast supply = CoinGecko implied circulating supply on its first day + all later quarterly and gas burns. The two segments join on 2025-10-09 with different methods. CoinGecko supply itself fluctuates day to day (e.g. about 3.19M BNB low from 2026-04-01 to 04-10); values are kept as published.',
  'bnb.m6': 'Days after the frozen archive are fetched from DefiLlama and CoinGecko up to the device\'s UTC yesterday; increments are kept only in this browser\'s localStorage. Upstream delays, CORS, rate limits or network failures leave NA. Research only, not investment advice.',
  'bnb.sources': 'Sources: ',
  'bnb.tableTitle': 'Daily data · UTC (newest first)',
  'bnb.colDate': 'Date', 'bnb.colPrice': 'Price USD', 'bnb.colPe': 'Circulating PE', 'bnb.colQ': 'Quarterly annual USD', 'bnb.colGasDay': 'Daily gas burn USD', 'bnb.colGas': 'Gas annualized USD', 'bnb.colMcapSrc': 'Market-cap source', 'bnb.colStatus': 'Status / source',
};
// Footer visitor-counter labels (same text as the HYPE/UNI pages; those keys live in pe-i18n.js there).
Object.assign(zh, { 'pe.text35': '总访问量', 'pe.text36': '今日访问量', 'pe.text37': 'GoatCounter 站点汇总（与首页相同） · 今日按 UTC' });
Object.assign(en, { 'pe.text35': 'Total visits', 'pe.text36': 'Today\u2019s visits', 'pe.text37': 'GoatCounter site-wide totals (same as homepage) · Today in UTC' });
Object.assign(I18N_DICT.zh, zh);
Object.assign(I18N_DICT.en, en);

// Dynamic strings: Chinese text is the key; English lookup by key, fallback to the Chinese text.
const dyn = {
  '目标完整 UTC 日：': 'Target complete UTC day: ', ' · 表中截至：': ' · Table through: ', ' · 卡片有效估值日：': ' · Cards valid as of: ', '无': 'none',
  '流通 PE': 'Circulating PE', '近似收盘价格': 'Approx. close price', '流通市值': 'Circulating market cap', '季度销毁年化（最近4次）': 'Quarterly burn (latest 4)', 'Gas 销毁年化（30日）': 'Gas burn annualized (30d)', '年化销毁额合计': 'Total annualized burn',
  ' · 最近有效，非目标日': ' · latest valid, not target day', '价格 USD': 'Price USD', '近1年流通 PE 20分位': '1Y circulating PE P20', '近1年流通 PE 50分位（中位数）': '1Y circulating PE P50 (median)', '近1年流通 PE 80分位': '1Y circulating PE P80', '每日 Gas 销毁（USD）': 'Daily gas burn (USD)', '季度销毁': 'Quarterly burn', 'PE x': 'PE x',
  '固化历史': 'Frozen history', '浏览器增量': 'Browser increment', '倒推': 'Backcast', '季度销毁不足4次': 'Fewer than 4 quarterly burns', '缺价格/市值': 'Missing price / market cap', '零分母': 'Zero denominator', '收入窗口缺 ': 'Revenue window missing ', ' 天': ' days',
  '图表库未加载；下方表格和 CSV 仍可用。': 'Chart library failed to load; the table and CSV are still available.',
  '加载中…': 'Loading…', '本地缓存不可用': 'Local cache unavailable', '缓存写入失败；本次增量仅在内存中': 'Cache write failed; increments kept in memory only',
  '系统时间早于固化档案；保留历史，不向未来抓取。': 'System clock is earlier than the archive; keeping history, not fetching ahead.',
  '设备日期距固化档案超过10年，请检查系统时间': 'Device date is more than 10 years past the archive; check the system clock',
  '正在补齐 ': 'Fetching ', ' 个日期的公开数据…': ' days of public data…', '收入获取失败：': 'Revenue fetch failed: ', '行情获取失败：': 'Market fetch failed: ', '；可能为网络、CORS 或限流': '; possibly network, CORS or rate limit',
  '所有目标日期的指标已完整。': 'All target days are complete.', '固化档案已覆盖到目标日。': 'The frozen archive already covers the target day.', ' 个增量日期仍待补齐；表格保留 NA，卡片显示明确标注日期的最近有效估值。': ' increment days still pending; the table keeps NA and cards show the latest valid, dated value.',
  '读取失败：': 'Load failed: ', '目标 ': 'Target ', '当日 Gas 销毁缺失': 'gas burn missing for the day', '30日窗口不完整': '30-day window incomplete', '缺少 D+1 00:00 UTC 精确配对价格/市值': 'no exact D+1 00:00 UTC price/market-cap pair',
  '（限流，请稍后手动重试）': ' (rate-limited; retry later manually)', '协议标识不匹配': 'unexpected protocol id',
  '最近一次季度销毁是 ': 'The latest quarterly burn is ', '（第 ': ' (#', ' 次），已过 ': '), ', ' 天。新一季公告发布后需维护者手动更新，在此之前分母继续使用最近 4 次。': ' days ago. A maintainer adds each new quarter manually; until then the latest 4 burns stay in use.',
};
const keys = Object.keys(dyn).sort((a, b) => b.length - a.length).map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const re = new RegExp(keys.join('|'), 'g');
window.BNBText = text => (window.I18n && window.I18n.lang === 'en') ? String(text).replace(re, s => dyn[s]) : String(text);
})();
