const assert=require('node:assert/strict'),fs=require('node:fs');const C=require('./pe-core.js');
const SEED_LAST=JSON.parse(fs.readFileSync(__dirname+'/pe-data/hype.json')).last,dd=k=>C.date(C.time(SEED_LAST)+k*C.DAY); // test dates relative to bundled seed end
let count=0;function test(name,fn){fn();console.log('PASS',name);count++;}
const H=JSON.parse(fs.readFileSync(__dirname+'/pe-data/hype.json')),U=JSON.parse(fs.readFileSync(__dirname+'/pe-data/uni.json'));
test('UTC yesterday including Shanghai midnight',()=>assert.equal(C.yesterday(Date.parse('2026-10-08T00:15:00+08:00')),'2026-10-06'));
test('bundled HYPE rows all reproduce from raw inputs',()=>{for(const r of H.rows){const base={...H,last:C.date(C.time(r.date)-C.DAY),rows:[{supply:H.fixedSupply}]};const v=C.calculate(base,H.revenue,H.market,r.date).at(-1);assert.equal(v.circ,r.circ);assert.equal(v.full,r.full);}});
test('UNI supply reproduces all archived rows',()=>{let supply=900000000;for(let t=C.time('2025-12-29');t<=C.time(U.last);t+=C.DAY){const d=C.date(t);supply-=U.revenue[d]/U.market[d][0];const r=U.rows.find(r=>r.date===d);if(r)assert.ok(Math.abs(supply-r.supply)<1e-6);}});
test('frozen rows never replaced',()=>assert.deepEqual(C.calculate(H,{}, {},H.last),H.rows));
test('existing raw values win but null can be filled',()=>assert.deepEqual(C.merge({a:0,b:null},{a:99,b:12}),{a:0,b:12}));
test('market uses paired exact midnight; drops realtime',()=>{const t=C.time(dd(2));assert.deepEqual(C.market({prices:[[t,10],[t+123,90]],market_caps:[[t,100],[t+123,900]]},dd(1)),{[dd(1)]:[10,100]});assert.deepEqual(C.market({prices:[[t,10]],market_caps:[[t+1,100]]},dd(1)),{});});
test('duplicate input rejected',()=>assert.throws(()=>C.revenue({totalDataChart:[[0,1],[0,2]]},dd(1))));
test('null/negative revenue not zero, true zero preserved',()=>assert.deepEqual(C.revenue({totalDataChart:[[0,null],[86400,-1],[172800,0]]},dd(1)),{'1970-01-01':null,'1970-01-02':null,'1970-01-03':0}));
test('incomplete and future days excluded',()=>assert.deepEqual(C.revenue({totalDataChart:[[C.time(dd(2))/1000,5]]},dd(1)),{}));
test('30 contiguous days and fixed HYPE supply',()=>{const rev={...H.revenue,[dd(1)]:100},pm={...H.market,[dd(1)]:[90,20000000000]},r=C.calculate(H,rev,pm,dd(1)).at(-1);assert.equal(r.supply,H.fixedSupply);assert.equal(r.status,'ok');delete rev[dd(-5)];assert.equal(C.calculate(H,rev,pm,dd(1)).at(-1).circ,null);});
test('zero denominator gives NA',()=>{const rev={};for(let i=0;i<30;i++)rev[C.date(C.time(dd(1))-i*C.DAY)]=0;assert.equal(C.calculate(H,rev,{[dd(1)]:[90,100]},dd(1)).at(-1).circ,null);});
test('UNI supply gap poisons following days, complete data recovers',()=>{const rev={...U.revenue,[dd(1)]:100,[dd(2)]:100},pm={...U.market,[dd(2)]:[10,1000]};assert.equal(C.calculate(U,rev,pm,dd(2)).at(-1).supply,null);pm[dd(1)]=[10,1000];assert.equal(C.calculate(U,rev,pm,dd(2)).at(-1).supply,U.rows.at(-1).supply-20);});
test('missing recent market keeps day and never borrows old quote',()=>{const r=C.calculate(H,H.revenue,H.market,dd(1)).at(-1);assert.equal(r.date,dd(1));assert.equal(r.price,null);assert.equal(r.circ,null);});
console.log(count+' tests passed');
// Browser controller smoke tests using a small DOM: network denial must not erase history.
const vm=require('node:vm');
async function smoke(asset,network){
 const nodes={};const make=()=>({textContent:'',innerHTML:'',disabled:false,children:[],append(x){this.children.push(x)},replaceChildren(...x){this.children=x},click(){}});
 const document={body:{dataset:{asset}},getElementById(id){return nodes[id]??=make()},querySelectorAll(){return []},createElement:make};const seed=asset==='hype'?H:U;let saved;
 const fixed=C.time(dd(2));class Clock extends Date{constructor(...args){super(...(args.length?args:[fixed]))}static now(){return fixed}}
 const ctx={PECore:{...C,yesterday:()=>C.yesterday(fixed)},Date:Clock,document,window:{addEventListener(){}},localStorage:{getItem(){return null},setItem(k,v){saved=JSON.parse(v)}},fetch:async url=>{if(url.startsWith('pe-data'))return {ok:true,json:async()=>seed};if(!network)throw Error('CORS denied');const t=C.time(dd(2));return {ok:true,json:async()=>url.includes('llama')?{id:'parent#'+(asset==='hype'?'hyperliquid':'uniswap'),totalDataChart:[[C.time(dd(1))/1000,100]]}:{prices:[[t,10]],market_caps:[[t,1000]]}}},AbortSignal:{timeout(){}},Blob,URL,setTimeout,console};
 await vm.runInNewContext(fs.readFileSync(__dirname+'/pe.js','utf8'),ctx);
 assert.equal(nodes.refresh.disabled,false);assert.equal(nodes.tbody.children.length,Math.min(365,seed.rows.length+1)); // default range = 1 yearassert.ok(nodes.asof.textContent.includes(dd(1)));
 if(network){assert.ok(nodes.status.textContent.includes('已完整'));assert.equal(saved.revenue[dd(1)],100)}else {assert.ok(nodes.status.textContent.includes('CORS'));assert.ok(!nodes.cards.innerHTML.includes('NA'));assert.ok(nodes.cards.innerHTML.includes(dd(0)+' UTC'));assert.ok(nodes.cards.innerHTML.includes('最近有效，非目标日'));assert.ok(nodes.status.textContent.includes('当日收入缺失'));assert.ok(nodes.status.textContent.includes('精确配对价格/市值'))}
}
(async()=>{for(const a of ['hype','uni'])for(const n of [false,true]){await smoke(a,n);console.log('PASS UI smoke',a,n?'increment success':'network failure');}})().catch(e=>{console.error(e);process.exitCode=1});
