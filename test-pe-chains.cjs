const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),B=require('./pe-chains'),C=require('./pe-core');
const end='2026-10-07',ts=C.time(end)/1000;
const payload=rows=>({id:'parent#uniswap',totalDataChartBreakdown:rows});
const parsed=B.parse(payload([[ts,{Ethereum:{v2:2,v3:3},Base:{v3:0},Polygon:{v3:null},Bad:{v3:-1},Other:{v3:7}}],[ts+86400,{Ethereum:{v3:999}}]]),end);
assert.equal(parsed[end].Ethereum,5);assert.equal(parsed[end].Base,0);assert.equal(parsed[end].Polygon,null);assert.equal(parsed[end].Bad,null);assert.equal(B.group(parsed[end],'Arbitrum'),null);assert.equal(B.total(parsed[end]),null);assert.equal(Object.keys(parsed).length,1);
assert.throws(()=>B.parse(payload([[ts,{}],[ts,{}]]),end));assert.equal(B.group({Ethereum:5,X:2,Y:3},'Others'),5);
const days={};for(let i=0;i<30;i++)days[C.date(C.time(end)-i*C.DAY)]={Ethereum:1,Base:0};
assert.equal(B.summary(days,end).covered,30);assert.equal(B.summary(days,end).sum,30);delete days[end].Base;assert.equal(B.summary(days,end).rows.find(r=>r.name==='Base').days,29);days[end].Ethereum=null;assert.equal(B.summary(days,end).covered,29);assert.equal(B.summary(days,end).sum,29);
const snapshot=JSON.parse(fs.readFileSync('pe-data/uni-chains.json')),data=B.parse(snapshot,end),seed=JSON.parse(fs.readFileSync('pe-data/uni.json'));
let mismatch=0,matched=0;for(const [d,v] of Object.entries(seed.revenue)){const total=B.total(data[d]);if(C.valid(total)&&C.valid(v)){if(Math.abs(total-v)>.01)mismatch++;else matched++;}}
console.log('Snapshot reconciliation: matched',matched,'different',mismatch,'30d coverage',B.summary(data,end).covered);
async function run(online=false,stored={},lang='en'){
 const nodes={},buttons=[30,90,0].map(range=>({dataset:{range}})),requests=[];let option;
 const make=()=>({children:[],textContent:'',innerHTML:'',append(x){this.children.push(x)},replaceChildren(...x){this.children=x}});
 const document={body:{dataset:{asset:'uni'}},getElementById:id=>nodes[id]??=make(),querySelectorAll:s=>s==='[data-range]'?buttons:[],createElement:make};
 const echarts={init:()=>({setOption:o=>option=o,resize(){}})},window={PEChains:B,I18n:{lang},echarts,addEventListener(){}};
 const ctx={window,document,PECore:{...C,yesterday:()=> '2026-10-08'},echarts,AbortSignal:{timeout(){}},localStorage:{getItem:k=>stored[k]??null,setItem:(k,v)=>stored[k]=v,removeItem:k=>delete stored[k]},fetch:async url=>{requests.push(url);if(url==='pe-data/uni.json')return {ok:true,json:async()=>seed};if(url==='pe-data/uni-chains.json')return {ok:true,json:async()=>snapshot};if(!online)throw Error('offline');return {ok:true,json:async()=>url.includes('llama')?{...payload([[ts+86400,{Ethereum:{v3:0},Base:{v3:8}}]]),totalDataChart:[[ts+86400,10]]}:{prices:[],market_caps:[]}}},Blob,URL,setTimeout};
 await vm.runInNewContext(fs.readFileSync('pe.js','utf8'),ctx);return {nodes,buttons,requests,window,stored,get option(){return option}};
}
(async()=>{
 const h=await run();assert.equal(h.option.series.length,11);assert.match(h.nodes['chain-summary'].innerHTML,/29\/30/);assert.match(h.nodes['chain-summary'].innerHTML,/API failed/);
 for(const b of h.buttons){b.onclick();assert.deepEqual(h.option.xAxis[0].data,h.option.xAxis[1].data);for(const s of h.option.series)assert.equal(s.data.length,h.option.xAxis[0].data.length);for(let i=0;i<h.option.xAxis[0].data.length;i++){const d=h.option.xAxis[0].data[i];for(let j=0;j<6;j++)assert.equal(h.option.series[j+3].data[i],B.group(data[d],[...B.main,'Others'][j]));}}
 seed.rows.forEach((r,i)=>['circ','full','price'].forEach((k,j)=>assert.equal(h.option.series[j].data[i],r[k])));
 assert.match(h.option.tooltip.formatter([{axisValue:seed.last}]),/Difference vs valuation revenue/);
 const live=await run(true);assert.equal(live.requests.filter(u=>u.includes('llama')).length,1);assert.equal(live.option.series[3].data.at(-1),0);assert.equal(live.option.series[6].data.at(-1),8);assert.equal(live.option.series[4].data.at(-1),null);assert.match(live.option.tooltip.formatter([{axisValue:'2026-10-08'}]),/\$-2/);
 assert.ok(live.stored['hypevalue-uni-chains-v1']);live.nodes['clear-chains'].onclick();assert.equal(live.stored['hypevalue-uni-chains-v1'],undefined);assert.equal(live.option.series[3].data.at(-1),null);
 const count=h.requests.length;h.window.I18n.lang='zh';h.window.onI18nChange();assert.match(h.nodes['chain-summary'].innerHTML,/API失败/);assert.equal(h.requests.length,count);
 console.log('PASS chain validation, UTC, zero/null/negative, observed-only coverage, reconciliation, fallback/cache/clear, single API response, ranges, unchanged PE curves, bilingual redraw');
})().catch(e=>{console.error(e);process.exitCode=1});
