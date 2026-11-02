/* Colyseus @colyseus/sdk 0.18.9. Message-only lobby; no schema or legacy chat socket. */
(() => {
  'use strict';
  const TILE = 32, STEP_MS = 180, NICK_KEY = 'arena_chat_nick';
  const frames = {left:'left',right:'right',up:'back',down:'front'};
  const requested = new URLSearchParams(location.search).get('mpRoom') || '';
  const group = /^test-[A-Za-z0-9-]{1,64}$/.test(requested) ? requested : 'public';
  const endpoint = window.ARENA_MULTIPLAYER_ENDPOINT || 'https://poke.miao77.xyz';
  const subscribers = new Set(), players = new Map(), sprites = new Map(), chatBacklog = [];
  let scene = null, room = null, selfId = null, online = false, active = false;
  let alive = true, joining = false, generation = 0, timer = null, attempt = 0;
  let sentMoves = [], lastMove = '', status = 'connecting', readyTimer = null;
  let nick;
  try { nick = localStorage.getItem(NICK_KEY); } catch (_) {}
  nick = nick || '训练师#' + Math.floor(1000 + Math.random() * 9000);
  try { localStorage.setItem(NICK_KEY,nick); } catch (_) {}
  const indicator = document.createElement('span');
  indicator.id = 'arena-multiplayer-state'; indicator.setAttribute('role','status');
  indicator.style.cssText = 'position:absolute;left:8px;top:8px;z-index:3;font:11px/1.4 sans-serif;color:#dce9e4;background:#10231fbb;padding:3px 6px;border-radius:4px;max-width:calc(100% - 105px);pointer-events:none';
  document.getElementById('game').append(indicator);
  function refresh() {
    const en = window.I18n?.lang === 'en';
    indicator.textContent = online ? (en ? `Online · ${players.size} in hall` : `联机 · 大厅 ${players.size} 人`) : status === 'connecting' ? (en ? 'Connecting…' : '联机连接中…') : (en ? 'Offline · retrying (solo available)' : '联机离线 · 正在重试（可单机游玩）');
  }
  function notify(value) {
    online = value; status = value ? 'online' : 'offline';
    for (const sub of subscribers) sub.status?.(value);
    refresh();
  }
  function transmit(type, data) {
    // The SDK can buffer disconnected sends. Gate here: uncertain chat must never replay.
    if (!online || !room || !room.connection?.isOpen) return false;
    try { room.send(type,data); return true; } catch (_) { return false; }
  }
  function destroySprite(id) {
    const entry = sprites.get(id);
    if (!entry) return;
    if (scene) scene.tweens.killTweensOf(entry.sprite);
    entry.sprite.destroy(); entry.label.destroy(); sprites.delete(id);
  }
  function clearPlayers() { for (const id of sprites.keys()) destroySprite(id); players.clear(); refresh(); }
  function valid(p) { return p && typeof p.id === 'string' && typeof p.nick === 'string' && Number.isInteger(p.x) && Number.isInteger(p.y) && frames[p.dir] && (!scene || !scene.blocked(p.x,p.y)); }
  function labelAt(entry) {
    entry.label.setPosition(entry.sprite.x,entry.sprite.y-44);
  }
  function render(p, snap = false) {
    if (!scene || !active || p.id === selfId) return;
    let entry = sprites.get(p.id);
    const x = p.x*TILE+TILE/2, y = (p.y+1)*TILE, anim = frames[p.dir];
    if (!entry) {
      const sprite = scene.add.sprite(x,y,'player',`ariel-${anim}`).setOrigin(.5,1).setDepth(5);
      const label = scene.add.text(x,y-44,p.nick.slice(0,24),{fontFamily:'sans-serif',fontSize:'11px',color:'#ffffff',stroke:'#10231f',strokeThickness:3,backgroundColor:'#10231faa',padding:{x:3,y:1}}).setOrigin(.5,1).setDepth(11);
      entry = {sprite,label}; sprites.set(p.id,entry);
    }
    entry.label.setText(p.nick.slice(0,24));
    scene.tweens.killTweensOf(entry.sprite);
    if (!snap && (entry.sprite.x !== x || entry.sprite.y !== y)) {
      entry.sprite.play(anim,true);
      scene.tweens.add({targets:entry.sprite,x,y,duration:STEP_MS,onUpdate:()=>labelAt(entry),onComplete:()=>{entry.sprite.anims.stop();entry.sprite.setFrame(`ariel-${anim}`);labelAt(entry);}});
    } else { entry.sprite.setPosition(x,y);entry.sprite.anims.stop();entry.sprite.setFrame(`ariel-${anim}`);labelAt(entry); }
  }
  function correct(p, snapshot) {
    if (!scene || !active) return;
    // Acknowledgements for earlier predicted steps must not rewind a newer step.
    const index = sentMoves.findIndex(m=>m.x===p.x && m.y===p.y && m.dir===p.dir);
    if (!snapshot && index >= 0) { sentMoves.splice(0,index+1); return; }
    sentMoves = []; lastMove = '';
    if (scene.tx === p.x && scene.ty === p.y && scene.facing === p.dir) return;
    scene.tweens.killTweensOf(scene.player);
    scene.tx=p.x; scene.ty=p.y; scene.facing=p.dir; scene.moving=false;
    scene.mpCorrectUntil=performance.now()+STEP_MS;
    scene.player.anims.stop();scene.player.setFrame(`ariel-${frames[p.dir]}`);scene.placePlayer();
  }
  function player(p, snap = false) {
    if (!valid(p)) return;
    players.set(p.id,{id:p.id,nick:p.nick,x:p.x,y:p.y,dir:p.dir});
    if (p.id === selfId) correct(p,snap); else render(p,snap);
    refresh();
  }
  function snapshot(data) {
    if (!data || !Array.isArray(data.players) || typeof data.selfId !== 'string') return;
    selfId=data.selfId;clearPlayers();sentMoves=[];lastMove='';
    for (const p of data.players) player(p,true);
    refresh();
  }
  function schedule() {
    clearTimeout(timer);
    if (alive) timer=setTimeout(connect,Math.min(30000,1200*2**Math.min(attempt++,5))+Math.random()*400);
  }
  async function connect() {
    if (!alive || joining || room) return;
    clearTimeout(timer);joining=true;const token=++generation;
    status=attempt?'offline':'connecting';refresh();
    try {
      if (!window.Colyseus?.Client) throw new Error('SDK unavailable');
      const client = new window.Colyseus.Client(endpoint);
      const joined = await client.joinOrCreate('lobby',{nick,group});
      if (token!==generation || !alive) { joined.leave().catch(()=>{});return; }
      room=joined;selfId=joined.sessionId;
      // Own bounded join retries; never let the SDK enqueue chat during reconnection.
      if (joined.reconnection) joined.reconnection.enabled=false;
      joined.onMessage('snapshot',data=>{if(room!==joined)return;snapshot(data);if(!online){clearTimeout(readyTimer);notify(true);transmit('presence',{active});}});
      joined.onMessage('player',data=>{if(room===joined)player(data);});
      joined.onMessage('leave',data=>{if(room!==joined || !data)return;destroySprite(data.id);players.delete(data.id);refresh();});
      joined.onMessage('chat',data=>{if(room!==joined)return;if(!subscribers.size){if(chatBacklog.length>=100)chatBacklog.shift();chatBacklog.push(data);}else for(const sub of subscribers)sub.chat?.(data);});
      joined.onLeave(()=>{if(room!==joined)return;room=null;sentMoves=[];lastMove='';clearPlayers();notify(false);schedule();});
      joined.onError(()=>{if(room===joined)rejoin();});
      attempt=0;
      readyTimer=setTimeout(()=>{if(room===joined&&!online)rejoin();},12000);
      joined.send('nick',{nick});
      joined.send('presence',{active});
    } catch (_) {
      if (token===generation) { notify(false);schedule(); }
    } finally { if(token===generation)joining=false; }
  }
  function rejoin() {
    clearTimeout(readyTimer);generation++;joining=false;const old=room;room=null;sentMoves=[];lastMove='';
    clearPlayers();notify(false);
    if(old)old.leave().catch(()=>{});
    schedule();
  }
  function setHall(value) {
    active=!!value;sentMoves=[];lastMove='';
    if (!active) { for(const id of sprites.keys())destroySprite(id); }
    transmit('presence',{active});
  }
  function setNick(value) {
    const next=String(value||'').trim().slice(0,24);if(!next || next===nick)return;
    nick=next;try{localStorage.setItem(NICK_KEY,nick);}catch(_){}
    transmit('nick',{nick});
  }
  window.ArenaMultiplayer={
    attach(value){scene=value;setHall(true);for(const p of players.values()){if(p.id===selfId)correct(p,true);else render(p,true);}},
    detach(value){if(scene!==value)return;setHall(false);clearPlayers();scene=null;},
    setHall,setNick,refresh,rejoin,
    move(x,y,dir){
      if(!active || !frames[dir])return;
      const key=`${x},${y},${dir}`;if(key===lastMove)return;
      if(transmit('move',{x,y,dir})){lastMove=key;sentMoves.push({x,y,dir});if(sentMoves.length>32)sentMoves.shift();}
    },
    sendChat(data){return transmit('chat',data);},
    subscribe(sub){subscribers.add(sub);sub.status?.(online);for(const data of chatBacklog.splice(0))sub.chat?.(data);return()=>subscribers.delete(sub);},
    get connected(){return online;},get group(){return group;},get playerCount(){return players.size;}
  };
  window.addEventListener('online',()=>{if(!room)connect();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden && !room)connect();});
  window.addEventListener('pagehide',()=>{alive=false;clearTimeout(timer);clearTimeout(readyTimer);generation++;joining=false;const old=room;room=null;notify(false);clearPlayers();if(old)old.leave().catch(()=>{});});
  window.addEventListener('pageshow',event=>{if(event.persisted){alive=true;connect();}});
  refresh();connect();
})();
