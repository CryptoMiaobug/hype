/* 反向交易页：浏览器直连 Hyperliquid info 接口，收益起点来自 copy-data/roster.json，每日收盘净值来自 copy-data/daily.json（GitHub Actions 每天 00:05 固化）。 */
'use strict';
(()=>{
 const C=window.CopyCore,$=id=>document.getElementById(id);
 const bi=(zh,en)=>window.I18n?.lang==='en'?en:zh,t=k=>window.I18n?.t(k)??k;
 const API='https://api.hyperliquid.xyz/info',EXPLORER='https://app.hyperliquid.xyz/explorer';
 const DIM='#8fb5ac',GRID='#183c34',REFRESH_MS=30000,PAGE=50;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
 const fmt=(n,d=2)=>n==null||!Number.isFinite(n)?'NA':n.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
 const usd=(n,d=2)=>n==null||!Number.isFinite(n)?'NA':(n<0?'-$':'$')+fmt(Math.abs(n),d);
 const signed=(n,d=2)=>n==null||!Number.isFinite(n)?'NA':(n>0?'+':n<0?'-':'')+'$'+fmt(Math.abs(n),d);
 const pct=(n,d=2)=>n==null||!Number.isFinite(n)?'NA':(n>0?'+':'')+fmt(n*100,d)+'%';
 const cls=n=>n>0?'up':n<0?'down':'';
 const px=n=>{if(!Number.isFinite(n)||!n)return 'NA';const a=Math.abs(n),d=a>=1000?1:a>=1?Math.min(4,Math.max(2,5-Math.floor(Math.log10(a))-1)):Math.min(8,2-Math.floor(Math.log10(a))+3);return fmt(n,d);};
 const sz=n=>Math.abs(n).toLocaleString('en-US',{maximumFractionDigits:6});
 const short=a=>a.slice(0,6)+'…'+a.slice(-4);
 const when=ms=>{const d=new Date(ms),p=v=>String(v).padStart(2,'0');return `${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;};
 const day=ms=>{const d=new Date(ms),p=v=>String(v).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;};

 let roster=null,daily=null,data=null,shown=PAGE,status=['加载中…','Loading…'],timer=null,busy=false,chart=null;

 async function info(body){
  const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),credentials:'omit',signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw Error('HTTP '+r.status+(r.status===429?bi('（限流，稍后再试）',' (rate limited)'):''));
  return r.json();
 }
 function setStatus(zh,en){status=[zh,en];$('status').textContent=bi(zh,en);}

 async function load(){
  if(busy)return;busy=true;$('refresh').disabled=true;
  try{
   if(!roster){const r=await fetch('copy-data/roster.json?v='+Date.now(),{credentials:'omit'});if(!r.ok)throw Error('roster HTTP '+r.status);roster=await r.json();}
   // 日线文件每天只变一次；读取失败（例如还没有第一天）就只用 HL 采样点
   daily=await fetch('copy-data/daily.json?v='+Math.floor(Date.now()/600000),{credentials:'omit'}).then(r=>r.ok?r.json():null).catch(()=>null);
   const user=roster.account,start=roster.start.time;
   const dexs=['',...(await info({type:'perpDexs'})).slice(1).map(d=>d?.name).filter(Boolean)];
   const [spot,states,fills,funding,ledger,portfolio]=await Promise.all([
    info({type:'spotClearinghouseState',user}),
    Promise.all(dexs.map(dex=>info({type:'clearinghouseState',user,dex}))),
    info({type:'userFillsByTime',user,startTime:start,aggregateByTime:true}),
    info({type:'userFunding',user,startTime:start}),
    info({type:'userNonFundingLedgerUpdates',user,startTime:start}),
    info({type:'portfolio',user})
   ]);
   const now=Date.now(),sum=C.summarize({spot,states,fills,funding,ledger,account:user,start,capital:roster.start.capital});
   const capital=roster.start.capital;
   data={sum,trades:C.trades(fills,start),at:now,
    curve:C.withDaily(daily,C.curve(portfolio,{start,capital,ledger,account:user,now,equity:sum.equity})),
    days:C.dailyTable(daily,{equity:sum.equity,fills,funding,ledger,account:user,capital,now})};
   render();
   setStatus('已更新 '+when(now).slice(6),'Updated '+when(now).slice(6));
  }catch(e){setStatus('读取失败：'+e.message,'Load failed: '+e.message);}
  finally{busy=false;$('refresh').disabled=false;}
 }

 function cards(){
  const s=data.sum,list=[
   [t('ct.cEquity'),usd(s.equity),bi('可用 ','Available ')+usd(s.available)+' · '+bi('保证金 ','Margin ')+usd(s.margin),''],
   [t('ct.cPnl'),signed(s.pnl),bi('起始 ','Start ')+usd(roster.start.capital)+(s.flow?' · '+bi('净转入 ','Net in ')+signed(s.flow):''),cls(s.pnl)],
   [t('ct.cRoi'),pct(s.roi),t('ct.since')+' '+day(roster.start.time),cls(s.roi)],
   [t('ct.cUpnl'),signed(s.upnl),s.positions.length+bi(' 个持仓',' positions'),cls(s.upnl)],
   [t('ct.cClosed'),signed(s.closed),s.trades+bi(' 笔成交 · 成交额 ',' fills · volume ')+usd(s.volume,0),cls(s.closed)],
   [t('ct.cFees'),usd(-s.fees),s.volume?bi('平均 ','Avg ')+fmt(s.fees/s.volume*100,3)+'%':'','down'],
   [t('ct.cFunding'),signed(s.funding,3),bi('正数为收入','Positive = income'),cls(s.funding)],
   [t('ct.cNotional'),usd(s.notional,0),bi('名义 / 净值 ','Notional / equity ')+fmt(s.lev,2)+'x','']
  ];
  $('cards').innerHTML=list.map(([k,v,sub,c])=>`<div class="stat-card"><div class="label">${esc(k)}</div><div class="value ${c}">${esc(v)}</div><div class="sub">${esc(sub)}</div></div>`).join('');
  const a=roster.account;
  $('acct').innerHTML=`${esc(t('ct.account'))}：<a href="${EXPLORER}/address/${esc(a)}" target="_blank" rel="noopener"><code>${esc(a)}</code></a> · ${esc(t('ct.since'))} ${esc(day(roster.start.time))}`;
 }

 function drawCurve(){
  const el=$('chart');
  if(!window.echarts){el.textContent=bi('图表库未加载','Chart library failed to load');return;}
  chart??=echarts.init(el);
  const pts=data.curve,last=pts.at(-1)?.[1]??0,col=last>=0?'#1fd286':'#ff5c6c';
  chart.setOption({animation:false,grid:{left:60,right:20,top:20,bottom:40},
   tooltip:{trigger:'axis',confine:true,formatter:p=>when(p[0].value[0])+'<br>'+t('ct.cPnl')+' '+signed(p[0].value[1])},
   xAxis:{type:'time',axisLabel:{color:DIM},splitLine:{show:false}},
   yAxis:{type:'value',axisLabel:{color:DIM,formatter:v=>'$'+v},splitLine:{lineStyle:{color:GRID}}},
   series:[{type:'line',data:pts,showSymbol:pts.length<30,symbolSize:4,lineStyle:{color:col,width:1.6},itemStyle:{color:col},
    areaStyle:{color:last>=0?'rgba(31,210,134,.15)':'rgba(255,92,108,.15)'},markLine:{silent:true,symbol:'none',lineStyle:{color:DIM,type:'dashed'},label:{show:false},data:[{yAxis:0}]}}]},{notMerge:true});
 }

 function dayTable(){
  const ds=data.days;
  $('days').innerHTML=ds.length?ds.map(r=>`<tr><td class="pl-sticky">${esc(r.d)}${r.live?` <small class="pe-muted">${esc(t('ct.live'))}</small>`:''}</td><td class="num">${esc(usd(r.equity))}</td>
   <td class="num ${cls(r.pnl)}">${esc(signed(r.pnl))}</td><td class="num ${cls(r.roi)}">${esc(pct(r.roi))}</td><td class="num ${cls(r.cum)}">${esc(signed(r.cum))}</td>
   <td class="num">${esc(usd(r.fees))}</td><td class="num ${cls(r.funding)}">${esc(signed(r.funding,3))}</td><td class="num">${r.fills}</td><td class="num">${esc(usd(r.volume,0))}</td></tr>`).join('')
   :`<tr><td colspan="9" class="pe-muted">${esc(t('ct.noDays'))}</td></tr>`;
 }

 function posTable(){
  const ps=data.sum.positions;
  $('pos').innerHTML=ps.length?ps.map(p=>`<tr><td class="pl-sticky"><b>${esc(p.coin)}</b></td><td class="${p.side==='long'?'up':'down'}">${esc(t(p.side==='long'?'ct.long':'ct.short'))}</td>
   <td class="num">${esc(sz(p.szi))}</td><td class="num">${esc(usd(p.value))}</td><td class="num">${esc(px(p.entry))}</td><td class="num">${esc(px(p.mark))}</td>
   <td class="num ${cls(p.upnl)}">${esc(signed(p.upnl))}<small>${esc(pct(p.roe))}</small></td><td class="num">${esc(p.lev==null?'NA':p.lev+'x')}<small>${esc(p.levType==='isolated'?bi('逐仓','Isolated'):p.levType==='cross'?bi('全仓','Cross'):'')}</small></td>
   <td class="num">${esc(p.liq==null?'—':px(p.liq))}<small>${esc(p.liqDist==null?'':fmt(p.liqDist*100,1)+'%')}</small></td></tr>`).join('')
   :`<tr><td colspan="9" class="pe-muted">${esc(t('ct.noPos'))}</td></tr>`;
 }

 function tradeTable(){
  const tr=data.trades,rows=tr.slice(0,shown);
  $('fills').innerHTML=rows.length?rows.map(f=>`<tr><td class="pl-sticky">${esc(when(f.time))}</td><td><b>${esc(f.coin)}</b></td><td class="${f.side==='buy'?'up':'down'}">${esc(f.dir||(f.side==='buy'?'Buy':'Sell'))}</td>
   <td class="num">${esc(px(f.px))}</td><td class="num">${esc(sz(f.sz))}</td><td class="num">${esc(usd(f.value))}</td><td class="num">${esc(usd(f.fee,4))}</td>
   <td class="num ${cls(f.closed)}">${f.closed?esc(signed(f.closed)):'—'}</td></tr>`).join('')
   :`<tr><td colspan="8" class="pe-muted">${esc(t('ct.noTrades'))}</td></tr>`;
  $('more').hidden=tr.length<=shown;
 }


 function render(){if(!data)return;cards();drawCurve();dayTable();posTable();tradeTable();}

 function languageChanged(){$('status').textContent=bi(...status);$('chart').setAttribute('aria-label',t('ct.curveAria'));render();}
 function schedule(){clearInterval(timer);timer=setInterval(()=>{if(!document.hidden)load();},REFRESH_MS);}
 function init(){
  $('refresh').onclick=load;$('more').onclick=()=>{shown+=PAGE;tradeTable();};
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
  window.addEventListener('resize',()=>chart?.resize());
  const prev=window.onI18nChange;window.onI18nChange=(...a)=>{prev?.(...a);languageChanged();};
  languageChanged();load();schedule();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
