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

// 成交展示：按时间倒序；方向文字直接用 HL 的 dir（Open Long / Close Short ...）。
function trades(fills,start){
 return (fills||[]).filter(x=>x.time>=start).map(x=>({time:x.time,coin:x.coin,side:x.side==='B'?'buy':'sell',dir:x.dir,
  px:num(x.px),sz:num(x.sz),value:num(x.px)*num(x.sz),fee:num(x.fee),closed:num(x.closedPnl),hash:x.hash})).sort((a,b)=>b.time-a.time);
}

const api={netFlow,positions,summarize,curve,trades};
if(typeof module!=='undefined')module.exports=api;else root.CopyCore=api;
})(globalThis);
