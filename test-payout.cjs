// Payout ratio (actual holder payout ÷ protocol revenue): core math, bundled data, overview + coin-page panel.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const P=require('./payout-core.js'),PC=require('./pe-core.js'),D=require('./dca-core.js'),BC=require('./bnb-core.js');
const S=JSON.parse(fs.readFileSync('pe-data/payout.json')),B=JSON.parse(fs.readFileSync('pe-data/bnb.json'));
let n=0;const test=(name,f)=>{f();console.log('PASS',name);n++;};
test('window: sums, missing day -> NA (not zero), zero revenue -> NA',()=>{
 const rev={'2026-01-01':100,'2026-01-02':300},hold={'2026-01-01':10,'2026-01-02':30};
 assert.deepEqual(P.window(rev,hold,'2026-01-02',2),{days:2,end:'2026-01-02',rev:400,hold:40,ratio:0.1,missing:0});
 assert.equal(P.window(rev,{'2026-01-02':30},'2026-01-02',2).ratio,null);
 assert.equal(P.window({'2026-01-01':0},{'2026-01-01':0},'2026-01-01',1).ratio,null);});
test('summary clamps to last day with both series and flags pause <10%',()=>{
 const rev={},hold={};for(let i=0;i<30;i++){const d=PC.date(PC.time('2026-01-30')-i*PC.DAY);rev[d]=100;hold[d]=5;}rev['2026-01-31']=100;
 const s=P.summary({revenue:rev,holders:hold},'2026-01-31');assert.equal(s.end,'2026-01-30');assert.equal(s.w30.ratio,0.05);assert.equal(s.paused,true);assert.equal(s.annual30,150*365/30);});
test('bundled snapshot: HYPE/UNI ≈100%, AAVE 30d 0% paused and 1y 15–30%',()=>{
 for(const k of ['hype','uni']){const s=P.summary(S.assets[k],S.last);assert.ok(Math.abs(s.w30.ratio-1)<0.01,k);assert.ok(Math.abs(s.w365.ratio-1)<0.01,k);assert.equal(s.paused,false);}
 const a=P.summary(S.assets.aave,S.last);assert.equal(a.w30.ratio,0);assert.equal(a.paused,true);assert.equal(a.annual30,0);assert.ok(a.w365.ratio>0.15&&a.w365.ratio<0.3,a.w365.ratio);
 assert.equal(S.assets.aave.llamaId,'parent#aave');});
test('AAVE payout revenue equals PE-seed revenue on overlapping days',()=>{const A=JSON.parse(fs.readFileSync('pe-data/aave.json'));let k=0;for(const [d,v] of Object.entries(A.revenue))if(S.assets.aave.revenue[d]!=null){assert.equal(S.assets.aave.revenue[d],v,d);k++;}assert.ok(k>300);});
test('monthly: newest first, ratio NA when month has gaps',()=>{const m=P.monthly(S.assets.aave,S.last,13);assert.equal(m.length,13);assert.ok(m[0].month>m[1].month);assert.equal(m[0].month,S.last.slice(0,7));assert.equal(P.monthly({revenue:{'2026-01-01':1,'2026-01-02':1},holders:{'2026-01-01':1}},'2026-01-31')[0].ratio,null);});
test('BNB split: gas 100%, shares add to 1, Auto-Burn dominates',()=>{const b=P.bnb(B.rows.at(-1));assert.equal(b.gasRatio,1);assert.ok(Math.abs(b.autoShare+b.gasShare-1)<1e-12);assert.ok(b.autoShare>0.9);assert.equal(P.bnb({annual:0,gas:0,quarterly:0}),null);});
test('parse rejects wrong id, keeps only complete days ≤ end',()=>{assert.throws(()=>P.parse({id:'parent#x',totalDataChart:[]},'parent#aave','2026-01-01'));assert.deepEqual(P.parse({id:'parent#aave',totalDataChart:[[PC.time('2026-01-01')/1000,5],[PC.time('2026-01-02')/1000,6],[PC.time('2026-01-01')/1000+5,9]]},'parent#aave','2026-01-01'),{'2026-01-01':5});});
(async()=>{
 // load: live fill only after seed.last, bundled values never overwritten; failure keeps bundle
 const next=PC.date(PC.time(S.last)+PC.DAY),ts=PC.time(next)/1000,old=PC.time(S.last)/1000;
 const fake=fail=>async u=>{if(u==='pe-data/payout.json')return JSON.parse(fs.readFileSync(u));if(fail)throw Error('offline');const id='parent#'+u.split('/fees/')[1].split('?')[0];return {id,totalDataChart:[[old,999999999],[ts,u.includes('Holders')?50:100]]};};
 let r=await P.load(fake(false),next);assert.equal(r.live,true);assert.equal(r.seed.assets.aave.revenue[next],100);assert.equal(r.seed.assets.aave.holders[next],50);assert.equal(r.seed.assets.aave.revenue[S.last],S.assets.aave.revenue[S.last]);
 r=await P.load(fake(true),next);assert.equal(r.live,false);assert.equal(r.seed.assets.aave.revenue[next],undefined);
 r=await P.load(fake(false),next,['aave']);assert.equal(r.seed.assets.hype.revenue[next],undefined);
 console.log('PASS load: live fill / offline / scoped');n++;
 // overview column, both languages, offline
 for(const lang of ['zh','en']){
  const nodes={},make=()=>({innerHTML:'',addEventListener(k,f){this['on'+k]=f}}),dict={zh:{},en:{}};
  const ctx={I18N_DICT:dict,DCACore:D,PayoutCore:P,PECore:{...PC,yesterday:()=>'2026-10-12'},BNBCore:{...BC,yesterday:()=>'2026-10-12'},document:{getElementById:id=>nodes[id]??=make()},localStorage:{getItem:()=>null},AbortSignal:{timeout(){}},location:{href:''},
   fetch:async u=>{if(u.startsWith('pe-data'))return {ok:true,json:async()=>JSON.parse(fs.readFileSync(u))};throw Error('offline')}};
  ctx.window={...ctx,I18n:{lang}};ctx.window.window=ctx.window;
  await vm.runInNewContext(fs.readFileSync('pe-list.js','utf8'),Object.assign(ctx,{window:ctx.window}));await new Promise(r=>setTimeout(r,50));
  const h=nodes['pe-list'].innerHTML,rows=h.split('<tr ').slice(1),row=id=>rows.find(r=>r.includes(id+'-pe.html'));
  assert.ok(row('hype').includes('<b>100.0%</b>'),'hype');assert.ok(row('uni').includes('<b>100.0%</b>'),'uni');
  assert.ok(row('aave').includes('<b>0.0%</b>')&&row('aave').includes('pl-flag'),'aave paused');assert.ok(/1Y |近1年 /.test(row('aave'))&&/20\.\d%/.test(row('aave')),'aave 1y');
  assert.ok(row('bnb').includes(lang==='en'?'N/A':'不适用')&&row('bnb').includes('Auto-Burn')&&!row('bnb').includes('Gas 100%'),'bnb n/a');
  for(const id of ['hype','uni','bnb'])assert.ok(!row(id).includes('pl-flag'),id);
  assert.equal(rows.every(r=>(r.match(/<td/g)||[]).length===11),true);
  if(lang==='en')assert.ok(!/[\u4e00-\u9fff]/.test(h));
  console.log('PASS overview payout column',lang);n++;
 }
 // coin-page panel
 for(const asset of ['aave','hype','uni','bnb'])for(const lang of ['zh','en']){
  const el={innerHTML:''},ctx={PayoutCore:P,PECore:{...PC,yesterday:()=>S.last},document:{body:{dataset:{asset}},getElementById:id=>id==='payout'?el:null},AbortSignal:{timeout(){}},
   fetch:async u=>{if(u.startsWith('pe-data'))return {ok:true,json:async()=>JSON.parse(fs.readFileSync(u))};throw Error('offline')}};
  ctx.window={...ctx,I18n:{lang}};ctx.window.window=ctx.window;
  await vm.runInNewContext(fs.readFileSync('payout-panel.js','utf8'),Object.assign(ctx,{window:ctx.window}));await new Promise(r=>setTimeout(r,30));
  const h=el.innerHTML;assert.ok(!/读取失败|Load failed|加载中|Loading/.test(h),asset+h.slice(0,200));
  if(asset==='bnb')assert.ok(h.includes(lang==='en'?'N/A':'不适用')&&h.includes('Auto-Burn')&&!h.includes('Gas-burn payout ratio')&&!h.includes('Gas 销毁回馈率'));
  else{assert.ok(h.includes('<tbody><tr>'));if(asset==='aave'){assert.ok(h.includes('pl-flag'));assert.ok(/(实际回馈 PE|Actual-payout PE)<\/div><div class="value">NA</.test(h));}else assert.ok(/(实际回馈 PE|Actual-payout PE)<\/div><div class="value">[\d,.]+ x/.test(h),asset);}
  if(lang==='en')assert.ok(!/[\u4e00-\u9fff]/.test(h),asset);
  ctx.window.onI18nChange();
 }
 console.log('PASS coin-page payout panel ×4 assets ×2 langs');n++;
 for(const p of ['hype-pe.html','uni-pe.html','aave-pe.html','bnb-pe.html']){const h=fs.readFileSync(p,'utf8');assert.ok(h.includes('id="payout"')&&h.includes('payout-core.js')&&h.includes('payout-panel.js'),p);}
 assert.match(fs.readFileSync('pe-list.html','utf8'),/payout-core\.js[^]*pe-list\.js/);
 // Coin-page section order: chart -> DCA -> (page extras) -> daily table -> payout -> method (last).
 for(const p of ['hype-pe.html','uni-pe.html','aave-pe.html','bnb-pe.html']){const h=fs.readFileSync(p,'utf8'),at=k=>h.indexOf(k);
  const o=[at('id="chart"'),at('id="dca"'),at('id="tbody"'),at('id="payout"'),at('pe-method')];assert.ok(o.every((v,i)=>v>0&&(i===0||v>o[i-1])),p+' '+o);
  assert.ok(h.lastIndexOf('<section')<at('pe-method'),p+' method last');}
 console.log('PASS page wiring');console.log(n+2+' tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
