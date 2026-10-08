# 可见访问计数（2026-10-08）

首页、HYPE PE、UNI PE 共用 `visit-counter.js`，只显示数字，不执行追踪；每页原有 GoatCounter `count.js` 仍仅一份。PE 不加载首页 app.js / i18n.js，不改变估值、图表或数据。

沿用首页原接口 `https://cryptomiao.goatcounter.com/counter/TOTAL.json`，这是 cryptomiao GoatCounter 站点 TOTAL 汇总，并非当前 PE 页独立访问量，也不保证只含当前域名（取决于该 GoatCounter 站点接收的追踪）。仍优先展示 `count_unique`，该字段缺失才使用 `count`。今日使用 `?start=YYYY-MM-DD&end=次日`，按 UTC，不改为北京时间。PE 页脚明确标注范围。

真实整数 0 显示 0；加载显示「加载中…」，网络、HTTP、JSON、数据格式错误或12秒超时显示「暂不可用」，不伪装为0。独立加载总量和今日计数，一个失败不影响另一个。没有密钥、私有统计接口、隐私设置修改、重试循环或额外追踪。

首页同步抽取原 inline 计数逻辑并补充中英 `visit.total` / `visit.today` 字典，避免原始 key 外露。两 PE 保持原有中文页面机制，标签是「总访问量 / 今日访问量」。

验证：`node test-visit-counter.cjs` 检查三个页面 DOM 结构、单份追踪/组件、加载态、动态数字、真实0、UTC查询、非法数据、HTTP/JSON/网络失败及英文失败态；并使用实时公共 API 响应驱动 DOM 桩，2026-10-08 返回319/0，HTTP200、CORS `*`。这些数字未写入组件。`node test-pe.cjs`、`node test-pe-chart.cjs` 全通过。

真实浏览器验收限制：OpenClaw 浏览器运行正常，但导航线上域名被工具策略阻止（`browser navigation blocked by policy`）；未绕过。DOM 桩/HTTP检查不等于真实浏览器视觉、CORS执行验收。GoatCounter可能有缓存或更新延迟；统计与追踪失败互不关联。

部署：现有 main 分支静态 GitHub Pages 流程，显式暂存本次7个文件后提交推送，不改已有未跟踪 `.gitignore`。
