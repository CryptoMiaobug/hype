// AAVE revenue PE: bundled seed reproduces from raw inputs; page wiring; UI smoke via shared pe.js.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');const C=require('./pe-core.js');
const A=JSON.parse(fs.readFileSync(__dirname+'/pe-data/aave.json'));let count=0;
function test(n,f){f();console.log('PASS',n);count++;}
test('seed metadata',()=>{assert.equal(A.asset,'aave');assert.equal(A.fixedSupply,16000000);assert.equal(A.rows.length,365);assert.equal(A.rows.at(-1).date,A.last);assert.ok(A.rows.every(r=>r.source==='bundled'));});
test('every bundled row reproduces from raw revenue + market',()=>{for(const r of A.rows){const base={...A,last:C.date(C.time(r.date)-C.DAY),rows:[{supply:A.fixedSupply}]};const v=C.calculate(base,A.revenue,A.market,r.date).at(-1);for(const k of ['r30','annual','circ','full','price','mcap'])assert.equal(v[k],r[k],r.date+' '+k);assert.equal(v.status,r.status);}});
test('circ = mcap / (R30*365/30), full = 16M*price / annual',()=>{const r=A.rows.at(-1);assert.ok(Math.abs(r.circ-r.mcap/(r.r30*365/30))<1e-9);assert.ok(Math.abs(r.full-16e6*r.price/r.annual)<1e-9);assert.ok(r.full>=r.circ);});
test('increment keeps 16M fixed supply (not HYPE-only anymore)',()=>{const n=C.date(C.time(A.last)+C.DAY),rev={...A.revenue,[n]:100000},pm={...A.market,[n]:[100,1.5e9]};const r=C.calculate(A,rev,pm,n).at(-1);assert.equal(r.supply,16e6);assert.equal(r.status,'ok');assert.equal(r.source,'browser');});
test('UNI still uses burn-backed supply (fixedSupply null)',()=>{const U=JSON.parse(fs.readFileSync(__dirname+'/pe-data/uni.json'));assert.equal(U.fixedSupply,null);});
test('page wiring',()=>{const h=fs.readFileSync('aave-pe.html','utf8');assert.match(h,/data-asset="aave"/);assert.match(h,/pe-data\/aave\.json/);assert.ok(!/uniswap|pe-chains|chain-summary|clear-chains/i.test(h));assert.match(h,/aria-current="page">AAVE PE/);
 for(const p of ['index.html','valuation.html','hype-pe.html','uni-pe.html','bnb-pe.html','pe-list.html','aave-pe.html','battlefield/index.html'])assert.match(fs.readFileSync(p,'utf8'),/aave-pe\.html"[^>]*>AAVE PE</,p);
 const keys=[...h.matchAll(/data-i18n="([^"]+)"/g)].map(m=>m[1]),dict={zh:{},en:{}};vm.runInNewContext(fs.readFileSync('i18n.js','utf8').replace(/document\.addEventListener[\s\S]*$/,''),{window:{},document:{addEventListener(){}},navigator:{},localStorage:{getItem(){}},I18N_DICT:dict,console});
});
console.log(count+' tests passed');
async function smoke(network){
 const nodes={};const make=()=>({textContent:'',innerHTML:'',disabled:false,children:[],append(x){this.children.push(x)},replaceChildren(...x){this.children=x},click(){}});
 const document={body:{dataset:{asset:'aave'}},getElementById(id){return nodes[id]??=make()},querySelectorAll(){return []},createElement:make};let saved;const urls=[];
 const next=C.date(C.time(A.last)+C.DAY),fixed=C.time(next)+2*C.DAY;class Clock extends Date{constructor(...a){super(...(a.length?a:[fixed]))}static now(){return fixed}}
 const ctx={PECore:{...C,yesterday:()=>C.yesterday(fixed)},Date:Clock,document,window:{addEventListener(){}},localStorage:{getItem(){return null},setItem(k,v){saved=JSON.parse(v)}},
  fetch:async url=>{urls.push(url);if(url.startsWith('pe-data'))return {ok:true,json:async()=>A};if(!network)throw Error('CORS denied');const t=C.time(next)+C.DAY;return {ok:true,json:async()=>url.includes('llama')?{id:'parent#aave',totalDataChart:[[C.time(next)/1000,150000]]}:{prices:[[t,160]],market_caps:[[t,2.5e9]]}}},AbortSignal:{timeout(){}},Blob,URL,setTimeout,console};
 await vm.runInNewContext(fs.readFileSync(__dirname+'/pe.js','utf8'),ctx);
 assert.equal(nodes.refresh.disabled,false);assert.ok(nodes.cards.innerHTML.includes('协议收入'));
 if(network){assert.ok(urls.some(u=>u==='https://api.llama.fi/summary/fees/aave?dataType=dailyRevenue'));assert.ok(urls.some(u=>u.includes('/coins/aave/market_chart')));assert.equal(saved.revenue[next],150000);}
 else {assert.ok(nodes.status.textContent.includes('CORS'));assert.ok(nodes.cards.innerHTML.includes(A.last+' UTC'));}
}
(async()=>{for(const n of [false,true]){await smoke(n);console.log('PASS UI smoke aave',n?'increment':'offline');}})().catch(e=>{console.error(e);process.exitCode=1});
