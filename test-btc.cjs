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

// 导航：BTC 数据下拉在 PE 监控后、Hype监控前，含 4 个子页；btc.html 跳转到回撤页
const sub=['btc-drawdown.html','btc-mvrv.html','btc-mcap.html','btc-dominance.html'];
for(const pg of [...sub,'dashboard.html','valuation.html','hype-pe.html','uni-pe.html','bnb-pe.html','aave-pe.html','pe-list.html','battlefield/index.html']){
 const h=fs.readFileSync(pg,'utf8'),pe=h.indexOf('data-i18n="nav.pe"'),btc=h.indexOf('data-i18n="nav.btc"'),hy=h.indexOf('data-i18n="nav.hype"');
 assert.ok(pe>0&&pe<btc&&btc<hy,pg+' 导航顺序');
 const pre=pg.startsWith('battlefield')?'../':'';
 let at=btc;for(const s of sub){const i=h.indexOf('href="'+pre+s+'"',at);assert.ok(i>at&&i<hy,pg+' 菜单含 '+s);at=i;}
 assert.equal((h.match(/data-i18n="nav\.btc"/g)||[]).length,1,pg);
 if(sub.includes(pg)){
  assert.equal((h.match(/class="btc-chart"/g)||[]).length,1,pg+' 单图');
  assert.match(h,new RegExp('<a href="'+pg+'" class="active" aria-current="page"'),pg+' 当前项高亮');
  assert.match(h,/details class="nav-pe nav-btc active"/,pg);
 }
}
assert.match(fs.readFileSync('btc.html','utf8'),/location\.replace\('btc-drawdown\.html'/);

// 词条：页面用到的 key 中英都有
const ctx={document:{addEventListener(){}},window:{}};vm.createContext(ctx);
vm.runInContext(fs.readFileSync('i18n.js','utf8')+'\n'+fs.readFileSync('btc-i18n.js','utf8')+'\nthis.D=I18N_DICT;',ctx);
const keys=[...sub.map(p=>fs.readFileSync(p,'utf8')).join('').matchAll(/data-(?:i18n|btc-aria)="([^"]+)"/g)].map(x=>x[1]);
for(const k of keys)for(const l of ['zh','en'])assert.ok(ctx.D[l][k],l+' 缺词条 '+k);
console.log('PASS btc: drawdown, expanding Z, fixed history, merge, seed sanity, nav order, i18n ('+keys.length+' keys)');
