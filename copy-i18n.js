// 反向交易页词条，复用全站 I18n（语言记忆、切换按钮）。
Object.entries({
 zh:{
  'ct.title':'反向交易',
  'ct.subtitle':'自动反向跟单：对方开多我开空，按比例合并成净仓位。全部数据由浏览器直接读取 Hyperliquid 链上公开接口。',
  'ct.refresh':'数据更新','ct.auto':'每 30 秒自动刷新',
  'ct.account':'交易账户','ct.since':'收益起点',
  'ct.cEquity':'账户净值','ct.cPnl':'净收益','ct.cRoi':'收益率','ct.cUpnl':'未实现盈亏','ct.cClosed':'已实现盈亏（未扣费）','ct.cVolume':'累计交易量','ct.cFees':'累计手续费','ct.cFunding':'资金费','ct.cNotional':'持仓名义价值',
  'ct.daily':'每日收益','ct.dailyCap':'按北京时间日界，每天 00:05 固化前一日收盘净值；最上面一行是今天（进行中）','ct.colDay':'日期','ct.colEq':'收盘净值','ct.colDayPnl':'当日收益','ct.colDayRoi':'当日收益率','ct.colCum':'累计收益','ct.colFills':'成交数','ct.colVol':'成交额','ct.live':'进行中','ct.noDays':'第一个完整交易日结束后（次日 00:05）开始记录',
  'ct.curve':'净收益曲线','ct.curveAria':'自收益起点以来的净收益折线（美元）',
  'ct.positions':'当前持仓','ct.trades':'最近成交',
  'ct.colCoin':'币种','ct.colSide':'方向','ct.colSize':'数量','ct.colValue':'名义价值','ct.colMargin':'保证金','ct.colEntry':'开仓价','ct.colMark':'标记价','ct.colUpnl':'浮盈','ct.colLev':'杠杆','ct.colLiq':'强平价（距离）',
  'ct.colTime':'时间','ct.colDir':'操作','ct.colPx':'成交价','ct.colFee':'手续费','ct.colClosed':'平仓盈亏',
  'ct.long':'多','ct.short':'空','ct.noPos':'当前无持仓','ct.noTrades':'暂无成交','ct.more':'显示更多',
    'ct.note':'净收益 = 当前净值 − 起始资金 − 起点后净转入；收益率 = 净收益 ÷（起始资金 + 净转入）。统一账户下净值已包含逐仓保证金和浮盈。已实现盈亏为 Hyperliquid 返回的平仓盈亏（不含手续费），资金费为正表示收入。收益曲线以每日收盘净值为主（GitHub Actions 每天 00:05 北京时间固化，只追加不改写），今天的部分接 Hyperliquid portfolio 采样点和实时净值。已固化的收盘净值取自运行时刻，已剔除日界后几分钟内的手续费、资金费和转账。持仓表：名义价值 = 数量 × 标记价；保证金 = 该仓位实际占用的资金（逐仓保证金 + 浮盈）；重开手续费 = 全部平仓再按原样开回的预估手续费（各 dex 实际吃单费率 × 2，不含滑点）。仅展示实盘记录，不构成投资建议。',
  'ct.sources':'数据来源：','ct.visitNote':'GoatCounter 站点汇总（与首页相同） · 今日按 UTC'
 },
 en:{
  'ct.title':'Reverse Copy Trading',
  'ct.subtitle':'Automatically takes the opposite side of tracked traders: they go long, we go short, netted per coin. All data is read by your browser directly from Hyperliquid public APIs.',
  'ct.refresh':'Update data','ct.auto':'Auto-refresh every 30 s',
  'ct.account':'Trading account','ct.since':'P&L since',
  'ct.cEquity':'Account equity','ct.cPnl':'Net P&L','ct.cRoi':'Return','ct.cUpnl':'Unrealized P&L','ct.cClosed':'Realized P&L (before fees)','ct.cVolume':'Total volume','ct.cFees':'Fees paid','ct.cFunding':'Funding','ct.cNotional':'Position notional',
  'ct.daily':'Daily P&L','ct.dailyCap':'Beijing-time days; each day’s closing equity is frozen at 00:05 the next day. Top row is today (in progress).','ct.colDay':'Date','ct.colEq':'Closing equity','ct.colDayPnl':'Day P&L','ct.colDayRoi':'Day return','ct.colCum':'Cumulative P&L','ct.colFills':'Fills','ct.colVol':'Volume','ct.live':'in progress','ct.noDays':'Recording starts after the first full day (00:05 next day).',
  'ct.curve':'Net P&L curve','ct.curveAria':'Net P&L in USD since the start time',
  'ct.positions':'Open positions','ct.trades':'Recent fills',
  'ct.colCoin':'Asset','ct.colSide':'Side','ct.colSize':'Size','ct.colValue':'Notional','ct.colMargin':'Margin','ct.colEntry':'Entry','ct.colMark':'Mark','ct.colUpnl':'uPnL','ct.colLev':'Leverage','ct.colLiq':'Liq. price (distance)',
  'ct.colTime':'Time','ct.colDir':'Action','ct.colPx':'Price','ct.colFee':'Fee','ct.colClosed':'Closed P&L',
  'ct.long':'Long','ct.short':'Short','ct.noPos':'No open positions','ct.noTrades':'No fills yet','ct.more':'Show more',
    'ct.note':'Net P&L = current equity − starting capital − net transfers after the start; return = net P&L ÷ (starting capital + net transfers). In a unified account equity already includes isolated margin and unrealized P&L. Realized P&L is closed P&L as reported by Hyperliquid (before fees); positive funding is income. The curve is built from daily closing equity (frozen by GitHub Actions at 00:05 Beijing time, append-only), with today extended by Hyperliquid portfolio samples and live equity. Frozen closes are taken at run time with fees, funding and transfers after midnight removed. Positions: notional = size × mark price; margin = capital actually tied up in the position (isolated margin incl. uPnL); reopen fees = estimated fees to close everything and reopen as-is (actual taker rate per dex × 2, excl. slippage). Live record only, not investment advice.',
  'ct.sources':'Sources: ','ct.visitNote':'GoatCounter site totals (same as homepage) · today in UTC'
 }
}).forEach(([lang,entries])=>Object.assign(I18N_DICT[lang],entries));
