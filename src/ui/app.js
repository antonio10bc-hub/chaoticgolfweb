// Estado de la aplicación (no de las reglas): qué pantalla, qué modo, qué partida,
// y los flags de la reproducción de animaciones. Un único objeto compartido.
export const app = {
  game: null,            // Game en curso (src/engine/game.js)
  mode: 'free',          // 'free' (testing tool) | 'test' (probar desde editor) | 'story' (en solitario) | 'pve' (con bots)
  variant: null,         // subtipo: en solitario 'puzzle' | 'daily' | 'rush'; con bots 'tour' | 'challenge'; null = el normal
  run: null,             // datos del subtipo en curso (hoyo del torneo, puntos del contrarreloj, fecha del reto…)
  levelIndex: null,      // índice del nivel en juego (modo historia)
  level: null,           // nivel en juego (historia / prueba)
  screen: 'menu',
  animating: false,      // true mientras se reproducen las animaciones de una jugada
  animQueue: [],         // eventos de animación pendientes de reproducir
  animLead: 0,           // espera antes de reproducirlos (tras jugar una carta)
  lastPlayAt: 0,         // última carta jugada (aviso de fin de turno en historia)
  playSeq: 0,            // contador de jugadas resueltas (la IA evalúa reacciones una vez por jugada)
  lastActor: null,       // jugador de la última carta consumida
  tipShown: {},          // bocadillos de tutorial ya mostrados en la partida actual
  storyLevels: [],       // niveles integrados de Lo básico (cargados de JSON)
  puzzleLevels: [],      // puzles de "gana en 1 turno"
  pveShowHands: false,   // debug: ver las cartas de los contrincantes
  pveCfg: { color: 0, size: 'm', opps: 2, humans: 1, diff: 'normal' },
  lastPveCfg: null,      // configuración de la partida PVE en curso (para Reiniciar)
  ai: { acting: false, thinkingOf: null },
  // multijugador local (varias personas en el mismo dispositivo)
  viewer: null,          // persona que tiene ahora el dispositivo (su mano es la del dock)
  passFor: null,         // pantalla de "pasa el móvil" abierta para esta persona
  reacting: null,        // persona fuera de turno que ha pedido el dispositivo para reaccionar
  lastInputAt: 0,        // último clic / tecla (aviso tras un rato sin jugar)
  paused: false,         // false | 'user' | 'settings' | 'rules': la máquina y sus temporizadores esperan
};

export const S = () => app.game.S;
