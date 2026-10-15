// Einstieg: Canvas, Spielschleife mit festem Schritt, Szenenwechsel, Laden.
import { W, H } from './config.js';
import { loadAll } from './assets.js';
import { Keyboard } from './input.js';
import { TitleScene } from './scenes/title.js';
import { SelectScene } from './scenes/select.js';
import { FightScene } from './scenes/fight.js';
import { VersusScene } from './scenes/versus.js';
import { toggleMute, unlockAudio } from './audio.js';
import { strokeText } from './hud.js';
import { TouchControls, isTouchDevice } from './touch.js';

const canvas = document.getElementById('game');
const stage = document.getElementById('stage');
const ctx = canvas.getContext('2d');
const touchDevice = isTouchDevice();
const touch = new TouchControls(stage);
touch.show(touchDevice);
if (!touchDevice) document.body.classList.add('desktop');
let dpr = 1;

function resize() {
  // Handys bekommen hoechstens 1.5-fache Aufloesung, das spart Fuellrate bei Spiegelung und Effekten
  dpr = Math.min(touchDevice ? 1.5 : 2, window.devicePixelRatio || 1);
  canvas.width = W * dpr; canvas.height = H * dpr;
  const vw = window.innerWidth, vh = window.innerHeight;
  const scale = Math.min(vw / W, vh / H);
  canvas.style.width = `${W * scale}px`; canvas.style.height = `${H * scale}px`;
  stage.style.width = `${W * scale}px`; stage.style.height = `${H * scale}px`;
  touch.setScale(scale);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 150));
resize();
canvas.addEventListener('dblclick', () => { if (document.fullscreenElement) document.exitFullscreen(); else canvas.requestFullscreen && canvas.requestFullscreen(); });
// Taste T schaltet das Touch-Overlay am Rechner zum Ausprobieren ein
window.addEventListener('keydown', (e) => { if (e.code === 'KeyT' && !touchDevice) touch.show(touch.enabled ? false : true); });

const game = {
  scene: null,
  lastSetup: null,
  touch,
  touchDevice,
  toTitle() { touch.setLayout('single'); this.scene = new TitleScene(this); },
  toSelect(cpu) { const c = cpu ?? !!(this.lastSetup && this.lastSetup.cpu); touch.setLayout(c ? 'single' : 'split'); this.scene = new SelectScene(this, c); },
  startFight(setup) { this.lastSetup = setup; this.scene = new VersusScene(this, setup); },
  beginFight(setup) { this.lastSetup = setup; this.scene = new FightScene(this, setup); },
  rematch() {
    const s = this.lastSetup;
    // frische Eingaben, gleiche Kaempfer und Buehne
    const inputs = s.inputs.map(i => i.clone());
    this.beginFight({ ...s, inputs });
  },
};
window.__game = game;

let loadProgress = 0;
let loaded = false;
let loadError = null;

loadAll((p) => { loadProgress = p; }).then(() => { loaded = true; game.toTitle(); }).catch((e) => { loadError = e.message; console.error(e); });

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyM') toggleMute();
  unlockAudio();
}, { passive: true });

let acc = 0, last = performance.now();
const STEP = 1000 / 60;
function loop(now) {
  requestAnimationFrame(loop);
  acc += Math.min(100, now - last); last = now;
  let steps = 0;
  while (acc >= STEP && steps < 4) {
    Keyboard.beginFrame();
    if (loaded && game.scene) game.scene.update();
    Keyboard.endFrame();
    acc -= STEP; steps++;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  if (!loaded) {
    ctx.fillStyle = '#07070f'; ctx.fillRect(0, 0, W, H);
    strokeText(ctx, 'FAMILY FIGHTER', W / 2, H / 2 - 60, 80, '#ffd500', '#000');
    ctx.fillStyle = '#222'; ctx.fillRect(W / 2 - 300, H / 2 + 10, 600, 18);
    ctx.fillStyle = '#ffd500'; ctx.fillRect(W / 2 - 300, H / 2 + 10, 600 * loadProgress, 18);
    strokeText(ctx, loadError ? `Fehler: ${loadError}` : `Lade Kämpfer ... ${Math.round(loadProgress * 100)} %`, W / 2, H / 2 + 60, 22, loadError ? '#ff6b6b' : '#fff', '#000', 'center', false);
    return;
  }
  game.scene.draw(ctx);
}
requestAnimationFrame(loop);
