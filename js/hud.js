// Kopfzeile wie bei Street Fighter: Lebensbalken, Namen, Portraits, Timer, Runden, Special-Leiste.
import { W, H, MAX_METER, ROUNDS_TO_WIN, ALT_FILTER } from './config.js';
import { Assets } from './assets.js';

export const FONT = 'Impact, "Arial Black", "Helvetica Neue", sans-serif';

export function strokeText(ctx, str, x, y, size, fill = '#fff', stroke = '#000', align = 'center', italic = true, lw = null) {
  ctx.font = `${italic ? 'italic ' : ''}900 ${size}px ${FONT}`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = lw ?? Math.max(3, size / 9); ctx.strokeStyle = stroke;
  ctx.strokeText(str, x, y);
  ctx.fillStyle = fill; ctx.fillText(str, x, y);
}

function skewRect(ctx, x, y, w, h, skew, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + skew, y); ctx.lineTo(x + w + skew, y); ctx.lineTo(x + w - skew, y + h); ctx.lineTo(x - skew, y + h);
  ctx.closePath(); ctx.fill();
}

export class Hud {
  constructor() {
    this.ghost = [1, 1];   // verzoegerter roter Nachlauf
    this.combo = [{ n: 0, t: 0 }, { n: 0, t: 0 }];
    this.timerPulse = 0;
  }

  update(f1, f2) {
    const fs = [f1, f2];
    for (let i = 0; i < 2; i++) {
      const r = Math.max(0, fs[i].hp / fs[i].def.hp);
      if (this.ghost[i] > r) this.ghost[i] = Math.max(r, this.ghost[i] - 0.004);
      else this.ghost[i] = r;
      if (this.combo[i].t > 0) this.combo[i].t--;
    }
  }

  showCombo(slot, n) { this.combo[slot] = { n, t: 70 }; }

  draw(ctx, f1, f2, timer, roundNo) {
    const fs = [f1, f2];
    const barW = 470, barH = 26, top = 36;
    for (let i = 0; i < 2; i++) {
      const f = fs[i];
      const mirror = i === 1;
      const x0 = mirror ? W - 110 - barW : 110;
      const ratio = Math.max(0, f.hp / f.def.hp);
      // Rahmen
      skewRect(ctx, x0 - 4, top - 4, barW + 8, barH + 8, 10, '#111');
      skewRect(ctx, x0, top, barW, barH, 10, '#3a0d0d');
      // roter Nachlauf
      const gw = barW * this.ghost[i];
      skewRect(ctx, mirror ? x0 + barW - gw : x0, top, gw, barH, 10, '#d21f1f');
      // gelbes Leben
      const lw = barW * ratio;
      const g = ctx.createLinearGradient(0, top, 0, top + barH);
      g.addColorStop(0, '#fff6a8'); g.addColorStop(0.5, '#ffd500'); g.addColorStop(1, '#e09a00');
      if (ratio < 0.25) { g.addColorStop(0, '#ffb3b3'); g.addColorStop(0.5, '#ff5252'); g.addColorStop(1, '#b00000'); }
      skewRect(ctx, mirror ? x0 + barW - lw : x0, top, lw, barH, 10, g);
      // Glanz
      skewRect(ctx, mirror ? x0 + barW - lw : x0, top, lw, barH * 0.4, 10, 'rgba(255,255,255,0.25)');
      // Name
      strokeText(ctx, f.def.name, mirror ? x0 + barW - 6 : x0 + 6, top + barH + 20, 26, '#fff', '#000', mirror ? 'right' : 'left');
      // Rundenpunkte
      for (let r = 0; r < ROUNDS_TO_WIN; r++) {
        const cx = mirror ? x0 + barW - 150 - r * 26 : x0 + 150 + r * 26;
        ctx.beginPath(); ctx.arc(cx, top + barH + 20, 8, 0, Math.PI * 2);
        ctx.fillStyle = r < f.roundsWon ? '#ffd500' : 'rgba(0,0,0,0.5)'; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
      }
      // Portrait
      const por = Assets.portraits[f.def.id];
      const px = mirror ? W - 100 : 16, py = 18, ps = 84;
      ctx.save();
      ctx.beginPath(); ctx.moveTo(px + 12, py); ctx.lineTo(px + ps, py); ctx.lineTo(px + ps - 12, py + ps); ctx.lineTo(px, py + ps); ctx.closePath();
      ctx.fillStyle = f.def.color; ctx.fill();
      ctx.clip();
      if (por) {
        const s = Math.max(ps / por.width, ps / por.height);
        const dw = por.width * s, dh = por.height * s;
        if (f.altColor) ctx.filter = ALT_FILTER;
        ctx.drawImage(por, px + (ps - dw) / 2, py + (ps - dh) / 2 - 4, dw, dh);
      }
      ctx.restore();
      ctx.lineWidth = 3; ctx.strokeStyle = '#fff';
      ctx.beginPath(); ctx.moveTo(px + 12, py); ctx.lineTo(px + ps, py); ctx.lineTo(px + ps - 12, py + ps); ctx.lineTo(px, py + ps); ctx.closePath(); ctx.stroke();
      // Spieler-Label
      strokeText(ctx, f.input.constructor.name === 'CpuInput' ? 'CPU' : `P${i + 1}`, px + ps / 2, py + ps + 12, 16, f.def.accent, '#000', 'center', false);

      // Special-Leiste unten
      const mw = 300, mh = 14, my = H - 46;
      const mx = mirror ? W - 70 - mw : 70;
      skewRect(ctx, mx - 3, my - 3, mw + 6, mh + 6, 6, '#111');
      skewRect(ctx, mx, my, mw, mh, 6, '#1d2340');
      const mr = Math.min(1, f.meter / MAX_METER);
      const full = f.meter >= MAX_METER;
      const mg = ctx.createLinearGradient(mx, 0, mx + mw, 0);
      if (full) {
        const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 90);
        mg.addColorStop(0, '#fff'); mg.addColorStop(0.5, f.def.accent); mg.addColorStop(1, `rgba(255,255,255,${pulse})`);
      } else { mg.addColorStop(0, f.def.color); mg.addColorStop(1, f.def.accent); }
      const mlw = mw * mr;
      skewRect(ctx, mirror ? mx + mw - mlw : mx, my, mlw, mh, 6, mg);
      for (let s = 1; s < 4; s++) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(mx + (mw / 4) * s - 1, my, 2, mh); }
      strokeText(ctx, full ? 'SUPER BEREIT' : 'SPECIAL', mirror ? mx + mw : mx, my - 12, 14, full ? '#fff' : '#cfd6ff', '#000', mirror ? 'right' : 'left', false);

      // Combo
      const c = this.combo[i];
      if (c.t > 0 && c.n >= 2) {
        const a = Math.min(1, c.t / 15);
        ctx.globalAlpha = a;
        const cx = mirror ? W - 160 : 160, cy = 190;
        strokeText(ctx, `${c.n}`, cx, cy, 64, '#ffd500', '#000');
        strokeText(ctx, 'HITS COMBO', cx, cy + 40, 22, '#fff', '#000');
        ctx.globalAlpha = 1;
      }
    }
    // Timer
    const tx = W / 2, ty = 52;
    skewRect(ctx, tx - 58, 14, 116, 78, 8, '#111');
    skewRect(ctx, tx - 52, 20, 104, 66, 8, '#2a2f45');
    const tcol = timer <= 10 ? '#ff4b4b' : '#ffd500';
    strokeText(ctx, timer === Infinity ? '∞' : String(Math.max(0, Math.ceil(timer))).padStart(2, '0'), tx, ty + 2, 56, tcol, '#000', 'center', false);
    strokeText(ctx, `RUNDE ${roundNo}`, tx, 104, 16, '#fff', '#000', 'center', false);
  }
}
