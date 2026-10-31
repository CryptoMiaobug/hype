/* 竞技场 — auto-play battle scene.
 * Plays one pre-recorded battle from assets/battles.json (made by battle-gen/build_battles.mjs
 * with the Pokémon Showdown engine). The player only watches; text goes through the shared
 * DOM dialog (window.ArenaUI.dialog) so CJK stays crisp and screen readers get it. */
(function () {
  'use strict';

  const W = 240, H = 124;              // battle "stage" in world px (the text box is DOM, below it)
  const DATA_V = '20261031b';

  const STAT = {
    zh: { atk: '攻击', def: '防御', spa: '特攻', spd: '特防', spe: '速度', acc: '命中率', eva: '闪避率' },
    en: { atk: 'Attack', def: 'Defense', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed', acc: 'accuracy', eva: 'evasiveness' },
  };
  const STATUS = {
    zh: { par: '麻痹了，可能会无法行动！', brn: '被灼伤了！', psn: '中毒了！', tox: '中了剧毒！', slp: '睡着了！', frz: '被冻住了！' },
    en: { par: 'is paralyzed! It may be unable to move!', brn: 'was burned!', psn: 'was poisoned!', tox: 'was badly poisoned!', slp: 'fell asleep!', frz: 'was frozen solid!' },
  };
  const CANT = {
    zh: { par: '因麻痹而无法行动！', flinch: '畏缩了，无法行动！', slp: '正在呼呼大睡。', frz: '被冻住了，无法行动！' },
    en: { par: 'is paralyzed! It can\'t move!', flinch: 'flinched and couldn\'t move!', slp: 'is fast asleep.', frz: 'is frozen solid!' },
  };

  const lang = () => (window.I18n && window.I18n.lang === 'en' ? 'en' : 'zh');
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const FONT = '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif';

  class Battle extends Phaser.Scene {
    constructor() { super('battle'); }

    init(data) { this.pick = data.pick; }

    preload() {
      const addImages = d => {
        const keys = new Set([...d.picks, ...Object.values(d.trainers).map(t => t.mon)]);
        for (const k of keys) if (!this.textures.exists('mon-' + k)) this.load.image('mon-' + k, `assets/mon/${k}.png`);
        for (const k of d.picks) if (!this.textures.exists('back-' + k)) this.load.image('back-' + k, `assets/mon/${k}-back.png`);
      };
      if (this.cache.json.exists('battles')) addImages(this.cache.json.get('battles'));
      else {
        this.load.once('filecomplete-json-battles', (key, type, data) => addImages(data));
        this.load.json('battles', `assets/battles.json?v=${DATA_V}`);
      }
    }

    create() {
      this.UI = window.ArenaUI;
      this.D = this.cache.json.get('battles');
      const pool = this.D.battles.filter(b => b.pick === this.pick);
      this.B = pool[Math.floor(Math.random() * pool.length)];
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
      const tr = this.D.trainers[this.B.trainer][L];
      const foeMon = this.D.mon[this.B.foe][L], myMon = this.D.mon[this.B.pick][L];

      await this.tween({ targets: this.sprite.foe, x: this.home.foe.x, duration: 600, ease: 'Quad.out' });
      await this.say(zh ? `${tr}向你发起了对战！` : `${tr} wants to battle!`);
      this.box.foe.c.setVisible(true);
      await this.say(zh ? `${tr}派出了${foeMon}！` : `${tr} sent out ${foeMon}!`, 700);
      await this.say(zh ? `去吧！${myMon}！` : `Go! ${myMon}!`, 300);
      await this.tween({ targets: this.sprite.me, x: this.home.me.x, duration: 500, ease: 'Quad.out' });
      this.box.me.c.setVisible(true);
      await this.wait(300);

      for (const st of this.B.steps) await this.step(st, L);

      const win = this.B.result === 'win';
      const end = zh
        ? (win ? [`你战胜了${tr}！`] : [`你输给了${tr}……`, `${myMon}已经尽力了！`])
        : (win ? [`You defeated ${tr}!`] : [`You lost to ${tr}...`, `${myMon} did its best!`]);
      this.UI.dialog.busy = false;
      this.UI.dialog.start(end, () => this.finish());
    }

    async step(st, L) {
      const zh = L === 'zh';
      const who = this.name(st.s), whoL = this.name(st.s, true);
      switch (st.t) {
        case 'move': {
          const mv = this.D.moves[st.m][L];
          await this.say(zh ? `${who}使用了${mv}！` : `${who} used ${mv}!`, 450);
          const dx = st.s === 'me' ? 10 : -10;
          await this.tween({ targets: this.sprite[st.s], x: this.home[st.s].x + dx, duration: 110, yoyo: true });
          break;
        }
        case 'dmg': {
          if (st.from) {
            const why = st.from === 'brn' ? (zh ? '受到了灼伤的伤害！' : 'is hurt by its burn!')
              : st.from === 'psn' ? (zh ? '受到了毒的伤害！' : 'is hurt by poison!')
              : st.from === 'recoil' ? (zh ? '受到了反作用力伤害！' : 'is damaged by the recoil!')
              : (zh ? '受到了伤害！' : 'was hurt!');
            await this.say(zh ? who + why : `${who} ${why}`, 400);
          } else {
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
      this.scene.wake('arena', { result });
    }
  }

  window.ArenaBattle = Battle;
})();
