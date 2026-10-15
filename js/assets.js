// Laedt Sprites, Portraits, Buehnen und die Sprite-Metadaten.
import { CHARACTERS, STAGES, POSES } from './characters.js';

export const Assets = {
  sprites: {},     // id -> pose -> { img, w, h, anchor }
  portraits: {},   // id -> img
  stages: {},      // id -> img
  ready: false,
  progress: 0,
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Bild fehlt: ' + src));
    img.src = src;
  });
}

export async function loadAll(onProgress) {
  const meta = await (await fetch('assets/sprites.json')).json();
  const jobs = [];
  let done = 0;
  const total = CHARACTERS.length * (POSES.length + 1) + STAGES.length;
  const tick = () => { done++; Assets.progress = done / total; onProgress && onProgress(Assets.progress); };

  for (const c of CHARACTERS) {
    Assets.sprites[c.id] = {};
    for (const p of POSES) {
      const m = meta.fighters[c.id][p];
      jobs.push(loadImage(`assets/fighters/${c.id}/${p}.webp`).then((img) => {
        Assets.sprites[c.id][p] = { img, w: m.w, h: m.h, anchor: m.anchor };
        tick();
      }));
    }
    jobs.push(loadImage(`assets/portraits/${c.id}.webp`).then((img) => { Assets.portraits[c.id] = img; tick(); }));
  }
  for (const s of STAGES) {
    jobs.push(loadImage(s.file).then((img) => { Assets.stages[s.id] = img; tick(); }));
  }
  await Promise.all(jobs);
  Assets.ready = true;
}
