/* 竞技场 — auto-play battle scene.
 * Plays one pre-recorded battle. Starter tier: assets/battles.json (battle-gen/build_battles.mjs);
 * other tiers: one file per Pokémon, assets/battles/<id>.json (battle-gen/build_tier_battles.mjs),
 * with the Pokémon Showdown engine). The player only watches; text goes through the shared
 * DOM dialog (window.ArenaUI.dialog) so CJK stays crisp and screen readers get it. */
(function () {
  'use strict';

  const W = 240, H = 124;
  const W_ = W;              // battle "stage" in world px (the text box is DOM, below it)
  const DATA_V = '20261031m';

  const STAT = {
    zh: { atk: '攻击', def: '防御', spa: '特攻', spd: '特防', spe: '速度', acc: '命中率', eva: '闪避率' },
    en: { atk: 'Attack', def: 'Defense', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed', acc: 'accuracy', eva: 'evasiveness' },
  };
  const STATUS = {
    zh: { par: '麻痹了，可能会无法行动！', brn: '被灼伤了！', psn: '中毒了！', tox: '中了剧毒！', slp: '睡着了！', frz: '被冻住了！' },
    en: { par: 'is paralyzed! It may be unable to move!', brn: 'was burned!', psn: 'was poisoned!', tox: 'was badly poisoned!', slp: 'fell asleep!', frz: 'was frozen solid!' },
  };
  const CANT = {
    zh: { par: '因麻痹而无法行动！', flinch: '畏缩了，无法行动！', slp: '正在呼呼大睡。', frz: '被冻住了，无法行动！', recharge: '需要休息，无法行动！', attract: '着迷了，无法行动！', truant: '正在偷懒。', nopp: '没有可以使出的招式了！' },
    en: { par: 'is paralyzed! It can\'t move!', flinch: 'flinched and couldn\'t move!', slp: 'is fast asleep.', frz: 'is frozen solid!', recharge: 'must recharge!', attract: 'is immobilized by love!', truant: 'is loafing around!', nopp: 'has no moves left!' },
  };

  const lang = () => (window.I18n && window.I18n.lang === 'en' ? 'en' : 'zh');
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const FONT = '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif';

  class Battle extends Phaser.Scene {
    constructor() { super('battle'); }

    init(data) {
      this.champ = data.champ;                 // the champion the player challenges (the foe side)
      this.music = data.music || 'battle';   // tiers 9-10 use the legendary battle theme
      // Notice-board replay: a fixed battle (index n) chosen from the match result; the challenger is
      // shown as the entrant's address (who). Otherwise a random battle with an unnamed challenger.
      this.fixedN = Number.isInteger(data.n) ? data.n : null;
      this.who = data.who || null;
      this.crit = data.crit > 1 ? data.crit : 0;   // winning multiplier >1 = crit bonus line at the end
      this.replay = !!data.replay;
      // assets/battles/<champion>.json holds its 100 battles (battle-gen/build_tier_battles.mjs)
      this.dataKey = 'battles-' + data.champ;
      this.dataUrl = `assets/battles/${data.champ}.json?v=${data.v || DATA_V}`;
    }

    preload() {
      const key = this.dataKey;
      // pick the battle as soon as the script is in, then load only the two sprites it needs
      const addImages = d => {
        // any of the champion's battles; the challenger ('me') comes with the battle
        this.B = this.fixedN !== null && d.battles[this.fixedN]
          ? d.battles[this.fixedN]
          : d.battles[Math.floor(Math.random() * d.battles.length)];
        const foe = this.B.foe, me = this.B.pick;
        if (!this.textures.exists('mon-' + foe)) this.load.image('mon-' + foe, `assets/mon/${foe}.png`);
        if (!this.textures.exists('back-' + me)) this.load.image('back-' + me, `assets/mon/${me}-back.png`);
      };
      if (this.cache.json.exists(key)) addImages(this.cache.json.get(key));
      else {
        this.load.once('filecomplete-json-' + key, (k, type, data) => addImages(data));
        this.load.json(key, this.dataUrl);
      }
    }

    create() {
      this.UI = window.ArenaUI;
      this.D = this.cache.json.get(this.dataKey);
      this.hp = { me: this.B.maxHp.me, foe: this.B.maxHp.foe };
      this.texts = [];

      // Field: grass backdrop and two platforms, GBA style
      const g = this.add.graphics();
      g.fillStyle(0xd8f0c0).fillRect(-600, -400, W + 1200, 470);
      g.fillStyle(0xb8e098).fillRect(-600, 70, W + 1200, 400);
      g.fillStyle(0x98c878).fillEllipse(176, 66, 104, 22);
      g.fillStyle(0xb0d890).fillEllipse(176, 64, 92, 16);
      g.fillStyle(0x98c878).fillEllipse(62, 120, 130, 26);
      g.fillStyle(0xb0d890).fillEllipse(62, 118, 116, 20);

      this.sprite = {
        foe: this.add.image(176 + 140, 68, 'mon-' + this.B.foe).setOrigin(0.5, 1),
        me: this.add.image(62 - 140, 126, 'back-' + this.B.pick).setOrigin(0.5, 1),
      };
      this.home = { foe: { x: 176, y: 68 }, me: { x: 62, y: 126 } };
      this.box = { foe: this.makeBox(8, 8, 'foe'), me: this.makeBox(130, 74, 'me') };
      this.box.foe.c.setVisible(false); this.box.me.c.setVisible(false);

      const advance = () => this.UI.dialog.advance();
      const keys = this.input.keyboard.addKeys('SPACE,ENTER,Z');
      keys.SPACE.on('down', advance); keys.ENTER.on('down', advance); keys.Z.on('down', advance);
      this.input.on('pointerdown', advance);

      this.UI.dialog.busy = true;
      this.UI.dialog.hold('');           // show the box now so the stage can be fitted above it
      this.UI.setHint('battle');
      this.cameras.main.setRoundPixels(true);
      this.fit();
      this.onResize = () => this.fit();
      this.scale.on('resize', this.onResize);
      this.events.once('shutdown', () => this.scale.off('resize', this.onResize));

      if (window.ArenaMusic) {
        window.ArenaMusic.play(this.music);
        const moves = this.B.steps.filter(st => st.t === 'move').map(st => st.m);
        window.ArenaMusic.preloadSfx([...moves, 'hit', 'hit_super', 'hit_weak', 'faint']);
      }
      this.run();
    }

    update() {
      const pad = this.UI.pad;
      if (pad.action) { pad.action = false; this.UI.dialog.advance(); }
    }

    // Fit the stage into the part of the canvas the text box doesn't cover.
    fit() {
      const { width, height } = this.scale.gameSize;
      const dlg = this.UI.dialog.el.getBoundingClientRect();
      const cv = this.game.canvas.getBoundingClientRect();
      const reserve = this.UI.dialog.el.hidden ? 140 : Math.max(0, cv.bottom - dlg.top) + 8;
      const avail = Math.max(80, height - reserve);
      const fit = Math.min(width / W, avail / H);
      const zoom = fit >= 1 ? Math.floor(fit * 2) / 2 : fit;
      const cam = this.cameras.main;
      cam.setZoom(zoom);
      cam.centerOn(W / 2, H / 2 + reserve / (2 * zoom));
      const res = zoom * (window.devicePixelRatio || 1);
      this.texts.forEach(t => t.setResolution(res));
    }

    text(x, y, s, size, color) {
      const t = this.add.text(x, y, s, { fontFamily: FONT, fontSize: size + 'px', fontStyle: 'bold', color: color || '#303030' });
      this.texts.push(t);
      return t;
    }

    makeBox(x, y, side) {
      const L = lang();
      const w = 102, h = side === 'me' ? 38 : 28;
      const c = this.add.container(x, y);
      const g = this.add.graphics();
      g.fillStyle(0x506858).fillRoundedRect(0, 0, w, h, 5);
      g.fillStyle(0xf8f8e0).fillRoundedRect(1.5, 1.5, w - 3, h - 3, 4);
      g.fillStyle(0x506858).fillRoundedRect(30, 17, 66, 6, 2);
      g.fillStyle(0xf0f0f0).fillRect(44, 18.5, 50, 3);
      const fill = this.add.rectangle(44, 18.5, 50, 3, 0x48d048).setOrigin(0, 0);
      const mon = this.D.mon[side === 'me' ? this.B.pick : this.B.foe][L];
      const name = this.text(6, 3, mon, 9);
      const lv = this.text(w - 6, 3, 'Lv' + this.D.level, 8).setOrigin(1, 0);
      const hpTag = this.text(33, 15.5, 'HP', 6, '#f8c030');
      c.add([g, fill, name, lv, hpTag]);
      let num = null;
      if (side === 'me') {
        num = this.text(w - 6, 24, `${this.hp.me}/${this.B.maxHp.me}`, 8).setOrigin(1, 0);
        c.add(num);
      }
      return { c, fill, num };
    }

    setBar(side, hp) {
      const max = this.B.maxHp[side], r = Math.max(0, hp) / max;
      const b = this.box[side];
      b.fill.width = 50 * r;
      b.fill.fillColor = r > 0.5 ? 0x48d048 : r > 0.2 ? 0xf8c030 : 0xf04838;
      if (b.num) b.num.setText(`${Math.round(Math.max(0, hp))}/${max}`);
    }

    // ---------- promise helpers ----------
    wait(ms) { return new Promise(r => this.time.delayedCall(ms, r)); }
    tween(cfg) { return new Promise(r => this.tweens.add({ ...cfg, onComplete: r })); }
    say(s, hold) { return this.UI.dialog.say(s, hold); }

    name(side, lower) {
      const L = lang();
      const mon = this.D.mon[side === 'me' ? this.B.pick : this.B.foe][L];
      if (side === 'me') return mon;
      return L === 'zh' ? '对手的' + mon : (lower ? 'the foe\'s ' : 'The foe\'s ') + mon;
    }

    async animateHp(side, to) {
      const from = this.hp[side];
      this.hp[side] = to;
      const o = { v: from };
      await this.tween({ targets: o, v: to, duration: Math.min(900, 250 + Math.abs(from - to) * 25), onUpdate: () => this.setBar(side, o.v) });
      this.setBar(side, to);
    }

    async run() {
      const L = lang(), zh = L === 'zh';
      const tr = 'Miao';   // every champion trainer is shown as Miao (recorded names in battles/*.json are ignored)
      const foeMon = this.D.mon[this.B.foe][L], myMon = this.D.mon[this.B.pick][L];

      await this.tween({ targets: this.sprite.foe, x: this.home.foe.x, duration: 600, ease: 'Quad.out' });
      await this.say(zh ? `擂主训练家${tr}接受了挑战！` : `Champion trainer ${tr} accepts the challenge!`);
      this.box.foe.c.setVisible(true);
      await this.say(zh ? `${tr}派出了擂主${foeMon}！` : `${tr} sent out the champion ${foeMon}!`, 700);
      const who = this.who;
      await this.say(who
        ? (zh ? `挑战者${who}派出了${myMon}！` : `Challenger ${who} sent out ${myMon}!`)
        : (zh ? `去吧！挑战者${myMon}！` : `Go! Challenger ${myMon}!`), 300);
      await this.tween({ targets: this.sprite.me, x: this.home.me.x, duration: 500, ease: 'Quad.out' });
      this.box.me.c.setVisible(true);
      await this.wait(300);

      const steps = this.B.steps;
      for (let i = 0; i < steps.length; i++) await this.step(steps[i], L, steps.slice(i + 1, i + 3));

      const win = this.B.result === 'win';
      if (window.ArenaMusic) { if (win) window.ArenaMusic.play('victory'); else window.ArenaMusic.stop(); }
      const me = who || (zh ? '你' : 'You');
      const end = zh
        ? (win ? [`${me}战胜了${tr}！`, `擂主${foeMon}被击败了！`] : [`${me}输给了${tr}……`, `擂主${foeMon}守住了擂台！`])
        : (win ? [`${me} defeated ${tr}!`, `The champion ${foeMon} has fallen!`] : [`${me} lost to ${tr}...`, `The champion ${foeMon} held on!`]);
      if (win && this.crit) end.push(zh ? `恭喜本场比赛获得${this.crit}倍暴击奖励！！！` : `Congratulations! This match earned a ${this.crit}× critical bonus!!!`);
      this.UI.dialog.busy = false;
      this.UI.dialog.start(end, () => this.finish());
    }

    sfx(key, maxWait) { return window.ArenaMusic ? window.ArenaMusic.sfx(key, maxWait) : Promise.resolve(); }

    async step(st, L, ahead = []) {
      const zh = L === 'zh';
      const who = this.name(st.s), whoL = this.name(st.s, true);
      switch (st.t) {
        case 'move': {
          const mv = this.D.moves[st.m][L];
          await this.say(zh ? `${who}使用了${mv}！` : `${who} used ${mv}!`, 300);
          const dx = st.s === 'me' ? 10 : -10;
          // the move's own sound plays with the lunge (capped so long ones like Gust don't stall the battle)
          await Promise.all([this.sfx(st.m, 900), this.tween({ targets: this.sprite[st.s], x: this.home[st.s].x + dx, duration: 110, yoyo: true })]);
          break;
        }
        case 'dmg': {
          if (st.from) {
            const why = st.from === 'brn' ? (zh ? '受到了灼伤的伤害！' : 'is hurt by its burn!')
              : st.from === 'psn' ? (zh ? '受到了毒的伤害！' : 'is hurt by poison!')
              : st.from === 'recoil' ? (zh ? '受到了反作用力伤害！' : 'is damaged by the recoil!')
              : st.from === 'sand' ? (zh ? '受到了沙暴的伤害！' : 'is buffeted by the sandstorm!')
              : st.from === 'hail' ? (zh ? '受到了冰雹的伤害！' : 'is pelted by hail!')
              : st.from === 'confusion' ? (zh ? '在混乱中攻击了自己！' : 'hurt itself in its confusion!')
              : st.from === 'roughskin' ? (zh ? '被粗糙皮肤弄伤了！' : 'was hurt by Rough Skin!')
              : st.from === 'trap' ? (zh ? '被紧紧缠住，受到了伤害！' : 'is hurt by the trap!')
              : (zh ? '受到了伤害！' : 'was hurt!');
            await this.say(zh ? who + why : `${who} ${why}`, 400);
          } else {
            // hit sound depends on effectiveness, which the script lists right after the damage
            const eff = ahead.find(a => a.t === 'eff' && a.s === st.s);
            const hit = eff && eff.v === 'super' ? 'hit_super' : eff && eff.v === 'resist' ? 'hit_weak' : 'hit';
            this.sfx(hit);
            await this.tween({ targets: this.sprite[st.s], alpha: 0.15, duration: 70, yoyo: true, repeat: 2 });
          }
          await this.animateHp(st.s, st.hp);
          break;
        }
        case 'heal':
          await this.animateHp(st.s, st.hp);
          await this.say(zh ? `${who}回复了体力！` : `${who} regained health!`);
          break;
        case 'eff':
          if (st.v === 'super') await this.say(zh ? '效果拔群！' : 'It\'s super effective!');
          else if (st.v === 'resist') await this.say(zh ? '效果不太好……' : 'It\'s not very effective...');
          else await this.say(zh ? `对${who}好像没有效果……` : `It doesn't affect ${whoL}...`);
          break;
        case 'crit': await this.say(zh ? '击中了要害！' : 'A critical hit!', 600); break;
        case 'miss': await this.say(zh ? `${who}的攻击没有命中！` : `${who}'s attack missed!`); break;
        case 'fail': await this.say(zh ? '但是失败了！' : 'But it failed!'); break;
        case 'status': await this.say(zh ? who + STATUS.zh[st.v] : `${who} ${STATUS.en[st.v]}`); break;
        case 'weather': {
          const W = {
            zh: { rain: '开始下雨了！', sun: '日照变强了！', sand: '刮起了沙暴！', hail: '开始下冰雹了！', none: '天气恢复了平静。' },
            en: { rain: 'It started to rain!', sun: 'The sunlight turned harsh!', sand: 'A sandstorm kicked up!', hail: 'It started to hail!', none: 'The weather cleared up.' },
          };
          const tint = { rain: 0x6080c0, sun: 0xfff0a0, sand: 0xc0a060, hail: 0xe0f0ff }[st.v];
          if (this.weatherFx) { this.weatherFx.destroy(); this.weatherFx = null; }
          if (tint) this.weatherFx = this.add.rectangle(W_ / 2, H / 2, W_ + 1200, H + 800, tint, 0.18).setDepth(-1);
          await this.say(W[L][st.v] || W[L].none);
          break;
        }
        case 'cure': await this.say(zh ? `${who}的异常状态治愈了！` : `${who} was cured!`); break;
        case 'cant': {
          const c = CANT[L][st.v] || (zh ? '无法行动！' : 'can\'t move!');
          await this.say(zh ? who + c : `${who} ${c}`);
          break;
        }
        case 'boost': {
          const stat = STAT[L][st.stat] || st.stat, n = Math.abs(st.n);
          const s = zh
            ? `${who}的${stat}${st.n > 0 ? (n > 1 ? '大幅提高了' : '提高了') : (n > 1 ? '大幅降低了' : '降低了')}！`
            : `${cap(who)}'s ${stat} ${st.n > 0 ? (n > 1 ? 'rose sharply' : 'rose') : (n > 1 ? 'harshly fell' : 'fell')}!`;
          await this.say(s);
          break;
        }
        case 'faint':
          this.sfx('faint');
          await this.tween({ targets: this.sprite[st.s], y: this.home[st.s].y + 40, alpha: 0, duration: 450, ease: 'Quad.in' });
          await this.say(zh ? `${who}倒下了！` : `${who} fainted!`);
          break;
        default: break;
      }
    }

    finish() {
      this.UI.setHint('arena');
      const result = this.B.result;
      this.scene.stop();
      this.scene.wake('arena', this.replay ? { replay: true } : { result });
    }
  }

  window.ArenaBattle = Battle;
})();
