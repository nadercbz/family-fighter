// Titelbildschirm mit Logo, allen Kaempfern und Modusauswahl.
import { W, H, GROUND, STAGE_W } from '../config.js';
import { CHARACTERS } from '../characters.js';
import { Assets } from '../assets.js';
import { Keyboard } from '../input.js';
import { strokeText } from '../hud.js';
import { Sfx, unlockAudio, startMusic, stopMusic } from '../audio.js';

export class TitleScene {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this.menu = 0;
    this.touch = game.touchDevice;
    this.items = this.touch ? ['1 SPIELER  vs  CPU', '2 SPIELER  (geteilter Bildschirm)'] : ['2 SPIELER', '1 SPIELER  vs  CPU'];
    this.started = false;
  }

  update() {
    this.t++;
    if (!this.started) {
      if (Keyboard.anyPressed()) { this.started = true; unlockAudio(); startMusic('title'); Sfx.confirm(); }
      return;
    }
    if (Keyboard.justPressed('KeyW') || Keyboard.justPressed('ArrowUp') || Keyboard.justPressed('KeyS') || Keyboard.justPressed('ArrowDown')) {
      this.menu = (this.menu + 1) % this.items.length; Sfx.select();
    }
    if (Keyboard.justPressed('Enter') || Keyboard.justPressed('Space') || Keyboard.justPressed('KeyF') || Keyboard.justPressed('KeyJ')) {
      Sfx.confirm(); stopMusic();
      this.game.toSelect(this.touch ? this.menu === 0 : this.menu === 1);
    }
  }

  draw(ctx) {
    const bg = Assets.stages.neon;
    const pan = (Math.sin(this.t / 400) * 0.5 + 0.5) * (STAGE_W - W);
    ctx.drawImage(bg, -pan, 0, STAGE_W, H);
    ctx.fillStyle = 'rgba(5,5,20,0.55)'; ctx.fillRect(0, 0, W, H);

    // Kaempfer in einer Reihe
    const n = CHARACTERS.length;
    for (let i = 0; i < n; i++) {
      const c = CHARACTERS[i];
      const s = Assets.sprites[c.id].idle;
      const scale = 0.78;
      const x = 140 + i * 250 + Math.sin(this.t / 30 + i) * 3;
      const bob = Math.sin(this.t / 14 + i * 1.3) * 3;
      const facing = i < 2.5 ? 1 : -1;
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(x, GROUND + 4, 60 * scale, 10, 0, 0, Math.PI * 2); ctx.fill();
      if (facing > 0) ctx.drawImage(s.img, x - s.anchor * s.w * scale, GROUND - s.h * scale + bob, s.w * scale, s.h * scale);
      else { ctx.translate(x + (1 - s.anchor) * s.w * scale, 0); ctx.scale(-1, 1); ctx.drawImage(s.img, 0, GROUND - s.h * scale + bob, s.w * scale, s.h * scale); }
      ctx.restore();
    }

    // Logo
    ctx.save();
    ctx.translate(W / 2, 150);
    const pulse = 1 + Math.sin(this.t / 20) * 0.015;
    ctx.scale(pulse, pulse);
    ctx.rotate(-0.03);
    const g = ctx.createLinearGradient(0, -70, 0, 60);
    g.addColorStop(0, '#fff3b0'); g.addColorStop(0.45, '#ffc400'); g.addColorStop(0.5, '#ff7a00'); g.addColorStop(1, '#b3270b');
    ctx.font = `italic 900 128px Impact, "Arial Black", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 22; ctx.strokeStyle = '#1a0606'; ctx.strokeText('FAMILY FIGHTER', 0, 0);
    ctx.lineWidth = 10; ctx.strokeStyle = '#ffffff'; ctx.strokeText('FAMILY FIGHTER', 0, 0);
    ctx.fillStyle = g; ctx.fillText('FAMILY FIGHTER', 0, 0);
    ctx.restore();
    strokeText(ctx, 'FÜNF KÄMPFER · EINE TASTATUR · KEINE GNADE', W / 2, 232, 24, '#fff', '#000', 'center', false);

    if (!this.started) {
      if (Math.floor(this.t / 30) % 2 === 0) strokeText(ctx, this.touch ? 'TIPPE ZUM STARTEN' : 'DRÜCKE EINE TASTE', W / 2, 330, 40, '#ffd500', '#000');
    } else {
      for (let i = 0; i < this.items.length; i++) {
        const sel = i === this.menu;
        const y = 300 + i * 52;
        if (sel) {
          ctx.fillStyle = 'rgba(255,213,0,0.18)';
          ctx.fillRect(W / 2 - 240, y - 22, 480, 44);
        }
        strokeText(ctx, (sel ? '▶  ' : '') + this.items[i] + (sel ? '  ◀' : ''), W / 2, y, sel ? 36 : 30, sel ? '#ffd500' : '#ddd', '#000');
      }
      strokeText(ctx, this.touch ? 'Stick hoch / runter wählen · SCHLAG oder OK bestätigen · ⛶ Vollbild' : 'W / S wählen · ENTER bestätigen · M Ton · ESC im Kampf: Pause und Steuerung', W / 2, H - 28, 18, '#bbb', '#000', 'center', false);
    }
  }
}
