// Regression tests for presentation only: no changes to valuation inputs/calculation.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),C=require('./pe-core.js');
const source=fs.readFileSync(__dirname+'/pe.js','utf8');
async function run(asset,{cache={},online=false,end='2026-10-08'}={}){
 const seed=JSON.parse(fs.readFileSync(__dirname+'/pe-data/'+asset+'.json')),nodes={},buttons=[30,90,0].map(range=>({dataset:{range}}));let option,saved;
 const make=()=>({children:[],textContent:'',innerHTML:'',append(x){this.children.push(x)},replaceChildren(...x){this.children=x}});
 const document={body:{dataset:{asset}},getElementById(id){return nodes[id]??=make()},querySelectorAll(){return buttons},createElement:make};
 const echarts={init(){return {setOption(o){option=o},resize(){}}}};
 const ctx={PECore:{...C,yesterday:()=>end},document,window:{echarts,addEventListener(){}},echarts,localStorage:{getItem(){return JSON.stringify({seedHash:seed.sourceSHA256,...cache})},setItem(k,v){saved=JSON.parse(v)}},fetch:async url=>{if(url.startsWith('pe-data'))return {ok:true,json:async()=>seed};if(!online)throw Error('offline');return {ok:true,json:async()=>url.includes('llama')?{id:'parent#'+(asset==='hype'?'hyperliquid':'uniswap'),totalDataChart:[[C.time(seed.last)/1000,999],[C.time('2026-10-07')/1000,777],[C.time('2026-10-08')/1000,null]]}:{prices:[],market_caps:[]}}},AbortSignal:{timeout(){}},Blob,URL,setTimeout,console};
 await vm.runInNewContext(source,ctx);
 return {seed,nodes,buttons,get option(){return option},saved};
}
(async()=>{
 const h=await run('hype',{online:true,cache:{revenue:{'2026-10-06':999,'2026-10-07':0}}});
 assert.equal(h.option.series.length,4);assert.equal(h.option.series[3].type,'bar');assert.equal(h.option.series[3].yAxisIndex,2);
 assert.equal(h.option.series[3].data.at(-2),0);assert.equal(h.option.series[3].data.at(-1),null);
 assert.equal(h.option.series[3].data.at(-3),h.seed.revenue[h.seed.last]);
 assert.ok(h.option.tooltip.formatter([{axisValue:'2026-10-07'}]).includes('USD）：$0'));
 assert.ok(h.option.tooltip.formatter([{axisValue:'2026-10-08'}]).includes('NA（缺失，未填零）'));
 assert.equal(h.nodes.tbody.children[0].children[4].textContent,'NA');assert.equal(h.nodes.tbody.children[1].children[4].textContent,'0');
 for(const b of h.buttons){b.onclick();const expected=+b.dataset.range||h.seed.rows.length+2;assert.equal(h.option.xAxis[0].data.length,expected);assert.deepEqual(h.option.xAxis[0].data,h.option.xAxis[1].data);assert.equal(h.nodes.tbody.children.length,expected);for(const s of h.option.series)assert.equal(s.data.length,expected);h.option.xAxis[1].data.forEach((d,i)=>assert.equal(h.option.series[3].data[i],h.saved.revenue[d]??null));}
 assert.deepEqual(Array.from(h.option.axisPointer.link[0].xAxisIndex),[0,1]);
 // The original 3 series are unchanged for every archived day.
 h.seed.rows.forEach((r,i)=>['circ','full','price'].forEach((k,j)=>assert.equal(h.option.series[j].data[i],r[k])));
 const inc=await run('hype',{online:true});assert.equal(inc.option.series[3].data.at(-2),777);
 const early=await run('hype',{end:'2026-10-01'});assert.equal(early.option.series[3].data.at(-1),early.seed.revenue[early.seed.last]);
 const u=await run('uni');assert.equal(u.option.series.length,3);assert.equal(u.option.yAxis.length,2);assert.equal(u.option.xAxis.type,'category');assert.equal(u.option.title,undefined);assert.equal(u.nodes.tbody.children[0].children.length,6);
 assert.ok(h.nodes.cards.innerHTML.includes('最近有效，非目标日'));assert.ok(h.nodes.status.textContent.includes('当日收入缺失'));
 console.log('PASS chart: raw daily mapping, frozen/cache/API precedence, zero/missing, tooltip, table, all 3 ranges, linked UTC axes, unchanged historical curves, API increment, early clock, UNI regression, latest-valid cards');
})().catch(e=>{console.error(e);process.exitCode=1});
