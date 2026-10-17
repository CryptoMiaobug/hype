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
for(const p of ['dashboard.html','valuation.html','hype-pe.html','uni-pe.html','bnb-pe.html','aave-pe.html','pe-list.html','battlefield/index.html','btc-drawdown.html','btc-mvrv.html','btc-mcap.html','btc-dominance.html'])
  assert.match(fs.readFileSync(p,'utf8'),/<summary data-i18n="nav\.pe">PE 监控<\/summary><div class="nav-pe-menu"><a href="(\.\.\/)?pe-list\.html"/,p+' 下拉里保留全部总览');
console.log('PASS nav-pe: click opens dropdown only, no redirect');
