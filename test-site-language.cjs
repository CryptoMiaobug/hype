// Shared initialization contract for every published entry; no browser dependency.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const pages=['index.html','valuation.html','hype-pe.html','uni-pe.html','battlefield/index.html','dca.html'];
function boot(page,language,store={},denied=false){
 const html=fs.readFileSync(page,'utf8'),events={},buttons=['zh','en'].map(lang=>({dataset:{lang},classList:{toggle(){}}}));
 let sw=html.includes('id="langSwitch"')?node():null;
 function node(){return {querySelector(){return null},appendChild(n){sw=n},addEventListener(k,fn){this[k]=fn}}}
 const host=node(),sample={textContent:'',getAttribute:()=> 'nav.dashboard',hasAttribute:()=>false};
 const document={documentElement:{},querySelector:s=>(page.startsWith('battlefield')?s==='#top-bar .top-left':s==='.topbar')?host:null,getElementById:()=>sw,createElement:node,querySelectorAll:s=>s==='#langSwitch button'?buttons:s==='[data-i18n]'?[sample]:[],addEventListener:(k,f)=>events[k]=f};
 const c={document,navigator:{language},localStorage:{getItem:k=>{if(denied)throw Error('SecurityError');return store[k]},setItem:(k,v)=>{if(denied)throw Error('SecurityError');store[k]=v}}};c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync('i18n.js','utf8'),c);events.DOMContentLoaded();
 assert.ok(sw,'switch exists: '+page);assert.equal(typeof sw.click,'function');
 return {c,sw,sample,lang:()=>document.documentElement.lang};
}
for(const page of pages){
 const html=fs.readFileSync(page,'utf8');assert.match(html,/i18n.js\?v=20261009dca/);
 for(const language of ['zh','zh-CN','zh-TW','zh-HK','zh-Hans','zh-Hant','ZH_tw','en','ja','fr','',undefined,'zhfake']){
  const expected=/^zh(?:[-_]|$)/i.test(language||'')?'zh':'en';
  for(const saved of [undefined,'invalid','','zh','en']){
   const store={hs_lang:saved},h=boot(page,language,store);
   assert.equal(h.lang(),saved==='zh'||saved==='en'?saved:expected);
   assert.equal(store.hs_lang,saved,'auto detection never persists');
   assert.equal(h.sample.textContent,h.lang()==='en'?'Dashboard':'仪表盘');
   h.sw.click({target:{closest:()=>({dataset:{lang:'en'}})}});assert.equal(h.lang(),'en');assert.equal(store.hs_lang,'en');
   assert.equal(boot(page,'zh-TW',store).lang(),'en');
  }
  const h=boot(page,language,{},true);assert.equal(h.lang(),expected);h.c.I18n.set('zh');assert.equal(h.lang(),'zh');h.c.I18n.set('en');assert.equal(h.lang(),'en');
 }
 const store={};boot(page,'en',store);assert.equal(boot(page,'zh-Hant',store).lang(),'zh');
 console.log('PASS',page,': locale matrix, invalid/blocked storage, actual button event, manual persistence, system changes, static navigation');
}
assert.ok(!fs.readFileSync('valuation.js','utf8').includes('I18n.setTemp(hl)'), 'legacy shared URL cannot override viewer language');
console.log('PASS shared valuation URL respects viewer language; five published HTML entries covered');
