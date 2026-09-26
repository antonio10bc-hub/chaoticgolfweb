/* =========================================================
   JUICE / GAME-FEEL TUNING — todas las constantes de efectos.
   Ajusta aquí duraciones (ms), intensidades (px), cantidades
   de partículas y volumen. Nada de esto altera las reglas.
   ---------------------------------------------------------
   RITMO: pausado para que cada acción se lea bien (una jugada típica ~2 s).
   Si algo se siente lento, baja move.ms / move.holeMs.
   ========================================================= */
export const JUICE = {
  move: {
    ms: 200,              // duración de un paso de pelota
    iriMs: 125,           // paso con el palo iridiscente
    holeMs: 270,          // paso del hoyo (más pesado)
    ease: 'cubic-bezier(.3,.75,.35,1)',     // salida suave con rebote sutil
    holeEase: 'cubic-bezier(.45,.55,.35,1)', // arrastre pesado del hoyo
    grassPuffs: 3,        // partículas de césped por paso
    dirtPuffs: 5,         // partículas de tierra por paso del hoyo
  },
  impact: {
    shakeMs: 240,         // duración de la sacudida del tablero (2-3 px en CSS)
    lungePx: 8,           // estirada del atacante hacia el golpe
    windupMs: 100, strikeMs: 120, recoverMs: 130,
    sparks: 10,           // partículas del choque
  },
  teleport: { inMs: 220, outMs: 250, vortex: 10 },  // succión / expulsión + vórtice
  fall:     { ms: 300, poof: 8 },                   // rueda fuera + poof
  appear:   { ms: 460, dust: 6 },                   // drop-in con rebote + polvo
  sink:     { ms: 440, confetti: 16 },              // espiral + confeti al embocar
  settle:   { plofMs: 190, sand: 9 },               // "plof" del búnker
  place:    { dust: 8 },                            // polvo al colocar loseta
  particles: { max: 90 },                           // límite del pool de partículas
  confettiWin: { bursts: 3, perBurst: 16, gapMs: 130 }, // confeti de victoria
  turnBannerMs: 1300,     // vida del banner de turno
  dealStaggerMs: 95,      // retraso entre cartas robadas
  cardFlyMs: 320,         // viaje de la carta jugada hacia el tablero
  sfx: { volume: 0.13 },  // volumen maestro de los efectos de sonido
  trail: { max: 160, holdMs: 200, stepMs: 40, maxMs: 1100 },  // estela de la jugada: se quita uno a uno (stepMs) al acabar
  idle: { ms: 6000 },     // tiempo sin input antes de las animaciones de reposo
  slowMoMs: 240,          // pausa de slow-motion al embocar (antes del confeti)
  comboMs: 850,           // vida del texto flotante de combo
  ambientMs: 3800,        // intervalo entre pétalos ambientales (si el tablero está visible)
  rewindMs: 320,          // retroceso rápido de las piezas al jugar NO
  music: { volume: 0.055, chordMs: 2600 },  // música ambiental generativa
  cardLeadMs: { mine: 220, bot: 520 },      // espera del tablero tras jugar una carta (para ver primero la carta)
  cardShowMs: { mine: 1300, bot: 1700, discard: 900 }, // vida de la carta jugada / descartada sobre la mesa
  // ritmo de la IA — despacio y de una en una, para que se entienda qué hace
  ai: {
    thinkMs: 1250,       // pausa antes de decidir
    stepMs: 820,         // entre pasos del dedo
    clickMs: 380,        // entre elegir carta y elegir destino
    betweenMs: 1250,     // entre cartas de un mismo turno
    endMs: 1100,          // pausa antes de terminar el turno
    reactDelayMs: 550,   // antes de una reacción naranja espontánea
    jaqueWindowMs: 6500, // espera a la posible reacción del jugador humano en un JAQUE
    jaqueIdleMs: 1900,   // … si el humano no tiene naranjas
  },
};

/* ---------- velocidad de las animaciones (ajustes: lenta / normal / rápida) ----------
   Escala todas las duraciones de arriba (claves que acaban en "ms"), incluido el ritmo
   de la IA, salvo esperas que no son animación: reposo, música, ambiente y la ventana
   del JAQUE para que el jugador pueda reaccionar. */
export const SPEEDS = { slow: 1.4, normal: 1, fast: .6 };
const NO_SCALE = new Set(['idle.ms', 'music.chordMs', 'ambientMs', 'ai.jaqueWindowMs', 'ai.jaqueIdleMs']);
const BASE = JSON.parse(JSON.stringify(JUICE));
export let SPEED = 1;
export function setSpeed(mult) {
  SPEED = mult;
  const walk = (base, live, path) => {
    for (const [k, v] of Object.entries(base)) {
      const key = path ? path + '.' + k : k;
      if (v && typeof v === 'object') walk(v, live[k], key);
      else if (typeof v === 'number' && /ms$/i.test(k) && !NO_SCALE.has(key)) live[k] = Math.round(v * mult);
      else if (typeof v === 'number' && path && /ms$/i.test(path) && !NO_SCALE.has(path)) live[k] = Math.round(v * mult); // cardLeadMs.mine…
    }
  };
  walk(BASE, JUICE, '');
  if (typeof document !== 'undefined') document.documentElement.style.setProperty('--spd', mult);
}

// movimiento reducido: la preferencia del sistema o el ajuste del juego
const SYS_REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export let REDUCED = SYS_REDUCED;
export function setReduced(on) {
  REDUCED = SYS_REDUCED || !!on;
  if (typeof document !== 'undefined') document.documentElement.classList.toggle('reduceMotion', REDUCED);
}

export const GRASS_C = ['#8DB05F', '#A3C173', '#5C9854', '#D9E6B8'];
export const SAND_C  = ['#ECE6CC', '#F6F2E0', '#DCD3B0', '#CFC49B'];
export const CEMENT_C = ['#efece4', '#cfccc4', '#faf8f2'];
export const DIRT_C  = ['#a98a5c', '#8a6a3f', '#cbb289'];
export const WARP_C  = ['#2D4F7C', '#4A6D9C', '#F1F1DC', '#E8873A'];
export const WATER_C = ['#BFE8F5', '#7FCBE3', '#FFFFFF', '#4FA7C6'];
export const WOOD_C  = ['#E2B77E', '#C99257', '#A8743F', '#F6E2BE'];
export const IRI_C   = ['#FF8FC4', '#8FB6FF', '#7EE8C8', '#FFE38A', '#C39BFF'];
export const CONFETTI_C = ['#E8873A', '#D9603A', '#2D4F7C', '#F1F1DC', '#8DB05F', '#ECE6CC'];
