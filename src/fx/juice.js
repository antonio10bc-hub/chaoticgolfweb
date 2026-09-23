/* =========================================================
   JUICE / GAME-FEEL TUNING — todas las constantes de efectos.
   Ajusta aquí duraciones (ms), intensidades (px), cantidades
   de partículas y volumen. Nada de esto altera las reglas.
   ---------------------------------------------------------
   RITMO: una jugada completa debe resolverse en < ~1,5 s.
   Si algo se siente lento, baja move.ms / move.holeMs.
   ========================================================= */
export const JUICE = {
  move: {
    ms: 130,              // duración de un paso de pelota
    holeMs: 185,          // paso del hoyo (más pesado)
    ease: 'cubic-bezier(.3,.75,.35,1)',     // salida suave con rebote sutil
    holeEase: 'cubic-bezier(.45,.55,.35,1)', // arrastre pesado del hoyo
    grassPuffs: 3,        // partículas de césped por paso
    dirtPuffs: 5,         // partículas de tierra por paso del hoyo
  },
  impact: {
    shakeMs: 240,         // duración de la sacudida del tablero (2-3 px en CSS)
    lungePx: 8,           // estirada del atacante hacia el golpe
    windupMs: 70, strikeMs: 90, recoverMs: 90,
    sparks: 10,           // partículas del choque
  },
  teleport: { inMs: 150, outMs: 170, vortex: 10 },  // succión / expulsión + vórtice
  fall:     { ms: 210, poof: 8 },                   // rueda fuera + poof
  appear:   { ms: 340, dust: 6 },                   // drop-in con rebote + polvo
  sink:     { ms: 320, confetti: 16 },              // espiral + confeti al embocar
  settle:   { plofMs: 130, sand: 9 },               // "plof" del búnker
  place:    { dust: 8 },                            // polvo al colocar loseta
  particles: { max: 90 },                           // límite del pool de partículas
  confettiWin: { bursts: 3, perBurst: 16, gapMs: 130 }, // confeti de victoria
  turnBannerMs: 1050,     // vida del banner de turno
  dealStaggerMs: 75,      // retraso entre cartas robadas
  cardFlyMs: 320,         // viaje de la carta jugada hacia el tablero
  sfx: { volume: 0.13 },  // volumen maestro de los efectos de sonido
  trail: { fadeMs: 2000, max: 14 },  // estela fantasma de la última jugada
  idle: { ms: 6000 },     // tiempo sin input antes de las animaciones de reposo
  slowMoMs: 180,          // pausa de slow-motion al embocar (antes del confeti)
  comboMs: 850,           // vida del texto flotante de combo
  ambientMs: 3800,        // intervalo entre pétalos ambientales (si el tablero está visible)
  rewindMs: 230,          // retroceso rápido de las piezas al jugar NO
  music: { volume: 0.055, chordMs: 2600 },  // música ambiental generativa
  // ritmo de la IA — despacio y de una en una, para que se entienda qué hace
  ai: {
    thinkMs: 1050,       // pausa antes de decidir
    stepMs: 680,         // entre pasos del dedo
    clickMs: 260,        // entre elegir carta y elegir destino
    betweenMs: 1000,     // entre cartas de un mismo turno
    endMs: 950,          // pausa antes de terminar el turno
    reactDelayMs: 550,   // antes de una reacción naranja espontánea
    jaqueWindowMs: 6500, // espera a la posible reacción del jugador humano en un JAQUE
    jaqueIdleMs: 1900,   // … si el humano no tiene naranjas
  },
};

export const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const GRASS_C = ['#8DB05F', '#A3C173', '#5C9854', '#D9E6B8'];
export const SAND_C  = ['#ECE6CC', '#F6F2E0', '#DCD3B0', '#CFC49B'];
export const CEMENT_C = ['#efece4', '#cfccc4', '#faf8f2'];
export const DIRT_C  = ['#a98a5c', '#8a6a3f', '#cbb289'];
export const WARP_C  = ['#2D4F7C', '#4A6D9C', '#F1F1DC', '#E8873A'];
export const CONFETTI_C = ['#E8873A', '#D9603A', '#2D4F7C', '#F1F1DC', '#8DB05F', '#ECE6CC'];
