# UNI 每日回购／销毁价值代理图 — 2026-10-08

## 范围与口径
- UNI 补齐与 HYPE 相同的双 grid 图布局、UTC 日期轴联动、30/90/全部筛选、同日 tooltip、每日金额表格列。长图题拆两行以减少窄屏溢出；双资产图高均为桌面 650px / 窄屏 560px。
- UNI 图题为「每日回购／销毁价值（代理口径，USD）」；来源仍为 DefiLlama Uniswap `dailyRevenue`。页面明确：是当前估值分母使用的销毁价值代理，不代表已逐笔核验的实际链上回购或销毁。
- 直接使用现有 `seed.revenue` > 有效缓存 > 联网补缺合并序列；不从滚动值反推、不将真实零转 NA、不将缺失填零。
- 不修改 pe-core.js、固化 JSON、分母字段、供应估算模型、CSV；不重算固化历史。HYPE 仍用 dailyHoldersRevenue，图题和原行为保持不变。保留最新有效日卡片和三条曲线颜色 #38BDF8 / #FBBF24 / #C084FC。

## 验证
- `node --check pe.js && node --check pe-core.js`
- `node test-pe.cjs`：13 计算测试 + 4 个断网/增量 UI smoke。
- `node test-pe-chart.cjs`：HYPE/UNI 均执行原始柱图映射、固化/缓存/API 优先级、零/缺失、tooltip、七列表格、30/90/全部联动、完整固化与增量原三曲线逐值对照、正确 API 字段、联网增量、早时钟、卡片有效日、颜色及双 HTML 脚本版本检查。
- `git diff --check`。
- 浏览器 running/CDP ready，但 OpenClaw 导航线上 UNI 页面被 `browser navigation blocked by policy` 拦截；未绕过。真实渲染、窄屏视觉、触控与浏览器实际 CORS 未完成验收，不能把 DOM/图表配置桩测试当成真实浏览器测试。

## 发布
- 沿用现有静态 GitHub Pages `main` 分支直接推送方式，远端检查基线为 30d3a9e。
- 双 HTML 引用 `pe.js?v=20261008unibars`、`pe.css?v=20261008unibars`。
- 仅提交本次 JS/CSS、双 HTML、图表测试、本说明；原有未跟踪 `.gitignore` 不纳入。无凭据读取或认证变更。
- 推送后由执行报告记录线上 HTML / 带版本 JS、CSS / core / 双 JSON 的 HTTP 与字节比对证据。
