// BTC 数据页：计算口径、历史固定、增量合并、导航位置、词条齐全。
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const C=require('./btc-core.js');

// 回撤：对截至当日的最高价
const mk=(n,f)=>Array.from({length:n},(_,i)=>[C.date(C.time('2020-01-01')+i*C.DAY),...f(i)]);
let d=C.derive([['2020-01-01',100,1000,2],['2020-01-02',150,1500,2],['2020-01-03',75,750,1]]);
assert.equal(d[0].dd,0);assert.equal(d[1].dd,0);assert.equal(d[2].dd,-0.5);assert.equal(d[2].athDate,'2020-01-02');
assert.equal(d[0].realized,500);assert.equal(d[2].realized,750);
assert.equal(d[0].z,null,'预热期不出 Z');

// Z：截至当日总体标准差，与朴素计算一致
const rows=mk(800,i=>[10+i,1e9+i*1e7+(i%7)*3e6,1+(i%11)/10]);
d=C.derive(rows);
for(const i of [365,500,799]){
 const m=rows.slice(0,i+1).map(r=>r[2]),mean=m.reduce((a,b)=>a+b)/m.length,sd=Math.sqrt(m.reduce((a,b)=>a+(b-mean)**2,0)/m.length);
 const r=rows[i];assert.ok(Math.abs(d[i].z-(r[2]-r[2]/r[3])/sd)<1e-9,'z@'+i);
}
assert.equal(d[364].z,null);

// 历史固定：追加新数据不改写旧点
const more=C.derive([...rows,...mk(900,i=>[1e5,9e12,4]).slice(800)]);
for(let i=0;i<800;i++){assert.equal(more[i].z,d[i].z);assert.equal(more[i].dd,d[i].dd);}

// 区间
assert.equal(C.zone(-0.1),'under');assert.equal(C.zone(2),'neutral');assert.equal(C.zone(5),'warm');assert.equal(C.zone(7),'hot');assert.equal(C.zone(null),null);

// parse：过滤无效、超过 end 的日期
const p=C.parse({data:[{time:'2020-01-04T00:00:00.000000000Z',PriceUSD:'1',CapMrktCurUSD:'2',CapMVRVCur:'3'},{time:'2020-01-05T00:00:00Z',PriceUSD:'x',CapMrktCurUSD:'2',CapMVRVCur:'3'},{time:'2020-01-09T00:00:00Z',PriceUSD:'1',CapMrktCurUSD:'2',CapMVRVCur:'3'}]},'2020-01-08');
assert.deepEqual(p,[['2020-01-04',1,2,3]]);
assert.throws(()=>C.parse({},'2020-01-01'));

// merge：归档优先、只追加连续日、断档即停
const seedRows=[['2020-01-01',1,1,1],['2020-01-02',2,2,2]];
const m=C.merge(seedRows,[['2020-01-02',9,9,9],['2020-01-04',4,4,4],['2020-01-03',3,3,3],['2020-01-06',6,6,6],['2020-01-05',0,5,5]]);
assert.deepEqual(m.map(r=>r[0]),['2020-01-01','2020-01-02','2020-01-03','2020-01-04']);
assert.equal(m[1][1],2,'不覆盖归档');
assert.equal(seedRows.length,2,'不修改原数组');
assert.equal(C.yesterday(Date.parse('2026-10-17T00:30:00Z')),'2026-10-16');

// 固化档案：连续、有效，最新值和 Coin Metrics 对得上
const seed=JSON.parse(fs.readFileSync('btc-data/btc.json','utf8'));
assert.equal(seed.first,'2010-07-18');assert.equal(seed.rows.at(-1)[0],seed.last);
for(let i=1;i<seed.rows.length;i++)assert.equal(C.time(seed.rows[i][0])-C.time(seed.rows[i-1][0]),C.DAY,'连续 '+seed.rows[i][0]);
assert.ok(seed.rows.every(r=>r.slice(1).every(x=>x>0)));
const sd=C.derive(seed.rows),last=sd.at(-1);
assert.ok(last.z>-2&&last.z<12,'最新 Z 合理');
const y2017=sd.find(r=>r.date==='2017-12-16');assert.ok(y2017.z>7,'2017 顶部在过热区');
const y2018=sd.find(r=>r.date==='2018-12-15');assert.ok(y2018.z<0,'2018 底部在低估区');

// 市值占比：按天铺满，缺日留 null，接上 BTC 价格
const dom=C.dominance([['2020-01-01',60,1000],['2020-01-03',61,1100],['2020-01-04',150,1]],[{date:'2020-01-01',price:7,mcap:600},{date:'2020-01-03',price:8,mcap:671}]);
assert.deepEqual(dom.map(r=>r.date),['2020-01-01','2020-01-02','2020-01-03','2020-01-04']);
assert.equal(dom[1].dom,null);assert.equal(dom[2].price,8);assert.equal(dom[3].dom,null,'无效值不画');
assert.deepEqual(C.dominance([],[]),[]);assert.deepEqual(C.dominance(undefined,[]),[]);
const ds=JSON.parse(fs.readFileSync('btc-data/dominance.json','utf8'));
assert.equal(ds.cols.join(),'date,btcDominance,totalMarketCap');
assert.ok(ds.archiveLast>='2026-10-16'&&ds.rows[0][0]<='2013-05-01');
for(let i=1;i<ds.rows.length;i++)assert.ok(ds.rows[i][0]>ds.rows[i-1][0],'递增 '+ds.rows[i][0]);
assert.ok(ds.rows.every(r=>r[1]>0&&r[1]<100&&r[2]>0));
const low=ds.rows.reduce((a,b)=>b[1]<a[1]?b:a);assert.ok(low[0].startsWith('2018-01')&&low[1]<35,'2018-01 低点');

// 分位：线性插值，跳过 null；默认全部历史，可选最近 N 天
assert.equal(C.quantile([1,2,3,4,5],.5),3);assert.equal(C.quantile([1,2,3,4],.2),1.6);assert.equal(C.quantile([null,NaN],.5),null);
const bs=Array.from({length:400},(_,i)=>({date:C.date(C.time('2020-01-01')+i*C.DAY),v:i<35?1e9:(i===100?null:i)}));
const bb=C.band(bs,'v',365);assert.equal(bb.n,364);assert.equal(bb.from,'2020-02-05');assert.equal(bb.p50,217.5);
const ba=C.band(bs,'v');assert.equal(ba.n,399);assert.equal(ba.from,'2020-01-01');
assert.equal(C.band(sd,'z').from,sd[C.Z_WARMUP].date,'样本起点 = 第一个有效 Z');
const zb=C.band(sd,'z');assert.ok(zb.p20<zb.p50&&zb.p50<zb.p80&&zb.n===sd.length-C.Z_WARMUP);
// 全历史分位：严格低于当前值的占比
const rk=C.rank([{date:'a',v:1},{date:'b',v:3},{date:'c',v:null},{date:'d',v:2}],'v');
assert.equal(rk.date,'d');assert.equal(rk.value,2);assert.ok(Math.abs(rk.rank-100/3)<1e-9);assert.equal(rk.n,3);
assert.equal(C.rank([{date:'a',v:null}],'v'),null);
const zr=C.rank(sd,'z');assert.ok(zr.rank>=0&&zr.rank<=100&&zr.n===sd.length-C.Z_WARMUP);
const ov=fs.readFileSync('btc-overview.html','utf8');
assert.ok(ov.includes('id="btc-list"')&&ov.includes('dca-core.js')&&ov.includes('btc.js'),'总览页依赖');

// 导航：BTC 数据下拉在 PE 监控后、Hype监控前，含 4 个子页；btc.html 跳转到回撤页
const sub=['btc-overview.html','btc-mvrv.html','btc-drawdown.html','btc-dominance.html','btc-mcap.html'];
for(const pg of [...sub,'dashboard.html','valuation.html','hype-pe.html','uni-pe.html','bnb-pe.html','aave-pe.html','pe-list.html','battlefield/index.html']){
 const h=fs.readFileSync(pg,'utf8'),pe=h.indexOf('data-i18n="nav.pe"'),btc=h.indexOf('data-i18n="nav.btc"'),hy=h.indexOf('data-i18n="nav.hype"');
 assert.ok(pe>0&&pe<btc&&btc<hy,pg+' 导航顺序');
 const pre=pg.startsWith('battlefield')?'../':'';
 let at=btc;for(const s of sub){const i=h.indexOf('href="'+pre+s+'"',at);assert.ok(i>at&&i<hy,pg+' 菜单含 '+s);at=i;}
 assert.equal((h.match(/data-i18n="nav\.btc"/g)||[]).length,1,pg);
 if(sub.includes(pg)){
  assert.equal((h.match(/class="btc-chart"/g)||[]).length,pg==='btc-overview.html'?0:1,pg+' 单图');
  assert.match(h,new RegExp('<a href="'+pg+'" class="active" aria-current="page"'),pg+' 当前项高亮');
  assert.match(h,/details class="nav-pe nav-btc active"/,pg);
 }
}
assert.match(fs.readFileSync('btc.html','utf8'),/location\.replace\('btc-overview\.html'/);

// 词条：页面用到的 key 中英都有
const ctx={document:{addEventListener(){}},window:{}};vm.createContext(ctx);
vm.runInContext(fs.readFileSync('i18n.js','utf8')+'\n'+fs.readFileSync('btc-i18n.js','utf8')+'\nthis.D=I18N_DICT;',ctx);
const keys=[...sub.map(p=>fs.readFileSync(p,'utf8')).join('').matchAll(/data-(?:i18n|btc-aria)="([^"]+)"/g)].map(x=>x[1]);
for(const k of keys)for(const l of ['zh','en'])assert.ok(ctx.D[l][k],l+' 缺词条 '+k);
console.log('PASS btc: drawdown, expanding Z, fixed history, merge, seed sanity, nav order, i18n ('+keys.length+' keys)');
// Live point: Z / MVRV / drawdown at the live price; realized cap = latest daily; daily rows untouched.
{const assert=require('node:assert/strict'),fs=require('node:fs'),C=require('./btc-core.js'),D=require('./dca-core.js');
 const raw=JSON.parse(fs.readFileSync('btc-data/btc.json','utf8')).rows,d=C.derive(raw),last=d.at(-1);
 for(const k of [0.6,0.9,1,1.2,2]){
  const p=last.price*k,w=C.withLive(raw,d,p,'01:23 UTC',Date.parse('2026-10-30T02:00:00Z')),l=w.at(-1);
  assert.equal(w.length,d.length+1);assert.deepEqual(w.slice(0,-1),d,'history unchanged');
  assert.equal(l.live,true);assert.equal(l.date,'2026-10-30');assert.equal(l.closeDate,last.date);assert.equal(l.at,'01:23 UTC');
  assert.ok(Math.abs(l.mcap-last.mcap*k)<1);assert.ok(Math.abs(l.realized-last.realized)/last.realized<1e-12);
  assert.ok(Math.abs(l.mvrv-last.mvrv*k)<1e-9);
  const ref=C.derive([...raw,['x',p,last.mcap*k,last.mcap*k/last.realized]]).at(-1);assert.ok(Math.abs(l.z-ref.z)<1e-12);
  assert.ok(k<=1?l.dd<=0:true);if(p>last.ath){assert.equal(l.dd,0);assert.equal(l.athDate,'2026-10-30');}
  const ev=D.btcEvaluate(w);assert.equal(ev.live,true);assert.equal(ev.tier,D.BTC_TIERS[D.btcTierIndex(l.z)]);
  const h=D.btcPanel(w,z=>z);assert.ok(h.includes('dca-ratio">'+D.actionText(ev.tier,z=>z)+'<'));assert.match(h,/实时价 \$/);assert.match(h,/日线截至 /);
 }
 for(const bad of [null,0,NaN,-1])assert.equal(C.withLive(raw,d,bad),d,'invalid price -> daily rows');
 assert.match(D.btcPanel(d,z=>z),/数据日 /);
 console.log('PASS btc live point (Z/MVRV/drawdown at live price, history unchanged, fallback)');}
