/* 竞技场 background music and battle sound effects.
 * Tracks are rendered from the original GBA song data by music-gen/render.py; music.json holds
 * each track's loop points, and Web Audio loops exactly between them (no gap at the seam).
 * Browsers block sound until the first click/key press, so the requested track starts then.
 * Sound effects (assets/sfx, made by music-gen/render_sfx.sh) share the same mute switch.
 * The mute choice is remembered in localStorage. */
(function () {
  'use strict';

  const V = '20261031e';
  const VOLUME = 0.45;         // music bus
  const SFX_VOLUME = 0.8;      // effects sit a bit above the music, as in the games
  const FADE = 0.4;            // seconds
  const STORE = 'arena_muted';

  let ctx = null, master = null, musicBus = null, sfxBus = null, meta = null, sfxMap = null;
  const sfxBuffers = {};       // file -> Promise<AudioBuffer>
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
    master = ctx.createGain();                 // mute switch
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = VOLUME; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = SFX_VOLUME; sfxBus.connect(master);
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
      src.connect(gain).connect(musicBus);
      src.start();
      current = { name, src, gain };
    } catch (e) {
      // Missing/undecodable audio must never break the game.
      console.warn('arena music:', e);
    }
  }

  function play(name) { wanted = name; start(name); }

  // ---------- sound effects ----------
  function loadSfxMap() {
    if (!sfxMap) sfxMap = fetch(`assets/sfx/sfx.json?v=${V}`).then(r => r.json()).catch(() => ({}));
    return sfxMap;
  }
  function loadSfx(file) {
    if (!sfxBuffers[file]) {
      sfxBuffers[file] = fetch(`assets/sfx/${file}.mp3?v=${V}`)
        .then(r => r.arrayBuffer())
        .then(b => new Promise((ok, bad) => ctx.decodeAudioData(b, ok, bad)));
      sfxBuffers[file].catch(() => { delete sfxBuffers[file]; });
    }
    return sfxBuffers[file];
  }
  // Decode the effects a battle will use ahead of time so they fire on cue.
  async function preloadSfx(keys) {
    if (!ensureCtx()) return;
    const m = await loadSfxMap();
    [...new Set(keys.map(k => m[k]).filter(Boolean))].forEach(f => loadSfx(f).catch(() => {}));
  }
  // Play one effect; resolves when it has finished (or right away if sound is off/unavailable).
  // maxWait caps how long a caller can be held up by a long effect (e.g. Gust is 7 s).
  async function sfx(key, maxWait = 1200) {
    if (!ctx || ctx.state !== 'running' || muted) return;
    try {
      const m = await loadSfxMap();
      const file = m[key];
      if (!file) return;
      const buf = await loadSfx(file);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(sfxBus);
      src.start();
      await new Promise(r => setTimeout(r, Math.min(maxWait, buf.duration * 1000)));
    } catch (e) {
      console.warn('arena sfx:', key, e);
    }
  }
  function stop() { wanted = null; if (ctx) stopCurrent(); }

  function setMuted(m) {
    muted = m;
    try { localStorage.setItem(STORE, m ? '1' : '0'); } catch (e) { /* ignore */ }
    if (master) master.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.05);
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
    const label = muted ? (en ? 'Turn sound on' : '打开声音') : (en ? 'Mute sound' : '关闭声音');
    btn.setAttribute('aria-label', label);
    btn.title = label;
  }
  window.addEventListener('DOMContentLoaded', () => {
    btn = document.getElementById('music-toggle');
    if (!btn) return;
    btn.addEventListener('click', e => { e.stopPropagation(); setMuted(!muted); btn.blur(); });
    renderButton();
  });

  window.ArenaMusic = { play, stop, sfx, preloadSfx, setMuted, refreshLabel: renderButton, get muted() { return muted; }, get track() { return current ? current.name : null; } };
})();
