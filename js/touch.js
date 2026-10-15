// Touch-Steuerung fuers Handy: schwebender Joystick links, vier Angriffsknoepfe rechts, Pause und Vollbild oben.
// Alles wird als Tastencode in die Keyboard-Schicht gespeist, deshalb funktionieren Menues und Kampf unveraendert.
// Layout 'single': nur Spieler 1 (CPU-Modus). Layout 'split': Spieler 1 links, Spieler 2 rechts (Tablet oder grosses Handy).
import { KEYS, W, H } from './config.js';
import { Keyboard } from './input.js';
import { unlockAudio } from './audio.js';

export const isTouchDevice = () => ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0;

const STICK_R = 78;        // Radius der Joystick-Basis (logische Pixel)
const DEAD = 14;           // Totzone
const BTN = 74;            // Durchmesser der Angriffsknoepfe

class Stick {
  constructor(root, zone, keys, side) {
    this.keys = keys;
    this.zone = zone;
    this.id = null;
    this.ox = 0; this.oy = 0;
    this.active = new Set();
    this.base = el('div', 'ff-stick', root);
    this.knob = el('div', 'ff-knob', this.base);
    this.base.style.display = 'none';
    this.base.style.width = this.base.style.height = `${STICK_R * 2}px`;
    this.knob.style.width = this.knob.style.height = `${STICK_R * 0.9}px`;
    this.hint = el('div', 'ff-stickhint', root);
    this.hint.textContent = side === 0 ? 'BEWEGEN' : 'BEWEGEN';
    const z = zone;
    Object.assign(this.hint.style, { left: `${z.x + z.w / 2 - 60}px`, top: `${z.y + z.h / 2 - 12}px` });
  }
  inZone(x, y) { const z = this.zone; return x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h; }
  start(id, x, y) {
    this.id = id; this.ox = x; this.oy = y;
    this.base.style.display = 'block';
    this.base.style.left = `${x - STICK_R}px`; this.base.style.top = `${y - STICK_R}px`;
    this.hint.style.opacity = '0';
    this.move(x, y);
  }
  move(x, y) {
    let dx = x - this.ox, dy = y - this.oy;
    const d = Math.hypot(dx, dy);
    if (d > STICK_R) { dx *= STICK_R / d; dy *= STICK_R / d; }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const want = new Set();
    if (d > DEAD) {
      const ang = Math.atan2(dy, dx);
      const c = Math.cos(ang), s = Math.sin(ang);
      if (c > 0.38) want.add(this.keys.right);
      if (c < -0.38) want.add(this.keys.left);
      if (s < -0.5) want.add(this.keys.up);
      if (s > 0.5) want.add(this.keys.down);
    }
    for (const k of this.active) if (!want.has(k)) Keyboard.virtualUp(k);
    for (const k of want) if (!this.active.has(k)) Keyboard.virtualDown(k);
    this.active = want;
  }
  end() {
    this.id = null;
    this.base.style.display = 'none';
    this.hint.style.opacity = '';
    for (const k of this.active) Keyboard.virtualUp(k);
    this.active.clear();
  }
}

function el(tag, cls, parent) { const e = document.createElement(tag); e.className = cls; parent.appendChild(e); return e; }

export class TouchControls {
  constructor(container) {
    this.root = el('div', 'ff-touch', container);
    this.root.style.width = `${W}px`; this.root.style.height = `${H}px`;
    this.layout = null;
    this.buttons = [];
    this.sticks = [];
    this.pointers = new Map();     // pointerId -> { kind: 'stick'|'btn', ref }
    this.enabled = false;
    this.setLayout('single');
    const r = this.root;
    r.addEventListener('pointerdown', (e) => this.onDown(e));
    r.addEventListener('pointermove', (e) => this.onMove(e));
    r.addEventListener('pointerup', (e) => this.onUp(e));
    r.addEventListener('pointercancel', (e) => this.onUp(e));
    r.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  setScale(s) { this.root.style.transform = `scale(${s})`; }
  show(on) { this.enabled = on; this.root.style.display = on ? 'block' : 'none'; }

  // Umrechnung Bildschirm -> logische Koordinaten des Overlays
  local(e) {
    const r = this.root.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
  }

  setLayout(layout) {
    if (layout === this.layout) return;
    this.layout = layout;
    this.root.innerHTML = '';
    this.buttons = []; this.sticks = [];
    for (const [, p] of this.pointers) if (p.kind === 'btn') p.ref.release();
    this.pointers.clear();
    const k1 = KEYS.p1, k2 = KEYS.p2;
    if (layout === 'split') {
      this.sticks.push(new Stick(this.root, { x: 0, y: 150, w: 330, h: H - 150 }, k1, 0));
      this.sticks.push(new Stick(this.root, { x: W - 330, y: 150, w: 330, h: H - 150 }, k2, 1));
      this.addCluster(k1, 340, H - 150, 1, 'P1');
      this.addCluster(k2, W - 340, H - 150, -1, 'P2');
    } else {
      this.sticks.push(new Stick(this.root, { x: 0, y: 120, w: W * 0.45, h: H - 120 }, k1, 0));
      this.addCluster(k1, W - 230, H - 165, -1, '');
    }
    // rechter Rand unter dem Portrait: OK, Pause, Vollbild (stoeren weder HUD noch Kampf)
    const rx = layout === 'split' ? W / 2 - 24 : W - 62;
    const ry = layout === 'split' ? 118 : 126;
    this.addButton('OK', ['Enter'], rx, ry, 48, 'ff-top');
    this.addButton('II', ['Escape'], rx, ry + 58, 48, 'ff-top');
    const fs = this.addButton('⛶', [], rx, ry + 116, 48, 'ff-top');
    fs.onTap = () => toggleFullscreen();
  }

  // Vier Knoepfe als Raute: Schlag, Schwer, Tritt, Special. dir = 1 oeffnet nach rechts, -1 nach links
  addCluster(k, cx, cy, dir, label) {
    const d = BTN;
    const g = 1.18;
    this.addButton('SCHLAG', [k.lp], cx - d * g * dir - d / 2, cy - d / 2, d, 'ff-lp');
    this.addButton('SCHWER', [k.hp], cx - d / 2, cy - d * g - d / 2, d, 'ff-hp');
    this.addButton('TRITT', [k.kick], cx - d / 2, cy + d * g - d / 2, d, 'ff-kick');
    this.addButton('SPECIAL', [k.special], cx + d * g * dir - d / 2, cy - d / 2, d, 'ff-sp');
    if (label) { const t = el('div', 'ff-label', this.root); t.textContent = label; t.style.left = `${cx - 20}px`; t.style.top = `${cy - d * 2.1}px`; }
  }

  addButton(text, codes, x, y, size, cls) {
    const b = el('div', `ff-btn ${cls || ''}`, this.root);
    b.textContent = text;
    Object.assign(b.style, { left: `${x}px`, top: `${y}px`, width: `${size}px`, height: `${size}px`, fontSize: `${size * (text.length > 3 ? 0.2 : 0.34)}px` });
    const btn = {
      el: b, codes, hit: { x, y, w: size, h: size }, held: 0,
      press() { this.held++; if (this.held === 1) { b.classList.add('on'); codes.forEach(c => Keyboard.virtualDown(c)); if (this.onTap) this.onTap(); } },
      release() { this.held = Math.max(0, this.held - 1); if (this.held === 0) { b.classList.remove('on'); codes.forEach(c => Keyboard.virtualUp(c)); } },
    };
    this.buttons.push(btn);
    return btn;
  }

  buttonAt(x, y) {
    for (const b of this.buttons) {
      const h = b.hit, pad = 10;
      if (x >= h.x - pad && x <= h.x + h.w + pad && y >= h.y - pad && y <= h.y + h.h + pad) return b;
    }
    return null;
  }

  onDown(e) {
    if (!this.enabled) return;
    e.preventDefault();
    unlockAudio();
    const { x, y } = this.local(e);
    const b = this.buttonAt(x, y);
    if (b) { b.press(); this.pointers.set(e.pointerId, { kind: 'btn', ref: b }); return; }
    for (const s of this.sticks) {
      if (s.id === null && s.inZone(x, y)) { s.start(e.pointerId, x, y); this.pointers.set(e.pointerId, { kind: 'stick', ref: s }); return; }
    }
    // Leerer Bereich: zaehlt als "Taste gedrueckt" fuer den Titel
    Keyboard.virtualDown('TouchAny'); this.pointers.set(e.pointerId, { kind: 'any' });
  }

  onMove(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    e.preventDefault();
    const { x, y } = this.local(e);
    if (p.kind === 'stick') p.ref.move(x, y);
    else if (p.kind === 'btn') {
      // Finger rutscht auf einen anderen Knopf: umschalten (erlaubt schnelle Wischkombos)
      const b = this.buttonAt(x, y);
      if (b && b !== p.ref) { p.ref.release(); b.press(); p.ref = b; }
    }
  }

  onUp(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    e.preventDefault();
    if (p.kind === 'stick') p.ref.end();
    else if (p.kind === 'btn') p.ref.release();
    else Keyboard.virtualUp('TouchAny');
    this.pointers.delete(e.pointerId);
  }

  vibrate(ms) { if (this.enabled && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* egal */ } } }
}

export function toggleFullscreen() {
  const d = document;
  const root = d.documentElement;
  try {
    if (d.fullscreenElement || d.webkitFullscreenElement) { (d.exitFullscreen || d.webkitExitFullscreen).call(d); return; }
    const req = root.requestFullscreen || root.webkitRequestFullscreen;
    if (req) req.call(root).then(() => { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); }).catch(() => {});
  } catch (e) { /* iPhone kann kein Vollbild, dort hilft "Zum Home-Bildschirm" */ }
}
