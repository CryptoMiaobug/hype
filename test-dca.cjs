// DCA suggestion: tier logic + in-page panel on HYPE/UNI/BNB PE pages.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const D=require('./dca-core.js'),PC=require('./pe-core.js'),BC=require('./bnb-core.js');
const rows=vals=>vals.map((v,i)=>({date:'d'+String(i).padStart(3,'0'),pe:v}));
const zh=(z)=>z,en=(z,e)=>e;
// Tier on rank (share below current): <20 green 200%, 20-50 yellow 100%, 50-80 orange 50%, >=80 red 0%.
const base=Array.from({length:99},(_,i)=>i+1); // 1..99 plus current = 100 values
for(const [cur,key,ratio] of [[0.5,'green',200],[20,'green',200],[21,'yellow',100],[50,'yellow',100],[50.5,'orange',50],[80,'orange',50],[81,'red',0],[1000,'red',0]]){
 const r=D.evaluate(rows([...base,cur]),'pe');assert.equal(r.tier.key,key,cur+' rank '+r.rank);assert.equal(r.tier.ratio,ratio);}
// Window = last 365 rows; nulls skipped; latest valid value used.
{const r=D.evaluate(rows([...Array(400).fill(1000),...Array.from({length:100},(_,i)=>i+1),null]),'pe');assert.equal(r.pe,100);assert.equal(r.n,364);}
assert.equal(D.evaluate(rows([null,null]),'pe'),null);
{const v=[5,1,3,2,4];assert.equal(D.pct(v,0.5),3);assert.equal(D.pct(v,0.2),1.8);}
// Panel: shows % only (no $ amounts), current tier highlighted, both languages.
{const h=D.panel(rows([...base,50.5]),'pe',zh);assert.match(h,/50%/);assert.match(h,/减半定投/);assert.ok(!h.includes('$'));assert.equal((h.match(/class="on"/g)||[]).length,1);
 const e=D.panel(rows([...base,50.5]),'pe',en);assert.ok(!/[\u4e00-\u9fff]/.test(e),e);assert.match(D.panel([],'pe',zh),/有效 PE 不足/);}
// Real archives.
for(const [a,f] of [['hype','circ'],['uni','circ'],['bnb','pe']]){const s=JSON.parse(fs.readFileSync('pe-data/'+a+'.json'));const r=D.evaluate(s.rows,f);assert.ok(r.p20<=r.p50&&r.p50<=r.p80);console.log('PASS',a,r.date,r.pe.toFixed(2),'rank',r.rank.toFixed(0)+'%',r.tier.ratio+'%');}
// Pages: each PE page has the panel slot and loads dca-core; no standalone page or nav entry remains.
for(const p of ['hype-pe.html','uni-pe.html','bnb-pe.html']){const s=fs.readFileSync(p,'utf8');assert.ok(s.includes('id="dca"')&&s.includes('dca-core.js'),p);}
assert.ok(!fs.existsSync('dca.html'));
for(const p of ['index.html','valuation.html','hype-pe.html','uni-pe.html','bnb-pe.html','battlefield/index.html'])assert.ok(!fs.readFileSync(p,'utf8').includes('dca.html'),p);
// pe.js renders the panel into #dca (offline, bundled archive).
(async()=>{
 for(const asset of ['hype','uni']){
  const seed=JSON.parse(fs.readFileSync('pe-data/'+asset+'.json')),nodes={},make=()=>({children:[],textContent:'',innerHTML:'',append(x){this.children.push(x)},replaceChildren(...x){this.children=x}});
  const document={body:{dataset:{asset}},getElementById:id=>nodes[id]??=make(),querySelectorAll:()=>[],createElement:make};
  const ctx={PECore:{...PC,yesterday:()=>seed.last},DCACore:D,document,localStorage:{getItem:()=>null,setItem(){}},fetch:async u=>{if(u.startsWith('pe-data'))return {ok:true,json:async()=>seed};throw Error('offline')},AbortSignal:{timeout(){}},Blob,URL,setTimeout,console};
  ctx.window={addEventListener(){},DCACore:D};
  await vm.runInNewContext(fs.readFileSync('pe.js','utf8'),ctx);
  assert.match(nodes.dca.innerHTML,/DCA 定投建议/);assert.match(nodes.dca.innerHTML,/\d+%/);console.log('PASS pe.js panel',asset);
 }
})().catch(e=>{console.error(e);process.exit(1)});
