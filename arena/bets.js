/* Recent entries on the lobby notice board, read straight from Arbitrum in the visitor's browser.
 * Entry  = USDC transfer INTO the arena address, amount >= 0.5 (roulette.py ignores smaller ones).
 * Result = USDC transfer OUT to the same address whose 4th decimal is 0 (win), 1 (loss) or 3 (win +
 *          beat Mewtwo, 100U bonus in the same transfer, 主人 2026-11-01); refunds (4th decimal 2) are
 *          not shown. Digits 1-3 of the last four = multiplier.
 * Per address, entries and results are paired in chain order (first entry gets first result after it).
 * No result yet = pending. Works in the browser (window.ArenaBets) and in Node (module.exports) for tests. */
(function (root) {
  'use strict';

  const ADDRESS = '0xf589fe018faf04b663eea702e59e8601c65e5354';
  const USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
  const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
  const START_BLOCK = 520206895;     // roulette.py went live after this block (data/roulette_state.json)
  const RPCS = ['https://arb1.arbitrum.io/rpc', 'https://arbitrum.gateway.tenderly.co'];
  const MIN_RAW = 500000;            // 0.5 USDC
  const MAX_RAW = 10000000;          // 10 USDC: larger entries are played at 10, the rest is refunded
  const WINDOW = 20000000;           // blocks per eth_getLogs call (~2 months on Arbitrum; arb1 answers 10M+ in ~0.1s)

  const pad = a => '0x' + a.slice(2).toLowerCase().padStart(64, '0');
  const hex = n => '0x' + n.toString(16);

  async function rpc(method, params) {
    let err;
    for (const url of RPCS) {
      try {
        const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
        const j = await r.json();
        if (j.error) throw new Error(j.error.message || 'rpc error');
        return j.result;
      } catch (e) { err = e; }
    }
    throw err;
  }

  const toRow = (l, dir) => ({
    dir,
    who: '0x' + l.topics[dir === 'in' ? 1 : 2].slice(26).toLowerCase(),
    raw: Number(BigInt(l.data)),
    block: parseInt(l.blockNumber, 16),
    idx: parseInt(l.logIndex, 16),
    tx: l.transactionHash,
  });

  // Fetch every transfer since START_BLOCK. Always the full history: results carry no link to their entry,
  // so pairing needs every earlier entry of that address (a partial window could pair a result to the wrong one).
  async function fetchTransfers() {
    const head = parseInt(await rpc('eth_blockNumber', []), 16);
    const rows = [];
    for (let from = START_BLOCK + 1; from <= head; from += WINDOW) {
      const to = Math.min(head, from + WINDOW - 1);
      const q = topics => rpc('eth_getLogs', [{ address: USDC, fromBlock: hex(from), toBlock: hex(to), topics }]);
      const [ins, outs] = await Promise.all([q([TRANSFER, null, pad(ADDRESS)]), q([TRANSFER, pad(ADDRESS)])]);
      ins.forEach(l => rows.push(toRow(l, 'in')));
      outs.forEach(l => rows.push(toRow(l, 'out')));
    }
    return { rows, head };
  }

  // rows (any order) -> entries newest-first: { who, raw (stake, capped at 10), tier, result }
  // result: { kind: 'win', mult } | { kind: 'loss' } | { kind: 'pending' }
  function pair(rows) {
    const sorted = rows.filter(r => r.who !== ADDRESS).sort((a, b) => a.block - b.block || a.idx - b.idx);
    const queue = {};   // address -> entries still waiting for a result, oldest first
    const entries = [];
    for (const r of sorted) {
      if (r.dir === 'in') {
        const stake = Math.min(Math.floor(r.raw / 10000) * 10000, MAX_RAW);   // 2 decimals, like roulette.py
        if (stake < MIN_RAW) continue;
        const e = { who: r.who, raw: stake, tier: tierOf(stake), tx: r.tx, block: r.block, result: { kind: 'pending' } };
        entries.push(e);
        (queue[r.who] = queue[r.who] || []).push(e);
      } else {
        const tail = r.raw % 10000, status = tail % 10, mult = Math.floor(tail / 10);
        // loss receipt is exactly 0.000001; a win always carries a multiplier >= 1. Anything else
        // (refunds = status 2, ordinary transfers out) is not a result.
        const isLoss = r.raw === 1, isWin = (status === 0 || status === 3) && mult >= 1;
        if (!isLoss && !isWin) continue;
        const q = queue[r.who];
        if (!q || !q.length) continue;
        const e = q.shift();
        e.result = isLoss ? { kind: 'loss' } : { kind: 'win', mult, mew: status === 3 };
        e.resultTx = r.tx;   // picks the replayed battle (game.js matchBattle)
      }
    }
    return entries.reverse();
  }

  // Tier by entry fee (主人 11-01): 0.5-1 = tier 1, 1.01-2 = tier 2, ... 9.01-10 = tier 10 (stake is capped at 10).
  const tierOf = raw => Math.min(10, Math.max(1, Math.ceil(raw / 1000000)));

  // -> { list: entries newest-first, head: latest block number }
  async function load() {
    const { rows, head } = await fetchTransfers();
    return { list: pair(rows), head };
  }

  // Replay for a settled match: among all recorded battles of the entry's tier whose challenger
  // outcome equals the match result, take number(result tx hash) mod count. idx = assets/match-index.json.
  // Mewtwo split (主人 2026-11-01): a win with status 3 (beat Mewtwo) only picks battles the challenger
  // won against Mewtwo; every other win never picks those, so a plain win never shows Mewtwo falling.
  // Candidate order: roster order of champions, then battle order inside assets/battles/<id>.json.
  // -> { champ, n (battle index in that file), expect: 'win' | 'lose' } or null if not settled.
  function matchBattle(entry, idx) {
    if (!entry.resultTx || entry.result.kind === 'pending') return null;
    const want = entry.result.kind === 'win' ? 'w' : 'l';
    const mew = !!entry.result.mew;
    const ok = champ => want !== 'w' || (champ === MEW) === mew;   // losses: everyone; wins: split on Mewtwo
    let list = idx.tiers[entry.tier];
    if (mew && !list.some(([c]) => c === MEW)) list = idx.tiers['10'];   // bonus is a tier-10 thing
    let count = 0;
    for (const [champ, s] of list) if (ok(champ)) for (const c of s) if (c === want) count++;
    if (!count) return null;
    let k = Number(BigInt(entry.resultTx) % BigInt(count));
    for (const [champ, s] of list) {
      if (!ok(champ)) continue;
      for (let n = 0; n < s.length; n++) {
        if (s[n] !== want) continue;
        if (k-- === 0) return { champ, n, chunk: idx.chunk, expect: want === 'w' ? 'win' : 'lose' };
      }
    }
    return null;
  }

  const MEW = 'mewtwo';
  const api = { load, pair, tierOf, matchBattle, ADDRESS, START_BLOCK };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ArenaBets = api;
})(typeof window !== 'undefined' ? window : globalThis);
