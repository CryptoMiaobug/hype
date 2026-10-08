/* Pure UTC calculations; bundled observations always win over browser cache/API. */
(function(root){
'use strict';
const DAY=86400000, valid=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
const date=t=>new Date(t).toISOString().slice(0,10), time=d=>Date.parse(d+'T00:00:00Z');
function yesterday(now=Date.now()){return date(Math.floor(now/DAY)*DAY-DAY);}
function revenue(data, end){
 if(!Array.isArray(data.totalDataChart))throw Error('收入响应缺少日序列');
 const out={}; for(const [t,v] of data.totalDataChart){if(!Number.isInteger(t)||t%86400)continue;const d=date(t*1000);if(d>end)continue;if(Object.hasOwn(out,d))throw Error('收入日期重复');out[d]=valid(v)?v:null;}return out;
}
function market(data,end){
 if(!Array.isArray(data.prices)||!Array.isArray(data.market_caps))throw Error('行情响应缺少序列');
 const caps=new Map();for(const [t,v] of data.market_caps){if(caps.has(t))throw Error('市值时间戳重复');caps.set(t,v);}
 const seen=new Set(),out={};for(const [t,p] of data.prices){if(seen.has(t))throw Error('价格时间戳重复');seen.add(t);if(!Number.isInteger(t)||t%DAY)continue;const d=date(t-DAY),m=caps.get(t);if(d<=end&&valid(p)&&p>0&&valid(m)&&m>0)out[d]=[p,m];}return out;
}
function merge(base, extra){const out={...base};for(const [k,v] of Object.entries(extra))if(out[k]==null&&v!=null)out[k]=v;return out;}
function calculate(seed,rev,prices,end){
 const rows=seed.rows.map(r=>({...r}));let supply=rows.at(-1).supply;
 for(let t=time(seed.last)+DAY;t<=time(end);t+=DAY){
  const d=date(t),pm=prices[d];let sum=0,missing=0;
  for(let i=0;i<30;i++){const v=rev[date(t-i*DAY)];if(!valid(v))missing++;else sum+=v;}
  const annual=missing?null:sum*365/30;
  if(seed.asset==='hype')supply=seed.fixedSupply;
  else if(supply!=null&&valid(rev[d])&&pm)supply-=rev[d]/pm[0];else supply=null;
  if(supply!=null&&supply<0)supply=null;
  rows.push({date:d,price:pm?.[0]??null,mcap:pm?.[1]??null,r30:missing?null:sum,annual,circ:annual>0&&pm?pm[1]/annual:null,full:annual>0&&pm&&supply!=null?supply*pm[0]/annual:null,supply,status:missing?'收入窗口缺 '+missing+' 天':!pm?'缺价格/市值':annual===0?'零分母':'ok',source:'browser'});
 }return rows;
}
const api={DAY,valid,date,time,yesterday,revenue,market,merge,calculate};if(typeof module!=='undefined')module.exports=api;else root.PECore=api;
})(globalThis);
