// No browser dependency: execute real site i18n + PE scripts against a DOM contract.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),C=require('./pe-core.js');
const hasChinese=s=>/[\u3400-\u9fff]/.test(s);
async function run(asset,stored,nav='en-US',offline=true,denied=false){
 const html=fs.readFileSync(asset+'-pe.html','utf8'),els=[],byId={},events={},store={hs_lang:stored},requests=[];let option;
 function node(attrs={},text=''){return {attrs,dataset:Object.fromEntries(Object.entries(attrs).filter(([k])=>k.startsWith('data-')).map(([k,v])=>[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),v])),textContent:text,innerHTML:'',children:[],classList:{toggle(){}},getAttribute(k){return this.attrs[k]},hasAttribute(k){return k in this.attrs},setAttribute(k,v){this.attrs[k]=v},append(n){this.children.push(n)},appendChild(n){this.append(n);if(n.id)byId[n.id]=n},replaceChildren(...n){this.children=n},querySelector(){return null},addEventListener(){}};}
 for(const m of html.matchAll(/<(\w+)\b([^>]*)>([^<]*)/g)){const attrs={};for(const a of m[2].matchAll(/([\w-]+)="([^"]*)"/g))attrs[a[1]]=a[2];const el=node(attrs,m[3]);els.push(el);if(attrs.id)byId[attrs.id]=el;}
 const root={lang:'zh'},bar=node(),buttons=[node({'data-lang':'zh'}),node({'data-lang':'en'})];
 const document={documentElement:root,body:{dataset:{asset}},getElementById:id=>byId[id],querySelector:s=>s==='.topbar'?bar:null,querySelectorAll:s=>s==='#langSwitch button'?buttons:els.filter(e=>s.startsWith('[')&&e.hasAttribute(s.slice(1,-1))),createElement:()=>node(),addEventListener:(k,fn)=>events[k]=fn};
 const seed=JSON.parse(fs.readFileSync('pe-data/'+asset+'.json'));
 const context={document,navigator:{language:nav},localStorage:{getItem:k=>{if(denied)throw Error('SecurityError');return store[k]??null},setItem:(k,v)=>{if(denied)throw Error('SecurityError');store[k]=v}},PECore:{...C,yesterday:()=> '2026-10-08'},echarts:{init:()=>({setOption:o=>option=o,resize(){}})},AbortSignal:{timeout(){}},Blob,URL,setTimeout,console,addEventListener(){},fetch:async url=>{requests.push(url);if(url==='pe-data/uni-chains.json'||url==='pe-data/hype-sources.json')return {ok:true,json:async()=>JSON.parse(fs.readFileSync(url))};if(url.startsWith('pe-data/'))return {ok:true,json:async()=>seed};if(offline)throw Error('offline');return {ok:false,status:429};}};context.window=context;vm.createContext(context);
 if(asset==='hype')vm.runInContext(fs.readFileSync('pe-sources.js','utf8'),context);
 if(asset==='uni')vm.runInContext(fs.readFileSync('pe-chains.js','utf8'),context);
 vm.runInContext(fs.readFileSync('i18n.js','utf8'),context);vm.runInContext(fs.readFileSync('pe-i18n.js','utf8'),context);
 const pending=vm.runInContext(fs.readFileSync('pe.js','utf8'),context);events.DOMContentLoaded();await pending;
 return {context,byId,els,root,store,requests,html,get option(){return option}};
}
function english(h){
 for(const e of h.els.filter(e=>e.attrs['data-i18n'])){assert.ok(!hasChinese(e.textContent),e.textContent);assert.ok(!/^pe\.|^nav\./.test(e.textContent));}
 for(const id of ['cards','asof','status',...(h.byId['chain-summary']?['chain-summary']:['source-summary'])])assert.ok(!hasChinese(h.byId[id].innerHTML+h.byId[id].textContent),id+': '+h.byId[id].textContent);
 for(const row of h.byId.tbody.children)for(const cell of row.children)assert.ok(!hasChinese(cell.textContent),cell.textContent);
 assert.ok(!hasChinese(h.option.tooltip.formatter([{axisValue:'2026-10-08'}])));
 assert.ok(!hasChinese(h.byId.chart.attrs['aria-label']));
 for(const item of [...h.option.series,...h.option.yAxis])assert.ok(!hasChinese(item.name));
 assert.equal(h.root.lang,'en');assert.equal(h.option.series.length,h.byId['chain-summary']?12:8);
}
(async()=>{
 for(const asset of ['hype','uni']){
  for(const initial of ['en','zh',undefined]){
   const h=await run(asset,initial);if(initial!=='zh')english(h);else assert.equal(h.root.lang,'zh');
   const b=h.els.find(e=>e.dataset.range==='30');b.onclick();const before=JSON.stringify(h.option.series.map(s=>s.data)),count=h.requests.length;
   h.byId.vcTotal.dataset.state='loading';h.context.I18n.set('en');assert.equal(h.byId.vcTotal.textContent,'Loading…');h.byId.vcTotal.dataset.state='ready';h.byId.vcTotal.textContent='123';h.byId.vcToday.dataset.state='error';
   h.context.I18n.set('en');english(h);assert.equal(h.byId.vcTotal.textContent,'123');assert.equal(h.byId.vcToday.textContent,'Unavailable');assert.equal(h.option.xAxis[0].data.length,30);assert.equal(JSON.stringify(h.option.series.map(s=>s.data)),before);
   assert.equal(h.requests.length,count);assert.equal(h.store.hs_lang,'en');
   h.context.I18n.set('zh');assert.equal(h.byId.vcToday.textContent,'暂不可用');assert.ok(hasChinese(h.byId.status.textContent));assert.equal(h.requests.length,count);
   // All static CJK text nodes must have a translation (counter values are state-driven).
   for(const e of h.els)if(hasChinese(e.textContent)&&!e.attrs.id)assert.ok(e.attrs['data-i18n'],JSON.stringify(e.attrs)+e.textContent);
   const next=await run(asset==='hype'?'uni':'hype',h.store.hs_lang);assert.equal(next.root.lang,'zh');
   assert.equal((h.html.match(/data-goatcounter=/g)||[]).length,1);
   assert.equal(h.option.series[3].itemStyle.color,asset==='uni'?'#60A5FA':'#50d2c1');
  }
  const errors=await run(asset,'en','en-US',false);english(errors);assert.match(errors.byId.status.textContent,/rate limited/);
  for(const locale of ['zh-CN','zh-TW','zh-HK','zh-Hans','zh-Hant','en','ja','fr','']) {
   for(const denied of [false,true]) {
    const system=await run(asset,'invalid',locale,true,denied);
    assert.equal(system.root.lang,locale.startsWith('zh')?'zh':'en');
    const count=system.requests.length;
    system.context.I18n.set('en');english(system);assert.equal(system.requests.length,count);
   }
  }
  console.log('PASS bilingual',asset,': all static/dynamic labels, system default, persisted cross-page choice, range/data preserved, zero switch requests, counter state, 429, chart/tooltip/ARIA');
 }
})().catch(e=>{console.error(e);process.exitCode=1});
