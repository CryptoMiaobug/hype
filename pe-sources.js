/* HYPE dailyHoldersRevenue presentation only; never passed to PECore. */
(function(root){
'use strict';
// Perps + Spot are required every day. Outcomes (HIP-4) is optional: DefiLlama only reports it from 2026-05 and
// its absence means the product had no reported series that day, so it does not void the day; a present but invalid value does.
const required=['Hyperliquid Perps','Hyperliquid Spot Orderbook'],optional=['Hyperliquid Outcomes'],keys=[...required,...optional],valid=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
const date=t=>new Date(t).toISOString().slice(0,10);
function parse(data,end){
 if(data.id!=='parent#hyperliquid'||!Array.isArray(data.totalDataChartBreakdown))throw Error('Invalid HYPE breakdown');
 const out={};for(const [ts,raw] of data.totalDataChartBreakdown){
  if(!Number.isInteger(ts)||ts%86400||!raw||typeof raw!=='object')continue;
  const d=date(ts*1000);if(d>end)continue;if(Object.hasOwn(out,d))throw Error('Duplicate source date');
  const values=raw['Hyperliquid L1'];out[d]=Object.fromEntries(keys.filter(k=>required.includes(k)||Object.hasOwn(values||{},k)).map(k=>[k,valid(values?.[k])?values[k]:null]));
  // Unexpected chains/components must not silently disappear from reconciliation.
  if(Object.keys(raw).some(k=>k!=='Hyperliquid L1')||Object.keys(values||{}).some(k=>!keys.includes(k)))out[d].unexpected=null;
 }return out;
}
function total(row){if(!row||Object.hasOwn(row,'unexpected')||!required.every(k=>valid(row[k]))||optional.some(k=>Object.hasOwn(row,k)&&!valid(row[k])))return null;return keys.reduce((s,k)=>s+(row[k]??0),0);}
function summary(data,end){
 const ds=Array.from({length:30},(_,i)=>date(Date.parse(end+'T00:00:00Z')-i*86400000)),days=ds.filter(d=>valid(total(data[d]))),sum=days.reduce((s,d)=>s+total(data[d]),0);
 return {covered:days.length,sum,rows:keys.map(name=>{const has=days.filter(d=>Object.hasOwn(data[d],name)),value=has.reduce((s,d)=>s+data[d][name],0);return {name,value,share:sum>0&&has.length?value/sum:null,days:has.length};})};
}
const api={keys,required,optional,valid,parse,total,summary};if(typeof module!=='undefined')module.exports=api;else root.PESources=api;
})(globalThis);
