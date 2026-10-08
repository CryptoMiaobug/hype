'use strict';
(async()=>{
 const C=PECore,asset=document.body.dataset.asset,id=asset==='hype'?'hyperliquid':'uniswap';
 const $=id=>document.getElementById(id),fmt=(n,d=2)=>n==null?'NA':n.toLocaleString('en-US',{maximumFractionDigits:d});
 let seed,rows=[],dailyRevenue={},range=90,chart;const key='hypevalue-pe-v1-'+asset;
 async function json(url){const r=await fetch(url,{signal:AbortSignal.timeout(25000),credentials:'omit'});if(!r.ok)throw Error('HTTP '+r.status+(r.status===429?'（限流，请稍后手动重试）':''));return r.json();}
 function render(){
  const target=rows.at(-1),complete=[...rows].reverse().find(r=>r.circ!=null),latest=complete??target;
  $('asof').textContent='目标完整 UTC 日：'+C.yesterday()+' · 表中截至：'+target.date+' · 卡片有效估值日：'+(complete?.date??'无');
  $('cards').innerHTML=[['流通'+(asset==='hype'?'收入倍数':'销毁 PE'),fmt(latest.circ)+' x'],['全解锁'+(asset==='hype'?'情景倍数':'销毁 PE（估算）'),fmt(latest.full)+' x'],['近似收盘价格','$'+fmt(latest.price,4)],['30日'+(asset==='hype'?'持币人收入':'销毁价值'),'$'+fmt(latest.r30)],['年化分母','$'+fmt(latest.annual)],['情景总供应',fmt(latest.supply,2)]].map(([k,v])=>`<div class="stat-card"><div class="label">${k}</div><div class="value">${v}</div><div class="sub">${latest.date} UTC${latest.date!==target.date?' · 最近有效，非目标日':''}</div></div>`).join('');
  const shown=range?rows.slice(-range):rows;
  $('tbody').replaceChildren(...[...shown].reverse().map(r=>{const tr=document.createElement('tr');for(const v of [r.date,fmt(r.price,4),fmt(r.circ),fmt(r.full),...(asset==='hype'?[fmt(dailyRevenue[r.date])]:[]),fmt(r.r30),r.source==='bundled'?'固化历史':r.status==='ok'?'浏览器增量':r.status]){const td=document.createElement('td');td.textContent=v;tr.append(td);}return tr;}));
  if(window.echarts){
   chart??=echarts.init($('chart'));
   const dates=shown.map(r=>r.date),hype=asset==='hype';
   const axis={type:'category',data:dates,axisLabel:{color:'#8fb5ac'}};
   const options={color:['#50d2c1','#ecb96a','#1fd286'],tooltip:{trigger:'axis'},legend:{textStyle:{color:'#8fb5ac'},data:['流通倍数','全解锁情景倍数','价格 USD']},grid:{left:65,right:65,bottom:55},xAxis:axis,yAxis:[{type:'value',name:'倍数 x',axisLabel:{color:'#8fb5ac'}},{type:'value',name:'USD',axisLabel:{color:'#8fb5ac'},splitLine:{show:false}}],series:[['流通倍数','circ',0],['全解锁情景倍数','full',0],['价格 USD','price',1]].map(([name,k,yAxisIndex])=>({name,type:'line',showSymbol:false,connectNulls:false,yAxisIndex,data:shown.map(r=>r[k])}))};
   if(hype){
    options.tooltip.confine=true;
    // One chart / two grids: identical UTC categories and linked pointers on mouse or touch.
    options.grid=[{left:65,right:65,top:65,height:'42%'},{left:65,right:65,top:'67%',bottom:55}];
    options.xAxis=[{...axis,gridIndex:0,boundaryGap:true},{...axis,gridIndex:1,boundaryGap:true}];
    options.yAxis.push({type:'value',gridIndex:1,name:'USD',min:0,axisLabel:{color:'#8fb5ac',formatter:v=>v>=1e6?fmt(v/1e6,1)+'M':v>=1e3?fmt(v/1e3,1)+'k':fmt(v)},splitLine:{lineStyle:{color:'#183c34'}}});
    options.title={text:'每日持币人收入（USD）',left:65,top:'57%',textStyle:{color:'#8fb5ac',fontSize:14}};
    options.axisPointer={link:[{xAxisIndex:[0,1]}]};
    options.tooltip.formatter=params=>{
     const d=params[0]?.axisValue,r=shown.find(r=>r.date===d);if(!r)return '';
     const v=dailyRevenue[d];
     return d+' UTC<br>流通倍数：'+fmt(r.circ)+' x<br>全解锁情景倍数：'+fmt(r.full)+' x<br>价格：$'+fmt(r.price,4)+'<br>每日持币人收入（USD）：'+(C.valid(v)?'$'+fmt(v):'NA（缺失，未填零）');
    };
    options.series.push({name:'每日持币人收入（USD）',type:'bar',xAxisIndex:1,yAxisIndex:2,barMaxWidth:18,itemStyle:{color:'#50d2c1',opacity:0.75},data:shown.map(r=>C.valid(dailyRevenue[r.date])?dailyRevenue[r.date]:null)});
   }
   chart.setOption(options);
  }else $('chart').textContent='图表库未加载；下方表格和 CSV 仍可用。';
 }
 async function refresh(){
  $('refresh').disabled=true;const notes=[];
  try{
   seed??=await json('pe-data/'+asset+'.json');
   let cache={};try{cache=JSON.parse(localStorage.getItem(key)||'{}');if(cache.seedHash!==seed.sourceSHA256)cache={};}catch{notes.push('本地缓存不可用');}
   // Validate cached raw values. Do not trust cached calculated rows.
   const cleanRev=Object.fromEntries(Object.entries(cache.revenue||{}).filter(([d,v])=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&C.valid(v)));
   const cleanMarket=Object.fromEntries(Object.entries(cache.market||{}).filter(([d,v])=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&Array.isArray(v)&&v.length===2&&v.every(n=>C.valid(n)&&n>0)));
   let rev=C.merge(seed.revenue,cleanRev),prices=C.merge(seed.market,cleanMarket);const end=C.yesterday();
   if(C.time(end)-C.time(seed.last)>3660*C.DAY)throw Error('设备日期距固化档案超过10年，请检查系统时间或由维护者更新档案');
   dailyRevenue=rev;
   if(end<seed.last){notes.push('系统时间早于固化档案；保留历史，不向未来抓取。');rows=seed.rows;render();return;}
   rows=C.calculate(seed,rev,prices,end);render();
   const gaps=rows.filter(r=>r.source==='browser'&&(r.price==null||r.r30==null||!C.valid(rev[r.date])));
   if(gaps.length){
    $('status').textContent='正在补齐 '+gaps.length+' 个日期的公开数据…';
    // Serial public requests, no aggressive retry; never proxy around CORS or rate limits.
    try{const d=await json('https://api.llama.fi/summary/fees/'+id+'?dataType='+(asset==='hype'?'dailyHoldersRevenue':'dailyRevenue'));if(d.id!=='parent#'+id)throw Error('协议标识不匹配');rev=C.merge(rev,C.revenue(d,end));}catch(e){notes.push('收入获取失败：'+e.message);}
    try{prices=C.merge(prices,C.market(await json('https://api.coingecko.com/api/v3/coins/'+id+'/market_chart?vs_currency=usd&days=365&interval=daily'),end));}catch(e){notes.push('行情获取失败：'+e.message+'；可能为网络、CORS 或限流');}
    try{localStorage.setItem(key,JSON.stringify({seedHash:seed.sourceSHA256,revenue:rev,market:prices,savedAt:new Date().toISOString()}));}catch{notes.push('缓存写入失败；本次增量仅在内存中');}
   }
   dailyRevenue=rev;rows=C.calculate(seed,rev,prices,end);render();const pending=rows.filter(r=>r.source==='browser'&&r.circ==null).length;
   notes.push(pending?pending+' 个增量日期仍待补齐/无有效分母；表格保留 NA，卡片显示明确标注日期的最近有效估值。':'所有目标日期的流通指标已完整。');
   const target=rows.at(-1);if(target.circ==null){const reasons=[];if(!C.valid(rev[end]))reasons.push('当日收入缺失');if(target.r30==null)reasons.push('30日收入窗口不完整');if(target.price==null)reasons.push('缺少 D+1 00:00 UTC 精确配对价格/市值');if(target.annual===0)reasons.push('年化分母为零');notes.push('目标 '+end+'：'+reasons.join('；')+'。请求成功但缺字段也不代表已补齐；上游可能尚未发布符合口径的数据。');}
   if(asset==='uni'&&rows.at(-1).supply==null)notes.push('供应累计存在缺口，全解锁估算暂停；须补全缺口后恢复。');
  }catch(e){notes.push('读取失败：'+e.message);}finally{$('status').textContent=notes.join(' ');$('refresh').disabled=false;}
 }
 $('refresh').onclick=refresh;document.querySelectorAll('[data-range]').forEach(b=>b.onclick=()=>{range=+b.dataset.range;render();});window.addEventListener('resize',()=>chart?.resize());
 $('download').onclick=()=>{if(!rows.length)return;const cols=['date','price','mcap','r30','annual','circ','full','supply','status','source'];const blob=new Blob([cols.join(',')+'\n'+rows.map(r=>cols.map(k=>r[k]??'NA').join(',')).join('\n')],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=asset+'-pe.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
 await refresh();
})();
