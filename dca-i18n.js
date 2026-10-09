// DCA page static text. Extends the shared site dictionary (i18n.js).
(function () {
'use strict';
Object.assign(I18N_DICT.zh, {
  'dca.title': 'DCA 定投建议',
  'dca.subtitle': '按当前 PE 在近 1 年的分位调整每期定投金额 · 分位线与 PE 图上的 P20/P50/P80 虚线一致',
  'dca.baseLabel': '每个币种的基准定投金额（USD）',
  'dca.rules': '规则',
  'dca.r1': '低于 20 分位：绿色，加倍定投（× 2）',
  'dca.r2': '20–50 分位：黄色，正常定投（× 1）',
  'dca.r3': '50–80 分位：橙色，减半定投（× 0.5）',
  'dca.r4': '高于 80 分位：红色，停止定投（× 0）',
  'dca.note': '分位 = 近 365 个日历日内低于当前 PE 的有效天数占比。数据来自本站固化档案；若你打开过对应 PE 页面，会一并使用本浏览器已缓存的增量。HYPE、UNI 用流通口径，BNB 用销毁 PE。仅供研究，不是投资建议。',
});
Object.assign(I18N_DICT.en, {
  'dca.title': 'DCA Guide',
  'dca.subtitle': 'Scales each period\u2019s buy by where the current PE sits in its 1-year range · tiers match the P20/P50/P80 dashed lines on the PE charts',
  'dca.baseLabel': 'Base DCA amount per asset (USD)',
  'dca.rules': 'Rules',
  'dca.r1': 'Below P20: green, double DCA (× 2)',
  'dca.r2': 'P20–P50: yellow, normal DCA (× 1)',
  'dca.r3': 'P50–P80: orange, half DCA (× 0.5)',
  'dca.r4': 'Above P80: red, pause DCA (× 0)',
  'dca.note': 'Percentile = share of valid days in the last 365 calendar days with PE below the current value. Uses the bundled archives plus any increments this browser cached when you opened the PE pages. HYPE and UNI use the circulating measure; BNB uses burn PE. Research only, not investment advice.',
});
})();
