/* UNI presentation-only dailyRevenue breakdown. Never an input to PECore. */
(function(root){
'use strict';
const DAY=86400000,valid=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
const main=['Ethereum','Arbitrum','Robinhood Chain','Base','Polygon'];
const date=t=>new Date(t).toISOString().slice(0,10);
function parse(data,end){
 if(data.id!=='parent#uniswap'||!Array.isArray(data.totalDataChartBreakdown))throw Error('Invalid UNI breakdown');
 const out={};for(const [ts,raw] of data.totalDataChartBreakdown){
  if(!Number.isInteger(ts)||ts%86400||!raw||typeof raw!=='object'||Array.isArray(raw))continue;
  const d=date(ts*1000);if(d>end)continue;if(Object.hasOwn(out,d))throw Error('Duplicate chain date');
  const chains={};for(const [chain,versions] of Object.entries(raw)){
   const values=versions&&typeof versions==='object'&&!Array.isArray(versions)?Object.values(versions):[];
   chains[chain]=values.length&&values.every(valid)?values.reduce((a,b)=>a+b,0):null;
  }out[d]=chains;
 }return out;
}
function total(chains){const vs=Object.values(chains||{});return vs.length&&vs.every(valid)?vs.reduce((a,b)=>a+b,0):null;}
function group(chains,key){if(key!=='Others')return valid(chains?.[key])?chains[key]:null;const vs=Object.entries(chains||{}).filter(([k])=>!main.includes(k)).map(([,v])=>v);return vs.length&&vs.every(valid)?vs.reduce((a,b)=>a+b,0):null;}
function summary(data,end){
 const days=Array.from({length:30},(_,i)=>date(Date.parse(end+'T00:00:00Z')-i*DAY));
 const names=[...new Set(days.flatMap(d=>Object.keys(data[d]||{})))].sort();
 const covered=days.filter(d=>valid(total(data[d])));const sum=covered.reduce((s,d)=>s+total(data[d]),0);
 return {covered:covered.length,sum,rows:names.map(name=>{const ds=covered.filter(d=>valid(data[d][name]));const value=ds.reduce((s,d)=>s+data[d][name],0);return {name,value,days:ds.length,share:sum>0?value/sum:null};})};
}
const api={parse,total,group,summary,main,valid};if(typeof module!=='undefined')module.exports=api;else root.PEChains=api;
})(globalThis);
