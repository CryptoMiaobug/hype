// i18n.js — 全站中英切换
// 用法:
//   1. HTML 里给需要翻译的元素加 data-i18n="key"
//   2. 动态生成文本用 I18n.t('key', {var: value})
//   3. 挂载在 window.I18n

const I18N_DICT = {
  zh: {
    // ---- 通用 ----
    'nav.dashboard': '仪表盘',
    'nav.valuation': '价值测算',
    'nav.battle': '战况',
    'common.loading': '加载中…',
    'common.noData': '数据暂不可用',
    'common.noDataRich': '数据暂不可用（该索引接口未开放或为空）',
    'rich.addr': '地址',
    'rich.balance': '余额',
    'common.total': '累计',
    'common.days30': '30天',
    'common.days180': '180天',
    'common.days360': '360天',
    'common.all': 'All',

    // ---- 顶部提示条 ----
    'notice': '💡 本站数据为链上实时刷新 · 部分数据源需科学上网 · 如无显示请刷新',

    // ---- 仪表盘 ----
    'idx.overview': '全站概览 · Overview',
    'idx.predPrice': '预测价格 / HYPE',
    'idx.predPriceTip': '点击进入价值测算页',
    'idx.hypePrice': 'HYPE 价格',
    'idx.mcap': '市值',
    'idx.fdv': 'FDV',
    'idx.vol24': '24h 成交',
    'idx.fees24': '24h Fees',
    'idx.volume24': '24h Volume',
    'idx.users': 'Users',
    'idx.usersSub': '累计地址',
    'idx.evmTx': 'EVM 24h Txs',
    'idx.evmActive': '活跃地址',
    'idx.hypeBurned': 'HYPE 已销毁',
    'idx.burnedPct': '占总量',
    'idx.afBuyback': 'AF 回购',
    'idx.hcBurn': 'HyperCore 协议销毁',
    'idx.evmGas': 'HyperEVM Gas',
    'idx.nullDead': 'Null + Dead',
    'idx.contracts': 'EVM 合约总数',
    'idx.contractsSub': '累计部署',
    'idx.feesTrend': '费用趋势 · Fees',
    'idx.totalFees': '累计手续费 (USDC)',
    'idx.dailyFees': '每日手续费增量',
    'idx.perps': '永续合约行情 · Perps',
    'idx.markets': '市场',
    'idx.spot': '现货行情 · Spot',
    'idx.spotMarkets': '现货市场',
    'idx.richList': 'HyperEVM 富豪榜 · Rich List',
    'idx.nativeHolders': '原生代币持有榜',
    'idx.footer': 'HypeValue · 数据来自 Hyperliquid 官方 API 与公开索引服务 · 仅供参考',

    // 表格表头
    'tbl.coin': '币种',
    'tbl.markPrice': '标记价',
    'tbl.chg24h': '24h 涨跌',
    'tbl.chg7d': '7D 涨跌',
    'tbl.funding': '资金费率',
    'tbl.oi': '未平仓 (OI)',
    'tbl.turnover': '24h 成交额',
    'tbl.price': '价格',

    // ---- 估值页 ----
    'val.title': '两阶段现金流折现 (DCF) 估值模型',
    'val.fetchBtn': '🔄 一键取数',
    'val.fetchBtnAgain': '🔄 重新取数',
    'val.fetchBtnLoading': '⏳ 取数中...',
    'val.fetchHint': '点击按钮从链上/CoinGecko/美国财政部拉取实时数据',
    'val.fetchLoading': '正在拉取:手续费/供应量/HYPE 价格/美债收益率...',
    'val.fetchOk': '✅ 全部数据已加载',
    'val.fetchPartialFail': '⚠️ 部分失败: {errs}。可以手动填入或再次点击取数',
    'val.fetchAllFail': '❌ 取数失败: {errs}。请手动填入或稍后重试',

    'val.params': '模型参数',
    'val.baseProfit': '当期利润基数 (USD)',
    'val.baseProfitHint': '= 过去 360 天手续费 × 97%',
    'val.baseProfitTodo': '— 待取数',
    'val.supply': '流通供应量 (HYPE)',
    'val.supplyHint': '= 总量 - 已销毁',
    'val.supplyTodo': '— 待取数',
    'val.supplyOk': '✓ 链上流通量 {v}',
    'val.supplyShared': '✓ 来自分享链接 {v}',
    'val.baseProfitOk': '✓ 过去 360 天手续费 {fee} × 97% = {base}',
    'val.baseProfitFail': '✗ 手续费拉取失败',

    'val.growth15': '1-5 年增长率',
    'val.growthUnified': '默认 5 年统一',
    'val.growthExpand': '分年设置 ▾',
    'val.growthCollapse': '统一 ▴',

    'val.perpetual': '永续增长率 (g)',
    'val.perpetualHint': '第 5 年后永续增长率',
    'val.rf': '无风险利率 (Rf)',
    'val.rfHint': '10 年期美债收益率',
    'val.rfTodo': '— 待取数',
    'val.rfOk': '✓ {v}% (10 年期美债)',
    'val.rfFail': '✗ 美债利率拉取失败,请手动填',

    'val.wacc': '贴现率 WACC',
    'val.waccHint': '加权平均资金成本',
    'val.waccWarn': '⚠️ WACC 必须大于永续增长率',

    'val.pv1': '阶段一现值合计',
    'val.pv1Sub': '前 5 年 PV',
    'val.pvTv': '永续终值现值',
    'val.pvTvSub': 'TV 贴回今天',
    'val.ev': '企业总价值 EV',
    'val.evSub': '阶段一 + 终值',
    'val.price': '预测价格 / HYPE',
    'val.priceSubDefault': '流通盘',
    'val.priceVs': 'vs 当前 ${cur} · ',
    'val.priceNeedSupply': '需要供应量数据',
    'val.pe': '当前市盈率 PE',
    'val.peSubDefault': '流通 / 全稀释',
    'val.peCirc': '流通',
    'val.peFdvAdj': '全稀释*',
    'val.pePart3': ' · 利润 {base}',
    'val.peSubLine': '流通 / 全稀释* · 利润 {base}',
    'val.peTipCirc': 'CoinGecko 流通市值 {v}',
    'val.peTipFdv': '调整后全稀释 {v}(已扣销毁)',
    'val.peNeedProfit': '需要利润基数',
    'val.peNeedMcap': '需要市值数据',
    'val.peCircOnly': '流通 · {mcap} / {base}',

    'val.chartTitle': '5 年预测利润 vs 折现现值',
    'val.chartFcf': '预测利润 (柱)',
    'val.chartPv': '折现现值 (线)',

    'val.tableTitle': '测算明细表',
    'val.tYear': '年份',
    'val.tGrowth': '增长率',
    'val.tProfit': '预测利润 (USD)',
    'val.tDisc': '折现因子',
    'val.tPv': '折现现值 (USD)',

    'val.disclaimer': '免责声明',
    'val.disclaimerSep': '：',
    'val.disclaimerText': '本页面仅为估值模型演示,不构成投资建议。DCF 模型对参数极度敏感,实际价值受市场情绪、监管、技术演进等多因素影响。',
    'val.srcLabel': '数据来源:',
    'val.srcFees': '手续费',
    'val.srcSupply': '供应量',
    'val.srcPrice': '当前价',
    'val.srcRf': '无风险利率',
    'val.srcTreasury': '美国财政部',

    // 分享
    'val.shareBtn': '📤 分享我的估值',
    'val.shareBtnTip': '把当前参数打包成链接,发给朋友一键还原',
    'val.shareBtnCopied': '✅ 已拷贝',
    'val.shareLinkBtn': '🔗 复制链接',
    'val.shareLinkBtnTip': '只拷贝链接,不带文案',
    'val.shareLinkCopied': '✅ 已复制',
    'val.shareTitle': 'HYPE 估值 · HypeValue',
    'val.shareText': '我预测 HYPE 真实估值为 ${price}（当前 ${cur}，{sign}{diff}%），快来看看吧！👇',
    'val.shareTextNoCmp': '我预测 HYPE 真实估值为 ${price}，快来看看吧！👇',
    'val.shareTextFallback': '我的 HYPE 估值参数，快来看看吧！👇',
    'val.shareOk': '✅ 已开启系统分享',
    'val.shareRichCopied': '✅ 文案 + 链接已复制，直接粘到 TG / 微信 / Discord',
    'val.shareLinkOk': '✅ 链接已复制，朋友打开后参数会自动加载',
    'val.shareFailed': '⚠️ 自动复制失败，手动拷贝：{url}',
  },
  en: {
    // ---- Generic ----
    'nav.dashboard': 'Dashboard',
    'nav.valuation': 'Valuation',
    'nav.battle': 'Battle',
    'common.loading': 'Loading…',
    'common.noData': 'Data unavailable',
    'common.noDataRich': 'Data unavailable (endpoint not exposed or empty)',
    'rich.addr': 'Address',
    'rich.balance': 'Balance',
    'common.total': 'Total',
    'common.days30': '30d',
    'common.days180': '180d',
    'common.days360': '360d',
    'common.all': 'All',

    // ---- Top notice ----
    'notice': '💡 Live on-chain data. Some sources may require VPN. Refresh if data is missing.',

    // ---- Dashboard ----
    'idx.overview': 'Overview',
    'idx.predPrice': 'Fair Price / HYPE',
    'idx.predPriceTip': 'Open valuation page',
    'idx.hypePrice': 'HYPE Price',
    'idx.mcap': 'Market Cap',
    'idx.fdv': 'FDV',
    'idx.vol24': '24h Volume',
    'idx.fees24': '24h Fees',
    'idx.volume24': '24h Volume',
    'idx.users': 'Users',
    'idx.usersSub': 'Total Addresses',
    'idx.evmTx': 'EVM 24h Txs',
    'idx.evmActive': 'Active Addr',
    'idx.hypeBurned': 'HYPE Burned',
    'idx.burnedPct': 'of Max Supply',
    'idx.afBuyback': 'AF Buyback',
    'idx.hcBurn': 'HyperCore Burn',
    'idx.evmGas': 'HyperEVM Gas',
    'idx.nullDead': 'Null + Dead',
    'idx.contracts': 'Total Contracts',
    'idx.contractsSub': 'Deployed',
    'idx.feesTrend': 'Fees Trend',
    'idx.totalFees': 'Cumulative Fees (USDC)',
    'idx.dailyFees': 'Daily Fees',
    'idx.perps': 'Perpetual Markets',
    'idx.markets': 'Markets',
    'idx.spot': 'Spot Markets',
    'idx.spotMarkets': 'Spot',
    'idx.richList': 'HyperEVM Rich List',
    'idx.nativeHolders': 'Native Token Holders',
    'idx.footer': 'HypeValue · Data from Hyperliquid API and public indexers · For reference only',

    'tbl.coin': 'Coin',
    'tbl.markPrice': 'Mark Price',
    'tbl.chg24h': '24h Chg',
    'tbl.chg7d': '7D Chg',
    'tbl.funding': 'Funding',
    'tbl.oi': 'Open Interest',
    'tbl.turnover': '24h Turnover',
    'tbl.price': 'Price',

    // ---- Valuation ----
    'val.title': 'Two-Stage DCF Valuation Model',
    'val.fetchBtn': '🔄 Fetch Live Data',
    'val.fetchBtnAgain': '🔄 Refetch',
    'val.fetchBtnLoading': '⏳ Fetching...',
    'val.fetchHint': 'Pull live data from chain / CoinGecko / US Treasury',
    'val.fetchLoading': 'Fetching: fees / supply / HYPE price / treasury yield...',
    'val.fetchOk': '✅ All data loaded',
    'val.fetchPartialFail': '⚠️ Partial failure: {errs}. Fill manually or retry',
    'val.fetchAllFail': '❌ Fetch failed: {errs}. Fill manually or try later',

    'val.params': 'Model Parameters',
    'val.baseProfit': 'Base Profit (USD)',
    'val.baseProfitHint': '= last 360d fees × 97%',
    'val.baseProfitTodo': '— pending',
    'val.supply': 'Circulating Supply (HYPE)',
    'val.supplyHint': '= max supply - burned',
    'val.supplyTodo': '— pending',
    'val.supplyOk': '✓ on-chain {v}',
    'val.supplyShared': '✓ from shared link {v}',
    'val.baseProfitOk': '✓ Last 360d fees {fee} × 97% = {base}',
    'val.baseProfitFail': '✗ Fees fetch failed',

    'val.growth15': 'Year 1-5 Growth',
    'val.growthUnified': 'Uniform 5y',
    'val.growthExpand': 'Per Year ▾',
    'val.growthCollapse': 'Uniform ▴',

    'val.perpetual': 'Perpetual Growth (g)',
    'val.perpetualHint': 'Terminal growth after Year 5',
    'val.rf': 'Risk-Free Rate (Rf)',
    'val.rfHint': '10Y US Treasury Yield',
    'val.rfTodo': '— pending',
    'val.rfOk': '✓ {v}% (10Y Treasury)',
    'val.rfFail': '✗ Treasury yield fetch failed',

    'val.wacc': 'Discount Rate WACC',
    'val.waccHint': 'Weighted Avg Cost of Capital',
    'val.waccWarn': '⚠️ WACC must be greater than perpetual growth',

    'val.pv1': 'Stage 1 PV',
    'val.pv1Sub': 'Sum of Y1-Y5 PV',
    'val.pvTv': 'Terminal PV',
    'val.pvTvSub': 'TV Discounted',
    'val.ev': 'Enterprise Value',
    'val.evSub': 'Stage 1 + TV',
    'val.price': 'Fair Price / HYPE',
    'val.priceSubDefault': 'Circulating',
    'val.priceVs': 'vs Current ${cur} · ',
    'val.priceNeedSupply': 'Need supply data',
    'val.pe': 'Current P/E',
    'val.peSubDefault': 'Circ / Fully Diluted',
    'val.peCirc': 'Circ',
    'val.peFdvAdj': 'FDV*',
    'val.peSubLine': 'Circ / FDV* · Profit {base}',
    'val.pePart3': ' · Profit {base}',
    'val.peTipCirc': 'CoinGecko Circulating Mcap {v}',
    'val.peTipFdv': 'Adjusted FDV {v} (burned excluded)',
    'val.peNeedProfit': 'Need base profit',
    'val.peNeedMcap': 'Need mcap data',
    'val.peCircOnly': 'Circ · {mcap} / {base}',

    'val.chartTitle': '5-Year FCF vs Discounted PV',
    'val.chartFcf': 'FCF (bar)',
    'val.chartPv': 'PV (line)',

    'val.tableTitle': 'Calculation Detail',
    'val.tYear': 'Year',
    'val.tGrowth': 'Growth',
    'val.tProfit': 'Projected Profit (USD)',
    'val.tDisc': 'Discount Factor',
    'val.tPv': 'Present Value (USD)',

    'val.disclaimer': 'Disclaimer',
    'val.disclaimerSep': ': ',
    'val.disclaimerText': 'This page is a valuation model demo, not investment advice. DCF is extremely sensitive to parameters; actual value depends on market sentiment, regulation, tech evolution and more.',
    'val.srcLabel': 'Sources:',
    'val.srcFees': 'Fees',
    'val.srcSupply': 'Supply',
    'val.srcPrice': 'Current Price',
    'val.srcRf': 'Risk-Free Rate',
    'val.srcTreasury': 'US Treasury',

    // Share
    'val.shareBtn': '📤 Share My Valuation',
    'val.shareBtnTip': 'Pack current params into a link so friends can restore your scenario',
    'val.shareBtnCopied': '✅ Copied',
    'val.shareLinkBtn': '🔗 Copy Link',
    'val.shareLinkBtnTip': 'Copy the link only, no message',
    'val.shareLinkCopied': '✅ Copied',
    'val.shareTitle': 'HYPE Valuation · HypeValue',
    'val.shareText': 'My HYPE fair value prediction: ${price} (current ${cur}, {sign}{diff}%). Come check it out! 👇',
    'val.shareTextNoCmp': 'My HYPE fair value prediction: ${price}. Come check it out! 👇',
    'val.shareTextFallback': 'My HYPE valuation params. Come check it out! 👇',
    'val.shareOk': '✅ Share sheet opened',
    'val.shareRichCopied': '✅ Message + link copied. Paste into TG / Discord / WhatsApp',
    'val.shareLinkOk': '✅ Link copied. Friends will load your params automatically',
    'val.shareFailed': '⚠️ Auto-copy failed, copy manually: {url}',
  },
};

const I18n = {
  lang: 'zh',

  init() {
    // 优先用用户手动选择（localStorage）；
    // 首次访问跟随系统语言：中文（zh / zh-CN / zh-TW / zh-HK...）→ zh，其他一律→ en
    const saved = localStorage.getItem('hs_lang');
    const navLang = (navigator.language || '').toLowerCase();
    this.lang = saved || (navLang.startsWith('zh') ? 'zh' : 'en');
    document.documentElement.lang = this.lang === 'en' ? 'en' : 'zh';
    this.apply();
    this.mountSwitcher();
  },

  t(key, vars) {
    let s = (I18N_DICT[this.lang] && I18N_DICT[this.lang][key]) || I18N_DICT.zh[key] || key;
    if (vars) for (const k in vars) s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]);
    return s;
  },

  apply() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const v = this.t(key);
      if (el.hasAttribute('data-i18n-html')) el.innerHTML = v;
      else el.textContent = v;
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.setAttribute('title', this.t(el.getAttribute('data-i18n-title')));
    });
    // 触发页面级重渲染钩子
    if (typeof window.onI18nChange === 'function') {
      try { window.onI18nChange(this.lang); } catch (e) {}
    }
  },

  set(lang) {
    if (lang !== 'zh' && lang !== 'en') return;
    this.lang = lang;
    localStorage.setItem('hs_lang', lang);
    document.documentElement.lang = lang;
    this.apply();
    this.updateSwitcherUI();
  },

  // 临时切换语言 (不写 localStorage,用于 URL ?hl= 跟随发起人)
  setTemp(lang) {
    if (lang !== 'zh' && lang !== 'en') return;
    if (this.lang === lang) return;
    this.lang = lang;
    document.documentElement.lang = lang;
    this.apply();
    this.updateSwitcherUI();
  },

  mountSwitcher() {
    const bar = document.querySelector('.topbar');
    if (!bar || document.getElementById('langSwitch')) return;
    const sw = document.createElement('div');
    sw.id = 'langSwitch';
    sw.className = 'lang-switch';
    sw.innerHTML = `
      <button data-lang="zh">CN</button>
      <button data-lang="en">EN</button>
    `;
    // 插到 .badge 之前
    const badge = bar.querySelector('.badge');
    if (badge) bar.insertBefore(sw, badge);
    else bar.appendChild(sw);
    sw.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-lang]');
      if (btn) this.set(btn.dataset.lang);
    });
    this.updateSwitcherUI();
  },

  updateSwitcherUI() {
    document.querySelectorAll('#langSwitch button').forEach(b => {
      b.classList.toggle('active', b.dataset.lang === this.lang);
    });
  },
};

window.I18n = I18n;
document.addEventListener('DOMContentLoaded', () => I18n.init());
