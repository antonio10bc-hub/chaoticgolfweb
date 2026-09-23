// Estado de la aplicación (no de las reglas): qué pantalla, qué modo, qué partida,
// y los flags de la reproducción de animaciones. Un único objeto compartido.
export const app = {
  game: null,            // Game en curso (src/engine/game.js)
  mode: 'free',          // 'free' (testing tool) | 'test' (probar desde editor) | 'story' | 'pve'
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
  storyLevels: [],       // niveles integrados de historia (cargados de JSON)
  pveShowHands: false,   // debug: ver las cartas de los contrincantes
  pveCfg: { color: 0, size: 'm', opps: 2 },
  lastPveCfg: null,      // configuración de la partida PVE en curso (para Reiniciar)
  ai: { acting: false, thinkingOf: null },
};

export const S = () => app.game.S;
export const isPve = () => app.mode === 'pve';
export const isHuman = p => app.mode !== 'pve' || p === app.game.S.human;
