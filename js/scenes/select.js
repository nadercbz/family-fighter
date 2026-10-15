// Charakterauswahl wie bei Street Fighter, danach Buehnenauswahl.
import { W, H, GROUND, STAGE_W, KEYS, ALT_FILTER } from '../config.js';
import { CHARACTERS, STAGES } from '../characters.js';
import { Assets } from '../assets.js';
import { Keyboard, PlayerInput, CpuInput } from '../input.js';
import { strokeText } from '../hud.js';
import { Sfx, startMusic, stopMusic, announce } from '../audio.js';
import { WEATHERS } from '../stagefx.js';

export class SelectScene {
  constructor(game, cpu) {
    this.game = game;
    this.cpu = cpu;
    this.t = 0;
    this.cur = [1, 3];
    this.locked = [false, false];
    this.lockT = [0, 0];
    this.stageCur = Math.floor(Math.random() * STAGES.length);
    this.weatherCur = 0;
    this.phase = 'chars';     // chars -> stage -> go
    this.cpuSpin = 0;
    this.goT = 0;
    startMusic('title');
    announce('Select your fighter', { rate: 1 });
  }

  update() {
    this.t++;
    if (Keyboard.justPressed('Escape')) { stopMusic(); this.game.toTitle(); return; }
    if (this.phase === 'chars') this.updateChars();
    else if (this.phase === 'stage') this.updateStage();
    else if (this.phase === 'go') { if (++this.goT > 60) this.start(); }
  }

  updateChars() {
    const n = CHARACTERS.length;
    for (let p = 0; p < 2; p++) {
      if (this.cpu && p === 1) continue;
      const k = KEYS[p === 0 ? 'p1' : 'p2'];
      if (!this.locked[p]) {
        if (Keyboard.justPressed(k.left)) { this.cur[p] = (this.cur[p] + n - 1) % n; Sfx.select(); }
        if (Keyboard.justPressed(k.right)) { this.cur[p] = (this.cur[p] + 1) % n; Sfx.select(); }
        if (Keyboard.justPressed(k.lp) || Keyboard.justPressed(k.hp) || Keyboard.justPressed(k.kick) || Keyboard.justPressed('Enter') && p === 0) {
          this.locked[p] = true; this.lockT[p] = 0; Sfx.confirm();
          announce(CHARACTERS[this.cur[p]].name.toLowerCase(), { rate: 1.0, pitch: 0.7 });
        }
      } else {
        this.lockT[p]++;
        if (Keyboard.justPressed(k.special) || Keyboard.justPressed('Backspace') && p === 0) { this.locked[p] = false; Sfx.back(); }
      }
    }
    // CPU waehlt zufaellig, sobald Spieler 1 fest ist
    if (this.cpu) {
      if (this.locked[0] && !this.locked[1]) {
        this.cpuSpin++;
        if (this.cpuSpin % 5 === 0 && this.cpuSpin < 50) { this.cur[1] = Math.floor(Math.random() * n); Sfx.select(); }
        if (this.cpuSpin >= 55) { this.locked[1] = true; this.lockT[1] = 0; Sfx.confirm(); }
      } else if (!this.locked[0]) { this.locked[1] = false; this.cpuSpin = 0; }
      else this.lockT[1]++;
    }
    if (this.locked[0] && this.locked[1] && this.lockT[0] > 30 && this.lockT[1] > 30) {
      this.phase = 'stage'; Sfx.confirm();
    }
  }

  updateStage() {
    const n = STAGES.length;
    const left = Keyboard.justPressed(KEYS.p1.left) || Keyboard.justPressed(KEYS.p2.left);
    const right = Keyboard.justPressed(KEYS.p1.right) || Keyboard.justPressed(KEYS.p2.right);
    const up = Keyboard.justPressed(KEYS.p1.up) || Keyboard.justPressed(KEYS.p2.up);
    const dn = Keyboard.justPressed(KEYS.p1.down) || Keyboard.justPressed(KEYS.p2.down);
    if (up) { this.weatherCur = (this.weatherCur + WEATHERS.length - 1) % WEATHERS.length; Sfx.select(); }
    if (dn) { this.weatherCur = (this.weatherCur + 1) % WEATHERS.length; Sfx.select(); }
    if (left) { this.stageCur = (this.stageCur + n - 1) % n; Sfx.select(); }
    if (right) { this.stageCur = (this.stageCur + 1) % n; Sfx.select(); }
    if (Keyboard.justPressed(KEYS.p1.special) || Keyboard.justPressed(KEYS.p2.special)) { this.stageCur = Math.floor(Math.random() * n); Sfx.select(); }
    if (Keyboard.justPressed(KEYS.p1.lp) || Keyboard.justPressed(KEYS.p2.lp) || Keyboard.justPressed('Enter') || Keyboard.justPressed('Space')) {
      this.phase = 'go'; this.goT = 0; Sfx.confirm();
    }
    if (Keyboard.justPressed(KEYS.p1.hp) || Keyboard.justPressed('Backspace')) { this.phase = 'chars'; this.locked = [false, false]; Sfx.back(); }
  }

  start() {
    stopMusic();
    const inputs = [new PlayerInput('p1'), this.cpu ? new CpuInput(1) : new PlayerInput('p2')];
    this.game.startFight({
      p1: CHARACTERS[this.cur[0]], p2: CHARACTERS[this.cur[1]],
      stage: STAGES[this.stageCur], inputs, cpu: this.cpu, weather: WEATHERS[this.weatherCur],
    });
  }

  // ---- Zeichnung ---------------------------------------------------------
  draw(ctx) {
    const bg = Assets.stages.hinterhof;
    ctx.drawImage(bg, -(STAGE_W - W) / 2, 0, STAGE_W, H);
    ctx.fillStyle = 'rgba(4,6,20,0.72)'; ctx.fillRect(0, 0, W, H);
    // Lichtstreifen
    ctx.save(); ctx.globalAlpha = 0.08;
    for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? '#fff' : '#ffd500'; ctx.fillRect(((this.t * 2 + i * 220) % (W + 300)) - 300, 0, 60, H); }
    ctx.restore();

    if (this.phase === 'chars' || this.phase === 'go') this.drawChars(ctx);
    if (this.phase === 'stage' || this.phase === 'go') this.drawStage(ctx);
    if (this.phase === 'go') {
      ctx.fillStyle = `rgba(0,0,0,${Math.min(1, this.goT / 40)})`; ctx.fillRect(0, 0, W, H);
    }
  }

  drawChars(ctx) {
    strokeText(ctx, 'WÄHLE DEINEN KÄMPFER', W / 2, 44, 44, '#ffd500', '#000');
    const n = CHARACTERS.length;
    const tile = 150, gap = 18;
    const totalW = n * tile + (n - 1) * gap;
    const x0 = W / 2 - totalW / 2;
    const y0 = H - 250;
    for (let i = 0; i < n; i++) {
      const c = CHARACTERS[i];
      const x = x0 + i * (tile + gap);
      const por = Assets.portraits[c.id];
      ctx.save();
      ctx.fillStyle = c.color; ctx.fillRect(x, y0, tile, tile);
      ctx.beginPath(); ctx.rect(x, y0, tile, tile); ctx.clip();
      const s = Math.max(tile / por.width, tile / por.height) * 1.05;
      const dw = por.width * s, dh = por.height * s;
      ctx.drawImage(por, x + (tile - dw) / 2, y0 + (tile - dh) / 2 - 6, dw, dh);
      const g = ctx.createLinearGradient(0, y0 + tile - 50, 0, y0 + tile);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.85)');
      ctx.fillStyle = g; ctx.fillRect(x, y0 + tile - 50, tile, 50);
      ctx.restore();
      strokeText(ctx, c.name, x + tile / 2, y0 + tile - 16, 22, '#fff', '#000', 'center', false);
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.strokeRect(x, y0, tile, tile);
      // Cursor
      for (let p = 0; p < 2; p++) {
        if (this.cur[p] !== i) continue;
        const col = p === 0 ? '#2f8bff' : '#ff3d6e';
        const blink = this.locked[p] ? 1 : (Math.sin(this.t / 5) * 0.5 + 0.5);
        ctx.lineWidth = 6; ctx.strokeStyle = col; ctx.globalAlpha = 0.5 + 0.5 * blink;
        const inset = p === 0 ? 0 : 7;
        ctx.strokeRect(x - 4 + inset, y0 - 4 + inset, tile + 8 - inset * 2, tile + 8 - inset * 2);
        ctx.globalAlpha = 1;
        const tag = p === 0 ? '1P' : (this.cpu ? 'CPU' : '2P');
        const tx = p === 0 ? x + 4 : x + tile - 4;
        ctx.fillStyle = col; ctx.fillRect(p === 0 ? x - 4 : x + tile - 44, y0 - 26, 48, 26);
        strokeText(ctx, tag, p === 0 ? x + 20 : x + tile - 20, y0 - 13, 18, '#fff', '#000', 'center', false);
      }
    }
    // grosse Vorschau links und rechts
    for (let p = 0; p < 2; p++) {
      const c = CHARACTERS[this.cur[p]];
      const s = Assets.sprites[c.id].idle;
      const scale = 0.95;
      const facing = p === 0 ? 1 : -1;
      const x = p === 0 ? 230 : W - 230;
      const bob = this.locked[p] ? 0 : Math.sin(this.t / 12) * 3;
      const bottom = GROUND - 120;
      ctx.save();
      if (p === 1 && this.cur[0] === this.cur[1]) ctx.filter = ALT_FILTER;
      if (this.locked[p]) { const k = Math.min(1, this.lockT[p] / 8); ctx.globalAlpha = 1; ctx.translate(x, bottom); ctx.scale(1 + (1 - k) * 0.15, 1 + (1 - k) * 0.15); ctx.translate(-x, -bottom); }
      if (facing > 0) ctx.drawImage(s.img, x - s.anchor * s.w * scale, bottom - s.h * scale + bob, s.w * scale, s.h * scale);
      else { ctx.translate(x + (1 - s.anchor) * s.w * scale, 0); ctx.scale(-1, 1); ctx.drawImage(s.img, 0, bottom - s.h * scale + bob, s.w * scale, s.h * scale); }
      ctx.restore();
      if (this.locked[p]) {
        ctx.save(); ctx.translate(x, bottom - s.h * scale - 10); ctx.rotate(p === 0 ? -0.12 : 0.12);
        strokeText(ctx, 'OK!', 0, 0, 48, '#7fffd4', '#000'); ctx.restore();
      }
      // Name, Titel, Werte
      const tx = p === 0 ? 60 : W - 60;
      const align = p === 0 ? 'left' : 'right';
      strokeText(ctx, c.name, tx, 110, 54, c.accent, '#000', align);
      strokeText(ctx, c.title, tx, 150, 24, '#fff', '#000', align, false);
      strokeText(ctx, `Special: ${c.projName}`, tx, 180, 18, '#ddd', '#000', align, false);
      const keys = Object.entries(c.stats);
      for (let k = 0; k < keys.length; k++) {
        const [name, v] = keys[k];
        const y = 215 + k * 26;
        strokeText(ctx, name.toUpperCase(), tx, y, 16, '#bbb', '#000', align, false);
        for (let d = 0; d < 5; d++) {
          const bx = p === 0 ? tx + 110 + d * 22 : tx - 110 - d * 22 - 16;
          ctx.fillStyle = d < v ? c.accent : 'rgba(255,255,255,0.15)';
          ctx.fillRect(bx, y - 7, 16, 14);
        }
      }
    }
    const hint = this.game.touchDevice
      ? (this.cpu ? 'Stick links / rechts · SCHLAG bestätigen · SPECIAL zurück' : 'Jeder mit seinem Stick wählen · SCHLAG bestätigen · SPECIAL zurück')
      : this.cpu
      ? 'P1: A / D wählen · F bestätigen · R zurück · ESC Titel'
      : 'P1: A / D wählen · F bestätigen · R zurück      P2: ← / → wählen · J bestätigen · U zurück      ESC Titel';
    strokeText(ctx, hint, W / 2, H - 40, 18, '#ccc', '#000', 'center', false);
  }

  drawStage(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.78)'; ctx.fillRect(0, 0, W, H);
    strokeText(ctx, 'WÄHLE DIE BÜHNE', W / 2, 80, 48, '#ffd500', '#000');
    const n = STAGES.length;
    const tw = 270, th = 152, gap = 24;
    const x0 = W / 2 - (n * tw + (n - 1) * gap) / 2;
    const y0 = 300;
    for (let i = 0; i < n; i++) {
      const s = STAGES[i];
      const x = x0 + i * (tw + gap);
      const sel = i === this.stageCur;
      const img = Assets.stages[s.id];
      ctx.save();
      if (sel) { ctx.translate(x + tw / 2, y0 + th / 2); ctx.scale(1.08, 1.08); ctx.translate(-(x + tw / 2), -(y0 + th / 2)); }
      ctx.drawImage(img, x, y0, tw, th);
      if (!sel) { ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x, y0, tw, th); }
      ctx.lineWidth = sel ? 6 : 2; ctx.strokeStyle = sel ? '#ffd500' : 'rgba(255,255,255,0.4)'; ctx.strokeRect(x, y0, tw, th);
      ctx.restore();
      strokeText(ctx, s.name, x + tw / 2, y0 + th + 28, 26, sel ? '#ffd500' : '#ddd', '#000');
      strokeText(ctx, s.sub, x + tw / 2, y0 + th + 52, 16, '#bbb', '#000', 'center', false);
    }
    // Vorschau gross
    const big = Assets.stages[STAGES[this.stageCur].id];
    ctx.save(); ctx.globalAlpha = 0.35; ctx.drawImage(big, W / 2 - 400, 120, 800, 160); ctx.restore();
    const wl = WEATHERS[this.weatherCur];
    strokeText(ctx, `WETTER:  ${wl.toUpperCase()}`, W / 2, H - 110, 28, this.weatherCur === 0 ? '#9bbcff' : '#ffd500', '#000');
    strokeText(ctx, '↑ / ↓ Wetter', W / 2, H - 82, 16, '#bbb', '#000', 'center', false);
    strokeText(ctx, this.game.touchDevice ? 'Stick links / rechts Bühne · hoch / runter Wetter · SCHLAG bestätigen · SCHWER zurück' : '← / → Bühne · F oder J bestätigen · R / U Zufall · G zurück', W / 2, H - 40, 18, '#ccc', '#000', 'center', false);
    strokeText(ctx, `${CHARACTERS[this.cur[0]].name}   vs   ${CHARACTERS[this.cur[1]].name}`, W / 2, 190, 40, '#fff', '#000');
  }
}
