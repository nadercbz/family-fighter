// VS-Bildschirm vor dem Kampf: beide Kaempfer gross, Namen, Buehne.
import { W, H, ALT_FILTER } from '../config.js';
import { Assets } from '../assets.js';
import { strokeText } from '../hud.js';
import { announce, Sfx } from '../audio.js';

const DURATION = 150;

export class VersusScene {
  constructor(game, setup) {
    this.game = game;
    this.setup = setup;
    this.t = 0;
    announce(`${setup.p1.name.toLowerCase()} versus ${setup.p2.name.toLowerCase()}`, { rate: 0.95 });
    Sfx.roundBell();
  }

  update() {
    this.t++;
    if (this.t === 28) Sfx.hitHeavy();
    if (this.t >= DURATION) this.game.beginFight(this.setup);
  }

  draw(ctx) {
    const { p1, p2, stage } = this.setup;
    const t = this.t;
    const bg = Assets.stages[stage.id];
    ctx.drawImage(bg, -200, 0, bg.width * (H / bg.height), H);
    ctx.fillStyle = 'rgba(3,4,14,0.78)'; ctx.fillRect(0, 0, W, H);

    const slide = 1 - Math.pow(1 - Math.min(1, t / 22), 3);
    // Farbflaechen diagonal
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = p1.color;
    ctx.beginPath(); ctx.moveTo(-W + W * slide, 0); ctx.lineTo(W * 0.56 - W + W * slide, 0); ctx.lineTo(W * 0.44 - W + W * slide, H); ctx.lineTo(-W + W * slide, H); ctx.closePath(); ctx.fill();
    ctx.fillStyle = p2.color;
    ctx.beginPath(); ctx.moveTo(W * 2 - W * slide, 0); ctx.lineTo(W * 0.56 + W - W * slide, 0); ctx.lineTo(W * 0.44 + W - W * slide, H); ctx.lineTo(W * 2 - W * slide, H); ctx.closePath(); ctx.fill();
    ctx.restore();
    // Streifen
    ctx.save(); ctx.globalAlpha = 0.12;
    for (let i = 0; i < 10; i++) { ctx.fillStyle = '#fff'; ctx.fillRect(((t * 6 + i * 180) % (W + 200)) - 200, 0, 30, H); }
    ctx.restore();

    const drawFighter = (def, side) => {
      const s = Assets.sprites[def.id].idle;
      const scale = 1.35;
      const x = side === 0 ? -300 + 620 * slide : W + 300 - 620 * slide;
      const bottom = H - 30;
      ctx.save();
      if (side === 1 && p1.id === p2.id) ctx.filter = ALT_FILTER;
      ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 20;
      if (side === 0) ctx.drawImage(s.img, x - s.anchor * s.w * scale, bottom - s.h * scale, s.w * scale, s.h * scale);
      else { ctx.translate(x + (1 - s.anchor) * s.w * scale, 0); ctx.scale(-1, 1); ctx.drawImage(s.img, 0, bottom - s.h * scale, s.w * scale, s.h * scale); }
      ctx.restore();
      const nx = side === 0 ? 70 : W - 70;
      const align = side === 0 ? 'left' : 'right';
      const ny = 120;
      strokeText(ctx, def.name, nx + (side === 0 ? -400 + 400 * slide : 400 - 400 * slide), ny, 86, '#fff', '#000', align);
      strokeText(ctx, def.title, nx + (side === 0 ? -400 + 400 * slide : 400 - 400 * slide), ny + 58, 30, def.accent, '#000', align, false);
      strokeText(ctx, side === 0 ? 'SPIELER 1' : (this.setup.cpu ? 'CPU' : 'SPIELER 2'), nx + (side === 0 ? -400 + 400 * slide : 400 - 400 * slide), ny - 60, 22, '#ddd', '#000', align, false);
    };
    drawFighter(p1, 0);
    drawFighter(p2, 1);

    // VS
    if (t > 24) {
      const k = Math.min(1, (t - 24) / 8);
      const pop = 1 + (1 - k) * 2.2;
      ctx.save();
      ctx.translate(W / 2, H / 2 - 20);
      ctx.rotate(-0.08);
      ctx.scale(pop, pop);
      ctx.globalAlpha = k;
      strokeText(ctx, 'VS', 0, 0, 170, '#ffd500', '#000');
      ctx.restore();
    }
    if (t > 50) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, H - 90, W, 56);
      strokeText(ctx, `${stage.name}  ·  ${stage.sub}`, W / 2, H - 62, 30, '#fff', '#000', 'center', false);
    }
    if (t > DURATION - 24) {
      ctx.fillStyle = `rgba(0,0,0,${(t - (DURATION - 24)) / 24})`; ctx.fillRect(0, 0, W, H);
    }
  }
}
