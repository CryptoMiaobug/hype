// 反向交易页：收益口径、净转入、持仓/成交整理、曲线、词条与转义。
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const C=require('./copy-core.js');
const ME='0xabc',START=1000;

// 净转入：起点前不算；转入正、转出负（含手续费）；自转不算；deposit/withdraw
const ledger=[
 {time:900,delta:{type:'send',user:'0xfff',destination:ME,amount:'4000',usdcValue:'4000'}},
 {time:1100,delta:{type:'send',user:'0xfff',destination:ME,token:'USDC',amount:'100',usdcValue:'100'}},
 {time:1200,delta:{type:'send',user:ME,destination:'0xfff',amount:'30',usdcValue:'30',fee:'1'}},
 {time:1300,delta:{type:'deposit',usdc:'50'}},
 {time:1400,delta:{type:'withdraw',usdc:'20',fee:'1'}},
 {time:1500,delta:{type:'send',user:ME,destination:ME,amount:'999',usdcValue:'999'}},
 {time:1600,delta:{type:'accountClassTransfer',usdc:'500',toPerp:true}}
];
const flow=C.netFlow(ledger,'0xABC',START);
assert.equal(flow.total,100-31+50-21);assert.equal(flow.items.length,4);

// 持仓：0 仓位过滤；标记价=名义/数量；强平距离；按名义降序
const states=[{assetPositions:[
 {position:{coin:'BTC',szi:'-0.05',entryPx:'80000',positionValue:'4100',marginUsed:'600',unrealizedPnl:'-100',liquidationPx:'90200',leverage:{type:'isolated',value:7},cumFunding:{sinceOpen:'0.1'}}},
 {position:{coin:'ETH',szi:'0',positionValue:'0'}}]},
 {assetPositions:[{position:{coin:'xyz:MU',szi:'2',entryPx:'900',positionValue:'1840',marginUsed:'263',unrealizedPnl:'40',liquidationPx:null,leverage:{type:'isolated',value:7}}}]}];
const ps=C.positions(states);
assert.deepEqual(ps.map(p=>p.coin),['BTC','xyz:MU']);
assert.equal(ps[0].side,'short');assert.equal(ps[0].mark,82000);assert.ok(Math.abs(ps[0].liqDist-0.1)<1e-12);
assert.equal(ps[1].liqDist,null);assert.equal(ps[1].side,'long');

// 汇总：净收益 = 净值 − 本金 − 净转入，收益率按（本金+净转入）
const fills=[{time:900,coin:'BTC',px:'1',sz:'1',fee:'9',closedPnl:'9',side:'B'},
 {time:1100,coin:'BTC',px:'80000',sz:'0.05',fee:'1.8',closedPnl:'0',side:'A',dir:'Open Short'},
 {time:1200,coin:'BTC',px:'81000',sz:'0.01',fee:'0.4',closedPnl:'-10',side:'B',dir:'Close Short'}];
const funding=[{time:900,delta:{usdc:'5'}},{time:1150,delta:{usdc:'0.2'}},{time:1250,delta:{usdc:'-0.05'}}];
const s=C.summarize({spot:{balances:[{coin:'HYPE',total:'1'},{coin:'USDC',total:'5150',hold:'863'}]},states,fills,funding,ledger,account:ME,start:START,capital:5000});
assert.equal(s.equity,5150);assert.equal(s.available,5150-863);assert.equal(s.flow,98);
assert.ok(Math.abs(s.pnl-52)<1e-9);assert.ok(Math.abs(s.roi-52/5098)<1e-12);
assert.equal(s.trades,2);assert.ok(Math.abs(s.fees-2.2)<1e-12);assert.equal(s.closed,-10);assert.ok(Math.abs(s.funding-0.15)<1e-12);
assert.equal(s.upnl,-60);assert.equal(s.notional,5940);assert.equal(s.volume,4000+810);

// 曲线：起点 0 → 合并去重（day/week 同一时点）→ 扣除时点前净转入 → 末尾实时点
const pf=[['day',{accountValueHistory:[[1050,'5000'],[1250,'5120']]}],['week',{accountValueHistory:[[800,'1'],[1250,'5120']]}]];
const cv=C.curve(pf,{start:START,capital:5000,ledger,account:ME,now:2000,equity:5150});
assert.deepEqual(cv,[[1000,0],[1050,0],[1250,120-69],[2000,150-98]]);

// 成交：只要起点后，倒序
const tr=C.trades(fills,START);
assert.deepEqual(tr.map(x=>x.time),[1200,1100]);assert.equal(tr[0].side,'buy');assert.equal(tr[1].value,4000);

// 词条：zh/en 键一致，页面用到的 ct.* / nav.copy 全部存在
const ctx={I18N_DICT:{zh:{},en:{}}};vm.runInNewContext(fs.readFileSync('copy-i18n.js','utf8'),ctx);
assert.deepEqual(Object.keys(ctx.I18N_DICT.zh).sort(),Object.keys(ctx.I18N_DICT.en).sort());
const html=fs.readFileSync('copy-trade.html','utf8'),js=fs.readFileSync('copy.js','utf8');
for(const k of new Set([...html.matchAll(/data-i18n="(ct\.[^"]+)"/g),...js.matchAll(/t\('(ct\.[^']+)'\)/g)].map(m=>m[1])))
 assert.ok(k in ctx.I18N_DICT.zh&&k in ctx.I18N_DICT.en,'missing '+k);
const shared=fs.readFileSync('i18n.js','utf8');assert.ok(shared.includes("'nav.copy': '反向交易'")&&shared.includes("'nav.copy': 'Reverse Trading'"));

// 不可信数据（Trasia 昵称）必须经 esc 输出
assert.match(js,/esc\(m\.nickname\)/);assert.match(js,/esc\(b\.title/);assert.ok(!/\$\{m\.nickname\}/.test(js));

// 名单数据：账户、起点、两批、地址格式
const r=JSON.parse(fs.readFileSync('copy-data/roster.json','utf8'));
assert.match(r.account,/^0x[0-9a-f]{40}$/);assert.ok(r.start.time>0&&r.start.capital>0);
for(const b of r.batches){assert.ok(b.ratio>0&&b.members.length);for(const m of b.members)assert.match(m.address,/^0x[0-9a-f]{40}$/);}
console.log('PASS copy: net flow, positions, summary, curve, fills, i18n, escaping, roster');
