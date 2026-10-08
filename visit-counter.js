// Shared display only: tracking remains the existing, single GoatCounter script.
// Preserve the homepage's site TOTAL and count_unique-first scope, UTC day range.
(function () {
  'use strict';
  var base = 'https://cryptomiao.goatcounter.com/counter/TOTAL.json';
  function text(zh, en) {
    return document.documentElement.lang === 'en' ? en : zh;
  }
  function ymd(d) { return d.toISOString().slice(0, 10); }
  function count(data) {
    var value = data && (data.count_unique != null ? data.count_unique : data.count);
    if (typeof value === 'string' && /^(\d+|\d{1,3}(,\d{3})+)$/.test(value)) {
      value = Number(value.replace(/,/g, ''));
    }
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
      throw new Error('Invalid visitor count');
    }
    return value.toLocaleString('en-US');
  }
  async function grab(url, id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = text('加载中…', 'Loading…');
    el.dataset.state = 'loading';
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 12000);
    try {
      var response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error('Counter unavailable');
      el.textContent = count(await response.json());
      el.dataset.state = 'ready';
    } catch (_) {
      el.textContent = text('暂不可用', 'Unavailable');
      el.dataset.state = 'error';
    } finally {
      clearTimeout(timer);
    }
  }
  var now = new Date();
  grab(base, 'vcTotal');
  grab(base + '?start=' + ymd(now) + '&end=' + ymd(new Date(now.getTime() + 86400000)), 'vcToday');
})();
