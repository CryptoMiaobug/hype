// DCA tier logic + page rendering against the bundled archives.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const D=require('./dca-core.js'),PC=require('./pe-core.js'),BC=require('./bnb-core.js');
const rows=vals=>vals.map((v,i)=>({date:'d'+String(i).padStart(3,'0'),pe:v}));
// Tier boundaries on rank: <20 green, 20-50 yellow, 50-80 orange, >=80 red.
const base=Array.from({length:99},(_,i)=>i+1); // 1..99, plus current = 100 values
// below-count/100 = rank: 20->19% green, 21->20% yellow, 50.5->50% orange, 80->79% orange, 81->80% red
for(const [cur,key,mult] of [[0.5,'green',2],[20,'green',2],[21,'yellow',1],[50,'yellow',1],[50.5,'orange',0.5],[80,'orange',0.5],[81,'red',0],[1000,'red',0]]){
 const r=D.evaluate(rows([...base,cur]),'pe');assert.equal(r.tier.key,key,cur+' rank '+r.rank);assert.equal(r.tier.mult,mult);}
const base100=Array.from({length:100},(_,i)=>i+1);
// Window = last 365 rows; nulls ignored; latest valid value used.
{const r=D.evaluate(rows([...Array(400).fill(1000),...base100,null]),'pe');assert.equal(r.pe,100);assert.equal(r.n,364);}
assert.equal(D.evaluate(rows([null,null]),'pe'),null);
assert.equal(D.amount(100,D.TIERS[0]),200);assert.equal(D.amount(100,D.TIERS[2]),50);assert.equal(D.amount(100,D.TIERS[3]),0);assert.equal(D.amount(-1,D.TIERS[1]),null);
// Percentile matches the chart bands' formula.
{const v=[5,1,3,2,4];assert.equal(D.pct(v,0.5),3);assert.equal(D.pct(v,0.2),1.8);}
// Real archives: P20<=P50<=P80 and the rank-derived tier.
for(const [a,f] of [['hype','circ'],['uni','circ'],['bnb','pe']]){const s=JSON.parse(fs.readFileSync('pe-data/'+a+'.json'));const r=D.evaluate(s.rows,f);assert.ok(r.p20<=r.p50&&r.p50<=r.p80);console.log('PASS',a,r.date,r.pe.toFixed(2),'rank',r.rank.toFixed(0)+'%',r.tier.key);}
// Page: renders 3 cards, base input persists and rescales, works offline from bundled JSON.
(async()=>{
 const nodes={},store={},make=()=>({innerHTML:'',textContent:'',value:'',attrs:{},setAttribute(k,v){this.attrs[k]=v},addEventListener(k,f){this['on'+k]=f}});
 const ctx={DCACore:D,PECore:{...PC,yesterday:()=>'2026-10-08'},BNBCore:{...BC,yesterday:()=>'2026-10-08'},document:{getElementById:id=>nodes[id]??=make()},localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>store[k]=v},AbortSignal:{timeout(){}},
  fetch:async u=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(u))})};ctx.window=ctx;
 await vm.runInNewContext(fs.readFileSync('dca.js','utf8'),ctx);
 const html=nodes.cards.innerHTML;assert.equal((html.match(/class="dca-card"/g)||[]).length,3,html.slice(0,300));
 for(const n of ['HYPE','UNI','BNB'])assert.ok(html.includes('<h3>'+n+'</h3>'));
 assert.match(nodes.total.textContent,/\$/);
 nodes.base.value='250';nodes.base.oninput();assert.equal(store['hypevalue-dca-base-v1'],'250');assert.ok(nodes.cards.innerHTML.includes('基准 $250'));
 nodes.base.value='-5';nodes.base.oninput();assert.equal(nodes.base.attrs['aria-invalid'],'true');assert.equal(store['hypevalue-dca-base-v1'],'250');
 ctx.I18n={lang:'en'};ctx.onI18nChange();assert.ok(!/[\u4e00-\u9fff]/.test(nodes.cards.innerHTML+nodes.total.textContent));
 console.log('PASS dca page render, base persistence, validation, English');
})().catch(e=>{console.error(e);process.exit(1)});
