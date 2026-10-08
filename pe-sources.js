/* HYPE dailyHoldersRevenue presentation only; never passed to PECore. */
(function(root){
'use strict';
const keys=['Hyperliquid Perps','Hyperliquid Spot Orderbook'],valid=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
const date=t=>new Date(t).toISOString().slice(0,10);
function parse(data,end){
 if(data.id!=='parent#hyperliquid'||!Array.isArray(data.totalDataChartBreakdown))throw Error('Invalid HYPE breakdown');
 const out={};for(const [ts,raw] of data.totalDataChartBreakdown){
  if(!Number.isInteger(ts)||ts%86400||!raw||typeof raw!=='object')continue;
  const d=date(ts*1000);if(d>end)continue;if(Object.hasOwn(out,d))throw Error('Duplicate source date');
  const values=raw['Hyperliquid L1'];out[d]=Object.fromEntries(keys.map(k=>[k,valid(values?.[k])?values[k]:null]));
  // Unexpected chains/components must not silently disappear from reconciliation.
  if(Object.keys(raw).some(k=>k!=='Hyperliquid L1')||Object.keys(values||{}).some(k=>!keys.includes(k)))out[d].unexpected=null;
 }return out;
}
function total(row){return row&&keys.every(k=>valid(row[k]))&&!Object.hasOwn(row,'unexpected')?keys.reduce((s,k)=>s+row[k],0):null;}
function summary(data,end){
 const ds=Array.from({length:30},(_,i)=>date(Date.parse(end+'T00:00:00Z')-i*86400000)),days=ds.filter(d=>valid(total(data[d]))),sum=days.reduce((s,d)=>s+total(data[d]),0);
 return {covered:days.length,sum,rows:keys.map(name=>{const value=days.reduce((s,d)=>s+data[d][name],0);return {name,value,share:sum>0?value/sum:null,days:days.length};})};
}
const api={keys,valid,parse,total,summary};if(typeof module!=='undefined')module.exports=api;else root.PESources=api;
})(globalThis);
