// Weekly buy/sell plan: altcoin PE tiers (12 + buffer), BTC Z tiers (12), panels, pages.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const D=require('./dca-core.js'),PC=require('./pe-core.js'),BC=require('./bnb-core.js');
const rows=vals=>vals.map((v,i)=>({date:'d'+String(i).padStart(3,'0'),pe:v}));
const zh=(z)=>z,en=(z,e)=>e;

// --- Altcoin tiers on percentile rank (share strictly below current), lower bound inclusive.
assert.deepEqual(D.TIERS.map(t=>t.side+t.ratio),['buy300','buy200','buy150','buy125','buy100','buy75','buy50','buy25','sell2','sell3','sell5','sell8']);
for(const [rank,key] of [[0,'t300'],[9.99,'t300'],[10,'t200'],[39.9,'t125'],[40,'t100'],[69.9,'t50'],[70,'t25'],[79.99,'t25'],[80,'s2'],[84.9,'s2'],[85,'s3'],[90,'s5'],[95,'s8'],[100,'s8']])
 assert.equal(D.TIERS[D.tierIndex(rank)].key,key,String(rank));
// Real evaluate(): base = 1..99, cur appended last -> rank = #below/100.
const base=Array.from({length:99},(_,i)=>i+1);
for(const [cur,key] of [[0.5,'t300'],[10.5,'t200'],[50.5,'t75'],[70.5,'t25'],[80.5,'s2'],[85.5,'s3'],[90.5,'s5'],[95.5,'s8'],[1000,'s8']]){
 const r=D.evaluate(rows([...base].reverse().concat(cur)),"pe");assert.equal(r.tier.key,key,cur+" rank "+r.rank);assert.equal(r.buffer,false);}
// Default window = all rows; 365 = trailing year.
{const v=[...Array(400).fill(1000),...Array.from({length:100},(_,i)=>i+1)];
 assert.equal(D.evaluate(rows(v),'pe').n,500);assert.equal(D.evaluate(rows(v),'pe',365).n,365);assert.deepEqual(D.evaluate(rows(v),'pe'),D.evaluate(rows(v),'pe',0));}
assert.equal(D.evaluate(rows([null,null]),'pe'),null);
// Buffer: P70–P80 after P80+ (no dip below P70 since) -> pause; after a dip below P70 -> back to buy 25%.
{const hist=Array.from({length:100},(_,i)=>i);           // 0..99
 const viaHigh=D.evaluate(rows([...hist,95,75]),'pe');     // came down from ~P93
 assert.ok(viaHigh.rank>=70&&viaHigh.rank<80,String(viaHigh.rank));assert.equal(viaHigh.buffer,true);assert.equal(viaHigh.tier.key,'hold');assert.equal(viaHigh.base.key,'t25');
 const viaLow=D.evaluate(rows([...hist,95,50,75]),'pe');   // dipped below P70 in between
 assert.equal(viaLow.buffer,false);assert.equal(viaLow.tier.key,'t25');
 const fromBelow=D.evaluate(rows([...hist,75]),'pe');      // walked back: 99 (P80+) is reached before any <P70? no: 99 is last of hist
 assert.equal(fromBelow.buffer,true,'99 right before is P80+');
 const clean=D.evaluate(rows([...hist,60,75]),'pe');assert.equal(clean.buffer,false);}
// Gradient: each tier segment at its bounds.
{const g=D.gradient();for(const t of D.TIERS)assert.ok(g.includes(`${t.color} ${t.lo}% ${t.hi}%`),t.key);}

// --- BTC tiers on Z value.
assert.deepEqual(D.BTC_TIERS.map(t=>t.side+t.ratio),['buy300','buy200','buy150','buy100','buy50','buy25','hold0','sell0.5','sell1','sell2','sell5','sell10']);
for(const [z,key] of [[-1,'z300'],[-0.01,'z300'],[0,'z200'],[0.94,'z150'],[1,'z100'],[1.5,'z50'],[1.74,'z50'],[1.75,'z25'],[2,'zhold'],[2.49,'zhold'],[2.5,'zs05'],[3,'zs1'],[4.99,'zs2'],[5,'zs5'],[7,'zs10'],[12,'zs10']])
 assert.equal(D.BTC_TIERS[D.btcTierIndex(z)].key,key,String(z));
{const p=[-5,-1,0,2,2.5,7,8,20].map(D.btcPos);assert.equal(p[0],0);assert.equal(p[1],0);assert.ok(p.every((v,i)=>i===0||v>=p[i-1]));assert.equal(p.at(-1),100);}
assert.equal(D.btcEvaluate([{date:'a',z:null},{date:'b',z:null}]),null);
{const r=D.btcEvaluate([{date:'a',z:3,mvrv:2},{date:'b',z:null,mvrv:1}]);assert.equal(r.date,'a');assert.equal(r.tier.key,'zs1');}

// Badge contrast (WCAG >= 4.5) for every tier including hold.
{const L=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4);return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2];};
 for(const t of [...D.TIERS,D.HOLD,...D.BTC_TIERS]){const a=L(t.color),b=L(t.ink),r=(Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);assert.ok(r>=4.5,t.key+' '+r.toFixed(2));}}
{const v=[5,1,3,2,4];assert.equal(D.pct(v,0.5),3);assert.equal(D.pct(v,0.2),1.8);}
// Action text.
assert.equal(D.actionText(D.TIERS[0],zh),'买 300%');assert.equal(D.actionText(D.TIERS[10],en),'Sell 5%');assert.equal(D.actionText(D.HOLD,zh),'暂停');

// --- Panels: % only (no $), one highlighted rule, both languages.
{const h=D.panel(rows([...base].reverse().concat(50.5)),'pe',zh);assert.match(h,/买 75%/);assert.match(h,/每周买卖建议/);assert.equal((h.match(/<li /g)||[]).length,13);assert.ok(!h.includes('$'));assert.equal((h.match(/class="on"/g)||[]).length,1);
 assert.match(h,/不设底仓/);assert.ok(!/底仓即停/.test(h));
 const e=D.panel(rows([...base].reverse().concat(50.5)),'pe',en);assert.ok(!/[\u4e00-\u9fff]/.test(e),e.match(/[^<>]*[\u4e00-\u9fff][^<>]*/)?.[0]);assert.match(D.panel([],'pe',zh),/有效 PE 不足/);
 const s=D.panel(rows([...base].reverse().concat(95.5)),'pe',zh);assert.match(s,/卖 8%/);assert.match(s,/初始仓位/);
 const b=D.panel(rows([...Array.from({length:100},(_,i)=>i),95,75]),'pe',zh);assert.match(b,/dca-ratio">暂停/);assert.equal((b.match(/class="on"/g)||[]).length,1);}
{const BT=require('./btc-core.js'),seed=JSON.parse(fs.readFileSync('btc-data/btc.json')),d=BT.derive(seed.rows);
 const r=D.btcEvaluate(d);console.log('PASS btc',r.date,'Z',r.z.toFixed(2),D.actionText(r.tier,zh));
 const h=D.btcPanel(d,zh);assert.equal((h.match(/<li /g)||[]).length,12);assert.equal((h.match(/class="on"/g)||[]).length,1);assert.ok(!h.includes('$'));assert.match(h,/MVRV Z-Score/);
 const e=D.btcPanel(d,en);assert.ok(!/[\u4e00-\u9fff]/.test(e),e.match(/[^<>]*[\u4e00-\u9fff][^<>]*/)?.[0]);
 assert.match(D.btcPanel([],zh),/暂无 Z 值/);}

// Real archives (all-time default).
for(const [a,f] of [['hype','circ'],['uni','circ'],['bnb','pe'],['aave','circ']]){const s=JSON.parse(fs.readFileSync('pe-data/'+a+'.json'));const r=D.evaluate(s.rows,f);assert.ok(r.p20<=r.p50&&r.p50<=r.p80);console.log('PASS',a,r.date,r.pe.toFixed(2),'rank',r.rank.toFixed(0)+'%',D.actionText(r.tier,zh),r.buffer?'(buffer)':'');}
// Pages: each PE page has the panel slot and loads dca-core; BTC MVRV page has its panel slot.
for(const p of ['hype-pe.html','uni-pe.html','bnb-pe.html','aave-pe.html']){const s=fs.readFileSync(p,'utf8');assert.ok(s.includes('id="dca"')&&s.includes('dca-core.js'),p);}
{const s=fs.readFileSync('btc-mvrv.html','utf8');assert.ok(s.includes('id="btc-dca"')&&s.includes('dca-core.js')&&s.includes('dca.css'),'btc-mvrv');
 assert.ok(s.indexOf('dca-core.js')<s.indexOf('btc.js'),'dca-core before btc.js');}
assert.ok(!fs.existsSync('dca.html'));
// pe.js renders the panel into #dca (offline, bundled archive).
(async()=>{
 for(const asset of ['hype','uni']){
  const seed=JSON.parse(fs.readFileSync('pe-data/'+asset+'.json')),nodes={},make=()=>({children:[],textContent:'',innerHTML:'',append(x){this.children.push(x)},replaceChildren(...x){this.children=x}});
  const document={body:{dataset:{asset}},getElementById:id=>nodes[id]??=make(),querySelectorAll:()=>[],createElement:make};
  const ctx={PECore:{...PC,yesterday:()=>seed.last},DCACore:D,document,localStorage:{getItem:()=>null,setItem(){}},fetch:async u=>{if(u.startsWith('pe-data'))return {ok:true,json:async()=>seed};throw Error('offline')},AbortSignal:{timeout(){}},Blob,URL,setTimeout,console};
  ctx.window={addEventListener(){},DCACore:D};
  await vm.runInNewContext(fs.readFileSync('pe.js','utf8'),ctx);
  assert.match(nodes.dca.innerHTML,/每周买卖建议/);assert.match(nodes.dca.innerHTML,/data-dca-win="365" class="active"/);console.log('PASS pe.js panel',asset);
 }
})().catch(e=>{console.error(e);process.exit(1)});
// Coin-page toggle: default last 1 year; clicking stores the shared choice.
{const s=JSON.parse(fs.readFileSync('pe-data/bnb.json')).rows,h1=D.panel(s,'pe',zh,365),h0=D.panel(s,'pe',zh);
 assert.equal((h1.match(/data-dca-win=/g)||[]).length,2);assert.match(h1,/data-dca-win="365" class="active" aria-pressed="true"/);assert.match(h0,/data-dca-win="0" class="active" aria-pressed="true"/);
 assert.ok(h1.includes('近1年分位 '+Math.round(D.evaluate(s,'pe',365).rank)+'%'));assert.ok(h0.includes('全部分位 '+Math.round(D.evaluate(s,'pe',0).rank)+'%'));assert.match(h0,/样本 2025-01-23 –/);assert.match(h0,/买 100%/);
 const store={m:{},getItem(k){return this.m[k]??null},setItem(k,v){this.m[k]=v}};let got;const el={addEventListener(_,f){this.f=f}};
 assert.equal(D.getWin(store),365,'default 1y');
 D.bindToggle(el,w=>got=w,store);el.f({target:{closest:()=>({dataset:{dcaWin:'365'}})}});assert.equal(got,365);assert.equal(D.getWin(store),365);
 el.f({target:{closest:()=>({dataset:{dcaWin:'0'}})}});assert.equal(got,0);assert.equal(D.getWin(store),0);assert.equal(D.getWin({getItem(){throw Error()}}),365);
 console.log('PASS coin-page window toggle');}
// pe.js stat cards: amounts >= 1M abbreviated (M/B), no long full figures.
(async()=>{
 for(const asset of ['hype','uni','aave']){
  const seed=JSON.parse(fs.readFileSync('pe-data/'+asset+'.json')),nodes={},make=()=>({children:[],textContent:'',innerHTML:'',append(x){this.children.push(x)},replaceChildren(...x){this.children=x}});
  const document={body:{dataset:{asset}},getElementById:id=>nodes[id]??=make(),querySelectorAll:()=>[],createElement:make};
  const ctx={PECore:{...PC,yesterday:()=>seed.last},DCACore:D,document,localStorage:{getItem:()=>null,setItem(){}},fetch:async u=>{if(u.startsWith('pe-data'))return {ok:true,json:async()=>seed};throw Error('offline')},AbortSignal:{timeout(){}},Blob,URL,setTimeout,console};
  ctx.window={addEventListener(){},DCACore:D};
  await vm.runInNewContext(fs.readFileSync('pe.js','utf8'),ctx);
  const vals=[...nodes.cards.innerHTML.matchAll(/class="value">([^<]*)</g)].map(m=>m[1]);
  assert.equal(vals.length,6,asset);
  for(const v of vals)assert.ok(!/\d{1,3}(,\d{3}){2,}/.test(v),asset+' long figure '+v);
  assert.match(vals[3],/^\$\d+(\.\d+)?[MB]$/,asset+' r30 '+vals[3]);assert.match(vals[4],/^\$\d+(\.\d+)?[MB]$/,asset+' annual '+vals[4]);assert.match(vals[5],/^\d+(\.\d+)?[MB]$/,asset+' supply '+vals[5]);
  console.log('PASS cards',asset,vals.join(' | '));
 }
})().catch(e=>{console.error(e);process.exit(1)});
// Live price: overview row and coin-page panel use the same liveEvaluate, so the tier is identical.
{const D=require('./dca-core.js'),fs=require('node:fs'),assert=require('node:assert/strict'),zh=z=>z;
 for(const [a,f] of [['hype','circ'],['uni','circ'],['bnb','pe'],['aave','circ']])for(const k of [0.7,0.9,1,1.1,1.3])for(const w of [365,0]){
  const rows=JSON.parse(fs.readFileSync('pe-data/'+a+'.json')).rows,close=D.evaluate(rows,f,w),q={price:rows.find(r=>r.date===close.date).price*k,chg24:null,at:0};
  const ev=D.liveEvaluate(rows,f,w,q),ref=D.evaluate([...rows,{date:'live',[f]:close.pe*k}],f,w);
  assert.equal(ev.live,true);assert.ok(Math.abs(ev.pe-close.pe*k)<1e-9);assert.equal(ev.rank,ref.rank);assert.equal(ev.tier,ref.tier);
  assert.equal(ev.p20,close.p20);assert.equal(ev.n,close.n);assert.equal(ev.closePe,close.pe);
  assert.ok(D.panel(rows,f,zh,w,q).includes('dca-ratio">'+D.actionText(ev.tier,zh)+'<'),a+' panel follows live tier');
 }
 const rows=JSON.parse(fs.readFileSync('pe-data/uni.json')).rows;
 for(const bad of [null,{price:0},{price:NaN},{}]){const ev=D.liveEvaluate(rows,'circ',365,bad);assert.equal(ev.live,false);assert.equal(ev.rank,D.evaluate(rows,'circ',365).rank);}
 assert.match(D.panel(rows,'circ',zh,365),/（收盘价）/);
 console.log('PASS live evaluate shared by overview + coin pages');}
