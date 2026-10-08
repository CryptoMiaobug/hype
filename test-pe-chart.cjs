// Regression tests for presentation only: no changes to valuation inputs/calculation.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),C=require('./pe-core.js');
const source=fs.readFileSync(__dirname+'/pe.js','utf8');
async function run(asset,{cache={},online=false,end='2026-10-08'}={}){
 const seed=JSON.parse(fs.readFileSync(__dirname+'/pe-data/'+asset+'.json')),nodes={},buttons=[30,90,0].map(range=>({dataset:{range}}));let option,saved;const requests=[];
 const make=()=>({children:[],textContent:'',innerHTML:'',append(x){this.children.push(x)},replaceChildren(...x){this.children=x}});
 const document={body:{dataset:{asset}},getElementById(id){return nodes[id]??=make()},querySelectorAll(){return buttons},createElement:make};
 const echarts={init(){return {setOption(o){option=o},resize(){}}}};
 const ctx={PECore:{...C,yesterday:()=>end},document,window:{echarts,addEventListener(){}},echarts,localStorage:{getItem(){return JSON.stringify({seedHash:seed.sourceSHA256,...cache})},setItem(k,v){saved=JSON.parse(v)}},fetch:async url=>{requests.push(url);if(url.startsWith('pe-data'))return {ok:true,json:async()=>seed};if(!online)throw Error('offline');return {ok:true,json:async()=>url.includes('llama')?{id:'parent#'+(asset==='hype'?'hyperliquid':'uniswap'),totalDataChart:[[C.time(seed.last)/1000,999],[C.time('2026-10-07')/1000,777],[C.time('2026-10-08')/1000,null]]}:{prices:[],market_caps:[]}}},AbortSignal:{timeout(){}},Blob,URL,setTimeout,console};
 await vm.runInNewContext(source,ctx);
 return {seed,nodes,buttons,get option(){return option},saved,requests};
}
(async()=>{
 for(const asset of ['hype','uni']){
 const h=await run(asset,{online:true,cache:{revenue:{'2026-10-06':999,'2026-10-07':0}}});
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
 const inc=await run(asset,{online:true});assert.equal(inc.option.series[3].data.at(-2),777);
 assert.ok(inc.requests.some(url=>url.endsWith('dataType='+(asset==='hype'?'dailyHoldersRevenue':'dailyRevenue'))));
 const expectedRows=C.calculate(h.seed,h.saved.revenue,h.saved.market,'2026-10-08');
 expectedRows.forEach((r,i)=>['circ','full','price'].forEach((k,j)=>assert.equal(h.option.series[j].data[i],r[k])));
 const early=await run(asset,{end:'2026-10-01'});assert.equal(early.option.series[3].data.at(-1),early.seed.revenue[early.seed.last]);
 assert.equal(h.option.yAxis.length,3);assert.equal(h.nodes.tbody.children[0].children.length,7);
 const label=asset==='hype'?'每日持币人收入（USD）':'每日回购／销毁价值（代理口径，USD）';
 assert.equal(h.option.title.text.replace('\n',''),label);assert.equal(h.option.series[3].name,label);
 // Stable semantic colors: legend and both custom tooltips use matching markers.
 for(const page of [h]){
  assert.deepEqual(Array.from(page.option.color),['#38BDF8','#FBBF24','#C084FC']);
  for(const [i,name,color] of [[0,'流通倍数','#38BDF8'],[1,'全解锁情景倍数','#FBBF24'],[2,'价格 USD','#C084FC']]){
   assert.equal(page.option.legend.data[i],name);assert.equal(page.option.series[i].name,name);
   assert.equal(page.option.series[i].lineStyle.color,color);assert.equal(page.option.series[i].itemStyle.color,color);
  }
 }
 assert.equal(h.option.series[3].itemStyle.color,'#50d2c1');assert.ok(!h.option.color.includes(h.option.series[3].itemStyle.color));
 const tooltip=h.option.tooltip.formatter([{axisValue:h.seed.last}]);
 for(const [color,tooltipLabel] of [['#38BDF8','流通倍数'],['#FBBF24','全解锁情景倍数'],['#C084FC','价格'],['#50d2c1',label]])assert.ok(tooltip.includes('background-color:'+color+'"></span>'+tooltipLabel+'：'));

 for(const asset of ['hype','uni'])assert.ok(fs.readFileSync(__dirname+'/'+asset+'-pe.html','utf8').includes('pe.js?v=20261008langauto'));
 assert.ok(h.nodes.cards.innerHTML.includes('最近有效，非目标日'));assert.ok(h.nodes.status.textContent.includes('当日收入缺失'));
 console.log('PASS chart',asset,': raw daily mapping, frozen/cache/API precedence, zero/missing, tooltip, table, all 3 ranges, linked UTC axes, unchanged historical curves, API increment, early clock, latest-valid cards');
 }
})().catch(e=>{console.error(e);process.exitCode=1});
