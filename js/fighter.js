// Kaempfer: Zustandsmaschine, Physik, Boxen, Animation (Ueberblenden, Windup, Lunge, Smear, Squash) und Zeichnung.
import { GROUND, STAGE_W, EDGE, GRAVITY, MAX_METER, ALT_FILTER } from './config.js';
import { ATTACKS, POSE_HURT } from './characters.js';
import { Assets } from './assets.js';
import { Sfx } from './audio.js';

const DASH_FRAMES = 11;
const BACKDASH_FRAMES = 9;
const KNOCKDOWN_LIE = 40;
const GETUP = 10;
const WALK_CYCLE = ['walk', 'walk_b', 'idle', 'walk_b'];
const WALK_STEP = 7;      // Frames je Laufphase

const ease = (k) => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;

export class Fighter {
  constructor(def, input, slot) {
    this.def = def;
    this.input = input;
    this.slot = slot;                 // 0 = links, 1 = rechts
    this.sprites = Assets.sprites[def.id];
    this.altColor = false;
    this.world = null;
    this.foe = null;
    this.roundsWon = 0;
    this.meter = 0;
    this.reset(slot === 0 ? 420 : STAGE_W - 420, slot === 0 ? 1 : -1);
  }

  reset(x, facing) {
    this.x = x; this.y = 0; this.vx = 0; this.vy = 0;
    this.facing = facing;
    this.hp = this.def.hp;
    this.state = 'idle';
    this.pose = 'idle';
    this.anim = { from: 'idle', to: 'idle', t: 9, dur: 1 };
    this.frame = 0; this.t = 0;
    this.stun = 0;
    this.attack = null;
    this.combo = 0;
    this.comboTimer = 0;
    this.knockdown = false;
    this.hitFlash = 0;
    this.tilt = 0;
    this.squash = 0;
    this.trailPos = [];
    this.lastHitDmg = 0;
    this.controllable = true;
    this.meterFullPlayed = false;
    this.walkPhase = 0;
    this.jumpVx = 0;
  }

  get grounded() { return this.y <= 0 && this.vy <= 0; }
  get sprite() { return this.sprites[this.pose] || this.sprites.idle; }
  get invulnerable() { return ['knockdown', 'getup', 'ko', 'win'].includes(this.state); }
  get crouching() { return this.state === 'crouch' || (this.state === 'attack' && this.attack && this.attack.crouch) || (this.state === 'block' && this.blockLow); }
  get cornered() { return this.x <= EDGE + 2 || this.x >= STAGE_W - EDGE - 2; }

  // ---- Animation ---------------------------------------------------------
  // Pose wechseln mit Ueberblendung (dur Frames). dur 0 = sofort umschalten.
  setPose(pose, dur = 4) {
    if (!this.sprites[pose]) pose = 'idle';
    if (pose === this.pose) return;
    this.anim = { from: this.pose, to: pose, t: 0, dur: Math.max(1, dur) };
    if (dur === 0) this.anim.t = this.anim.dur;
    this.pose = pose;
  }

  // ---- Boxen -------------------------------------------------------------
  spriteRect(s = this.sprite) {
    const left = this.facing > 0 ? this.x - s.anchor * s.w : this.x - (1 - s.anchor) * s.w;
    const top = GROUND - this.y - s.h;
    return { left, top, w: s.w, h: s.h };
  }

  boxToWorld(b) {
    if (!b) return null;
    const r = this.spriteRect();
    let x0, x1;
    if (this.facing > 0) { x0 = r.left + b.x * r.w; x1 = x0 + b.w * r.w; }
    else { x1 = r.left + r.w - b.x * r.w; x0 = x1 - b.w * r.w; }
    const y0 = r.top + b.y * r.h;
    return { x0, x1, y0, y1: y0 + b.h * r.h };
  }

  hurtbox() {
    if (this.invulnerable) return null;
    if (this.state === 'attack' && this.attack) return this.boxToWorld(this.attack.hurt);
    return this.boxToWorld(POSE_HURT[this.pose] || POSE_HURT.idle);
  }

  hitbox() {
    if (this.state !== 'attack' || !this.attack || this.attack.projectile) return null;
    const a = this.attack;
    if (a.hasHit) return null;
    if (a.t < a.startup || a.t >= a.startup + a.active) return null;
    return this.boxToWorld(a.hit);
  }

  pushbox() {
    const w = this.crouching ? 70 : 60;
    return { x0: this.x - w / 2, x1: this.x + w / 2 };
  }

  // ---- Zustand -----------------------------------------------------------
  setState(s, pose, blend = 4) {
    if (this.state === 'dash' && s !== 'dash') this.trailPos = [];
    this.state = s; this.t = 0;
    if (pose) this.setPose(pose, blend);
  }

  startAttack(name, extra = {}) {
    const base = ATTACKS[name];
    const sp = this.def.speed;
    this.attack = {
      ...base, ...extra, name, t: 0, hasHit: false,
      startup: Math.max(2, Math.round(base.startup / sp)),
      recovery: Math.round(base.recovery / sp),
    };
    // Windup: Ueberblendung ueber die Startup-Frames, dann sitzt die Pose beim ersten aktiven Frame
    this.setState('attack', base.pose, Math.max(2, this.attack.startup));
    if (!base.air) this.vx = 0;
    if (base.sound === 'heavy') Sfx.whooshHeavy(); else if (base.sound === 'special') Sfx.special(); else Sfx.whooshLight();
  }

  startSpecial() {
    const isSuper = this.meter >= MAX_METER;
    if (isSuper) {
      this.meter = 0;
      this.world.onSuper(this);
    }
    this.startAttack('special', { super: isSuper, spawned: false });
    if (isSuper) { this.anim.t = this.anim.dur; Sfx.superFire(); }   // Pose sitzt sofort fuer den Super-Freeze
  }

  tryChain(inp) {
    const a = this.attack;
    if (!a || !a.hasHit || a.projectile || a.air) return false;
    if (a.t < a.startup + a.active) return false;
    const fwd = inp.axis() === this.facing;
    const down = inp.held('down');
    const chains = a.chain || [];
    const want = [];
    if (inp.pressed('special')) want.push('special');
    if (inp.pressed('hp') && inp.pressed('kick')) want.push('kick_heavy');
    if (inp.pressed('kick')) want.push(down ? 'kick_low' : (fwd ? 'kick_heavy' : 'kick_light'));
    if (inp.pressed('hp')) want.push('punch_heavy');
    if (inp.pressed('lp')) want.push('punch_light');
    for (const w of want) {
      if (w === 'special') { inp.consume('special'); this.startSpecial(); return true; }
      if (chains.includes(w)) { inp.consumeAll(); this.startAttack(w); return true; }
    }
    return false;
  }

  update() {
    const inp = this.input;
    const foe = this.foe;
    this.frame++;
    if (this.anim.t < this.anim.dur) this.anim.t++;
    if (this.comboTimer > 0 && --this.comboTimer === 0) this.combo = 0;
    if (this.hitFlash > 0) this.hitFlash--;
    this.tilt *= 0.82;
    this.squash *= 0.74;

    // Blickrichtung nur am Boden und in neutralen Zustaenden
    if (this.grounded && ['idle', 'walk', 'crouch'].includes(this.state) && foe) {
      this.facing = foe.x >= this.x ? 1 : -1;
    }

    const dir = inp.axis();
    const fwd = dir !== 0 && dir === this.facing;
    const down = inp.held('down');

    switch (this.state) {
      case 'hit': {
        this.stun--;
        this.vx *= 0.86;
        if (this.y > 0 || this.vy > 0) { /* in der Luft bleiben bis zur Landung */ }
        else if (this.knockdown) { this.knockdown = false; this.setState('knockdown', 'ko', 2); this.vx = 0; this.squash = 1; this.world.fx.dust(this.x, GROUND, 12); Sfx.land(); }
        else if (this.stun <= 0) { this.setState('idle', 'idle', 5); this.vx = 0; }
        break;
      }
      case 'block': {
        this.stun--;
        this.vx *= 0.8;
        if (this.stun <= 0) { this.setState(down ? 'crouch' : 'idle', down ? 'crouch' : 'idle', 4); this.vx = 0; }
        break;
      }
      case 'knockdown': {
        this.t++;
        if (this.t >= KNOCKDOWN_LIE) this.setState('getup', 'crouch', 5);
        break;
      }
      case 'getup': {
        this.t++;
        if (this.t >= GETUP) this.setState('idle', 'idle', 5);
        break;
      }
      case 'ko': {
        this.vx *= 0.9;
        if (this.grounded && this.t === 0) { this.t = 1; this.setPose('ko', 2); this.squash = 1; this.world.fx.dust(this.x, GROUND, 16); Sfx.land(); }
        break;
      }
      case 'win': break;
      case 'dash': {
        this.t++;
        const n = this.backdash ? BACKDASH_FRAMES : DASH_FRAMES;
        const spd = this.backdash ? -this.def.dash * 0.75 : this.def.dash;
        this.vx = this.facing * spd * (1 - (this.t / n) * 0.45);
        this.trailPos.push({ x: this.x, y: this.y, pose: this.pose, facing: this.facing });
        if (this.trailPos.length > 5) this.trailPos.shift();
        // Dash kann jederzeit in einen Angriff abgebrochen werden (direktes Gefuehl)
        if (!this.backdash && this.t > 2 && (inp.pressed('lp') || inp.pressed('hp') || inp.pressed('kick'))) {
          const keep = this.vx * 0.5;
          this.handleAttackInput(inp, fwd, down);
          if (this.state === 'attack') { this.vx = keep; break; }
        }
        if (this.t >= n) { this.setState('idle', 'idle', 4); this.vx = 0; this.trailPos = []; }
        break;
      }
      case 'attack': {
        const a = this.attack;
        a.t++;
        if (a.projectile && !a.spawned && a.t >= a.startup) {
          a.spawned = true;
          this.world.spawnProjectile(this, a.super);
        }
        if (a.air) {
          if (this.grounded) { this.setState('idle', 'idle', 3); this.attack = null; this.land(); }
        } else {
          this.vx *= 0.8;
          if (this.tryChain(inp)) break;
          const total = a.startup + a.active + a.recovery;
          // Ausklang: in den letzten Frames schon zurueck in die Grundpose blenden
          if (a.t === total - 4) this.setPose(down ? 'crouch' : 'idle', 5);
          if (a.t >= total) { this.setState(down ? 'crouch' : 'idle', down ? 'crouch' : 'idle', 2); this.attack = null; }
        }
        break;
      }
      case 'jump': {
        if (!this.attack && this.controllable) {
          if (inp.pressed('lp') || inp.pressed('hp')) { inp.consume('lp'); inp.consume('hp'); this.startAttack('air_punch'); }
          else if (inp.pressed('kick')) { inp.consume('kick'); this.startAttack('air_kick'); }
        }
        if (this.state === 'jump') {
          if (this.vy < -1 && this.pose === 'jump' && this.sprites.fall) this.setPose('fall', 7);
          if (this.grounded && this.t > 2) { this.setState('idle', 'idle', 4); this.vx = 0; this.land(); }
        }
        this.t++;
        break;
      }
      default: { // idle, walk, crouch
        if (!this.controllable) { this.vx = 0; if (this.state !== 'idle') this.setState('idle', 'idle', 4); break; }
        if (this.handleAttackInput(inp, fwd, down)) break;
        if (inp.dashReady !== 0 && !down) {
          this.backdash = inp.dashReady === -this.facing;
          this.setState('dash', this.backdash ? 'jump' : 'walk', 2);
          Sfx.dash(); this.world.fx.dust(this.x, GROUND, 6, -this.facing);
          break;
        }
        if (inp.held('up')) {
          this.vy = this.def.jump; this.y = 0.01;
          this.jumpVx = dir * this.def.jumpFwd; this.vx = this.jumpVx;
          this.setState('jump', 'jump', 3); this.squash = -0.6;
          Sfx.jump(); this.world.fx.dust(this.x, GROUND, 5);
          break;
        }
        if (down) { if (this.state !== 'crouch') this.setState('crouch', 'crouch', 4); this.vx = 0; break; }
        if (dir !== 0) {
          this.vx = dir * (fwd ? this.def.walk : this.def.back);
          if (this.state !== 'walk') { this.setState('walk', 'walk', 4); this.walkPhase = 0; }
          this.walkPhase += fwd ? 1 : -1;
          const idx = ((Math.floor(this.walkPhase / WALK_STEP) % WALK_CYCLE.length) + WALK_CYCLE.length) % WALK_CYCLE.length;
          this.setPose(WALK_CYCLE[idx], 5);
          this.t++;
        } else { this.vx = 0; if (this.state !== 'idle') this.setState('idle', 'idle', 4); this.t++; }
      }
    }

    // Physik
    this.x += this.vx;
    if (this.y > 0 || this.vy > 0) {
      this.y += this.vy; this.vy -= GRAVITY;
      if (this.y <= 0) { this.y = 0; this.vy = 0; }
    }
    this.x = Math.max(EDGE, Math.min(STAGE_W - EDGE, this.x));
  }

  // Angriffseingaben aus Stand, Lauf, Ducken oder Dash. Liefert true, wenn ein Angriff gestartet wurde.
  handleAttackInput(inp, fwd, down) {
    if (inp.pressed('special')) { inp.consume('special'); this.startSpecial(); return true; }
    const lp = inp.pressed('lp'), hp = inp.pressed('hp'), kick = inp.pressed('kick');
    if ((hp && kick) || (kick && fwd && !down)) { inp.consume('hp'); inp.consume('kick'); this.startAttack('kick_heavy'); return true; }
    if (kick) { inp.consume('kick'); this.startAttack(down ? 'kick_low' : 'kick_light'); return true; }
    if (hp) { inp.consume('hp'); this.startAttack('punch_heavy'); return true; }
    if (lp) { inp.consume('lp'); this.startAttack('punch_light'); return true; }
    return false;
  }

  land() { Sfx.land(); this.world.fx.dust(this.x, GROUND, 7); this.squash = 1; }

  // ---- Zeichnung ---------------------------------------------------------
  // Liefert Versatz, Skalierung und Smear fuer den aktuellen Angriffsframe.
  attackMotion() {
    const a = this.attack;
    if (this.state !== 'attack' || !a || a.air) return { ox: 0, sx: 1, sy: 1, smear: 0 };
    const heavy = a.hitstop >= 8;
    const lunge = a.projectile ? 10 : heavy ? 22 : 14;
    if (a.t < a.startup) {           // Windup: leicht zurueck
      const k = a.t / a.startup;
      return { ox: -8 * (1 - k) * (1 - k) + lunge * k * k * 0.3, sx: 1 - 0.04 * (1 - k), sy: 1 + 0.02 * (1 - k), smear: 0 };
    }
    const act = a.t - a.startup;
    if (act < a.active) {            // Ausfall mit Smear
      return { ox: lunge, sx: 1.07, sy: 0.97, smear: act < 2 ? (heavy ? 3 : 2) : 0 };
    }
    const k = Math.min(1, (act - a.active) / Math.max(1, a.recovery));
    return { ox: lunge * (1 - ease(k)), sx: 1 + 0.07 * (1 - k), sy: 1 - 0.03 * (1 - k), smear: 0 };
  }

  draw(ctx, hitstop) {
    const s = this.sprite;
    // Schatten
    const shadowScale = Math.max(0.35, 1 - this.y / 420);
    ctx.save();
    ctx.globalAlpha = 0.5 * shadowScale;
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(this.x, GROUND + 6, (this.pose === 'ko' ? 170 : 72) * shadowScale, 13 * shadowScale, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Nachbilder beim Dash
    for (let i = 0; i < this.trailPos.length; i++) {
      const p = this.trailPos[i];
      ctx.globalAlpha = 0.1 + i * 0.05;
      this.drawPose(ctx, this.sprites[p.pose] || s, p.x, p.y, p.facing, { tint: this.def.accent });
    }
    ctx.globalAlpha = 1;

    const m = this.attackMotion();
    let ox = m.ox * this.facing, oy = 0;
    if (hitstop > 0 && (this.state === 'hit' || this.state === 'block')) ox += (Math.random() - 0.5) * 7;
    let sx = m.sx, sy = m.sy, rot = this.tilt * this.facing;
    if (this.state === 'idle') sy *= 1 + Math.sin(this.frame / 11) * 0.012;
    if (this.state === 'walk') oy = -Math.abs(Math.sin(this.walkPhase / (WALK_STEP * 2) * Math.PI)) * 5;
    if (this.state === 'jump' || (this.state === 'attack' && this.attack && this.attack.air)) {
      rot += this.vx * 0.012 * this.facing;
      sy *= 1 + Math.max(0, this.vy) * 0.004;
    }
    if (this.state === 'dash') rot += (this.backdash ? -0.06 : 0.1) * this.facing;
    // Squash bei Landung (positiv) oder Stretch beim Absprung (negativ)
    sx *= 1 + 0.12 * this.squash; sy *= 1 - 0.14 * this.squash;

    const flash = this.hitFlash > 0;
    const opts = { sx, sy, rot, oy, flash };
    // Smear: Geisterbilder entgegen der Schlagrichtung
    for (let i = m.smear; i > 0; i--) {
      ctx.globalAlpha = 0.14 * i;
      this.drawBlend(ctx, this.x + ox - this.facing * i * 16, this.y, { ...opts, sx: sx * (1 + i * 0.04) });
    }
    ctx.globalAlpha = 1;
    this.drawBlend(ctx, this.x + ox, this.y, opts);
  }

  // Zeichnet die aktuelle Pose, bei laufender Ueberblendung beide Posen gemischt.
  drawBlend(ctx, x, y, opts) {
    const a = this.anim;
    const k = a.t >= a.dur ? 1 : ease(a.t / a.dur);
    const to = this.sprites[a.to] || this.sprites.idle;
    const from = this.sprites[a.from] || this.sprites.idle;
    const base = ctx.globalAlpha;
    if (k < 1) {
      ctx.globalAlpha = base * (1 - k);
      this.drawPose(ctx, from, x, y, this.facing, opts);
    }
    ctx.globalAlpha = base * (k < 1 ? k : 1);
    this.drawPose(ctx, to, x, y, this.facing, opts);
    ctx.globalAlpha = base;
  }

  drawPose(ctx, s, x, y, facing, { sx = 1, sy = 1, rot = 0, oy = 0, flash = false, tint = null } = {}) {
    const left = facing > 0 ? x - s.anchor * s.w : x - (1 - s.anchor) * s.w;
    const bottom = GROUND - y + oy;
    ctx.save();
    ctx.translate(x, bottom);
    ctx.rotate(rot);
    ctx.scale(sx, sy);
    ctx.translate(-x, -bottom);
    let filter = '';
    if (this.altColor) filter += ALT_FILTER + ' ';
    if (flash) filter += 'brightness(2.4) contrast(0.8) ';
    if (tint) filter += 'brightness(1.6) saturate(2) ';
    if (filter) ctx.filter = filter;
    if (facing > 0) {
      ctx.drawImage(s.img, left, bottom - s.h, s.w, s.h);
    } else {
      ctx.translate(left + s.w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(s.img, 0, bottom - s.h, s.w, s.h);
    }
    ctx.restore();
  }

  // Spiegelung auf dem Boden (wird vom Kampf in einen Maskenpuffer gezeichnet)
  drawReflection(ctx) {
    const s = this.sprite;
    const m = this.attackMotion();
    ctx.save();
    ctx.translate(0, GROUND * 2);
    ctx.scale(1, -1);
    const base = ctx.globalAlpha;
    const a = this.anim;
    const k = a.t >= a.dur ? 1 : ease(a.t / a.dur);
    if (k < 1) { ctx.globalAlpha = base * (1 - k); this.drawPose(ctx, this.sprites[a.from] || s, this.x + m.ox * this.facing, this.y, this.facing, { sx: m.sx, sy: m.sy * 0.9 }); }
    ctx.globalAlpha = base * k;
    this.drawPose(ctx, s, this.x + m.ox * this.facing, this.y, this.facing, { sx: m.sx, sy: m.sy * 0.9 });
    ctx.restore();
  }

  drawDebug(ctx) {
    const hb = this.hurtbox(), ab = this.hitbox();
    if (hb) { ctx.strokeStyle = 'rgba(0,200,255,0.8)'; ctx.strokeRect(hb.x0, hb.y0, hb.x1 - hb.x0, hb.y1 - hb.y0); }
    if (ab) { ctx.strokeStyle = 'rgba(255,40,40,0.9)'; ctx.lineWidth = 3; ctx.strokeRect(ab.x0, ab.y0, ab.x1 - ab.x0, ab.y1 - ab.y0); ctx.lineWidth = 1; }
    const pb = this.pushbox();
    ctx.strokeStyle = 'rgba(255,255,0,0.6)'; ctx.strokeRect(pb.x0, GROUND - 40, pb.x1 - pb.x0, 40);
  }
}
