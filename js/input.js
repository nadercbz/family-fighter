// Tastatur mit Frame-Puffer. Jeder Spieler bekommt ein PlayerInput mit:
//  held(name)      Taste gehalten
//  pressed(name)   in diesem Frame gedrueckt (bleibt BUFFER Frames im Puffer, bis consume())
//  dashReady       Doppeltipp in Richtung erkannt (-1 links, +1 rechts)
// Gamepads werden in Tastencodes uebersetzt (siehe pollPads).
import { KEYS } from './config.js';

const BUFFER = 10;        // Frames, die ein Tastendruck gepuffert bleibt
const DOUBLE_TAP = 14;    // Frames fuer Doppeltipp

const down = new Set();
const justDown = new Set();
let anyPressed = false;

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (!down.has(e.code)) justDown.add(e.code);
  down.add(e.code);
  anyPressed = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', (e) => { down.delete(e.code); });
window.addEventListener('blur', () => { down.clear(); padState.length = 0; });

// ---- Gamepad ------------------------------------------------------------
// Pad 0 = Spieler 1, Pad 1 = Spieler 2. Standard-Layout: Kreuz/Stick = Richtung, X = leichter Schlag,
// Y = schwerer Schlag, A = Tritt, B oder RB = Special, LB = schwerer Tritt (Y+A), Start = Enter, Back = Escape.
// Die Knoepfe werden in die Tastencodes des Spielers uebersetzt, damit Menues und Kampf denselben Weg nutzen.
const padState = [];
const PAD_BUTTONS = (k) => ({
  0: [k.kick], 1: [k.special], 2: [k.lp], 3: [k.hp], 4: [k.hp, k.kick], 5: [k.special],
  8: ['Escape'], 9: ['Enter'], 12: [k.up], 13: [k.down], 14: [k.left], 15: [k.right],
});

function pollPads() {
  if (!navigator.getGamepads) return;
  let pads;
  try { pads = navigator.getGamepads(); } catch (e) { return; }
  for (let i = 0; i < 2; i++) {
    const pad = pads[i];
    const k = KEYS[i === 0 ? 'p1' : 'p2'];
    const map = PAD_BUTTONS(k);
    const prev = padState[i] || new Set();
    const cur = new Set();
    if (pad) {
      for (const b in map) if (pad.buttons[b] && pad.buttons[b].pressed) map[b].forEach(c => cur.add(c));
      const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
      if (ax < -0.5) cur.add(k.left); if (ax > 0.5) cur.add(k.right);
      if (ay < -0.5) cur.add(k.up); if (ay > 0.5) cur.add(k.down);
    }
    for (const c of cur) if (!prev.has(c)) { justDown.add(c); down.add(c); anyPressed = true; }
    for (const c of prev) if (!cur.has(c)) down.delete(c);
    padState[i] = cur;
  }
}

export const Keyboard = {
  isDown: (code) => down.has(code),
  justPressed: (code) => justDown.has(code),
  anyPressed: () => anyPressed,
  // Touch-Overlay und andere virtuelle Quellen speisen hier ein (gleiche Semantik wie Tastatur)
  virtualDown(code) { if (!down.has(code)) justDown.add(code); down.add(code); anyPressed = true; },
  virtualUp(code) { down.delete(code); },
  beginFrame() { pollPads(); },
  endFrame() { justDown.clear(); anyPressed = false; },
};

export class PlayerInput {
  constructor(slot) {
    this.slot = slot;
    this.map = KEYS[slot];
    this.buf = {};           // name -> Frames seit Druck (0 = jetzt)
    this.tap = { dir: 0, t: 99 };
    this.dashReady = 0;
    this.enabled = true;
    this.names = Object.keys(this.map);
  }

  // einmal pro Frame aufrufen
  update() {
    for (const n of this.names) {
      if (this.buf[n] !== undefined) this.buf[n]++;
      if (this.buf[n] > BUFFER) delete this.buf[n];
      if (this.enabled && Keyboard.justPressed(this.map[n])) this.buf[n] = 0;
    }
    // Doppeltipp
    this.tap.t++;
    this.dashReady = 0;
    for (const [n, dir] of [['left', -1], ['right', 1]]) {
      if (this.enabled && Keyboard.justPressed(this.map[n])) {
        if (this.tap.dir === dir && this.tap.t <= DOUBLE_TAP) { this.dashReady = dir; this.tap.t = 99; }
        else { this.tap.dir = dir; this.tap.t = 0; }
      }
    }
  }

  held(n) { return this.enabled && Keyboard.isDown(this.map[n]); }
  pressed(n) { return this.buf[n] !== undefined; }
  consume(n) { delete this.buf[n]; }
  consumeAll() { this.buf = {}; }
  axis() { return (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0); }
  clone() { return new PlayerInput(this.slot); }
}

// CPU-Gegner: liefert dieselbe Schnittstelle wie PlayerInput, entscheidet aber selbst.
export class CpuInput {
  constructor(level = 1) {
    this.level = level;      // 0 leicht, 1 mittel, 2 schwer
    this.state = {};
    this.buf = {};
    this.dashReady = 0;
    this.enabled = true;
    this.me = null; this.foe = null;
    this.think = 0;
    this.plan = 'idle';
    this.planT = 0;
    this.map = {};
  }
  attach(me, foe) { this.me = me; this.foe = foe; }
  update() {
    for (const n in this.buf) { this.buf[n]++; if (this.buf[n] > BUFFER) delete this.buf[n]; }
    this.state = {};
    this.dashReady = 0;
    if (!this.me || !this.foe || !this.enabled) return;
    const me = this.me, foe = this.foe;
    const dist = Math.abs(foe.x - me.x);
    const toward = foe.x > me.x ? 1 : -1;
    const react = [0.35, 0.6, 0.85][this.level];
    const aggro = [0.25, 0.45, 0.65][this.level];

    // Reaktion: Gegner greift an oder Projektil kommt -> blocken
    const threat = foe.state === 'attack' && dist < 330;
    const proj = foe.world && foe.world.projectiles.some(p => p.owner !== me && Math.abs(p.x - me.x) < 260 && Math.sign(p.vx) === -toward);
    if ((threat || proj) && Math.random() < react) {
      const lowIncoming = foe.attack && foe.attack.height === 'low';
      this.state[toward > 0 ? 'left' : 'right'] = true;
      if (lowIncoming) this.state.down = true;
      if (proj && Math.random() < 0.25 && me.y === 0) this.state.up = true;
      return;
    }

    if (--this.planT > 0) { this.applyPlan(toward, dist); return; }
    // neuen Plan waehlen
    const r = Math.random();
    if (dist > 420) {
      if (r < 0.35 && me.meter >= 0 && Math.random() < aggro) { this.plan = 'special'; this.planT = 6; }
      else if (r < 0.75) { this.plan = 'approach'; this.planT = 20 + Math.random() * 25; }
      else if (r < 0.9) { this.plan = 'jumpin'; this.planT = 8; }
      else { this.plan = 'wait'; this.planT = 15; }
    } else if (dist > 230) {
      if (r < 0.45) { this.plan = 'approach'; this.planT = 10 + Math.random() * 12; }
      else if (r < 0.6) { this.plan = 'kick_heavy'; this.planT = 4; }
      else if (r < 0.75) { this.plan = 'jumpin'; this.planT = 8; }
      else if (r < 0.85) { this.plan = 'special'; this.planT = 6; }
      else { this.plan = 'back'; this.planT = 12; }
    } else {
      if (r < aggro) { this.plan = ['lp', 'lp', 'hp', 'kick', 'low', 'kick_heavy'][Math.floor(Math.random() * 6)]; this.planT = 3; }
      else if (r < aggro + 0.2) { this.plan = 'block'; this.planT = 12; }
      else if (r < aggro + 0.3) { this.plan = 'back'; this.planT = 10; }
      else { this.plan = 'wait'; this.planT = 6 + Math.random() * 10; }
    }
    this.applyPlan(toward, dist);
  }
  applyPlan(toward, dist) {
    const fwd = toward > 0 ? 'right' : 'left', back = toward > 0 ? 'left' : 'right';
    switch (this.plan) {
      case 'approach': this.state[fwd] = true; break;
      case 'back': this.state[back] = true; break;
      case 'block': this.state[back] = true; if (Math.random() < 0.4) this.state.down = true; break;
      case 'jumpin': this.state[fwd] = true; this.state.up = true; if (this.planT < 4) this.press('kick'); break;
      case 'special': this.press('special'); this.plan = 'wait'; break;
      case 'lp': this.press('lp'); this.plan = 'wait'; break;
      case 'hp': this.press('hp'); this.plan = 'wait'; break;
      case 'kick': this.press('kick'); this.plan = 'wait'; break;
      case 'kick_heavy': this.press('hp'); this.press('kick'); this.plan = 'wait'; break;
      case 'low': this.state.down = true; this.press('kick'); this.plan = 'wait'; break;
      default: break;
    }
  }
  clone() { return new CpuInput(this.level); }
  press(n) { this.buf[n] = 0; }
  held(n) { return !!this.state[n]; }
  pressed(n) { return this.buf[n] !== undefined; }
  consume(n) { delete this.buf[n]; }
  consumeAll() { this.buf = {}; }
  axis() { return (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0); }
}
