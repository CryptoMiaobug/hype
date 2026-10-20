/* 反向交易页纯计算（无浏览器依赖，node 测试直接加载）。
   输入全部是 Hyperliquid info 接口原样返回的数据；统一账户下现货 USDC 总额 = 账户净值（含逐仓保证金和浮盈）。
   收益只算收益起点之后：净收益 = 当前净值 − 起始资金 − 起点后净转入。 */
(function(root){
'use strict';
const num=v=>{const n=+v;return Number.isFinite(n)?n:0;};

// 起点后的 USDC 净转入（转入为正、转出为负）。统一账户内部的现货/合约划转不算。
function netFlow(ledger,account,start){
 const me=String(account).toLowerCase();let total=0;const items=[];
 for(const x of ledger||[]){
  if(x.time<start)continue;const d=x.delta||{};let v=0;
  if(d.type==='deposit')v=num(d.usdc);
  else if(d.type==='withdraw')v=-num(d.usdc)-num(d.fee);
  else if(['send','spotTransfer','internalTransfer','subAccountTransfer'].includes(d.type)){
   if((d.token??'USDC')!=='USDC'&&d.usdcValue==null)continue;
   const amt=num(d.usdcValue??d.usdc??d.amount),to=String(d.destination||'').toLowerCase(),from=String(d.user||'').toLowerCase();
   if(to===me&&from!==me)v=amt;else if(from===me&&to!==me)v=-amt-num(d.fee);
  }
  if(v){total+=v;items.push([x.time,v]);}
 }
 return {total,items};
}

function positions(states){
 const out=[];
 for(const st of states||[])for(const ap of st?.assetPositions||[]){
  const p=ap.position;if(!p||!num(p.szi))continue;
  const value=num(p.positionValue),margin=num(p.marginUsed),szi=num(p.szi),mark=Math.abs(szi)?value/Math.abs(szi):0,liq=p.liquidationPx==null?null:num(p.liquidationPx);
  out.push({coin:p.coin,szi,side:szi>0?'long':'short',entry:num(p.entryPx),mark,value,margin,
   upnl:num(p.unrealizedPnl),roe:margin?num(p.unrealizedPnl)/margin:0,lev:p.leverage?.value??null,levType:p.leverage?.type??null,
   liq,liqDist:liq&&mark?Math.abs(mark-liq)/mark:null,funding:num(p.cumFunding?.sinceOpen)});
 }
 return out.sort((a,b)=>b.value-a.value);
}

function summarize({spot,states,fills,funding,ledger,account,start,capital}){
 const usdc=(spot?.balances||[]).find(b=>b.coin==='USDC');
 const equity=num(usdc?.total),margin=num(usdc?.hold);
 const pos=positions(states);
 const f=(fills||[]).filter(x=>x.time>=start);
 const closed=f.reduce((s,x)=>s+num(x.closedPnl),0),fees=f.reduce((s,x)=>s+num(x.fee),0),volume=f.reduce((s,x)=>s+num(x.px)*num(x.sz),0);
 const fund=(funding||[]).filter(x=>x.time>=start).reduce((s,x)=>s+num(x.delta?.usdc),0);
 const upnl=pos.reduce((s,p)=>s+p.upnl,0),notional=pos.reduce((s,p)=>s+p.value,0);
 const flow=netFlow(ledger,account,start),base=capital+flow.total,pnl=equity-base;
 return {equity,margin,available:equity-margin,notional,upnl,closed,fees,funding:fund,volume,trades:f.length,
  flow:flow.total,base,pnl,roi:base?pnl/base:0,lev:equity?notional/equity:0,positions:pos};
}

// 收益曲线：portfolio 的 day/week/month/allTime（全账户净值）合并去重；perp* 系列只含合约保证金部分，不能用，只保留起点之后，扣掉每个时点前的累计净转入。
function curve(portfolio,{start,capital,ledger,account,now,equity}){
 const m=new Map();
 for(const [k,v] of portfolio||[])if(!k.startsWith('perp'))for(const [t,val] of v?.accountValueHistory||[])if(t>=start)m.set(t,num(val));
 if(now&&equity!=null)m.set(now,equity);
 const flows=netFlow(ledger,account,start).items;
 const pts=[[start,0]];
 for(const [t,val] of [...m.entries()].sort((a,b)=>a[0]-b[0])){
  const inflow=flows.filter(([ft])=>ft<=t).reduce((s,[,v])=>s+v,0);
  pts.push([t,val-capital-inflow]);
 }
 return pts;
}

// 北京时间日界：某日 'YYYY-MM-DD' 结束时刻（次日 00:00 +08）
const dayEnd=d=>Date.parse(d+'T00:00:00+08:00')+86400000;

// 日线固化（copy-data/daily.json）+ 实时：曲线主体用每日收盘累计收益，最后一个收盘之后接 HL 采样点和实时点。
function withDaily(daily,pts){
 const rows=daily?.rows||[];if(!rows.length)return pts;
 const cut=dayEnd(rows.at(-1).d);
 return [pts[0],...rows.map(r=>[dayEnd(r.d),r.cum]),...pts.slice(1).filter(([t])=>t>cut)];
}

// 日收益表：已固化的日子 + 今日（进行中，按实时数据算）。收益率 = 当日收益 ÷（前日净值 + 当日净转入）。
function dailyTable(daily,{equity,fills,funding,ledger,account,capital,now}){
 const rows=(daily?.rows||[]).map((r,i,a)=>{const prev=i?a[i-1].equity:capital;return {...r,roi:prev+r.flow?r.pnl/(prev+r.flow):0,live:false};});
 const last=rows.at(-1),from=last?dayEnd(last.d):null;
 if(from!=null&&now>=from){
  const f=(fills||[]).filter(x=>x.time>=from),fu=(funding||[]).filter(x=>x.time>=from),flow=netFlow(ledger,account,from).total,pnl=equity-last.equity-flow;
  const d=new Date(now+8*3600000).toISOString().slice(0,10);
  rows.push({d,equity,pnl,roi:last.equity+flow?pnl/(last.equity+flow):0,flow,closed:f.reduce((s,x)=>s+num(x.closedPnl),0),fees:f.reduce((s,x)=>s+num(x.fee),0),
   funding:fu.reduce((s,x)=>s+num(x.delta?.usdc),0),fills:f.length,volume:f.reduce((s,x)=>s+num(x.px)*num(x.sz),0),cum:last.cum+pnl,live:true});
 }
 return rows.reverse();
}

// 成交展示：按时间倒序；方向文字直接用 HL 的 dir（Open Long / Close Short ...）。
function trades(fills,start){
 return (fills||[]).filter(x=>x.time>=start).map(x=>({time:x.time,coin:x.coin,side:x.side==='B'?'buy':'sell',dir:x.dir,
  px:num(x.px),sz:num(x.sz),value:num(x.px)*num(x.sz),fee:num(x.fee),closed:num(x.closedPnl),hash:x.hash})).sort((a,b)=>b.time-a.time);
}

// 累计成交额/成交数：有日线时用日线逐日累加（含今日进行中行），不受 userFillsByTime 单次 2000 条上限影响；还没有日线时用起点后的 fills。
function totals(days,sum){
 if(!days?.length)return {volume:sum.volume,fills:sum.trades};
 return {volume:days.reduce((s,r)=>s+num(r.volume),0),fills:days.reduce((s,r)=>s+num(r.fills),0)};
}

const api={netFlow,positions,summarize,curve,trades,dayEnd,withDaily,dailyTable,totals};
if(typeof module!=='undefined')module.exports=api;else root.CopyCore=api;
})(globalThis);
