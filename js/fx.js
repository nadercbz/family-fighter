// Partikel, Funken, Staub, Bildschirm-Wackeln, Blitz, Text-Popups.
export class Fx {
  constructor() {
    this.parts = [];
    this.texts = [];
    this.shake = 0;
    this.shakeX = 0; this.shakeY = 0;
    this.flash = 0; this.flashColor = '#fff';
    this.zoom = 0;
  }

  spark(x, y, color = '#ffd34d', n = 14, power = 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = (3 + Math.random() * 9) * power;
      this.parts.push({ kind: 'line', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 14 + Math.random() * 10, max: 24, color, w: 2 + Math.random() * 2 });
    }
    this.parts.push({ kind: 'ring', x, y, r: 6, vr: 7 * power, life: 10, max: 10, color });
  }

  burst(x, y, color, n = 40) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 4 + Math.random() * 14;
      this.parts.push({ kind: 'dot', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2, life: 25 + Math.random() * 20, max: 45, color, r: 3 + Math.random() * 5, g: 0.25 });
    }
    this.parts.push({ kind: 'ring', x, y, r: 10, vr: 16, life: 16, max: 16, color });
  }

  impact(x, y, r, color = '#fff') {
    this.parts.push({ kind: 'blob', x, y, r, life: 5, max: 5, color });
  }

  dust(x, y, n = 8, dir = 0) {
    for (let i = 0; i < n; i++) {
      this.parts.push({ kind: 'dot', x: x + (Math.random() - 0.5) * 40, y: y - Math.random() * 6, vx: (Math.random() - 0.5) * 4 + dir * 2, vy: -Math.random() * 2.5, life: 18 + Math.random() * 14, max: 32, color: 'rgba(230,220,200,0.55)', r: 6 + Math.random() * 8, g: -0.02 });
    }
  }

  trail(x, y, color) {
    this.parts.push({ kind: 'dot', x: x + (Math.random() - 0.5) * 14, y: y + (Math.random() - 0.5) * 14, vx: (Math.random() - 0.5) * 1.5, vy: (Math.random() - 0.5) * 1.5, life: 14, max: 14, color, r: 4 + Math.random() * 7, g: 0 });
  }

  text(x, y, str, color = '#fff', size = 34, life = 50) {
    this.texts.push({ x, y, str, color, size, life, max: life, vy: -1.2 });
  }

  doShake(n) { this.shake = Math.max(this.shake, n); }
  doFlash(color = '#fff', n = 8) { this.flash = n; this.flashMax = n; this.flashColor = color; }

  update() {
    for (const p of this.parts) {
      p.life--;
      if (p.kind === 'ring') { p.r += p.vr; p.vr *= 0.85; continue; }
      if (p.kind === 'blob') { p.r *= 1.12; continue; }
      p.x += p.vx; p.y += p.vy;
      if (p.g) p.vy += p.g;
      if (p.kind === 'line') { p.vx *= 0.88; p.vy *= 0.88; }
    }
    this.parts = this.parts.filter(p => p.life > 0);
    for (const t of this.texts) { t.life--; t.y += t.vy; }
    this.texts = this.texts.filter(t => t.life > 0);
    if (this.shake > 0) {
      this.shakeX = (Math.random() - 0.5) * this.shake * 2;
      this.shakeY = (Math.random() - 0.5) * this.shake * 1.4;
      this.shake *= 0.82; if (this.shake < 0.6) this.shake = 0;
    } else { this.shakeX = this.shakeY = 0; }
    if (this.flash > 0) this.flash--;
  }

  draw(ctx, camX) {
    for (const p of this.parts) {
      const a = Math.max(0, p.life / p.max);
      ctx.globalAlpha = a;
      if (p.kind === 'line') {
        ctx.strokeStyle = p.color; ctx.lineWidth = p.w; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x - camX, p.y); ctx.lineTo(p.x - camX - p.vx * 2.2, p.y - p.vy * 2.2); ctx.stroke();
      } else if (p.kind === 'blob') {
        ctx.globalAlpha = a * 0.9;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.ellipse(p.x - camX, p.y, p.r, p.r * 0.7, (p.life * 0.7), 0, Math.PI * 2); ctx.fill();
      } else if (p.kind === 'ring') {
        ctx.strokeStyle = p.color; ctx.lineWidth = 3 * a + 1;
        ctx.beginPath(); ctx.arc(p.x - camX, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x - camX, p.y, p.r * (0.4 + 0.6 * a), 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    for (const t of this.texts) {
      const a = Math.min(1, t.life / 12);
      const pop = t.max - t.life < 6 ? 1 + (6 - (t.max - t.life)) * 0.08 : 1;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(t.x - camX, t.y);
      ctx.scale(pop, pop);
      ctx.font = `italic 900 ${t.size}px Impact, "Arial Black", sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 6; ctx.strokeStyle = '#000'; ctx.lineJoin = 'round';
      ctx.strokeText(t.str, 0, 0);
      ctx.fillStyle = t.color; ctx.fillText(t.str, 0, 0);
      ctx.restore();
    }
  }

  drawOverlay(ctx, W, H) {
    if (this.flash > 0) {
      ctx.globalAlpha = (this.flash / this.flashMax) * 0.85;
      ctx.fillStyle = this.flashColor; ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }
}
