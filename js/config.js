// Grundkonstanten des Spiels. Alles in logischen Pixeln (Canvas 1280x720).
export const W = 1280;
export const H = 720;
export const GROUND = 648;          // Bodenlinie (Fusspunkt der Kaempfer)
export const STAGE_W = 1680;        // Breite der Buehne (breites Hintergrundbild, 21:9 auf 720 Hoehe)
export const MAX_GAP = 1060;        // maximale Distanz zwischen den Kaempfern
export const EDGE = 135;            // Abstand zum Buehnenrand (Sprite bleibt ganz im Bild)
export const FPS = 60;
export const ROUND_TIME = 99;
export const ROUNDS_TO_WIN = 2;
export const MAX_HP = 1000;
export const MAX_METER = 100;
export const GRAVITY = 0.95;
// Farbfilter fuer Spieler 2 im Spiegelmatch (Kleidung kippt, Haut bleibt glaubwuerdig)
export const ALT_FILTER = 'hue-rotate(-32deg) saturate(1.35) brightness(0.94)';

// Tasten je Spieler (event.code)
export const KEYS = {
  p1: {
    left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS',
    lp: 'KeyF', hp: 'KeyG', kick: 'KeyH', special: 'KeyR',
  },
  p2: {
    left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown',
    lp: 'KeyJ', hp: 'KeyK', kick: 'KeyL', special: 'KeyU',
  },
};

export const KEY_LABELS = {
  p1: { move: 'W A S D', lp: 'F', hp: 'G', kick: 'H', special: 'R' },
  p2: { move: 'Pfeile', lp: 'J', hp: 'K', kick: 'L', special: 'U' },
};
