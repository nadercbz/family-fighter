// Kaempfer-Definitionen. Namen hier aendern, sonst nichts noetig.
// Frame-Daten in Frames bei 60 Hz: startup (Vorlauf), active (Trefferfenster), recovery (Nachlauf).
// Boxen sind Anteile der Sprite-Breite/Hoehe (x,y von links oben, Blickrichtung rechts).

const HURT_STAND = { x: 0.26, y: 0.02, w: 0.48, h: 0.98 };
const HURT_LEAN = { x: 0.10, y: 0.02, w: 0.50, h: 0.98 };

export const ATTACKS = {
  punch_light: {
    pose: 'punch_light', startup: 4, active: 4, recovery: 8, dmg: 55,
    hitstun: 14, blockstun: 9, push: 6, hitstop: 5, height: 'mid', chain: ['punch_heavy', 'kick_light', 'kick_heavy', 'kick_low'],
    hurt: HURT_LEAN, hit: { x: 0.58, y: 0.12, w: 0.42, h: 0.24 }, sound: 'light',
  },
  punch_heavy: {
    pose: 'punch_heavy', startup: 8, active: 5, recovery: 14, dmg: 110,
    hitstun: 21, blockstun: 14, push: 10, hitstop: 9, height: 'mid', chain: ['kick_heavy'],
    hurt: HURT_LEAN, hit: { x: 0.52, y: 0.08, w: 0.48, h: 0.32 }, sound: 'heavy',
  },
  kick_light: {
    pose: 'kick_light', startup: 5, active: 5, recovery: 10, dmg: 75,
    hitstun: 16, blockstun: 11, push: 8, hitstop: 6, height: 'mid', chain: ['punch_heavy', 'kick_heavy'],
    hurt: { x: 0.08, y: 0.02, w: 0.46, h: 0.98 }, hit: { x: 0.52, y: 0.32, w: 0.48, h: 0.32 }, sound: 'light',
  },
  kick_low: {
    pose: 'kick_light', startup: 5, active: 5, recovery: 11, dmg: 65,
    hitstun: 16, blockstun: 11, push: 7, hitstop: 6, height: 'low', crouch: true, chain: ['kick_light', 'punch_heavy'],
    hurt: { x: 0.08, y: 0.25, w: 0.46, h: 0.75 }, hit: { x: 0.48, y: 0.62, w: 0.52, h: 0.38 }, sound: 'light',
  },
  kick_heavy: {
    pose: 'kick_heavy', startup: 10, active: 6, recovery: 17, dmg: 135,
    hitstun: 24, blockstun: 16, push: 14, hitstop: 10, height: 'mid', knockdown: true,
    hurt: { x: 0.14, y: 0.02, w: 0.46, h: 0.98 }, hit: { x: 0.48, y: 0.0, w: 0.52, h: 0.46 }, sound: 'heavy',
  },
  air_punch: {
    pose: 'punch_light', startup: 4, active: 999, recovery: 0, dmg: 80, air: true,
    hitstun: 18, blockstun: 12, push: 6, hitstop: 6, height: 'high',
    hurt: HURT_LEAN, hit: { x: 0.55, y: 0.25, w: 0.45, h: 0.35 }, sound: 'light',
  },
  air_kick: {
    pose: 'kick_light', startup: 5, active: 999, recovery: 0, dmg: 95, air: true,
    hitstun: 20, blockstun: 13, push: 8, hitstop: 7, height: 'high',
    hurt: { x: 0.08, y: 0.02, w: 0.46, h: 0.98 }, hit: { x: 0.5, y: 0.4, w: 0.5, h: 0.4 }, sound: 'heavy',
  },
  special: {
    pose: 'special', startup: 12, active: 1, recovery: 20, dmg: 0, projectile: true,
    hurt: HURT_LEAN, sound: 'special',
  },
};

// Grundboxen fuer Posen ohne Angriff
export const POSE_HURT = {
  idle: HURT_STAND, walk: HURT_STAND, walk_b: HURT_STAND, fall: { x: 0.2, y: 0.06, w: 0.6, h: 0.9 }, block: HURT_STAND, hit: { x: 0.3, y: 0.02, w: 0.5, h: 0.98 },
  win: HURT_STAND, crouch: { x: 0.2, y: 0.06, w: 0.6, h: 0.94 }, jump: { x: 0.2, y: 0.1, w: 0.6, h: 0.8 },
  special: HURT_LEAN, ko: null,
};

export const CHARACTERS = [
  {
    id: 'junior', name: 'NOOR', title: 'Der Wirbelwind',
    color: '#ff8fb1', accent: '#ffd1dc',
    hp: 900, walk: 5.3, back: 4.1, jump: 20.5, jumpFwd: 6.0, dash: 11,
    dmg: 0.9, speed: 1.15, projColor: '#ff6fa8', projName: 'Nirvana Blast',
    stats: { kraft: 2, tempo: 5, sprung: 5, ausdauer: 2 },
  },
  {
    id: 'nader', name: 'NADER', title: 'Der Regisseur',
    color: '#2f6bff', accent: '#9bbcff',
    hp: 1000, walk: 4.9, back: 3.8, jump: 19, jumpFwd: 5.5, dash: 10,
    dmg: 1.0, speed: 1.0, projColor: '#3d8bff', projName: 'Shuto Shot',
    stats: { kraft: 3, tempo: 4, sprung: 4, ausdauer: 3 },
  },
  {
    id: 'sensei', name: 'MBARK', title: 'Der Meister',
    color: '#7fa34a', accent: '#c9e29c',
    hp: 1100, walk: 4.0, back: 3.2, jump: 17.5, jumpFwd: 4.6, dash: 9,
    dmg: 1.25, speed: 0.88, projColor: '#9cff6b', projName: 'Atlas Welle',
    stats: { kraft: 5, tempo: 2, sprung: 2, ausdauer: 4 },
  },
  {
    id: 'shadow', name: 'NADIA', title: 'Die Klinge',
    color: '#c43bff', accent: '#e3b0ff',
    hp: 950, walk: 5.2, back: 4.0, jump: 19.5, jumpFwd: 5.8, dash: 11,
    dmg: 1.0, speed: 1.1, projColor: '#d26bff', projName: 'Schattenstrahl',
    stats: { kraft: 3, tempo: 5, sprung: 4, ausdauer: 3 },
  },
  {
    id: 'goldie', name: 'LATIFA', title: 'Die Unzerstörbare',
    color: '#ffb52e', accent: '#ffe29b',
    hp: 1200, walk: 4.3, back: 3.4, jump: 18, jumpFwd: 4.9, dash: 9.5,
    dmg: 1.1, speed: 0.95, projColor: '#ffc84a', projName: 'Goldener Hieb',
    stats: { kraft: 4, tempo: 3, sprung: 3, ausdauer: 5 },
  },
];

export const STAGES = [
  { id: 'hinterhof', name: 'HINTERHOF', sub: 'Berlin, Regennacht', file: 'assets/stages/hinterhof.jpg', floor: '#101418', reflect: 0.5,
    fx: { weathers: ['regen', 'regen', 'gewitter', 'nebel', 'klar'], maxLights: 110, lightMaxY: 530,
      neon: [{ x: 903, y: 366, w: 62, h: 12, color: '#ff3b3b' }, { x: 600, y: 330, w: 95, h: 10, color: '#ff6a7a' }],
      glow: [{ x: 612, y: 385, r: 150, color: 'rgba(255,170,90,0.35)' }, { x: 1215, y: 150, r: 120, color: 'rgba(120,200,255,0.4)' }] } },
  { id: 'kasbah', name: 'KASBAH', sub: 'Hoher Atlas, Abendstaub', file: 'assets/stages/kasbah.jpg', floor: '#7a4a2a', reflect: 0.05,
    fx: { weathers: ['klar', 'klar', 'staub', 'staub', 'nebel'], heat: { y0: 260, y1: 600, x0: 420, x1: 1420 }, clouds: true, maxLights: 20, lightMaxY: 300, dust: true } },
  { id: 'neon', name: 'NEONSTADT', sub: 'Nebel, Regen, Neon', file: 'assets/stages/neon.jpg', floor: '#0f1a1e', reflect: 0.55,
    fx: { weathers: ['regen', 'regen', 'nebel', 'gewitter', 'klar'], maxLights: 170, lightMaxY: 560,
      neon: [{ x: 270, y: 335, w: 58, h: 60, color: '#ff2f3f' }, { x: 1428, y: 318, w: 68, h: 70, color: '#ff2f3f' }, { x: 1056, y: 398, w: 18, h: 70, color: '#59c8ff' }, { x: 637, y: 455, w: 14, h: 40, color: '#59c8ff' }] } },
];

export const POSES = ['idle', 'walk', 'walk_b', 'fall', 'crouch', 'jump', 'punch_light', 'punch_heavy', 'kick_light', 'kick_heavy', 'block', 'hit', 'ko', 'special', 'win'];
