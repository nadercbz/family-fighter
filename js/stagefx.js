// Lebendige Buehnen: Lichter aus dem Hintergrundbild flackern und blinken, Wasser und Hitze verzerren,
// U-Bahn, Fernseher, Turmlicht, Wolken, dazu Wetter (Regen, Schnee, Nebel, Gewitter).
// Alles wird in Buehnenkoordinaten (STAGE_W x H) innerhalb der Kameratransformation gezeichnet.
import { STAGE_W, H, GROUND } from './config.js';
import { Sfx, Ambient } from './audio.js';

export const WEATHERS = ['zufall', 'klar', 'regen', 'schnee', 'nebel', 'gewitter', 'staub'];

const rnd = (a, b) => a + Math.random() * (b - a);

export class StageFx {
  constructor(stage, img, weather, fx) {
    this.stage = stage;
    this.img = img;
    this.fx = fx;
    this.cfg = stage.fx || {};
    this.t = 0;
    this.weather = weather === 'zufall' || !weather ? this.pickWeather() : weather;
    this.lights = [];
    this.drops = [];
    this.flakes = [];
    this.fogs = [];
    this.clouds = [];
    this.lightning = 0;
    this.motes = [];
    this.neonState = (this.cfg.neon || []).map(() => ({ on: 1, t: 0 }));
    this.nextLightning = rnd(240, 600);
    this.train = this.cfg.train ? { x: this.cfg.train.x0, wait: 120 } : null;
    this.buildBuffer();
    this.detectLights();
    this.initWeather();
  }

  pickWeather() {
    const opts = this.cfg.weathers || ['klar'];
    return opts[Math.floor(Math.random() * opts.length)];
  }

  // Hintergrund einmal in Buehnengroesse rastern, daraus Lichter lesen und Streifen fuer Wasser/Hitze ziehen
  buildBuffer() {
    // Zeichenpuffer (GPU) fuer Wasser und Hitze, getrennt vom Lesepuffer (CPU) fuer die Lichterkennung.
    const c = document.createElement('canvas');
    c.width = STAGE_W; c.height = H;
    c.getContext('2d').drawImage(this.img, 0, 0, STAGE_W, H);
    this.buf = c;
    const r = document.createElement('canvas');
    r.width = STAGE_W; r.height = H;
    const g = r.getContext('2d', { willReadFrequently: true });
    g.drawImage(this.img, 0, 0, STAGE_W, H);
    this.bctx = g;
  }

  detectLights() {
    if (this.cfg.lights === false) return;
    const g = this.bctx;
    const maxY = this.cfg.lightMaxY || GROUND - 60;
    const data = g.getImageData(0, 0, STAGE_W, maxY).data;
    const step = 3;
    const cand = [];
    const lum = (i) => 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    for (let y = 2; y < maxY - 2; y += step) {
      for (let x = 2; x < STAGE_W - 2; x += step) {
        const i = (y * STAGE_W + x) * 4;
        const l = lum(i);
        if (l < 215) continue;
        const r = data[i], gg = data[i + 1], b = data[i + 2];
        const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
        const sat = mx === 0 ? 0 : (mx - mn) / mx;
        if (l < 245 && sat < 0.25) continue;
        // lokales Maximum in 12 px Umgebung
        let isMax = true;
        for (let dy = -12; dy <= 12 && isMax; dy += step) for (let dx = -12; dx <= 12; dx += step) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= STAGE_W || yy >= maxY) continue;
          if (lum((yy * STAGE_W + xx) * 4) > l + 0.5) { isMax = false; break; }
        }
        if (!isMax) continue;
        cand.push({ x, y, l, r, g: gg, b, sat });
      }
    }
    cand.sort((a, b) => b.l + b.sat * 60 - (a.l + a.sat * 60));
    const picked = [];
    for (const c of cand) {
      if (picked.length >= (this.cfg.maxLights || 140)) break;
      if (picked.some(p => Math.abs(p.x - c.x) < 18 && Math.abs(p.y - c.y) < 18)) continue;
      picked.push(c);
    }
    this.lights = picked.map(c => ({
      x: c.x, y: c.y,
      color: `rgb(${Math.min(255, c.r + 30)},${Math.min(255, c.g + 20)},${Math.min(255, c.b + 10)})`,
      r: 7 + c.sat * 12 + (c.l - 215) * 0.15,
      phase: Math.random() * Math.PI * 2,
      speed: rnd(0.02, 0.09),
      mode: Math.random() < 0.18 ? 'blink' : 'twinkle',
      blinkT: rnd(60, 240),
      on: true,
    }));
  }

  initWeather() {
    const w = this.weather;
    if (w === 'regen' || w === 'gewitter') {
      const n = w === 'gewitter' ? 420 : 300;
      for (let i = 0; i < n; i++) this.drops.push({ x: rnd(-200, STAGE_W + 200), y: rnd(-H, H), v: rnd(14, 22), len: rnd(14, 26) });
      Ambient.start('rain', w === 'gewitter' ? 0.5 : 0.35);
    } else if (w === 'schnee') {
      for (let i = 0; i < 260; i++) this.flakes.push({ x: rnd(-100, STAGE_W + 100), y: rnd(-H, H), v: rnd(0.8, 2.2), r: rnd(1.5, 4), p: Math.random() * 7 });
      Ambient.start('wind', 0.2);
    } else if (w === 'staub') {
      for (let i = 0; i < 220; i++) this.motes.push({ x: rnd(-100, STAGE_W + 100), y: rnd(0, GROUND), v: rnd(0.2, 0.9), vy: rnd(-0.15, 0.15), r: rnd(1, 3), p: Math.random() * 7, a: rnd(0.25, 0.7) });
      Ambient.start('wind', 0.16);
    } else if (w === 'nebel') {
      for (let i = 0; i < 11; i++) this.fogs.push({ x: rnd(-400, STAGE_W), y: GROUND - rnd(-20, 260), w: rnd(600, 1100), h: rnd(120, 220), v: rnd(0.15, 0.5), a: rnd(0.22, 0.4) });
      Ambient.start('wind', 0.12);
    } else {
      Ambient.stop();
    }
    if (this.cfg.clouds) {
      for (let i = 0; i < 5; i++) this.clouds.push({ x: rnd(-600, STAGE_W), y: rnd(20, 200), w: rnd(400, 800), h: rnd(60, 120), v: rnd(0.08, 0.25), a: rnd(0.08, 0.2) });
    }
  }

  stop() { Ambient.stop(); }

  update() {
    this.t++;
    const w = this.weather;
    const wind = (w === 'gewitter' ? 6 : w === 'regen' ? 3 : 0.6);
    for (const d of this.drops) { d.y += d.v; d.x += wind * 0.6; if (d.y > GROUND + 10) { d.y = rnd(-H * 0.6, -20); d.x = rnd(-200, STAGE_W + 200); if (Math.random() < 0.25) this.fx.parts.push({ kind: 'dot', x: d.x, y: GROUND + 2, vx: rnd(-1, 1), vy: -rnd(1, 2.5), life: 8, max: 8, color: 'rgba(200,220,255,0.6)', r: 2, g: 0.3 }); } }
    for (const f of this.flakes) { f.y += f.v; f.x += Math.sin(this.t / 40 + f.p) * 0.6 + 0.3; if (f.y > GROUND + 6) { f.y = rnd(-120, -10); f.x = rnd(-100, STAGE_W + 100); } }
    for (const f of this.fogs) { f.x += f.v; if (f.x > STAGE_W + 200) f.x = -f.w - 100; }
    for (const c of this.clouds) { c.x += c.v; if (c.x > STAGE_W + 300) c.x = -c.w - 200; }
    for (const m of this.motes) { m.x += m.v + Math.sin(this.t / 50 + m.p) * 0.3; m.y += m.vy + Math.sin(this.t / 70 + m.p) * 0.2; if (m.x > STAGE_W + 100) m.x = -100; if (m.y < 0) m.y = GROUND; if (m.y > GROUND) m.y = 0; }
    for (const n of this.neonState) { n.t--; if (n.t <= 0) { n.on = n.on < 1 ? 1 : (Math.random() < 0.12 ? rnd(0.2, 0.6) : 1); n.t = n.on < 1 ? rnd(2, 8) : rnd(20, 160); } }
    for (const l of this.lights) {
      if (l.mode === 'blink' && --l.blinkT <= 0) { l.on = !l.on; l.blinkT = l.on ? rnd(60, 300) : rnd(10, 60); }
    }
    if (w === 'gewitter') {
      if (this.lightning > 0) this.lightning--;
      if (--this.nextLightning <= 0) { this.lightning = 18; this.nextLightning = rnd(200, 700); this.fx.doShake(3); setTimeout(() => Sfx.thunder(), rnd(150, 700)); }
    }
    if (this.train) {
      const tr = this.cfg.train;
      if (this.train.wait > 0) this.train.wait--;
      else { this.train.x += tr.speed; if ((tr.speed > 0 && this.train.x > tr.x1 + 400) || (tr.speed < 0 && this.train.x < tr.x1 - 400)) { this.train.x = tr.x0; this.train.wait = rnd(300, 900); } }
    }
  }

  // ---- hinter den Kaempfern ----------------------------------------------
  drawBack(ctx) {
    const c = this.cfg;
    if (c.water) this.drawWave(ctx, c.water, 1, true);
    if (c.heat) this.drawWave(ctx, c.heat, 0.5, false);
    for (const cl of this.clouds) {
      ctx.save(); ctx.globalAlpha = cl.a;
      const g = ctx.createRadialGradient(cl.x + cl.w / 2, cl.y + cl.h / 2, 10, cl.x + cl.w / 2, cl.y + cl.h / 2, cl.w / 2);
      g.addColorStop(0, 'rgba(20,24,40,0.9)'); g.addColorStop(1, 'rgba(20,24,40,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cl.x + cl.w / 2, cl.y + cl.h / 2, cl.w / 2, cl.h / 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    this.drawLights(ctx);
    this.drawNeon(ctx);
    if (this.train) this.drawTrain(ctx);
    if (c.tv) this.drawTv(ctx);
    if (c.beacon) this.drawBeacon(ctx);
    if (this.weather === 'gewitter' && this.lightning > 0) {
      const k = this.lightning / 18;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.55 * k * (Math.random() < 0.8 ? 1 : 0.3);
      ctx.fillStyle = '#dfe8ff'; ctx.fillRect(-500, -500, STAGE_W + 1000, H + 1000); ctx.restore();
    }
    if (this.weather === 'regen' || this.weather === 'gewitter') {
      ctx.fillStyle = `rgba(10,15,40,${this.weather === 'gewitter' ? 0.28 : 0.16})`; ctx.fillRect(-500, -500, STAGE_W + 1000, H + 1000);
    }
    if (this.weather === 'schnee') { ctx.fillStyle = 'rgba(200,215,255,0.08)'; ctx.fillRect(-500, -500, STAGE_W + 1000, H + 1000); }
    if (this.weather === 'staub') { ctx.fillStyle = 'rgba(255,190,120,0.09)'; ctx.fillRect(-500, -500, STAGE_W + 1000, H + 1000); }
    if (this.weather === 'nebel') { ctx.fillStyle = 'rgba(190,200,220,0.14)'; ctx.fillRect(-500, -500, STAGE_W + 1000, H + 1000); }
    for (const f of this.fogs) this.drawFog(ctx, f, 0.6);
  }

  // ---- vor den Kaempfern -------------------------------------------------
  drawFront(ctx) {
    const w = this.weather;
    if (w === 'regen' || w === 'gewitter') {
      ctx.save(); ctx.strokeStyle = 'rgba(190,210,255,0.45)'; ctx.lineWidth = 1.2; ctx.beginPath();
      const wind = w === 'gewitter' ? 6 : 3;
      for (const d of this.drops) { ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + wind * 0.3, d.y + d.len); }
      ctx.stroke(); ctx.restore();
    }
    if (w === 'schnee') {
      ctx.save(); ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (const f of this.flakes) { ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    for (const f of this.fogs) this.drawFog(ctx, f, 0.5);
    if (this.motes.length) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const m of this.motes) { ctx.globalAlpha = m.a * (0.5 + 0.5 * Math.sin(this.t / 20 + m.p)); ctx.fillStyle = '#ffd9a0'; ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
  }

  // Neonschilder flackern und leuchten, Lichtkegel pulsieren leicht
  drawNeon(ctx) {
    const neon = this.cfg.neon || [], glow = this.cfg.glow || [];
    if (!neon.length && !glow.length) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    neon.forEach((n, i) => {
      const st = this.neonState[i];
      const a = 0.55 * st.on * (this.weather === 'nebel' ? 0.8 : 1);
      ctx.globalAlpha = a;
      const cx = n.x + n.w / 2, cy = n.y + n.h / 2, r = Math.max(n.w, n.h) * 1.3;
      const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, r);
      g.addColorStop(0, n.color); g.addColorStop(0.5, n.color); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
      if (st.on < 1) { ctx.globalAlpha = (1 - st.on) * 0.6; ctx.fillStyle = 'rgba(0,0,0,1)'; ctx.globalCompositeOperation = 'source-over'; ctx.fillRect(n.x, n.y, n.w, n.h); ctx.globalCompositeOperation = 'lighter'; }
    });
    for (const gl of glow) {
      const pulse = 0.75 + 0.25 * Math.sin(this.t / 23 + gl.x);
      ctx.globalAlpha = pulse;
      const g = ctx.createRadialGradient(gl.x, gl.y, 4, gl.x, gl.y, gl.r);
      g.addColorStop(0, gl.color); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(gl.x, gl.y, gl.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  drawFog(ctx, f, k) {
    // Elliptischer Verlauf: Kreisverlauf in gestauchtem Koordinatensystem, sonst harte Kanten oben und unten
    ctx.save(); ctx.globalAlpha = f.a * k;
    ctx.translate(f.x + f.w / 2, f.y);
    ctx.scale(1, f.h / f.w);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, f.w / 2);
    g.addColorStop(0, 'rgba(207,214,230,0.9)'); g.addColorStop(0.45, 'rgba(207,214,230,0.45)'); g.addColorStop(1, 'rgba(207,214,230,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, f.w / 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // Zeilenweise Verzerrung eines Bildstreifens (Wasser: staerker nach unten, Hitze: fein)
  drawWave(ctx, band, amp, isWater) {
    const { y0, y1 } = band;
    const rows = isWater ? 2 : 4;
    const bx0 = band.x0 || 0, bx1 = band.x1 || STAGE_W, bw = bx1 - bx0;
    for (let y = y0; y < y1; y += rows) {
      const k = (y - y0) / (y1 - y0);
      const a = isWater ? amp * (1.2 + k * 3.5) : amp * 1.2;
      const off = Math.sin(y * 0.11 + this.t * 0.07) * a + Math.sin(y * 0.05 - this.t * 0.04) * a * 0.6;
      ctx.drawImage(this.buf, bx0 + 4, y, bw - 8, rows, bx0 + 4 + off, y, bw - 8, rows);
    }
    if (isWater) {
      // Glitzer auf dem Wasser
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 26; i++) {
        const sx = bx0 + ((i * 197 + this.t * (1.2 + (i % 3))) % bw);
        const sy = y0 + ((i * 53) % (y1 - y0));
        const al = 0.08 + 0.1 * Math.abs(Math.sin(this.t * 0.05 + i));
        ctx.fillStyle = `rgba(255,255,255,${al})`;
        ctx.fillRect(sx, sy, 20 + (i % 4) * 10, 1.2);
      }
      ctx.restore();
    }
  }

  drawLights(ctx) {
    if (!this.lights.length) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const dim = this.weather === 'nebel' ? 0.7 : 1;
    for (const l of this.lights) {
      if (!l.on) continue;
      const tw = l.mode === 'twinkle' ? 0.5 + 0.5 * Math.sin(this.t * l.speed + l.phase) : 1;
      const flick = Math.random() < 0.05 ? 0.6 : 1;
      const a = (0.12 + 0.3 * tw) * flick * dim;
      const r = l.r * (0.8 + 0.4 * tw);
      const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, r);
      g.addColorStop(0, l.color); g.addColorStop(0.4, l.color); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = a; ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(l.x, l.y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  drawTrain(ctx) {
    const tr = this.cfg.train;
    if (this.train.wait > 0) return;
    const x = this.train.x, h = tr.h || 22, len = tr.len || 260;
    let y = tr.y;
    if (tr.line) { const [[ax, ay], [bx, by]] = tr.line; const k = Math.max(0, Math.min(1, (x + len / 2 - ax) / (bx - ax))); y = ay + (by - ay) * k; }
    ctx.save();
    if (tr.line) { const [[ax, ay], [bx, by]] = tr.line; ctx.translate(x + len / 2, y); ctx.rotate(Math.atan2(by - ay, bx - ax)); ctx.translate(-(x + len / 2), -y); }
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = tr.color || '#3a3f4a';
    ctx.fillRect(x, y, len, h);
    ctx.fillStyle = '#ffe9a8';
    for (let i = 8; i < len - 8; i += 16) ctx.fillRect(x + i, y + h * 0.25, 10, h * 0.4);
    ctx.globalCompositeOperation = 'lighter';
    const hx = tr.speed > 0 ? x + len : x;
    const g = ctx.createRadialGradient(hx, y + h / 2, 2, hx, y + h / 2, 60);
    g.addColorStop(0, 'rgba(255,255,220,0.9)'); g.addColorStop(1, 'rgba(255,255,220,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(hx, y + h / 2, 60, 0, Math.PI * 2); ctx.fill();
    for (let i = 8; i < len - 8; i += 16) { ctx.globalAlpha = 0.35; ctx.fillStyle = '#ffe9a8'; ctx.fillRect(x + i - 2, y + h * 0.1, 14, h * 0.8); }
    ctx.restore();
  }

  drawTv(ctx) {
    const tv = this.cfg.tv;
    if (this.t % 5 === 0 || !this.tvColor) {
      const hue = [205, 215, 40, 330, 190][Math.floor(Math.random() * 5)];
      this.tvColor = `hsla(${hue},80%,${55 + Math.random() * 30}%,${0.18 + Math.random() * 0.2})`;
    }
    ctx.save();
    ctx.fillStyle = this.tvColor; ctx.fillRect(tv.x, tv.y, tv.w, tv.h);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25;
    const g = ctx.createRadialGradient(tv.x + tv.w / 2, tv.y + tv.h / 2, 10, tv.x + tv.w / 2, tv.y + tv.h / 2, tv.w * 1.4);
    g.addColorStop(0, this.tvColor); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(tv.x - tv.w, tv.y - tv.h, tv.w * 3, tv.h * 3);
    ctx.restore();
  }

  drawBeacon(ctx) {
    const b = this.cfg.beacon;
    const on = Math.floor(this.t / 40) % 2 === 0;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, on ? 26 : 10);
    g.addColorStop(0, 'rgba(255,60,60,0.95)'); g.addColorStop(1, 'rgba(255,60,60,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, 26, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}
