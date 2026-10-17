/* BTC 数据页纯计算（无浏览器依赖，node 测试直接加载）。
   行格式：[date 'YYYY-MM-DD', price USD, market cap USD, MVRV]，UTC 日线，Coin Metrics 社区版。
   历史固定：每天的指标只用截至当天的数据，后续新数据不会改写过去的值。 */
(function(root){
'use strict';
const DAY=86400000;
const date=t=>new Date(t).toISOString().slice(0,10),time=d=>Date.parse(d+'T00:00:00Z');
const yesterday=(now=Date.now())=>date(Math.floor(now/DAY)*DAY-DAY);
const pos=x=>typeof x==='number'&&Number.isFinite(x)&&x>0;
// Z-Score 前 365 天样本太少（2010 年可到 30+），不输出，避免把全历史坐标轴压扁。
const Z_WARMUP=365;

// Coin Metrics 响应 → 行；只收连续、有效的完整 UTC 日（≤ end）。
function parse(resp,end){
 if(!resp||!Array.isArray(resp.data))throw Error('Coin Metrics 响应缺少 data');
 const out=[];
 for(const r of resp.data){
  const d=String(r.time||'').slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||d>end)continue;
  const p=+r.PriceUSD,m=+r.CapMrktCurUSD,v=+r.CapMVRVCur;
  if(!(pos(p)&&pos(m)&&pos(v)))continue;
  out.push([d,p,m,v]);
 }
 return out;
}

// 归档行优先，增量只追加 seed.last 之后、与前一行日期连续的部分（遇断档即停）。
function merge(seedRows,extra){
 const rows=seedRows.slice();
 const sorted=(extra||[]).filter(r=>Array.isArray(r)&&r.length===4&&r.slice(1).every(pos)).sort((a,b)=>a[0]<b[0]?-1:1);
 for(const r of sorted){
  const last=rows.at(-1)[0];
  if(r[0]<=last)continue;
  if(time(r[0])-time(last)!==DAY)break;
  rows.push(r);
 }
 return rows;
}

// 派生指标：回撤（对截至当日的最高价）、已实现市值 = 市值 / MVRV、
// Z = (市值 − 已实现市值) / 截至当日市值的总体标准差（累计，Welford）。
function derive(rows){
 let ath=0,athDate=null,n=0,mean=0,m2=0;
 return rows.map(([d,price,mcap,mvrv],i)=>{
  if(price>ath){ath=price;athDate=d;}
  n++;const delta=mcap-mean;mean+=delta/n;m2+=delta*(mcap-mean);
  const sd=Math.sqrt(m2/n),realized=mcap/mvrv;
  return {date:d,price,mcap,mvrv,realized,ath,athDate,dd:price/ath-1,
   z:i>=Z_WARMUP&&sd>0?(mcap-realized)/sd:null};
 });
}

// Z-Score 区间，阈值沿用常见读法（<0 低估，>7 过热）。
function zone(z){
 if(z==null)return null;
 return z<0?'under':z<3?'neutral':z<7?'warm':'hot';
}

// 市值占比序列：按天铺满 [首日, 末日]，缺的日子为 null（不插值）；按日期接上 BTC 价格、市值。
function dominance(domRows,derived){
 if(!Array.isArray(domRows)||!domRows.length)return [];
 const byDay=new Map(domRows.filter(r=>Array.isArray(r)&&r[1]>0&&r[1]<100&&r[2]>0).map(r=>[r[0],r]));
 const btc=new Map((derived||[]).map(r=>[r.date,r])),out=[];
 for(let t=time(domRows[0][0]);t<=time(domRows.at(-1)[0]);t+=DAY){
  const d=date(t),r=byDay.get(d),b=btc.get(d);
  out.push({date:d,dom:r?r[1]:null,total:r?r[2]:null,price:b?.price??null,mcap:b?.mcap??null});
 }
 return out;
}

const api={DAY,date,time,yesterday,parse,merge,derive,zone,dominance,Z_WARMUP};
if(typeof module!=='undefined')module.exports=api;else root.BTCCore=api;
})(globalThis);
