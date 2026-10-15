import { GROUND, STAGE_W } from './config.js';

export const PROJ_ATTACK = {
  dmg: 150, hitstun: 22, blockstun: 16, push: 10, hitstop: 8, height: 'mid', chip: 0.15, sound: 'proj',
};
export const SUPER_ATTACK = {
  dmg: 320, hitstun: 30, blockstun: 22, push: 16, hitstop: 14, height: 'mid', chip: 0.2, knockdown: true, sound: 'proj', super: true,
};

export class Projectile {
  constructor(owner, x, y, dir, isSuper) {
    this.owner = owner;
    this.x = x; this.y = y;           // y: Hoehe ueber dem Boden
    this.vx = dir * (isSuper ? 11 : 9);
    this.dir = dir;
    this.isSuper = isSuper;
    this.r = isSuper ? 58 : 34;
    this.color = owner.def.projColor;
    this.alive = true;
    this.t = 0;
    this.atk = { ...(isSuper ? SUPER_ATTACK : PROJ_ATTACK) };
    this.hits = 0;
  }

  update(fx) {
    this.t++;
    this.x += this.vx;
    if (this.x < -120 || this.x > STAGE_W + 120) this.alive = false;
    if (this.t % 2 === 0) fx.trail(this.x - this.dir * this.r * 0.6, GROUND - this.y, this.color);
  }

  rect() {
    const r = this.r * 0.8;
    return { x0: this.x - r, x1: this.x + r, y0: GROUND - this.y - r, y1: GROUND - this.y + r };
  }

  draw(ctx, camX) {
    const sx = this.x - camX, sy = GROUND - this.y;
    const pulse = 1 + Math.sin(this.t * 0.6) * 0.08;
    const r = this.r * pulse;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(sx, sy, 2, sx, sy, r * 1.6);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.25, this.color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(sx, sy, r * 1.6, r * 1.15, 0, 0, Math.PI * 2); ctx.fill();
    // Schweif
    const tg = ctx.createLinearGradient(sx, sy, sx - this.dir * r * 4, sy);
    tg.addColorStop(0, this.color); tg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = tg;
    ctx.beginPath(); ctx.ellipse(sx - this.dir * r * 1.6, sy, r * 2.4, r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    // Kern
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(sx, sy, r * 0.45, r * 0.38, 0, 0, Math.PI * 2); ctx.fill();
    if (this.isSuper) {
      ctx.strokeStyle = this.color; ctx.lineWidth = 4;
      for (let i = 0; i < 3; i++) {
        const a = this.t * 0.25 + i * 2.1;
        ctx.beginPath(); ctx.ellipse(sx, sy, r * 1.3, r * 0.5, a, 0, Math.PI * 2); ctx.stroke();
      }
    }
    ctx.restore();
  }
}
