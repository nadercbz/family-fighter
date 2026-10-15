// Kampfszene: Welt, Runden, Kollisionen, Kamera mit Zoom, Spiegelungen, Super-Freeze, HUD, Overlays.
import { W, H, GROUND, STAGE_W, MAX_GAP, EDGE, ROUND_TIME, ROUNDS_TO_WIN, MAX_METER, KEY_LABELS, ALT_FILTER } from '../config.js';
import { Fighter } from '../fighter.js';
import { Projectile } from '../projectile.js';
import { Fx } from '../fx.js';
import { Hud, strokeText } from '../hud.js';
import { Assets } from '../assets.js';
import { Keyboard, CpuInput } from '../input.js';
import { Sfx, announce, startMusic, stopMusic, setMusicVolume } from '../audio.js';
import { StageFx } from '../stagefx.js';

const INTRO_FIGHT_AT = 100;
const SUPER_FREEZE = 26;

export class FightScene {
  constructor(game, setup) {
    this.game = game;
    this.setup = setup;             // { p1: def, p2: def, stage, inputs: [in1, in2], cpu: bool }
    this.stage = setup.stage;
    this.fx = new Fx();
    this.hud = new Hud();
    this.projectiles = [];
    this.f1 = new Fighter(setup.p1, setup.inputs[0], 0);
    this.f2 = new Fighter(setup.p2, setup.inputs[1], 1);
    this.f1.world = this.f2.world = this;
    this.f1.foe = this.f2; this.f2.foe = this.f1;
    if (setup.p1.id === setup.p2.id) this.f2.altColor = true;
    if (setup.inputs[1] instanceof CpuInput) setup.inputs[1].attach(this.f2, this.f1);
    this.zoom = 1;
    this.camX = (STAGE_W - W) / 2;
    this.hitstop = 0;
    this.slowmo = 0;
    this.superFreeze = 0;
    this.superFighter = null;
    this.frameParity = 0;
    this.round = 1;
    this.timer = ROUND_TIME;
    this.timerAcc = 0;
    this.paused = false;
    this.debug = false;
    this.superBanner = null;
    this.refl = document.createElement('canvas');
    this.sfx = new StageFx(this.stage, Assets.stages[this.stage.id], setup.weather, this.fx);
    if (['regen', 'gewitter'].includes(this.sfx.weather)) this.stage = { ...this.stage, reflect: Math.min(0.7, (this.stage.reflect || 0.2) + 0.25) };
    this.startRound();
    startMusic(this.stage.id);
  }

  // ---- Rundenablauf ------------------------------------------------------
  startRound() {
    this.phase = 'intro'; this.pt = 0;
    this.timer = ROUND_TIME; this.timerAcc = 0;
    this.projectiles = [];
    this.f1.reset(420, 1); this.f2.reset(STAGE_W - 420, -1);
    this.f1.controllable = this.f2.controllable = false;
    this.winner = null;
    this.hud.ghost = [1, 1];
    setMusicVolume(0.22);
    if (this.round === 1) announce(`Round one. Fight!`); else announce(`Round ${this.round}. Fight!`);
  }

  endRound(winner, reason) {
    this.phase = 'roundend'; this.pt = 0;
    this.winner = winner;
    this.reason = reason;
    if (winner) {
      winner.roundsWon++;
      if (winner.roundsWon >= ROUNDS_TO_WIN) { this.matchOver = true; }
    }
    this.f1.controllable = this.f2.controllable = false;
    setTimeout(() => announce(winner ? `${winner.def.name.toLowerCase()} wins` : 'Draw game', { rate: 0.85 }), reason === 'ko' ? 900 : 300);
  }

  onKO(loser) {
    this.phase = 'ko'; this.pt = 0;
    this.slowmo = 80;
    this.koLoser = loser;
    this.f1.controllable = this.f2.controllable = false;
    this.fx.doFlash('#fff', 10);
    this.fx.doShake(22);
    Sfx.ko();
    announce('K.O.!', { rate: 0.8, pitch: 0.5 });
    setMusicVolume(0.08);
  }

  onSuper(f) {
    this.fx.doFlash(f.def.color, 10);
    this.superBanner = { f, t: 80 };
    this.superFreeze = SUPER_FREEZE;
    this.superFighter = f;
    announce(f.def.projName, { rate: 1.0, pitch: 0.7 });
  }

  spawnProjectile(f, isSuper) {
    const s = f.sprite;
    const x = f.x + f.facing * s.w * 0.55;
    const y = s.h * 0.62;
    this.projectiles.push(new Projectile(f, x, y, f.facing, isSuper));
    this.fx.burst(x, GROUND - y, f.def.projColor, isSuper ? 40 : 14);
  }

  // ---- Treffer -----------------------------------------------------------
  resolveHit(att, def, atk, hitX, hitY, isProj = false) {
    if (def.invulnerable) return false;
    const dir = Math.sign(def.x - att.x) || att.facing;
    const defBack = def.input.axis() === -dir && def.grounded;
    const defDown = def.input.held('down');
    const canBlockState = ['idle', 'walk', 'crouch', 'block'].includes(def.state);
    let blocked = canBlockState && defBack;
    if (blocked && atk.height === 'low' && !defDown) blocked = false;
    if (blocked && atk.height === 'high' && defDown) blocked = false;

    if (blocked) {
      def.setState('block', defDown ? 'crouch' : 'block', 2); def.blockLow = defDown; def.stun = atk.blockstun;
      def.vx = dir * atk.push * 0.7;
      def.tilt = 0.05;
      if (def.cornered && !isProj) att.vx = -dir * atk.push * 0.8;
      if (atk.chip) { def.hp = Math.max(1, def.hp - atk.dmg * atk.chip); }
      att.meter = Math.min(MAX_METER, att.meter + 4);
      def.meter = Math.min(MAX_METER, def.meter + 3);
      this.hitstop = Math.max(this.hitstop, 3);
      this.fx.spark(hitX, hitY, '#7fd0ff', 8, 0.6);
      this.fx.impact(hitX, hitY, 26, '#9fe0ff');
      Sfx.block();
      return true;
    }

    // Treffer
    let dmg = atk.dmg * att.def.dmg;
    if (def.state === 'hit' && att.combo > 0) dmg *= Math.max(0.45, 1 - att.combo * 0.12);
    dmg = Math.round(dmg);
    def.hp = Math.max(0, def.hp - dmg);
    def.hitFlash = 5;
    def.stun = atk.hitstun;
    def.lastHitDmg = dmg;
    const heavy = atk.hitstop >= 8;
    const launch = atk.knockdown || def.y > 0 || def.state === 'jump' || (def.state === 'attack' && def.attack && def.attack.air);
    def.setState('hit', 'hit', 2); def.attack = null;
    def.vx = dir * atk.push;
    def.tilt = heavy ? 0.22 : 0.12;
    if (launch) { def.vy = 9; def.y = Math.max(def.y, 0.01); def.vx = dir * Math.max(6, atk.push * 0.7); def.knockdown = true; }
    if (def.cornered && !isProj) att.vx = -dir * atk.push * 0.9;
    att.combo++; att.comboTimer = atk.hitstun + 12;
    if (att.combo >= 2) this.hud.showCombo(att.slot, att.combo);
    att.meter = Math.min(MAX_METER, att.meter + (isProj ? 6 : 10));
    def.meter = Math.min(MAX_METER, def.meter + 6);
    for (const f of [att, def]) if (f.meter >= MAX_METER && !f.meterFullPlayed) { f.meterFullPlayed = true; Sfx.meterFull(); }
    if (att.meter < MAX_METER) att.meterFullPlayed = false;
    if (def.meter < MAX_METER) def.meterFullPlayed = false;
    this.hitstop = Math.max(this.hitstop, atk.hitstop);
    this.fx.spark(hitX, hitY, heavy ? '#ffb13d' : '#ffe66b', heavy ? 22 : 12, heavy ? 1.4 : 0.9);
    this.fx.impact(hitX, hitY, heavy ? 52 : 34, '#fff');
    if (heavy) this.fx.doShake(10); else this.fx.doShake(4);
    if (this.game.touch) this.game.touch.vibrate(heavy ? 35 : 15);
    if (atk.sound === 'proj') Sfx.projHit(); else if (heavy) Sfx.hitHeavy(); else Sfx.hitLight();
    if (atk.super) { this.fx.burst(hitX, hitY, att.def.projColor, 50); this.fx.doShake(18); }

    if (def.hp <= 0) {
      def.setState('ko', 'hit', 0); def.vy = 11; def.y = 0.01; def.vx = dir * 7; def.t = 0;
      this.onKO(def);
    }
    return true;
  }

  overlap(a, b) { return a && b && a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0; }

  collide() {
    const fs = [this.f1, this.f2];
    for (const att of fs) {
      const def = att.foe;
      const hb = att.hitbox();
      if (!hb) continue;
      const hurt = def.hurtbox();
      if (this.overlap(hb, hurt)) {
        att.attack.hasHit = true;
        const hx = (Math.max(hb.x0, hurt.x0) + Math.min(hb.x1, hurt.x1)) / 2;
        const hy = (Math.max(hb.y0, hurt.y0) + Math.min(hb.y1, hurt.y1)) / 2;
        this.resolveHit(att, def, att.attack, hx, hy);
      }
    }
    for (const p of this.projectiles) {
      if (!p.alive) continue;
      const pr = p.rect();
      for (const q of this.projectiles) {
        if (q === p || !q.alive || q.owner === p.owner) continue;
        if (this.overlap(pr, q.rect())) {
          this.fx.burst((p.x + q.x) / 2, GROUND - p.y, '#ffffff', 30); Sfx.projHit(); this.fx.doShake(6);
          if (!p.isSuper) p.alive = false; if (!q.isSuper) q.alive = false;
          if (p.isSuper && q.isSuper) { p.alive = q.alive = false; }
        }
      }
      if (!p.alive) continue;
      const def = p.owner.foe;
      const hurt = def.hurtbox();
      if (this.overlap(pr, hurt)) {
        const hit = this.resolveHit(p.owner, def, p.atk, p.x, GROUND - p.y, true);
        if (hit) { p.alive = false; this.fx.burst(p.x, GROUND - p.y, p.color, 24); }
      }
    }
    this.projectiles = this.projectiles.filter(p => p.alive);

    // Pushboxen
    const a = this.f1, b = this.f2;
    if (Math.abs(a.y - b.y) < 140 && !a.invulnerable && !b.invulnerable) {
      const pa = a.pushbox(), pb = b.pushbox();
      if (pa.x0 < pb.x1 && pa.x1 > pb.x0) {
        const ov = a.x < b.x ? pa.x1 - pb.x0 : pb.x1 - pa.x0;
        const sgn = a.x < b.x ? -1 : 1;
        if (a.cornered) b.x -= sgn * ov; else if (b.cornered) a.x += sgn * ov;
        else { a.x += sgn * ov / 2; b.x -= sgn * ov / 2; }
      }
    }
    for (const f of fs) {
      const gap = Math.abs(f.x - f.foe.x);
      if (gap > MAX_GAP && Math.sign(f.vx) === Math.sign(f.x - f.foe.x)) f.x = f.foe.x + Math.sign(f.x - f.foe.x) * MAX_GAP;
    }
    for (const f of fs) f.x = Math.max(EDGE, Math.min(STAGE_W - EDGE, f.x));
  }

  // ---- Update ------------------------------------------------------------
  update() {
    if (Keyboard.justPressed('Escape')) { this.paused = !this.paused; Sfx.back(); }
    if (Keyboard.justPressed('F3')) this.debug = !this.debug;
    if (this.paused) {
      if (Keyboard.justPressed('KeyQ') || Keyboard.justPressed('KeyR') || Keyboard.justPressed('KeyU')) { stopMusic(); this.sfx.stop(); this.game.toSelect(); }
      return;
    }
    this.hud.update(this.f1, this.f2);
    if (this.superBanner && --this.superBanner.t <= 0) this.superBanner = null;
    this.updateCamera();

    // Super-Freeze: alles steht, nur der Angreifer leuchtet
    this.sfx.update();
    if (this.superFreeze > 0) { this.superFreeze--; this.fx.update(); return; }
    this.fx.update();

    // Zeitlupe bei KO
    if (this.slowmo > 0) { this.slowmo--; this.frameParity ^= 1; if (this.frameParity) return; }

    // Hitstop friert beide ein
    if (this.hitstop > 0) { this.hitstop--; this.f1.input.update(); this.f2.input.update(); return; }

    this.pt++;
    switch (this.phase) {
      case 'intro':
        if (this.pt === INTRO_FIGHT_AT) { this.phase = 'fight'; this.f1.controllable = this.f2.controllable = true; Sfx.roundBell(); this.f1.input.consumeAll(); this.f2.input.consumeAll(); }
        break;
      case 'fight':
        if (++this.timerAcc >= 60) { this.timerAcc = 0; this.timer--; if (this.timer <= 10 && this.timer > 0) Sfx.timeTick(); if (this.timer <= 0) this.timeOver(); }
        break;
      case 'ko':
        if (this.pt > 100) {
          const w = this.f1.hp <= 0 ? this.f2 : this.f1;
          this.endRound(w, 'ko');
          w.setState('win', 'win', 6);
        }
        break;
      case 'roundend':
        if (this.pt > 170) {
          if (this.matchOver) { this.phase = 'result'; this.pt = 0; setMusicVolume(0.12); }
          else { if (this.winner) this.round++; this.startRound(); }
        }
        break;
      case 'result':
        if (Keyboard.justPressed('Enter') || Keyboard.justPressed('Space')) { stopMusic(); this.sfx.stop(); this.game.rematch(); }
        if (Keyboard.justPressed('Backspace') || Keyboard.justPressed('KeyR') || Keyboard.justPressed('KeyU')) { stopMusic(); this.sfx.stop(); this.game.toSelect(); }
        break;
    }

    this.f1.input.update(); this.f2.input.update();
    this.f1.update(); this.f2.update();
    for (const p of this.projectiles) p.update(this.fx);
    if (this.phase === 'fight' || this.phase === 'intro') this.collide();
    else this.projectiles = this.projectiles.filter(p => p.alive);
  }

  updateCamera() {
    let targetZoom, focusX;
    if (this.phase === 'ko' && this.koLoser) {
      targetZoom = 1.3; focusX = (this.koLoser.x * 2 + this.koLoser.foe.x) / 3;
    } else if (this.phase === 'result') {
      targetZoom = 1.0; focusX = (this.f1.x + this.f2.x) / 2;
    } else {
      const dist = Math.abs(this.f1.x - this.f2.x);
      targetZoom = 1 + 0.13 * Math.max(0, Math.min(1, (640 - dist) / 420));
      focusX = (this.f1.x + this.f2.x) / 2;
    }
    this.zoom += (targetZoom - this.zoom) * 0.08;
    const viewW = W / this.zoom;
    const target = Math.max(0, Math.min(STAGE_W - viewW, focusX - viewW / 2));
    this.camX += (target - this.camX) * 0.14;
  }

  timeOver() {
    const a = this.f1, b = this.f2;
    this.f1.controllable = this.f2.controllable = false;
    const ra = a.hp / a.def.hp, rb = b.hp / b.def.hp;
    const w = ra > rb ? a : rb > ra ? b : null;
    announce('Time over');
    this.endRound(w, 'time');
    if (w) w.setState('win', 'win', 6);
  }

  // ---- Zeichnung ---------------------------------------------------------
  applyCamera(ctx) {
    const camY = GROUND - GROUND / this.zoom;
    ctx.translate(this.fx.shakeX, this.fx.shakeY);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.camX, -camY);
  }

  draw(ctx) {
    const bg = Assets.stages[this.stage.id];
    const superOn = this.superFreeze > 0 && this.superFighter;
    const order = this.f1.state === 'attack' || this.f1.state === 'dash' ? [this.f2, this.f1] : [this.f1, this.f2];

    ctx.save();
    this.applyCamera(ctx);
    ctx.drawImage(bg, 0, 0, STAGE_W, H);
    this.sfx.drawBack(ctx);
    // Bodenverlauf fuer Tiefe
    const gl = ctx.createLinearGradient(0, GROUND - 20, 0, H);
    gl.addColorStop(0, 'rgba(0,0,0,0)'); gl.addColorStop(1, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = gl; ctx.fillRect(-200, GROUND - 20, STAGE_W + 400, H - GROUND + 20);
    ctx.restore();

    // Spiegelung auf dem Boden
    this.drawReflections(ctx);

    ctx.save();
    this.applyCamera(ctx);
    // Projektil-Licht auf dem Boden
    for (const p of this.projectiles) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35;
      const g = ctx.createRadialGradient(p.x, GROUND, 5, p.x, GROUND, 160);
      g.addColorStop(0, p.color); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(p.x, GROUND + 4, 160, 40, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    if (superOn) {
      const other = this.superFighter.foe;
      other.draw(ctx, this.hitstop);
      ctx.fillStyle = 'rgba(0,0,10,0.72)'; ctx.fillRect(-400, -400, STAGE_W + 800, H + 800);
      const k = this.superFreeze / SUPER_FREEZE;
      this.superFighter.hitFlash = k > 0.5 ? 1 : 0;
      ctx.save();
      ctx.shadowColor = this.superFighter.def.accent; ctx.shadowBlur = 60;
      this.superFighter.draw(ctx, 0);
      ctx.restore();
      this.superFighter.hitFlash = 0;
    } else {
      for (const f of order) f.draw(ctx, this.hitstop);
    }
    for (const p of this.projectiles) p.draw(ctx, 0);
    this.fx.draw(ctx, 0);
    this.sfx.drawFront(ctx);
    if (this.debug) { this.f1.drawDebug(ctx); this.f2.drawDebug(ctx); }
    ctx.restore();

    // Vignette
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

    this.hud.draw(ctx, this.f1, this.f2, this.timer, this.round);
    this.fx.drawOverlay(ctx, W, H);
    this.drawPhase(ctx);
    if (this.superBanner) this.drawSuperBanner(ctx);
    if (this.paused) this.drawPause(ctx);
  }

  drawReflections(ctx) {
    const strength = this.stage.reflect || 0;
    if (strength <= 0) return;
    const dpr = ctx.getTransform().a;
    const rh = H - GROUND;
    const c = this.refl;
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(rh * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(rh * dpr); }
    const rc = c.getContext('2d');
    rc.setTransform(1, 0, 0, 1, 0, 0);
    rc.clearRect(0, 0, c.width, c.height);
    rc.setTransform(dpr, 0, 0, dpr, 0, -GROUND * dpr);
    this.applyCamera(rc);
    rc.globalAlpha = 1;
    for (const f of [this.f1, this.f2]) f.drawReflection(rc);
    rc.setTransform(1, 0, 0, 1, 0, 0);
    rc.globalCompositeOperation = 'destination-in';
    const g = rc.createLinearGradient(0, 0, 0, c.height);
    g.addColorStop(0, `rgba(0,0,0,${strength})`); g.addColorStop(0.7, `rgba(0,0,0,${strength * 0.25})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    rc.fillStyle = g; rc.fillRect(0, 0, c.width, c.height);
    rc.globalCompositeOperation = 'source-over';
    ctx.drawImage(c, 0, GROUND, W, rh);
  }

  drawPhase(ctx) {
    const t = this.pt;
    if (this.phase === 'intro') {
      if (t < 70) {
        const k = Math.min(1, t / 10);
        const scale = 1.6 - 0.6 * k;
        this.bigText(ctx, `RUNDE ${this.round}`, W / 2, H / 2 - 40, 96, '#ffd500', scale, Math.min(1, t / 6));
      } else if (t < INTRO_FIGHT_AT + 18) {
        const k = Math.max(0, Math.min(1, (t - 70) / 8));
        this.bigText(ctx, 'FIGHT!', W / 2, H / 2 - 20, 130, '#ff3b3b', 2.4 - 1.4 * k, k);
      }
    } else if (this.phase === 'ko') {
      const k = Math.min(1, t / 14);
      this.bigText(ctx, 'K.O.', W / 2, H / 2 - 30, 180, '#ff2a2a', 2.6 - 1.6 * k, k);
    } else if (this.phase === 'roundend') {
      const k = Math.min(1, t / 10);
      if (this.reason === 'time') this.bigText(ctx, 'TIME OVER', W / 2, H / 2 - 110, 70, '#ffd500', 1, k);
      if (this.winner) {
        this.bigText(ctx, `${this.winner.def.name} GEWINNT`, W / 2, H / 2 - 30, 84, this.winner.def.accent, 1.4 - 0.4 * k, k);
        if (this.reason === 'ko' && this.winner.hp === this.winner.def.hp) this.bigText(ctx, 'PERFECT!', W / 2, H / 2 + 50, 56, '#7fffd4', 1, k);
      } else this.bigText(ctx, 'UNENTSCHIEDEN', W / 2, H / 2 - 30, 84, '#fff', 1, k);
    } else if (this.phase === 'result') {
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H);
      const w = this.winner;
      const s = w.sprites.win;
      const scale = 1.25;
      ctx.save();
      if (w.altColor) ctx.filter = ALT_FILTER;
      ctx.shadowColor = w.def.color; ctx.shadowBlur = 50;
      ctx.drawImage(s.img, W / 2 - s.w * scale / 2, H - 40 - s.h * scale, s.w * scale, s.h * scale);
      ctx.restore();
      this.bigText(ctx, 'WINNER', W / 2, 120, 110, '#ffd500', 1, 1);
      this.bigText(ctx, `${w.def.name}  ·  ${w.def.title}`, W / 2, 190, 36, '#fff', 1, 1);
      const blink = Math.floor(performance.now() / 500) % 2 === 0;
      if (blink) strokeText(ctx, this.game.touchDevice ? 'OK: Revanche      SPECIAL: Neue Auswahl' : 'ENTER: Revanche      BACKSPACE: Neue Auswahl', W / 2, H - 50, 24, '#fff', '#000', 'center', false);
    }
  }

  drawSuperBanner(ctx) {
    const b = this.superBanner;
    const k = Math.min(1, (80 - b.t) / 8);
    const x = b.f.slot === 0 ? 40 : W - 40;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 150, W, 70);
    strokeText(ctx, `${b.f.def.projName.toUpperCase()}!`, x, 185, 44 * (1.6 - 0.6 * k), b.f.def.accent, '#000', b.f.slot === 0 ? 'left' : 'right');
  }

  drawPause(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, W, H);
    this.bigText(ctx, 'PAUSE', W / 2, 110, 90, '#ffd500', 1, 1);
    const rows = [
      ['', 'SPIELER 1', 'SPIELER 2'],
      ['Laufen / Springen / Ducken', KEY_LABELS.p1.move, KEY_LABELS.p2.move],
      ['Leichter Schlag', KEY_LABELS.p1.lp, KEY_LABELS.p2.lp],
      ['Schwerer Schlag', KEY_LABELS.p1.hp, KEY_LABELS.p2.hp],
      ['Tritt (vorwärts + Tritt = schwer, unten + Tritt = tief)', KEY_LABELS.p1.kick, KEY_LABELS.p2.kick],
      ['Special (volle Leiste = SUPER)', KEY_LABELS.p1.special, KEY_LABELS.p2.special],
      ['Dash', 'A A / D D', '← ← / → →'],
      ['Block', 'Rückwärts halten (tief: unten + rückwärts)', ''],
      ['Combos', 'Leicht → Schwer → Schwerer Tritt → Special bei Treffer', ''],
      ['Gamepad', 'X Schlag, Y schwer, A Tritt, B/RB Special, LB schwerer Tritt', ''],
    ];
    let y = 180;
    for (const r of rows) {
      strokeText(ctx, r[0], 100, y, 21, '#fff', '#000', 'left', false);
      strokeText(ctx, r[1], 700, y, 21, '#9bbcff', '#000', 'left', false);
      strokeText(ctx, r[2], 1040, y, 21, '#ff9bb0', '#000', 'left', false);
      y += 38;
    }
    strokeText(ctx, this.game.touchDevice ? 'II: weiter      SPECIAL: zurück zur Auswahl' : 'ESC: weiter      Q: zurück zur Auswahl      M: Ton an/aus      F3: Hitboxen', W / 2, H - 60, 22, '#ffd500', '#000', 'center', false);
  }

  bigText(ctx, str, x, y, size, color, scale = 1, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y); ctx.scale(scale, scale);
    strokeText(ctx, str, 0, 0, size, color, '#000');
    ctx.restore();
  }
}
