/* 竞技场 background music.
 * Tracks are rendered from the original GBA song data by music-gen/render.py; music.json holds
 * each track's loop points, and Web Audio loops exactly between them (no gap at the seam).
 * Browsers block sound until the first click/key press, so the requested track starts then.
 * The mute choice is remembered in localStorage. */
(function () {
  'use strict';

  const V = '20261031c';
  const VOLUME = 0.45;
  const FADE = 0.4;            // seconds
  const STORE = 'arena_muted';

  let ctx = null, master = null, meta = null;
  const buffers = {};          // name -> Promise<AudioBuffer>
  let current = null;          // { name, src, gain }
  let wanted = null;           // track that should be playing
  let muted = false;
  try { muted = localStorage.getItem(STORE) === '1'; } catch (e) { /* storage blocked */ }

  function ensureCtx() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : VOLUME;
    master.connect(ctx.destination);
    return ctx;
  }

  function loadMeta() {
    if (!meta) meta = fetch(`assets/music/music.json?v=${V}`).then(r => r.json());
    return meta;
  }

  function load(name) {
    if (!buffers[name]) {
      buffers[name] = fetch(`assets/music/${name}.mp3?v=${V}`)
        .then(r => r.arrayBuffer())
        .then(b => new Promise((ok, bad) => ctx.decodeAudioData(b, ok, bad)));
    }
    return buffers[name];
  }

  function stopCurrent() {
    if (!current) return;
    const { src, gain } = current;
    const t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(0, t + FADE);
    src.stop(t + FADE + 0.05);
    current = null;
  }

  async function start(name) {
    if (!ensureCtx() || ctx.state !== 'running') return;   // will retry on unlock
    if (current && current.name === name) return;
    stopCurrent();
    if (!name) return;
    try {
      const [m, buf] = await Promise.all([loadMeta(), load(name)]);
      if (wanted !== name || (current && current.name === name)) return;   // changed while loading
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const lp = m[name];
      if (lp) {
        src.loop = true;
        src.loopStart = lp.loopStart;
        src.loopEnd = Math.min(lp.loopEnd, buf.duration);
      }
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.15);
      src.connect(gain).connect(master);
      src.start();
      current = { name, src, gain };
    } catch (e) {
      // Missing/undecodable audio must never break the game.
      console.warn('arena music:', e);
    }
  }

  function play(name) { wanted = name; start(name); }
  function stop() { wanted = null; if (ctx) stopCurrent(); }

  function setMuted(m) {
    muted = m;
    try { localStorage.setItem(STORE, m ? '1' : '0'); } catch (e) { /* ignore */ }
    if (master) master.gain.setTargetAtTime(m ? 0 : VOLUME, ctx.currentTime, 0.05);
    renderButton();
  }

  // First user gesture: create/resume the context and start whatever should be playing.
  function unlock() {
    if (!ensureCtx()) return;
    const go = () => { if (wanted) start(wanted); };
    if (ctx.state === 'suspended') ctx.resume().then(go, () => {});
    else go();
  }
  ['pointerdown', 'keydown', 'touchend'].forEach(ev => window.addEventListener(ev, unlock, { capture: true, passive: true }));

  let btn = null;
  function renderButton() {
    if (!btn) return;
    const en = window.I18n && window.I18n.lang === 'en';
    btn.textContent = muted ? '🔇' : '🔊';
    btn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    const label = muted ? (en ? 'Turn music on' : '打开音乐') : (en ? 'Mute music' : '关闭音乐');
    btn.setAttribute('aria-label', label);
    btn.title = label;
  }
  window.addEventListener('DOMContentLoaded', () => {
    btn = document.getElementById('music-toggle');
    if (!btn) return;
    btn.addEventListener('click', e => { e.stopPropagation(); setMuted(!muted); btn.blur(); });
    renderButton();
  });

  window.ArenaMusic = { play, stop, setMuted, refreshLabel: renderButton, get muted() { return muted; }, get track() { return current ? current.name : null; } };
})();
