# HYPE / UNI PE 静态集成（待发布）

新增 `hype-pe.html`、`uni-pe.html`，共用原站深绿色 `style.css` + `pe.css`，从首页、价值测算、战况导航进入。采用原站已有 ECharts；CDN 失败仍有卡片、表格和 CSV。没有 iframe、Python 服务、后端、账户、密钥或交易功能。

## 固化输入

`pe-data/hype.json` 来自 `/Users/macpony/shared/program/hyperliquid/hype_rolling_pe.csv` 及 `raw/20261007T164120.829625Z/{defillama,coingecko}.json`。
`pe-data/uni.json` 来自 `/Users/macpony/shared/program/uniswap/estimates/uni_rolling_pe.csv` 及 `raw/20261007T160532.313251Z/{defillama,coingecko}.json`。

CSV 转成同值的 JSON 行，附原 CSV SHA256。公开原始日收入和精确午夜配对行情也一起打包，以支持窗口和供应连续性，不包含档案绝对路径、源码、凭据或请求头。原项目文件未修改。档案固定截至 2026-10-06，HYPE 365 行、UNI 253 行。HYPE 固定供应 955307079.4341414 不被当前 API 改动。

## 自动补缺

打开页面：先显示固化+本机缓存，按设备 UTC 昨日计算目标；有缺日期才依次请求 DefiLlama 与 CoinGecko，25秒超时，无紧密重试。429 可手动稍后重试。原档案原始值 > 缓存 > 新 API，已有非空有效值不覆盖；缺口可补回。计算结果每次从原始输入重算，固化行始终保持不变。UTC 尚未结束日期和 CoinGecko 非午夜附加点不纳入。

增量记录和原始输入仅存当前 origin 的 localStorage，不跨设备/域名/协议，不修改网站文件。缓存被清除后仍有固化数据，但旧增量需重新获取。CoinGecko 公共接口约365日历史范围，超过范围的缺口不会插值/用0补；UNI 供应遇缺口后停止，补回才恢复。设备时钟不可信，页面明确提示；超过档案10年的异常时钟会拒绝巨量循环。上游历史修订不追溯覆盖已有有效输入。

本版本**不会自动补固化 CSV 本来已存在的 NA 行**，这是历史不覆盖的保守边界；本次固化行均有效。新日期的 NA 不当有效记录冻结，后续可重试填充。

## 测试及限制

- `node --check pe-core.js && node --check pe.js`
- `node test-pe.cjs`：13 个计算测试 + 4 个 UI 桩测试。365 HYPE 固化行逐值复算、253 UNI 供应复算一致；覆盖精确配对/UTC/窗口缺失/零分母/供应连续性/历史不可覆盖/断网保留/成功增量。
- 2026-10-08 对两个公共服务发送带 `Origin: https://hype.miao77.xyz` 的 HTTP 请求，HYPE 和 UNI 共4个接口均 HTTP 200、`Access-Control-Allow-Origin: *`。这只是响应头证据，不等同真实浏览器跨域验收。限流和未来 CORS 策略不可保证。
- OpenClaw browser 状态正常，但导航 `https://hype.miao77.xyz` 被工具策略禁止；未绕过策略，**未完成真实浏览器视觉/触屏/CORS验收**。应在允许的人工浏览器中验收桌面和手机，检查 DevTools Network 与 localStorage。
- 无法保证用户打开当天一定补齐：上游未发布、网络失败、限流、历史范围不足均保留 NA 并提示。
- 若要求全设备一致、长期可审计且可靠自动补齐，需要经用户批准的集中归档发布流程（例如 GitHub Actions 定时抓公开 API、只追加并发布静态档案）或服务端。当前没有建立任何定时任务或后端。

## 部署待办（尚未发布）

现存目录为独立 Git 仓库；检查时已有未跟踪 `.gitignore`（不是本次创建）。CNAME 为 `hype.miao77.xyz`；线上首页 HTTP 200，Server 响应头为 GitHub.com。`../docs` 只有接口资料，未发现部署说明；无 package.json / 构建器或仓库内 Actions workflow。静态文件可直接 GitHub Pages 发布，实际 Pages 分支/目录设置须由维护者确认，不能仅凭 CNAME 推定已配置。

1. 人工浏览器验收两个新页面、跨页导航、窄屏、图例与导出，检查缓存及断网降级。
2. 明确允许发布后，**仅显式暂存**此次文件：3个已有导航 HTML、2个新 HTML、pe-core.js、pe.js、pe.css、pe-data/hype.json、pe-data/uni.json、test-pe.cjs、本说明；不要 `git add .`。检查已存在 `.gitignore` 的安全规则是否应单独提交。
3. 核对 diff 和 GitHub Pages 发布分支/根目录，再提交/推送。不要访问、显示或暂存任何 github_token.txt / token / 私钥。
4. 等 Pages 完成后验证 HTTPS/CNAME、两个 JSON、两个页面和控制台。Python 文件不需要上传也不能在 Pages 运行。
5. 以后集中增加固化数据时，新建版本并审核来源/哈希，保持原有记录不变；版本迁移需要明确设计，不能悄悄重算整段历史。
