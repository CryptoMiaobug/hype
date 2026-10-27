// "PE 监控" 顶部标签：点击只展开下拉，不跳转总览页
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const listeners={doc:{},d:{},s:{}};
const on=k=>(ev,fn)=>{(listeners[k][ev]=listeners[k][ev]||[]).push(fn)};
const summary={addEventListener:on('s'),focus(){}};
const d={open:false,addEventListener:on('d'),contains:()=>true,
  querySelector:s=>s==='summary'?summary:(s.includes('pe-list.html')?{href:'pe-list.html'}:null)};
const ctx={location:{href:'hype-pe.html'},matchMedia:()=>({matches:false}),setTimeout,clearTimeout,
  document:{querySelectorAll:()=>[d],addEventListener:on('doc')}};
vm.runInNewContext(fs.readFileSync('nav-pe.js','utf8'),ctx);
let prevented=false;
(listeners.s.click||[]).forEach(fn=>fn({preventDefault(){prevented=true}}));
assert.equal(prevented,false,'summary 点击不能拦截（保留原生展开）');
assert.equal(ctx.location.href,'hype-pe.html','点击 PE 监控不能跳转');
for(const p of ['dashboard.html','valuation.html','hype-pe.html','uni-pe.html','bnb-pe.html','aave-pe.html','pe-list.html','battlefield/index.html','btc-overview.html','btc-drawdown.html','btc-mvrv.html','btc-mcap.html','btc-dominance.html'])
  assert.match(fs.readFileSync(p,'utf8'),/<summary data-i18n="nav\.pe">PE 监控<\/summary><div class="nav-pe-menu"><a href="(\.\.\/)?pe-list\.html"/,p+' 下拉里保留全部总览');
// 反向交易页已下线（2026-10-28）：导航里不应再有入口
for(const p of ['dashboard.html','valuation.html','hype-pe.html','uni-pe.html','bnb-pe.html','aave-pe.html','pe-list.html','battlefield/index.html','btc-overview.html','btc-drawdown.html','btc-mvrv.html','btc-mcap.html','btc-dominance.html'])
  assert.ok(!fs.readFileSync(p,'utf8').includes('copy-trade.html'),p+' 不应再链接反向交易页');
console.log('PASS nav-pe: click opens dropdown only, no redirect');
// Top bar must not overflow on narrow screens: every page with .topnav loads nav-pe.css, which carries the wrap rules.
{const css=fs.readFileSync('nav-pe.css','utf8');
 assert.ok(/\.topbar\s*\{\s*flex-wrap:\s*wrap/.test(css),'topbar wraps at all widths');
 assert.ok(/@media \(max-width: 800px\)[\s\S]*\.topbar \.topnav \{[^}]*flex-basis: 100%[^}]*flex-wrap: wrap/.test(css),'nav gets its own wrapping row <=800px');
 for(const p of fs.readdirSync('.').filter(f=>f.endsWith('.html'))){const h=fs.readFileSync(p,'utf8');if(h.includes('class="topnav"'))assert.ok(h.includes('nav-pe.css'),p+' loads nav-pe.css');}
 console.log('PASS topbar wrap on all pages');}
// PE overview: table fits at 1280 (no fixed min-width), fade cue only when it still scrolls.
{const css=fs.readFileSync('pe-list.css','utf8'),js=fs.readFileSync('pe-list.js','utf8');
 assert.ok(/\.pl-table\{min-width:0;width:100%\}/.test(css));assert.ok(css.includes('.pl-scroll.fits{-webkit-mask-image:none;mask-image:none}'));
 assert.ok(js.includes("classList.toggle('fits'"));console.log('PASS overview fit + scroll cue');}
