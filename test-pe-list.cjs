// PE overview list: renders one clickable row per asset; values match the coin pages' cores.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const PO=require('./payout-core.js'),D=require('./dca-core.js'),PC=require('./pe-core.js'),BC=require('./bnb-core.js');
(async()=>{
 for(const lang of ['zh','en']){
  const nodes={},make=()=>({innerHTML:'',addEventListener(k,f){this['on'+k]=f}}),dict={zh:{},en:{}};
  const ctx={I18N_DICT:dict,DCACore:D,PayoutCore:PO,PECore:{...PC,yesterday:()=>'2026-10-08'},BNBCore:{...BC,yesterday:()=>'2026-10-08'},
   document:{getElementById:id=>nodes[id]??=make()},localStorage:{getItem:()=>null},AbortSignal:{timeout(){}},location:{href:''},
   fetch:async u=>{if(u.startsWith('pe-data'))return {ok:true,json:async()=>JSON.parse(fs.readFileSync(u))};throw Error('offline')}};
  ctx.window={...ctx,I18n:{lang}};ctx.window.I18n.lang=lang;ctx.window.window=ctx.window;
  await vm.runInNewContext(fs.readFileSync('pe-list.js','utf8'),Object.assign(ctx,{window:ctx.window}));
  await new Promise(r=>setTimeout(r,50));
  const h=nodes['pe-list'].innerHTML;
  assert.equal((h.match(/<tr data-href=/g)||[]).length,4);
  for(const [n,p] of [['HYPE','hype-pe.html'],['UNI','uni-pe.html'],['BNB','bnb-pe.html'],['AAVE','aave-pe.html']])assert.ok(h.includes(`href="${p}"><b>${n}</b>`),n);
  assert.ok(!h.includes('读取失败')&&!h.includes('Load failed'),h.slice(0,400));
  // numbers equal the shared evaluate() on bundled rows (offline)
  for(const [a,f] of [['hype','circ'],['uni','circ'],['bnb','pe'],['aave','circ']]){const r=D.evaluate(JSON.parse(fs.readFileSync('pe-data/'+a+'.json')).rows,f);assert.ok(h.includes(r.pe.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+' x'),a);assert.ok(h.includes(`<b>${r.tier.ratio}%</b>`),a);}
  assert.ok(Object.keys(dict.zh).includes('list.title')&&Object.keys(dict.en).includes('list.note'));
  if(lang==='en')assert.ok(!/[\u4e00-\u9fff]/.test(h),h.match(/[^<>]*[\u4e00-\u9fff][^<>]*/)?.[0]);
  // row click navigates; link click is left to the browser
  const tr={dataset:{href:'uni-pe.html'}};nodes['pe-list'].onclick({target:{closest:s=>s==='a'?null:tr}});assert.equal(ctx.location.href,'uni-pe.html');
  console.log('PASS pe-list',lang);
 }
 // every page's PE menu starts with the overview link
 for(const p of ['dashboard.html','valuation.html','hype-pe.html','uni-pe.html','bnb-pe.html','aave-pe.html','battlefield/index.html','pe-list.html'])assert.match(fs.readFileSync(p,'utf8'),/<div class="nav-pe-menu"><a href="(\.\.\/)?pe-list\.html"/,p);
 console.log('PASS nav overview link on all pages');
})().catch(e=>{console.error(e);process.exit(1)});
// Site entry: index.html redirects to the PE overview; dashboard + logo links are not pointed back at index.html.
{const fs=require('node:fs'),assert=require('node:assert/strict'),idx=fs.readFileSync('index.html','utf8');
 assert.match(idx,/location\.replace\('pe-list\.html'/);assert.match(idx,/url=pe-list\.html/);assert.ok(!idx.includes('app.js'));
 for(const p of ['dashboard.html','valuation.html','hype-pe.html','uni-pe.html','bnb-pe.html','aave-pe.html','pe-list.html','battlefield/index.html']){const h=fs.readFileSync(p,'utf8');assert.match(h,/href="\/?dashboard\.html"[^>]*data-i18n="nav\.dashboard"/,p);assert.ok(!/href="\/?index\.html"/.test(h),p);if(p!=='battlefield/index.html')assert.match(h,/<a class="logo" href="pe-list\.html">/,p+' logo link');}
 console.log('PASS index.html -> pe-list.html; dashboard.html nav');}
