'use strict';
(async()=>{
 const t=text=>window.PEText?window.PEText(text):text;
 let statusText='加载中…';
 function status(text){statusText=text;$('status').textContent=t(text);}
 const C=PECore,asset=document.body.dataset.asset,id=asset==='hype'?'hyperliquid':'uniswap';
 const $=id=>document.getElementById(id),fmt=(n,d=2)=>n==null?'NA':n.toLocaleString('en-US',{maximumFractionDigits:d});
 // Linear-interpolated percentile over valid values (numpy 'linear' convention).
 const pct=(vals,q)=>{const v=vals.filter(x=>x!=null&&Number.isFinite(x)).sort((a,b)=>a-b);if(!v.length)return null;const i=(v.length-1)*q,lo=Math.floor(i),hi=Math.ceil(i);return v[lo]+(v[hi]-v[lo])*(i-lo);};
 const B=window.PEChains,chainKey='hypevalue-uni-chains-v1';
 const H=window.PESources,sourceKey='hypevalue-hype-sources-v1';
 let sourceData={},sourceSnapshot,sourceState=[];
 const sourceName=k=>k==='Hyperliquid Perps'?bi('永续相关收入','Perpetual-related revenue'):bi('现货及拍卖相关收入','Spot & auction-related revenue');
 let chainData={},chainSnapshot,chainState=[];
 const bi=(zh,en)=>window.I18n?.lang==='en'?en:zh;
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let seed,rows=[],dailyRevenue={},range=365,chart; // default view: last 1 year
 // Main-chart line visibility by stable key (survives range/language re-renders). Full-unlock is opt-in.
 const lineShown={circ:true,full:false,price:true,p20:true,p80:true};const lineNames=()=>({circ:t('流通倍数'),full:t('全解锁情景倍数'),price:t('价格 USD'),p20:bi('近1年流通 20分位','1Y circulating P20'),p80:bi('近1年流通 80分位','1Y circulating P80')});const key='hypevalue-pe-v1-'+asset;
 async function json(url){const r=await fetch(url,{signal:AbortSignal.timeout(25000),credentials:'omit'});if(!r.ok)throw Error('HTTP '+r.status+(r.status===429?'（限流，请稍后手动重试）':''));return r.json();}
 function render(){
  const target=rows.at(-1),complete=[...rows].reverse().find(r=>r.circ!=null),latest=complete??target;
  $('asof').textContent=t('目标完整 UTC 日：')+C.yesterday()+t(' · 表中截至：')+target.date+t(' · 卡片有效估值日：')+(complete?.date??t('无'));
  $('cards').innerHTML=[[t('流通')+(asset==='hype'?t('收入倍数'):t('销毁 PE')),fmt(latest.circ)+' x'],[t('全解锁')+(asset==='hype'?t('情景倍数'):t('销毁 PE（估算）')),fmt(latest.full)+' x'],[t('近似收盘价格'),'$'+fmt(latest.price,4)],[t('30日')+(asset==='hype'?t('持币人收入'):t('销毁价值')),'$'+fmt(latest.r30)],[t('年化分母'),'$'+fmt(latest.annual)],[t('情景总供应'),fmt(latest.supply,2)]].map(([k,v])=>`<div class="stat-card"><div class="label">${t(k)}</div><div class="value">${v}</div><div class="sub">${latest.date} UTC${latest.date!==target.date?t(' · 最近有效，非目标日'):''}</div></div>`).join('');
  const shown=range?rows.slice(-range):rows;
  $('tbody').replaceChildren(...[...shown].reverse().map(r=>{const tr=document.createElement('tr');for(const v of [r.date,fmt(r.price,4),fmt(r.circ),fmt(r.full),fmt(dailyRevenue[r.date]),fmt(r.r30),r.source==='bundled'?t('固化历史'):r.status==='ok'?t('浏览器增量'):t(r.status)]){const td=document.createElement('td');td.textContent=v;tr.append(td);}return tr;}));
  if(asset==='uni'&&B){
   const end=C.yesterday(),sum=B.summary(chainData,end),panel=$('chain-summary');
   if(panel)panel.innerHTML='<h3>'+bi('近30个完整 UTC 日 · 各链收入占比','Last 30 complete UTC days · revenue by chain')+'</h3><p>'+end+' · '+bi('有效明细覆盖','Valid breakdown coverage')+' '+sum.covered+'/30 · '+bi('已报告合计','Reported total')+' $'+fmt(sum.sum)+'</p><p>'+esc(t(chainState.map(([zh,en])=>bi(zh,en)).join(' · ')))+'</p><p>'+bi('占比仅按有效明细日已报告金额计算；各链缺键不是零。缺数时不是完整30日收入。所有链逐一列出，Others 为五条主链以外已报告链之和。','Shares use reported amounts on valid breakdown days only; absent chain keys are not zero. Incomplete coverage is not a full 30-day revenue total. All chains are listed; Others sums reported chains outside the five main chains.')+'</p><div class="scroll-y"><table><thead><tr><th>'+bi('链','Chain')+'</th><th>USD</th><th>%</th><th>'+bi('覆盖天数 / 30','Days / 30')+'</th></tr></thead><tbody>'+sum.rows.map(r=>'<tr><td>'+esc(r.name)+'</td><td>'+fmt(r.value)+'</td><td>'+fmt(r.share==null?null:r.share*100)+'</td><td>'+r.days+'/30</td></tr>').join('')+'</tbody></table></div>';
  }
  if(asset==='hype'&&H){
   const sum=H.summary(sourceData,C.yesterday());
   $('source-summary').innerHTML='<h3>'+bi('近30个完整 UTC 日 · 收入来源占比','Last 30 complete UTC days · revenue sources')+'</h3><p>'+C.yesterday()+' · '+bi('完整明细覆盖','Complete breakdown coverage')+' '+sum.covered+'/30 · '+bi('同期已报告合计','Reported total for covered days')+' $'+fmt(sum.sum)+'</p><p>'+esc(t(sourceState.map(([zh,en])=>bi(zh,en)).join(' · ')))+'</p><p>'+bi('仅统计两组均有效的日期；缺失不是零，不完整覆盖不是完整30日收入。不缩放明细以匹配估值底稿。','Only days with both valid groups are included; missing is not zero. Incomplete coverage is not a full 30-day total. Components are never scaled to match valuation inputs.')+'</p><div class="scroll-y"><table><thead><tr><th>'+bi('来源','Source')+'</th><th>USD</th><th>%</th><th>'+bi('覆盖天数','Days covered')+'</th></tr></thead><tbody>'+sum.rows.map(r=>'<tr><td>'+sourceName(r.name)+'</td><td>'+fmt(r.days?r.value:null)+'</td><td>'+fmt(r.share==null?null:r.share*100)+'</td><td>'+r.days+'/30</td></tr>').join('')+'</tbody></table></div>';
  }
  if(window.echarts){
   if(!chart){chart=echarts.init($('chart'));chart.on?.('legendselectchanged',e=>{for(const [k,n] of Object.entries(lineNames()))if(Object.hasOwn(e.selected||{},n))lineShown[k]=!!e.selected[n];});}
   const yearRows=rows.slice(-365),yearVals=yearRows.map(r=>r.circ).filter(v=>v!=null&&Number.isFinite(v)),band={p20:pct(yearVals,0.2),p80:pct(yearVals,0.8),n:yearVals.length,from:yearRows[0]?.date,to:yearRows.at(-1)?.date};
   const dates=shown.map(r=>r.date),revenueLabel=asset==='hype'?t('每日持币人收入（USD）'):t('每日回购／销毁价值（代理口径，USD）');
   const axis={type:'category',data:dates,axisLabel:{color:'#8fb5ac'}};
   const colors={circ:'#38BDF8',full:'#FBBF24',price:'#C084FC',revenue:'#50d2c1',p20:'#4ADE80',p80:'#F87171'};
   const marker=k=>`<span style="display:inline-block;margin-right:4px;border-radius:50%;width:10px;height:10px;background-color:${colors[k]}"></span>`;
   const options={color:[colors.circ,colors.full,colors.price],tooltip:{trigger:'axis'},legend:{textStyle:{color:'#8fb5ac'},data:[t('流通倍数'),t('全解锁情景倍数'),t('价格 USD')]},grid:{left:65,right:65,bottom:55},xAxis:axis,yAxis:[{type:'value',name:t('倍数 x'),axisLabel:{color:'#8fb5ac'}},{type:'value',name:'USD',axisLabel:{color:'#8fb5ac'},splitLine:{show:false}}],series:[[t('流通倍数'),'circ',0],[t('全解锁情景倍数'),'full',0],[t('价格 USD'),'price',1]].map(([name,k,yAxisIndex])=>({name,type:'line',showSymbol:false,connectNulls:false,yAxisIndex,lineStyle:{color:colors[k]},itemStyle:{color:colors[k]},data:shown.map(r=>r[k])}))};
   {
    options.tooltip.confine=true;
    // One chart / two grids: identical UTC categories and linked pointers on mouse or touch.
    options.grid=[{left:65,right:65,top:65,height:'42%'},{left:65,right:65,top:'67%',bottom:55}];
    options.xAxis=[{...axis,gridIndex:0,boundaryGap:true},{...axis,gridIndex:1,boundaryGap:true}];
    options.yAxis.push({type:'value',gridIndex:1,name:'USD',min:0,axisLabel:{color:'#8fb5ac',formatter:v=>v>=1e6?fmt(v/1e6,1)+'M':v>=1e3?fmt(v/1e3,1)+'k':fmt(v)},splitLine:{lineStyle:{color:'#183c34'}}});
    options.title={text:revenueLabel.replace(t('（代理口径'),t('\n（代理口径')),left:65,top:'57%',textStyle:{color:'#8fb5ac',fontSize:14}};
    options.axisPointer={link:[{xAxisIndex:[0,1]}]};
    options.tooltip.formatter=params=>{
     const d=params[0]?.axisValue,r=shown.find(r=>r.date===d);if(!r)return '';
     const v=dailyRevenue[d];
     return d+' UTC<br>'+marker('circ')+t('流通倍数：')+fmt(r.circ)+' x<br>'+marker('full')+t('全解锁情景倍数：')+fmt(r.full)+' x<br>'+marker('price')+t('价格：$')+fmt(r.price,4)+'<br>'+(band.n?marker('p20')+bi('近1年流通 20分位：','1Y circ. P20: ')+fmt(band.p20)+' x · '+marker('p80')+bi('80分位：','P80: ')+fmt(band.p80)+' x<br><span style="opacity:.7">'+bi('样本：','Sample: ')+band.from+' – '+band.to+' · '+band.n+bi(' 个有效日',' valid days')+(band.n<365?bi('（不足365天，按全部可用历史）',' (fewer than 365; uses all available history)'):'')+'</span><br>':'')+marker('revenue')+revenueLabel+t('：')+(C.valid(v)?'$'+fmt(v):t('NA（缺失，未填零）'));
    };
    options.series.push({name:revenueLabel,type:'bar',xAxisIndex:1,yAxisIndex:2,barMaxWidth:18,itemStyle:{color:colors.revenue,opacity:0.75},data:shown.map(r=>C.valid(dailyRevenue[r.date])?dailyRevenue[r.date]:null)});
   }
   if(asset==='uni'&&B){
    const names=[...B.main,'Others'],palette=['#60A5FA','#FBBF24','#FB7185','#A78BFA','#34D399','#94A3B8'];
    options.title.text=bi('每日按链收入（dailyRevenue 代理，USD）','Daily chain revenue (dailyRevenue proxy, USD)');
    options.tooltip.extraCssText='max-height:360px;overflow-y:auto;max-width:calc(100vw - 40px);white-space:normal';
    options.tooltip.enterable=true;
    options.title.text=options.title.text.replace('（','\n（').replace(' (','\n(');
    options.series.pop();
    names.forEach((name,i)=>options.series.push({name:name==='Others'?bi('其他链','Others'):name,type:'bar',stack:'chain-revenue',xAxisIndex:1,yAxisIndex:2,barMaxWidth:18,itemStyle:{color:palette[i]},data:shown.map(r=>B.group(chainData[r.date],name))}));
    options.legend=[options.legend,{type:'scroll',left:20,right:20,top:'63%',textStyle:{color:'#8fb5ac',fontSize:10},data:names.map(n=>n==='Others'?bi('其他链','Others'):n)}];
    const baseTooltip=options.tooltip.formatter;
    options.tooltip.formatter=params=>{
     const d=params[0]?.axisValue,cs=chainData[d],total=B.total(cs),original=dailyRevenue[d];
     let html=baseTooltip(params)+'<hr>'+bi('链明细已报告合计','Reported chain total')+': $'+fmt(total);
     html+='<br>'+bi('与估值收入差额（明细减估值）','Difference vs valuation revenue (chains minus valuation)')+': $'+fmt(C.valid(total)&&C.valid(original)?total-original:null);
     html+='<br>'+bi('缺失链键不视作零；占比按已报告合计','Absent keys are not zero; shares use reported total');
     for(const name of B.main)if(!Object.hasOwn(cs||{},name))html+='<br>'+esc(name)+': NA';
     for(const [name,value] of Object.entries(cs||{}).sort((a,b)=>(b[1]??-1)-(a[1]??-1)))html+='<br>'+esc(name)+': $'+fmt(value)+' · '+fmt(C.valid(value)&&total>0?value/total*100:null)+'%';

     return html;
    };
   }
   if(asset==='hype'&&H){
    options.series.pop();
    H.keys.forEach((k,i)=>options.series.push({name:sourceName(k),type:'bar',stack:'hype-sources',xAxisIndex:1,yAxisIndex:2,barMaxWidth:18,itemStyle:{color:['#50d2c1','#FB923C'][i]},data:shown.map(r=>sourceData[r.date]?.[k]??null)}));
    options.legend=[options.legend,{type:'scroll',left:20,right:20,top:'63%',textStyle:{color:'#8fb5ac',fontSize:10},data:H.keys.map(sourceName)}];
    options.tooltip.enterable=true;options.tooltip.extraCssText='max-height:360px;overflow-y:auto;max-width:calc(100vw - 40px);white-space:normal';
    const base=options.tooltip.formatter;
    options.tooltip.formatter=params=>{
     const d=params[0]?.axisValue,row=sourceData[d],total=H.total(row),original=dailyRevenue[d];
     return base(params)+'<hr>'+H.keys.map(k=>sourceName(k)+': $'+fmt(row?.[k])+' · '+fmt(H.valid(row?.[k])&&total>0?row[k]/total*100:null)+'%').join('<br>')+'<br>'+bi('明细同期合计','Same-day breakdown total')+': $'+fmt(total)+'<br>'+bi('与估值底稿差额（明细减底稿）','Difference vs valuation input (breakdown minus input)')+': $'+fmt(H.valid(total)&&C.valid(original)?total-original:null)+'<br>'+bi('NA 为缺失；差异保留，不缩放、不覆盖历史。','NA means missing; differences are retained, never scaled or written over history.');
    };
   }
   const main=Array.isArray(options.legend)?options.legend[0]:options.legend;
   // 1Y circulating-PE percentile bands: appended last so existing series order is unchanged.
   for(const k of ['p20','p80'])if(band[k]!=null){options.series.push({name:lineNames()[k],type:'line',showSymbol:false,xAxisIndex:0,yAxisIndex:0,silent:true,lineStyle:{type:'dashed',width:1.5,color:colors[k]},itemStyle:{color:colors[k]},data:shown.map(()=>band[k]),z:1});main.data.push(lineNames()[k]);}main.selected=Object.fromEntries(Object.entries(lineNames()).map(([k,n])=>[n,lineShown[k]]));
   chart.setOption(options, {notMerge:true});
  }else $('chart').textContent=t('图表库未加载；下方表格和 CSV 仍可用。');
 }
 async function refresh(){
  $('refresh').disabled=true;const notes=[];
  try{
   seed??=await json('pe-data/'+asset+'.json');
   if(asset==='uni'&&B){
    try{chainSnapshot??=await json('pe-data/uni-chains.json');chainData=B.parse(chainSnapshot,C.yesterday());chainState=[['快照抓取时间：'+chainSnapshot.fetchedAt,'Snapshot fetched: '+chainSnapshot.fetchedAt]];}catch(e){chainState=[['链快照不可用：'+e.message,'Chain snapshot unavailable: '+e.message]];}
    try{const cached=JSON.parse(localStorage.getItem(chainKey)||'null');if(cached){chainData={...chainData,...B.parse(cached,C.yesterday())};chainState.push(['本机缓存抓取：'+cached.fetchedAt,'Local cache fetched: '+cached.fetchedAt]);}}catch{chainState.push(['链缓存不可用','Chain cache unavailable']);}
   }
   if(asset==='hype'&&H){
    sourceData={};
    try{sourceSnapshot??=await json('pe-data/hype-sources.json');sourceData=H.parse(sourceSnapshot,C.yesterday());sourceState=[['快照抓取：'+sourceSnapshot.fetchedAt,'Snapshot fetched: '+sourceSnapshot.fetchedAt]];}catch(e){sourceState=[['来源快照不可用：'+e.message,'Source snapshot unavailable: '+e.message]];}
    try{const cached=JSON.parse(localStorage.getItem(sourceKey)||'null');if(cached){sourceData={...sourceData,...H.parse(cached,C.yesterday())};sourceState.push(['本机缓存抓取：'+cached.fetchedAt,'Local cache fetched: '+cached.fetchedAt]);}}catch{sourceState.push(['来源缓存不可用','Source cache unavailable']);}
   }
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
   const chainGaps=asset==='uni'&&B&&rows.some(r=>r.date<=end&&!C.valid(B.total(chainData[r.date])));
   const sourceGaps=asset==='hype'&&H&&rows.some(r=>r.date<=end&&!H.valid(H.total(sourceData[r.date])));
   if(gaps.length||chainGaps||sourceGaps){
    status('正在补齐 '+gaps.length+' 个日期的公开数据…');
    // Serial public requests, no aggressive retry; never proxy around CORS or rate limits.
    try{const d=await json('https://api.llama.fi/summary/fees/'+id+'?dataType='+(asset==='hype'?'dailyHoldersRevenue':'dailyRevenue'));if(d.id!=='parent#'+id)throw Error('协议标识不匹配');rev=C.merge(rev,C.revenue(d,end));if(asset==='hype'&&H){try{sourceData={...sourceData,...H.parse(d,end)};const snapshot={id:d.id,totalDataChartBreakdown:d.totalDataChartBreakdown.filter(([ts])=>C.date(ts*1000)<=end),fetchedAt:new Date().toISOString()};sourceState=[['API 明细抓取：'+snapshot.fetchedAt,'API breakdown fetched: '+snapshot.fetchedAt]];try{localStorage.setItem(sourceKey,JSON.stringify(snapshot));}catch{sourceState.push(['缓存写入失败，仅内存','Cache write failed; memory only']);}}catch(e){sourceState.push(['明细失败：'+e.message,'Breakdown failed: '+e.message]);}}if(asset==='uni'&&B){try{const parsed=B.parse(d,end);chainData={...chainData,...parsed};const snapshot={id:d.id,totalDataChartBreakdown:d.totalDataChartBreakdown.filter(([ts])=>C.date(ts*1000)<=end),fetchedAt:new Date().toISOString()};chainState=[['API 明细抓取：'+snapshot.fetchedAt,'API breakdown fetched: '+snapshot.fetchedAt]];try{localStorage.setItem(chainKey,JSON.stringify(snapshot));}catch{chainState.push(['缓存写入失败，仅内存','Cache write failed; memory only']);}}catch(e){chainState.push(['链明细失败：'+e.message,'Breakdown failed: '+e.message]);}}}catch(e){notes.push('收入获取失败：'+e.message);if(asset==='hype'&&H)sourceState.push(['API失败，保留快照/缓存：'+e.message,'API failed; retaining snapshot/cache: '+e.message]);if(asset==='uni')chainState.push(['API失败，保留快照/缓存：'+e.message,'API failed; retaining snapshot/cache: '+e.message]);}
    if(gaps.length)try{prices=C.merge(prices,C.market(await json('https://api.coingecko.com/api/v3/coins/'+id+'/market_chart?vs_currency=usd&days=365&interval=daily'),end));}catch(e){notes.push('行情获取失败：'+e.message+'；可能为网络、CORS 或限流');}
    try{localStorage.setItem(key,JSON.stringify({seedHash:seed.sourceSHA256,revenue:rev,market:prices,savedAt:new Date().toISOString()}));}catch{notes.push('缓存写入失败；本次增量仅在内存中');}
   }
   dailyRevenue=rev;rows=C.calculate(seed,rev,prices,end);render();const pending=rows.filter(r=>r.source==='browser'&&r.circ==null).length;
   notes.push(pending?pending+' 个增量日期仍待补齐/无有效分母；表格保留 NA，卡片显示明确标注日期的最近有效估值。':'所有目标日期的流通指标已完整。');
   const target=rows.at(-1);if(target.circ==null){const reasons=[];if(!C.valid(rev[end]))reasons.push('当日收入缺失');if(target.r30==null)reasons.push('30日收入窗口不完整');if(target.price==null)reasons.push('缺少 D+1 00:00 UTC 精确配对价格/市值');if(target.annual===0)reasons.push('年化分母为零');notes.push('目标 '+end+'：'+reasons.join('；')+'。请求成功但缺字段也不代表已补齐；上游可能尚未发布符合口径的数据。');}
   if(asset==='uni'&&rows.at(-1).supply==null)notes.push('供应累计存在缺口，全解锁估算暂停；须补全缺口后恢复。');
  }catch(e){notes.push('读取失败：'+e.message);}finally{status(notes.join(' '));$('refresh').disabled=false;}
 }
 if($('clear-sources'))$('clear-sources').onclick=()=>{try{localStorage.removeItem(sourceKey);sourceData=sourceSnapshot?H.parse(sourceSnapshot,C.yesterday()):{};sourceState=[['来源缓存已清除；使用固定快照','Source cache cleared; using snapshot']];}catch(e){sourceState=[['清缓存失败：'+e.message,'Cache clearing failed: '+e.message]];}render();};
 if($('clear-chains'))$('clear-chains').onclick=()=>{try{localStorage.removeItem(chainKey);chainData=chainSnapshot?B.parse(chainSnapshot,C.yesterday()):{};chainState=[['链缓存已清除，使用固定快照；可联网重试。','Chain cache cleared; using snapshot. Retry to fetch gaps.']];render();}catch(e){chainState=[['清缓存失败：'+e.message,'Cache clearing failed: '+e.message]];render();}};
 $('refresh').onclick=refresh;document.querySelectorAll('[data-range]').forEach(b=>b.onclick=()=>{range=+b.dataset.range;render();});window.addEventListener('resize',()=>chart?.resize());
 $('download').onclick=()=>{if(!rows.length)return;const cols=['date','price','mcap','r30','annual','circ','full','supply','status','source'];const blob=new Blob([cols.join(',')+'\n'+rows.map(r=>cols.map(k=>r[k]??'NA').join(',')).join('\n')],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=asset+'-pe.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
 function languageChanged(){
  document.querySelectorAll('[data-pe-aria]').forEach(el=>el.setAttribute('aria-label',window.I18n.t(el.getAttribute('data-pe-aria'))));
  for(const id of ['vcTotal','vcToday']){const el=$(id);if(el?.dataset?.state==='loading')el.textContent=t('加载中…');if(el?.dataset?.state==='error')el.textContent=window.I18n.lang==='en'?'Unavailable':'暂不可用';}
  if(rows.length)render();
  $('status').textContent=t(statusText);
 }
 window.onI18nChange=languageChanged;
 await refresh();
})();
