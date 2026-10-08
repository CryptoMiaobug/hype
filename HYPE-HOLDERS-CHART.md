# HYPE 每日持币人收入图 — 2026-10-08

## 实现
- 仅 HYPE 增加下方 USD 柱状图，与原三曲线在同一 ECharts 实例中使用两个 grid、同一 UTC 日期分类、联动 axisPointer，30/90/全部同时筛选图和表格。
- 柱状图直接读取本次计算使用的合并 revenue 原始 map：固化 > localStorage > API；不从 R30 差分推算，不把实际零改成缺失、不把缺失填零。
- tooltip 在上下图均显示同日三指标及每日持币人收入，明确 NA；表格新增收入列。独立 USD 纵轴，移动端 560px 图高，tooltip 限制在容器内。
- 不修改 pe-core.js、JSON 档案、PE 分母、供应估算、CSV 格式或 UNI HTML；保留 111b3ec 最近有效卡片逻辑。共享 CSS/JS 新逻辑仅 HYPE 启用。

## 验证
- `node --check pe.js`、`node --check pe-core.js`
- `node test-pe.cjs`：13 个计算测试、4 个 UI smoke。
- `node test-pe-chart.cjs`：原始序列逐日映射、固化/cache/API 优先级、真实零/缺失、tooltip、表格、30/90/全部、联动轴配置、旧三曲线逐值一致、API 增量、异常早时钟、UNI 图表/列数及最近有效卡片回归。
- OpenClaw browser running/CDP ready；线上导航返回 `browser navigation blocked by policy`。没有绕过限制，不能声称完成真实浏览器视觉、触屏或实际 CORS 验收。

## 发布
- docs/ 中为接口文档，无部署脚本；参考 PE-INTEGRATION.md，原站是无构建静态 GitHub Pages，main 分支原 tip 为 111b3ec。
- GitHub CLI Pages API 返回 401（现有 gh 认证不可用），不更改认证；原有 git transport 可读取 main，沿用 git push origin main。
- 只显式提交 pe.js、pe.css、hype-pe.html、本报告、新测试；现有未跟踪 .gitignore 不包含在内。
- 发布后需检查线上 HTML / 带版本 JS、CSS 及两份 JSON 与本地字节一致，并报告上线证据。真实浏览器验收仍待可用环境。
