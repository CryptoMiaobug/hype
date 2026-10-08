const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),B=require('./pe-sources'),C=require('./pe-core');
const end='2026-10-07',ts=C.time(end)/1000,payload=rows=>({id:'parent#hyperliquid',totalDataChartBreakdown:rows});
const row=(a,b)=>({'Hyperliquid L1':{'Hyperliquid Perps':a,'Hyperliquid Spot Orderbook':b}});
const parse=r=>B.parse(payload([[ts,r]]),end)[end];
assert.equal(B.total(parse(row(2,3))),5);assert.equal(B.total(parse(row(0,0))),0);
for(const x of [null,-1,'3',undefined])assert.equal(B.total(parse(row(2,x))),null);
assert.equal(B.total(parse({...row(2,3),Unknown:{x:1}})),null);
assert.throws(()=>B.parse(payload([[ts,{}],[ts,{}]]),end));assert.equal(Object.keys(B.parse(payload([[ts+86400,row(1,2)]]),end)).length,0);
const days={};for(let i=0;i<30;i++)days[C.date(C.time(end)-i*C.DAY)]=parse(row(1,0));
assert.equal(B.summary(days,end).covered,30);assert.equal(B.summary(days,end).rows[1].share,0);delete days[end];assert.equal(B.summary(days,end).covered,29);
const snapshot=JSON.parse(fs.readFileSync('pe-data/hype-sources.json')),data=B.parse(snapshot,end),seed=JSON.parse(fs.readFileSync('pe-data/hype.json'));
let matched=0,different=0;for(const [d,v] of Object.entries(seed.revenue)){const t=B.total(data[d]);if(C.valid(t)&&C.valid(v)){if(Math.abs(t-v)>.01)different++;else matched++;}}
console.log('HYPE snapshot reconciliation', {matched,different,coverage:B.summary(data,end).covered});
async function run(online=false,stored={},lang='en'){
 const nodes={},buttons=[30,90,0].map(range=>({dataset:{range}})),requests=[];let option;
 const make=()=>({children:[],textContent:'',innerHTML:'',append(x){this.children.push(x)},replaceChildren(...x){this.children=x}});
 const document={body:{dataset:{asset:'hype'}},getElementById:id=>nodes[id]??=make(),querySelectorAll:s=>s==='[data-range]'?buttons:[],createElement:make};
 const echarts={init:()=>({setOption:o=>option=o,resize(){}})},window={PESources:B,I18n:{lang},echarts,addEventListener(){}};
 const ctx={window,document,PECore:{...C,yesterday:()=> '2026-10-08'},echarts,AbortSignal:{timeout(){}},localStorage:{getItem:k=>stored[k]??null,setItem:(k,v)=>stored[k]=v,removeItem:k=>delete stored[k]},fetch:async url=>{requests.push(url);if(url==='pe-data/hype.json')return {ok:true,json:async()=>seed};if(url==='pe-data/hype-sources.json')return {ok:true,json:async()=>snapshot};if(!online)throw Error('offline');return {ok:true,json:async()=>url.includes('llama')?{...payload([[ts+86400,{'Hyperliquid L1':{'Hyperliquid Perps':0,'Hyperliquid Spot Orderbook':8}}]]),totalDataChart:[[ts+86400,10]]}:{prices:[],market_caps:[]}}},Blob,URL,setTimeout};
 await vm.runInNewContext(fs.readFileSync('pe.js','utf8'),ctx);return {nodes,buttons,requests,window,stored,get option(){return option}};
}
(async()=>{
 const h=await run();assert.equal(h.option.series.length,7);assert.match(h.nodes['source-summary'].innerHTML,/29\/30/);assert.match(h.nodes['source-summary'].innerHTML,/API failed/);
 for(const b of h.buttons){b.onclick();assert.deepEqual(h.option.xAxis[0].data,h.option.xAxis[1].data);for(const series of h.option.series)assert.equal(series.data.length,h.option.xAxis[0].data.length);}
 seed.rows.forEach((r,i)=>['circ','full','price'].forEach((k,j)=>assert.equal(h.option.series[j].data[i],r[k])));
 const live=await run(true);assert.equal(live.requests.filter(u=>u.includes('llama')).length,1);assert.equal(live.option.series[3].data.at(-1),0);assert.equal(live.option.series[4].data.at(-1),8);assert.match(live.option.tooltip.formatter([{axisValue:'2026-10-08'}]),/\$-2/);
 assert.ok(live.stored['hypevalue-hype-sources-v1']);live.nodes['clear-sources'].onclick();assert.equal(live.stored['hypevalue-hype-sources-v1'],undefined);assert.equal(live.option.series[3].data.at(-1),null);
 const count=h.requests.length;h.window.I18n.lang='zh';h.window.onI18nChange();assert.match(h.nodes['source-summary'].innerHTML,/API失败/);assert.equal(h.requests.length,count);
 console.log('PASS HYPE sources aggregation, missing/zero, unknown groups, reconciliation, 30-day coverage, offline/cache/clear, single API, all ranges, unchanged valuation, i18n');
})().catch(e=>{console.error(e);process.exitCode=1});
