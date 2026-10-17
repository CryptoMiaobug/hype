/* BTC 数据页渲染：固化档案 + Coin Metrics 增量 + CoinGecko 实时卡片。 */
'use strict';
(()=>{
 const C=window.BTCCore,$=id=>document.getElementById(id);
 const bi=(zh,en)=>window.I18n?.lang==='en'?en:zh;
 const KEY='btcdata-v1',DIM='#8fb5ac',GRID='#183c34';
 const fmt=(n,d=2)=>n==null||!Number.isFinite(n)?'NA':n.toLocaleString('en-US',{maximumFractionDigits:d});
 const usd=n=>n==null?'NA':n>=1e12?'$'+fmt(n/1e12,2)+'T':n>=1e9?'$'+fmt(n/1e9,2)+'B':n>=1e6?'$'+fmt(n/1e6,2)+'M':'$'+fmt(n,n<1?4:0);
 const pct=n=>n==null?'NA':fmt(n*100,2)+'%';
 const ranges={dd:0,z:0,mc:0,dom:0},charts={};
 let seed,domSeed,domRows=[],rows=[],live=null,status=['加载中…','Loading…'];

 async function json(url,ms=25000){
  const r=await fetch(url,{signal:AbortSignal.timeout(ms),credentials:'omit'});
  if(!r.ok)throw Error('HTTP '+r.status+(r.status===429?bi('（限流，稍后再试）',' (rate limited, retry later)'):''));
  return r.json();
 }
 function setStatus(zh,en){status=[zh,en];$('status').textContent=bi(zh,en);}
 const zoneText=z=>({under:bi('低估区','Undervalued'),neutral:bi('中性区','Neutral'),warm:bi('偏热区','Warm'),hot:bi('过热区','Overheated')})[C.zone(z)]||'';

 function cards(){
  const last=rows.at(-1),lz=[...rows].reverse().find(r=>r.z!=null);
  const price=live?.price??last.price,ath=Math.max(last.ath,live?.price??0);
  const liveTag=live?bi('CoinGecko 实时 · ','CoinGecko live · ')+live.at:last.date+' UTC';
  const list=[
   [bi('BTC 价格','BTC price'),'$'+fmt(price,0),liveTag],
   [bi('距历史高点回撤','Drawdown from ATH'),pct(price/ath-1),bi('历史最高日价 ','ATH daily price ')+'$'+fmt(ath,0)+(ath===last.ath?' · '+last.athDate:'')],
   ['MVRV Z-Score',fmt(lz?.z,2),(lz?zoneText(lz.z)+' · ':'')+(lz?.date??'NA')+' UTC'],
   ['MVRV',fmt(last.mvrv,3),last.date+' UTC'],
   [bi('BTC 市值','BTC market cap'),usd(live?.mcap??last.mcap),liveTag],
   [bi('已实现市值','Realized cap'),usd(last.realized),last.date+' UTC'],
   [bi('BTC 市值占比','BTC dominance'),live?.dom==null?'NA':fmt(live.dom,2)+'%',live?.dom==null?bi('实时接口不可用','Live feed unavailable'):bi('全市场 ','Total market ')+usd(live.total)]
  ];
  $('cards').innerHTML=list.map(([k,v,s])=>`<div class="stat-card"><div class="label">${k}</div><div class="value">${v}</div><div class="sub">${s}</div></div>`).join('');
  $('asof').textContent=bi('日线截至 ','Daily data through ')+last.date+' UTC · '+bi('固化档案截至 ','Archive through ')+seed.last;
 }

 const slice=k=>{const src=k==='dom'?domRows:rows;return ranges[k]?src.slice(-ranges[k]):src;};
 function base(shown,extra){
  const narrow=(document.querySelector('.btc-chart')?.clientWidth||1000)<600;
  return {animation:false,tooltip:{trigger:'axis',confine:true},legend:{top:0,textStyle:{color:DIM}},
   grid:{left:narrow?48:65,right:narrow?52:70,top:40,bottom:60},
   dataZoom:[{type:'inside'},{type:'slider',height:18,bottom:8,textStyle:{color:DIM}}],
   xAxis:{type:'category',data:shown.map(r=>r.date),axisLabel:{color:DIM}},...extra};
 }
 const logAxis=(name,pos)=>({type:'log',name,position:pos,logBase:10,axisLabel:{color:DIM,formatter:v=>usd(v)},splitLine:{show:pos==='left',lineStyle:{color:GRID}}});
 const line=(name,data,color,y=0,o={})=>({name,type:'line',showSymbol:false,yAxisIndex:y,data,lineStyle:{color,width:1.4},itemStyle:{color},...o});

 // 全历史 P20/P50/P80 虚线（同 PE 页配色），样本为全部有效数据，不随图表范围变化。
 const BAND_C={p20:'#4ADE80',p50:'#A5B4FC',p80:'#F87171'};
 function bandSeries(b,shown,label,unit){
  return ['p20','p50','p80'].filter(k=>b[k]!=null).map(k=>({name:bi('全历史'+label+' '+k.slice(1)+'分位'+(k==='p50'?'（中位数）':''),'All-time '+label+' P'+k.slice(1)+(k==='p50'?' (median)':'')),type:'line',showSymbol:false,silent:true,yAxisIndex:0,z:1,
   lineStyle:{type:'dashed',width:1.5,color:BAND_C[k]},itemStyle:{color:BAND_C[k]},data:shown.map(()=>b[k]),tooltip:{show:false}}));
 }
 function bandText(b,unit,d=2){
  if(!b.n)return '';
  const dot=k=>`<span style="display:inline-block;margin-right:4px;border-radius:50%;width:10px;height:10px;background:${BAND_C[k]}"></span>`;
  return '<br>'+dot('p20')+'P20 '+fmt(b.p20,d)+unit+' · '+dot('p50')+'P50 '+fmt(b.p50,d)+unit+' · '+dot('p80')+'P80 '+fmt(b.p80,d)+unit+'<br><span style="opacity:.7">'+bi('全历史样本：','All-time sample: ')+b.from+' – '+b.to+' · '+b.n+bi(' 天',' days')+'</span>';
 }
 function draw(k){
  if(!window.echarts){$('chart-'+k).textContent=bi('图表库未加载，可下载 CSV 查看数据。','Chart library failed to load; download the CSV instead.');return;}
  const el=$('chart-'+k);charts[k]??=echarts.init(el);
  const shown=slice(k),pName=bi('价格 USD','Price USD');let opt;
  if(k==='dd'){
   const dName=bi('回撤','Drawdown');
   opt=base(shown,{yAxis:[{type:'value',name:dName,max:0,axisLabel:{color:DIM,formatter:v=>fmt(v*100,0)+'%'},splitLine:{lineStyle:{color:GRID}}},logAxis(pName,'right')],
    series:[line(dName,shown.map(r=>r.dd),'#F87171',0,{areaStyle:{color:'rgba(248,113,113,.25)'}}),line(pName,shown.map(r=>r.price),'#FBBF24',1)]});
   opt.tooltip.formatter=p=>{const r=shown[p[0].dataIndex];return r.date+' UTC<br>'+bi('价格 ','Price ')+'$'+fmt(r.price,2)+'<br>'+bi('回撤 ','Drawdown ')+pct(r.dd)+'<br>'+bi('前高 ','Prior high ')+'$'+fmt(r.ath,2)+' · '+r.athDate;};
  }else if(k==='z'){
   const zName='MVRV Z-Score',zb=C.band(rows,'z');
   opt=base(shown,{yAxis:[{type:'value',name:'Z',axisLabel:{color:DIM},splitLine:{lineStyle:{color:GRID}}},logAxis(pName,'right')],
    series:[line(zName,shown.map(r=>r.z),'#50d2c1',0,{markLine:{silent:true,symbol:'none',lineStyle:{color:'#9CA3AF',type:[2,4],width:1.2,opacity:.9},label:{position:'insideStartTop',color:'#C7D2CF',fontSize:11},data:[{yAxis:0,label:{formatter:bi('0 · 低估线','0 · undervalued line')}},{yAxis:7,label:{formatter:bi('7 · 过热线','7 · overheated line')}}]}}),line(pName,shown.map(r=>r.price),'#FBBF24',1,{lineStyle:{color:'#FBBF24',width:1,opacity:.6}}),...bandSeries(zb,shown,'Z','')]});
   opt.tooltip.formatter=p=>{const r=shown[p[0].dataIndex];return r.date+' UTC<br>Z '+fmt(r.z,2)+(r.z==null?'':' · '+zoneText(r.z))+'<br>MVRV '+fmt(r.mvrv,3)+'<br>'+bi('价格 ','Price ')+'$'+fmt(r.price,2)+bandText(zb,'');};
  }else if(k==='dom'){
   const db=C.band(domRows,'dom'),dn=bi('BTC 市值占比','BTC dominance'),mn=bi('BTC 市值','BTC market cap'),cut=domSeed?.archiveLast;
   const mark=cut&&shown.some(r=>r.date>cut)?{silent:true,symbol:'none',lineStyle:{color:DIM,type:'dashed'},label:{color:DIM,formatter:bi('此后 CoinGecko','CoinGecko after')},data:[{xAxis:cut}]}:undefined;
   opt=base(shown,{yAxis:[{type:'value',name:'%',min:0,max:100,axisLabel:{color:DIM,formatter:'{value}%'},splitLine:{lineStyle:{color:GRID}}},logAxis('USD','right')],
    series:[line(dn,shown.map(r=>r.dom),'#60A5FA',0,{areaStyle:{color:'rgba(96,165,250,.28)'},markLine:mark}),line(pName,shown.map(r=>r.price),'#FBBF24',1,{lineStyle:{color:'#FBBF24',width:1}}),line(mn,shown.map(r=>r.mcap),'#50d2c1',1,{lineStyle:{color:'#50d2c1',width:1}}),...bandSeries(db,shown,bi('占比','dominance'),'%')]});
   opt.tooltip.formatter=p=>{const r=shown[p[0].dataIndex];return r.date+' UTC<br>'+dn+' '+(r.dom==null?'NA':fmt(r.dom,2)+'%')+'<br>'+bi('全市场市值 ','Total market cap ')+usd(r.total)+'<br>'+bi('价格 ','Price ')+(r.price==null?'NA':'$'+fmt(r.price,2))+'<br>'+mn+' '+usd(r.mcap)+'<br><span style="opacity:.7">'+(cut&&r.date>cut?'CoinGecko':'CoinMarketCap')+'</span>'+bandText(db,'%');};
  }else{
   const m=bi('市值','Market cap'),rc=bi('已实现市值','Realized cap');
   opt=base(shown,{yAxis:[logAxis('USD','left')],series:[line(m,shown.map(r=>r.mcap),'#38BDF8'),line(rc,shown.map(r=>r.realized),'#C084FC')]});
   opt.tooltip.formatter=p=>{const r=shown[p[0].dataIndex];return r.date+' UTC<br>'+m+' '+usd(r.mcap)+'<br>'+rc+' '+usd(r.realized)+'<br>MVRV '+fmt(r.mvrv,3);};
  }
  charts[k].setOption(opt,{notMerge:true});
 }
 function renderAll(){
  if(!rows.length)return;
  domRows=C.dominance(domSeed?.rows,rows);cards();['dd','z','mc','dom'].filter(k=>$('chart-'+k)).forEach(draw);
  document.querySelectorAll('[data-chart]').forEach(b=>b.setAttribute('aria-pressed',String(ranges[b.dataset.chart]===+b.dataset.range)));
 }

 async function fetchLive(){
  const [m,g]=await Promise.allSettled([
   json('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin',15000),
   json('https://api.coingecko.com/api/v3/global',15000)]);
  const b=m.status==='fulfilled'?m.value?.[0]:null,d=g.status==='fulfilled'?g.value?.data:null;
  if(!b&&!d)throw Error(bi('CoinGecko 不可用','CoinGecko unavailable'));
  const ok=x=>typeof x==='number'&&x>0?x:null;
  live={price:ok(b?.current_price),mcap:ok(b?.market_cap),dom:ok(d?.market_cap_percentage?.btc),total:ok(d?.total_market_cap?.usd),
   at:new Date((b?.last_updated?Date.parse(b.last_updated):Date.now())).toISOString().slice(11,16)+' UTC'};
 }

 async function refresh(){
  $('refresh').disabled=true;const notes=[];
  try{
   seed??=await json('btc-data/btc.json');
   if(!domSeed&&$('chart-dom'))try{domSeed=await json('btc-data/dominance.json');}catch(e){notes.push(['市值占比历史读取失败：'+e.message,'Dominance history failed: '+e.message]);}
   let extra=[];
   try{const c=JSON.parse(localStorage.getItem(KEY)||'null');if(c&&c.seedHash===seed.sourceSHA256&&Array.isArray(c.rows))extra=c.rows;}catch{notes.push(['本机缓存不可用','Local cache unavailable']);}
   let raw=C.merge(seed.rows,extra);rows=C.derive(raw);renderAll();
   const end=C.yesterday(),last=raw.at(-1)[0];
   if(last<end){
    setStatus('正在从 Coin Metrics 补齐 '+last+' 之后的日线…','Fetching daily data after '+last+' from Coin Metrics…');
    try{
     const start=C.date(C.time(last)+C.DAY);
     const r=await json('https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc&metrics=PriceUSD,CapMrktCurUSD,CapMVRVCur&frequency=1d&page_size=10000&start_time='+start+'&end_time='+end);
     raw=C.merge(raw,C.parse(r,end));
     try{localStorage.setItem(KEY,JSON.stringify({seedHash:seed.sourceSHA256,rows:raw.slice(seed.rows.length),savedAt:new Date().toISOString()}));}catch{notes.push(['缓存写入失败，本次增量只在内存中','Cache write failed; increments kept in memory only']);}
    }catch(e){notes.push(['Coin Metrics 获取失败：'+e.message,'Coin Metrics fetch failed: '+e.message]);}
    rows=C.derive(raw);
    if(raw.at(-1)[0]<end)notes.push(['日线截至 '+raw.at(-1)[0]+'，Coin Metrics 通常在 UTC 次日更新','Daily data through '+raw.at(-1)[0]+'; Coin Metrics usually publishes the next UTC day']);
   }
   try{await fetchLive();}catch(e){notes.push([e.message,e.message]);}
   renderAll();
   if(!notes.length)notes.push(['数据已是最新','Data is up to date']);
  }catch(e){notes.push(['读取失败：'+e.message,'Load failed: '+e.message]);}
  finally{setStatus(notes.map(n=>n[0]).join(' · '),notes.map(n=>n[1]).join(' · '));$('refresh').disabled=false;}
 }

 function download(){
  if(!rows.length)return;
  const isDom=!!$('chart-dom'),src=isDom?domRows:rows,cols=isDom?['date','dom','total','price','mcap']:['date','price','mcap','mvrv','realized','ath','dd','z'];
  const blob=new Blob([cols.join(',')+'\n'+src.map(r=>cols.map(k=>r[k]??'NA').join(',')).join('\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(isDom?'btc-dominance-':'btc-data-')+src.at(-1).date+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
 }

 function languageChanged(){
  document.querySelectorAll('[data-btc-aria]').forEach(el=>el.setAttribute('aria-label',window.I18n.t(el.getAttribute('data-btc-aria'))));
  $('status').textContent=bi(...status);renderAll();
 }
 function init(){
  $('refresh').onclick=refresh;$('download').onclick=download;
  document.querySelectorAll('[data-chart]').forEach(b=>b.onclick=()=>{ranges[b.dataset.chart]=+b.dataset.range;draw(b.dataset.chart);renderAll();});
  window.addEventListener('resize',()=>Object.values(charts).forEach(c=>c.resize()));
  const prev=window.onI18nChange;window.onI18nChange=(...a)=>{prev?.(...a);languageChanged();};
  languageChanged();refresh();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
