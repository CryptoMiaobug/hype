'use strict';
/* Coin-page panel: how much protocol revenue actually reaches holders.
   Independent of pe.js / bnb-pe.js; reads bundled pe-data and (if behind) DefiLlama, never alters PE rows. */
(async () => {
  const P = window.PayoutCore, el = document.getElementById('payout');
  if (!P || !el) return;
  const asset = document.body.dataset.asset ?? 'bnb';
  const bi = (zh, en) => window.I18n?.lang === 'en' ? en : zh;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (n, d = 2) => Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: d }) : 'NA';
  const usd = n => !Number.isFinite(n) ? 'NA' : '$' + (n >= 1e9 ? num(n / 1e9, 2) + 'B' : n >= 1e6 ? num(n / 1e6, 2) + 'M' : num(n, 0));
  const pct = v => v == null ? 'NA' : num(v * 100, 1) + '%';
  async function json(url) {
    const r = await fetch(url, { signal: AbortSignal.timeout(25000), credentials: 'omit' });
    if (!r.ok) throw Error('HTTP ' + r.status);
    return r.json();
  }
  const card = (label, value, sub) => `<div class="stat-card"><div class="label">${label}</div><div class="value">${value}</div><div class="sub">${sub}</div></div>`;
  let state = { loading: true };

  function render() {
    const h3 = `<h3>${bi('收入回馈率', 'Revenue payout ratio')}</h3>`;
    if (state.loading) { el.innerHTML = h3 + `<p class="pe-muted">${bi('加载中…', 'Loading…')}</p>`; return; }
    if (state.error) { el.innerHTML = h3 + `<p class="pe-muted">${bi('读取失败：', 'Load failed: ')}${esc(state.error)}</p>`; return; }
    if (asset === 'bnb') {
      const r = state.row, b = P.bnb(r);
      el.innerHTML = h3 + `<div class="stat-grid">`
        + card(bi('收入回馈率', 'Payout ratio'), bi('不适用', 'N/A'), bi('回馈主体不来自收入', 'Main payout is not revenue-funded'))
        + card(bi('季度 Auto-Burn 占年化回馈', 'Quarterly Auto-Burn share'), pct(b?.autoShare), bi('非收入来源 · ', 'not revenue-funded · ') + (r?.date ?? '') + ' UTC')
        + `</div><p class="pe-muted">${bi(
          'BNB 的回馈主体是季度 Auto-Burn，按出块数和 BNB 均价的公式从存量 BNB 中销毁，不随链上手续费或币安利润变化，因此「回馈 ÷ 收入」口径不适用。Gas 实时销毁（BEP-95，10% gas 费）虽来自链上收入，但占比很小，不足以代表整体。本页 PE 的分母主要由 Auto-Burn 构成，不会随链上业务增长。',
          'BNB\'s payout is dominated by the quarterly Auto-Burn, which removes existing BNB by a formula based on block count and average BNB price and does not track on-chain fees or Binance profit, so a payout ÷ revenue ratio does not apply. The real-time gas burn (BEP-95, 10% of gas fees) is revenue-funded but too small to represent the whole. Most of this page\'s PE denominator is Auto-Burn, which does not grow with on-chain activity.')}</p>`;
      return;
    }
    const src = state.payout.seed.assets[asset], s = P.summary(src, P.lastValid(src, state.end));
    const mcap = state.mcap, payoutPE = s.annual30 > 0 && mcap ? mcap / s.annual30 : null;
    const sub30 = `${s.end} UTC · ${usd(s.w30.hold)} / ${usd(s.w30.rev)}`;
    const months = P.monthly(src, s.end, 13);
    const note = asset === 'aave'
      ? bi('实际回馈 = DefiLlama Aave dailyHoldersRevenue，即国库买入 AAVE 的金额（2025-04-09 起）；stkAAVE 安全模块奖励来自生态储备，不计入。回馈率为 0 时实际回馈 PE 显示 NA。本页上方 PE 仍以协议收入为分母，不因回购暂停而改变。',
        'Actual payout = DefiLlama Aave dailyHoldersRevenue, i.e. treasury purchases of AAVE (since 2025-04-09). stkAAVE Safety Module rewards come from the ecosystem reserve and are excluded. When the ratio is 0, actual-payout PE shows NA. The PE above still uses protocol revenue as its denominator and does not change when buybacks pause.')
      : bi('实际回馈 = DefiLlama dailyHoldersRevenue，收入 = dailyRevenue。本币的 PE 分母本身就是回馈口径，回馈率接近 100% 属预期；仅作横向对照。',
        'Actual payout = DefiLlama dailyHoldersRevenue; revenue = dailyRevenue. This asset\'s PE denominator is already payout-based, so a ratio near 100% is expected; shown for comparison.');
    el.innerHTML = h3 + `<div class="stat-grid">`
      + card(bi('近 30 日回馈率', '30-day payout ratio'), pct(s.w30.ratio) + (s.paused ? ` <small class="pl-flag">${bi('回馈暂停', 'Payout paused')}</small>` : ''), sub30)
      + card(bi('近 1 年回馈率', '1-year payout ratio'), pct(s.w365.ratio), `${usd(s.w365.hold)} / ${usd(s.w365.rev)}`)
      + card(bi('年化实际回馈（近 30 日）', 'Annualized actual payout (30d)'), usd(s.annual30), s.end + ' UTC')
      + card(bi('实际回馈 PE', 'Actual-payout PE'), payoutPE == null ? 'NA' : num(payoutPE) + ' x', bi('流通市值 ÷ 年化实际回馈 · 市值 ', 'Circulating mcap ÷ annualized payout · mcap ') + (state.mcapDate ?? 'NA'))
      + `</div><div class="scroll-y"><table><thead><tr><th>${bi('月份 UTC', 'Month UTC')}</th><th>${bi('协议收入 USD', 'Revenue USD')}</th><th>${bi('实际回馈 USD', 'Payout USD')}</th><th>${bi('回馈率', 'Ratio')}</th><th>${bi('天数', 'Days')}</th></tr></thead><tbody>`
      + months.map(m => `<tr><td>${m.month}</td><td>${num(m.rev, 0)}</td><td>${num(m.hold, 0)}</td><td>${pct(m.ratio)}</td><td>${m.days}${m.missing ? ' / ' + bi('缺 ', 'missing ') + m.missing : ''}</td></tr>`).join('')
      + `</tbody></table></div><p class="pe-muted">${note}</p>`;
  }

  const prev = window.onI18nChange;
  window.onI18nChange = (...a) => { prev?.(...a); render(); };
  render();
  try {
    const seed = await json('pe-data/' + asset + '.json');
    const valued = [...seed.rows].reverse().find(r => (r.circ ?? r.pe) != null);
    if (asset === 'bnb') state = { row: valued };
    else {
      const payout = await P.load(json, (window.PECore?.yesterday ?? (() => seed.last))(), [asset]);
      state = { payout, end: (window.PECore?.yesterday ?? (() => payout.seed.last))(), mcap: valued?.mcap ?? null, mcapDate: valued?.date };
    }
  } catch (e) { state = { error: e.message }; }
  render();
})();
