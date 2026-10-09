'use strict';
(async () => {
  const C = BNBCore, $ = id => document.getElementById(id);
  const t = s => (window.BNBText ? window.BNBText(s) : s);
  const en = () => window.I18n?.lang === 'en';
  const fmt = (n, d = 2) => n == null ? 'NA' : n.toLocaleString('en-US', { maximumFractionDigits: d });
  const usd = n => n == null ? 'NA' : '$' + (n >= 1e9 ? fmt(n / 1e9, 3) + 'B' : n >= 1e6 ? fmt(n / 1e6, 2) + 'M' : fmt(n, 0));
  // Linear-interpolated percentile (numpy 'linear'), same as the HYPE/UNI pages.
  const pct = (vals, q) => { const v = vals.filter(Number.isFinite).sort((a, b) => a - b); if (!v.length) return null; const i = (v.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return v[lo] + (v[hi] - v[lo]) * (i - lo); };
  const KEY = 'hypevalue-pe-v1-bnb';
  let seed, rows = [], rev = {}, range = 365, chart, statusText = '加载中…';
  const shownLines = { pe: true, price: true, p20: true, p50: true, p80: true };

  const status = s => { statusText = s; $('status').textContent = t(s); };
  async function json(url) {
    const r = await fetch(url, { signal: AbortSignal.timeout(25000), credentials: 'omit' });
    if (!r.ok) throw Error('HTTP ' + r.status + (r.status === 429 ? '（限流，请稍后手动重试）' : ''));
    return r.json();
  }
  const names = () => ({ pe: t('销毁 PE'), price: t('价格 USD'), p20: t('近1年 PE 20分位'), p50: t('近1年 PE 50分位（中位数）'), p80: t('近1年 PE 80分位') });

  function render() {
    const target = rows.at(-1), ok = [...rows].reverse().find(r => r.pe != null), latest = ok ?? target;
    $('asof').textContent = t('目标完整 UTC 日：') + C.yesterday() + t(' · 表中截至：') + target.date + t(' · 卡片有效估值日：') + (ok?.date ?? t('无'));
    const sub = latest.date + ' UTC' + (latest.date !== target.date ? t(' · 最近有效，非目标日') : '');
    $('cards').innerHTML = [
      ['销毁 PE', fmt(latest.pe) + ' x'], ['近似收盘价格', '$' + fmt(latest.price, 2)], ['流通市值', usd(latest.mcap)],
      ['季度销毁年化（最近4次）', usd(latest.quarterly)], ['Gas 销毁年化（30日）', usd(latest.gas)], ['年化销毁额合计', usd(latest.annual)],
    ].map(([k, v]) => `<div class="stat-card"><div class="label">${t(k)}</div><div class="value">${v}</div><div class="sub">${sub}</div></div>`).join('');

    const days = C.staleDays(seed, C.yesterday()), last = seed.burns.at(-1);
    $('stale').hidden = days <= 92;
    if (days > 92) $('stale').textContent = t('最近一次季度销毁是 ') + last.date + t('（第 ') + last.n + t(' 次），已过 ') + days + t(' 天。新一季公告发布后需维护者手动更新，在此之前分母继续使用最近 4 次。');

    $('burns').replaceChildren(...[...seed.burns].reverse().map(b => {
      const tr = document.createElement('tr');
      for (const v of [b.n, b.quarter, b.date, fmt(b.amount, 2), '$' + fmt(b.medianPrice, 2), usd(b.usd)]) { const td = document.createElement('td'); td.textContent = v; tr.append(td); }
      const td = document.createElement('td'), a = document.createElement('a');
      a.href = 'https://bscscan.com/tx/' + b.tx; a.target = '_blank'; a.rel = 'noopener'; a.textContent = b.tx.slice(0, 10) + '…';
      td.append(a); tr.append(td); return tr;
    }));

    const shown = range ? rows.slice(-range) : rows;
    $('tbody').replaceChildren(...[...shown].reverse().map(r => {
      const tr = document.createElement('tr');
      const src = r.source === 'bundled' ? t('固化历史') : r.status === 'ok' ? t('浏览器增量') : t(r.status);
      for (const v of [r.date, fmt(r.price, 2), fmt(r.pe), usd(r.quarterly), usd(rev[r.date]), usd(r.gas), r.mcapSource === 'backcast' ? t('倒推') : r.mcapSource ?? 'NA', src]) { const td = document.createElement('td'); td.textContent = v; tr.append(td); }
      return tr;
    }));
    drawChart(shown);
  }

  function drawChart(shown) {
    if (!window.echarts) { $('chart').textContent = t('图表库未加载；下方表格和 CSV 仍可用。'); return; }
    if (!chart) {
      chart = echarts.init($('chart'));
      chart.on?.('legendselectchanged', e => { for (const [k, n] of Object.entries(names())) if (Object.hasOwn(e.selected || {}, n)) shownLines[k] = !!e.selected[n]; });
    }
    const year = rows.slice(-365).map(r => r.pe).filter(v => v != null), p20 = pct(year, 0.2), p50 = pct(year, 0.5), p80 = pct(year, 0.8);
    const dates = shown.map(r => r.date), n = names();
    const colors = { pe: '#F0B90B', price: '#C084FC', gas: '#50d2c1', p20: '#4ADE80', p50: '#A5B4FC', p80: '#F87171' };
    const axis = { type: 'category', data: dates, axisLabel: { color: '#8fb5ac' }, boundaryGap: true };
    const burnLines = seed.burns.filter(b => dates.includes(b.date)).map(b => ({ xAxis: b.date, label: { formatter: '#' + b.n, color: '#8fb5ac' } }));
    const series = [
      { name: n.pe, type: 'line', showSymbol: false, connectNulls: false, step: false, xAxisIndex: 0, yAxisIndex: 0, lineStyle: { color: colors.pe, width: 2 }, itemStyle: { color: colors.pe }, data: shown.map(r => r.pe),
        markLine: { silent: true, symbol: 'none', lineStyle: { color: '#4b6b63', type: 'dotted' }, data: burnLines } },
      { name: n.price, type: 'line', showSymbol: false, connectNulls: false, xAxisIndex: 0, yAxisIndex: 1, lineStyle: { color: colors.price }, itemStyle: { color: colors.price }, data: shown.map(r => r.price) },
      { name: t('每日 Gas 销毁（USD）'), type: 'bar', xAxisIndex: 1, yAxisIndex: 2, barMaxWidth: 18, itemStyle: { color: colors.gas }, data: shown.map(r => rev[r.date] ?? null) },
    ];
    const legend = [n.pe, n.price];
    const bands = { p20, p50, p80 };
    for (const k of ['p20', 'p50', 'p80']) {
      const v = bands[k];
      if (v == null) continue;
      series.push({ name: n[k], type: 'line', showSymbol: false, silent: true, xAxisIndex: 0, yAxisIndex: 0, z: 1, lineStyle: { type: 'dashed', width: 1.5, color: colors[k] }, itemStyle: { color: colors[k] }, data: shown.map(() => v) });
      legend.push(n[k]);
    }
    const byDate = Object.fromEntries(shown.map(r => [r.date, r]));
    chart.setOption({
      color: [colors.pe, colors.price, colors.gas],
      tooltip: { trigger: 'axis', confine: true, formatter: ps => {
        const d = ps[0]?.axisValue, r = byDate[d];
        if (!r) return d;
        return [d + ' UTC', t('销毁 PE') + ': ' + fmt(r.pe) + ' x', t('价格 USD') + ': $' + fmt(r.price, 2), t('流通市值') + ': ' + usd(r.mcap) + (r.mcapSource === 'backcast' ? ' (' + t('倒推') + ')' : ''),
          t('季度销毁年化（最近4次）') + ': ' + usd(r.quarterly) + (r.burnsUsed?.length ? ' [#' + r.burnsUsed.join(', #') + ']' : ''), t('Gas 销毁年化（30日）') + ': ' + usd(r.gas), t('每日 Gas 销毁（USD）') + ': ' + usd(rev[d]),
          [['p20', p20], ['p50', p50], ['p80', p80]].filter(([, v]) => v != null).map(([k, v]) => n[k] + ': ' + fmt(v) + ' x').join(' · ')].join('<br>');
      } },
      axisPointer: { link: [{ xAxisIndex: 'all' }] },
      legend: { textStyle: { color: '#8fb5ac' }, data: legend, selected: Object.fromEntries(Object.entries(n).map(([k, v]) => [v, shownLines[k]])) },
      title: { text: t('每日 Gas 销毁（USD）'), top: '62%', left: 10, textStyle: { color: '#8fb5ac', fontSize: 12, fontWeight: 'normal' } },
      grid: [{ left: 60, right: 65, top: 65, height: '44%' }, { left: 60, right: 65, top: '69%', bottom: 55 }],
      xAxis: [{ ...axis, gridIndex: 0 }, { ...axis, gridIndex: 1 }],
      yAxis: [
        { type: 'value', gridIndex: 0, name: t('倍数 x'), scale: true, axisLabel: { color: '#8fb5ac' }, splitLine: { lineStyle: { color: '#183c34' } } },
        { type: 'value', gridIndex: 0, name: 'USD', scale: true, axisLabel: { color: '#8fb5ac' }, splitLine: { show: false } },
        { type: 'value', gridIndex: 1, name: 'USD', min: 0, axisLabel: { color: '#8fb5ac', formatter: v => v >= 1e6 ? fmt(v / 1e6, 1) + 'M' : v >= 1e3 ? fmt(v / 1e3, 0) + 'k' : fmt(v) }, splitLine: { lineStyle: { color: '#183c34' } } },
      ],
      dataZoom: [{ type: 'inside', xAxisIndex: [0, 1] }],
      series,
    }, { notMerge: true });
  }

  async function refresh() {
    $('refresh').disabled = true;
    const notes = [];
    try {
      seed ??= await json('pe-data/bnb.json');
      let cache = {};
      try { cache = JSON.parse(localStorage.getItem(KEY) || '{}'); if (cache.seedHash !== seed.sourceSHA256) cache = {}; } catch { notes.push('本地缓存不可用'); }
      // Validate cached raw inputs; never trust cached computed rows.
      const day = /^\d{4}-\d{2}-\d{2}$/;
      const cRev = Object.fromEntries(Object.entries(cache.revenue || {}).filter(([d, v]) => day.test(d) && C.valid(v)));
      const cMkt = Object.fromEntries(Object.entries(cache.market || {}).filter(([d, v]) => day.test(d) && Array.isArray(v) && v.length === 2 && v.every(x => C.valid(x) && x > 0)));
      rev = C.merge(seed.revenue, cRev);
      let prices = cMkt;
      const end = C.yesterday();
      if (C.time(end) - C.time(seed.last) > 3660 * C.DAY) throw Error('设备日期距固化档案超过10年，请检查系统时间');
      if (end <= seed.last) {
        notes.push(end < seed.last ? '系统时间早于固化档案；保留历史，不向未来抓取。' : '固化档案已覆盖到目标日。');
        rows = C.calculate(seed, rev, prices, seed.last); render(); return;
      }
      rows = C.calculate(seed, rev, prices, end); render();
      const gaps = rows.filter(r => r.source === 'browser' && (r.price == null || r.r30 == null));
      if (gaps.length) {
        status('正在补齐 ' + gaps.length + ' 个日期的公开数据…');
        // Serial public requests, no aggressive retry; never proxy around CORS or rate limits.
        try { rev = C.merge(rev, C.revenue(await json('https://api.llama.fi/summary/fees/bsc?dataType=dailyRevenue'), end)); }
        catch (e) { notes.push('收入获取失败：' + e.message); }
        try { prices = C.merge(prices, C.market(await json('https://api.coingecko.com/api/v3/coins/binancecoin/market_chart?vs_currency=usd&days=365&interval=daily'), end)); }
        catch (e) { notes.push('行情获取失败：' + e.message + '；可能为网络、CORS 或限流'); }
        const keep = Object.fromEntries(Object.entries(rev).filter(([d]) => !Object.hasOwn(seed.revenue, d)));
        const keepM = Object.fromEntries(Object.entries(prices).filter(([d]) => d > seed.last));
        try { localStorage.setItem(KEY, JSON.stringify({ seedHash: seed.sourceSHA256, revenue: keep, market: keepM, savedAt: new Date().toISOString() })); }
        catch { notes.push('缓存写入失败；本次增量仅在内存中'); }
        rows = C.calculate(seed, rev, prices, end); render();
      }
      const pending = rows.filter(r => r.source === 'browser' && r.pe == null).length;
      notes.push(pending ? pending + ' 个增量日期仍待补齐；表格保留 NA，卡片显示明确标注日期的最近有效估值。' : '所有目标日期的指标已完整。');
      const last = rows.at(-1);
      if (last.pe == null) {
        const why = [];
        if (!C.valid(rev[end])) why.push('当日 Gas 销毁缺失');
        if (last.r30 == null) why.push('30日窗口不完整');
        if (last.price == null) why.push('缺少 D+1 00:00 UTC 精确配对价格/市值');
        notes.push('目标 ' + end + '：' + why.join('；') + '。');
      }
    } catch (e) { notes.push('读取失败：' + e.message); }
    finally { status(notes.join(' ')); $('refresh').disabled = false; }
  }

  $('refresh').onclick = refresh;
  document.querySelectorAll('[data-range]').forEach(b => b.onclick = () => { range = +b.dataset.range; render(); });
  window.addEventListener('resize', () => chart?.resize());
  $('download').onclick = () => {
    if (!rows.length) return;
    const cols = ['date', 'price', 'mcap', 'mcapSource', 'supply', 'quarterly', 'burnsUsed', 'r30', 'gas', 'annual', 'pe', 'status', 'source'];
    const cell = v => v == null ? 'NA' : Array.isArray(v) ? '"' + v.join(' ') + '"' : v;
    const blob = new Blob([cols.join(',') + '\n' + rows.map(r => cols.map(k => cell(r[k])).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'bnb-pe.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  window.onI18nChange = () => {
    document.querySelectorAll('[data-pe-aria]').forEach(el => el.setAttribute('aria-label', window.I18n.t(el.getAttribute('data-pe-aria'))));
    document.querySelectorAll('[data-i18n-aria]').forEach(el => el.setAttribute('aria-label', window.I18n.t(el.getAttribute('data-i18n-aria'))));
    for (const id of ['vcTotal', 'vcToday']) { const el = $(id); if (el?.dataset?.state === 'loading') el.textContent = t('加载中…'); }
    if (rows.length) render();
    $('status').textContent = t(statusText);
  };
  await refresh();
})();
