# Chaotic Golf

Mesa digital del juego de cartas: palos, dedo, búnkeres, portales, cartas de mover el hoyo y el **JAQUE**
(una jugada ganadora abre una ventana de reacción con cartas naranjas).

Sitio 100 % estático, sin paso de build: HTML + CSS + módulos ES nativos. Se puede instalar como app
(PWA) y funciona sin conexión.

## Arrancar

```bash
npm start            # http://localhost:8080  (los módulos ES no funcionan con file://)
```

Cualquier servidor estático sirve (`python3 -m http.server`, GitHub Pages…). Para las herramientas de
desarrollo: `npm install` (solo instala jsdom y puppeteer-core, que usan el oráculo y la prueba de humo).

## Estructura

```
index.html                 esqueleto de la página (sin lógica ni onclick)
styles/                    CSS por área: base, board, hands, hud, screens, editor, fx, icons, ui
src/
  main.js                  punto de entrada: listeners, carga de niveles y arte
  engine/                  REGLAS PURAS — sin DOM, sin sonido, sin timers
    game.js                clase Game: estado S + acción pendiente + eventos
    rng.js                 RNG con semilla (partidas reproducibles)
  content/
    cards/                 una carta (o familia) por archivo + registro ordenado (index.js)
    tiles/                 losetas (búnker, portal) con sus rasgos: trap / portal
    levels/story/          niveles del modo historia en JSON (+ index.json)
  ai/
    bot.js                 decisiones de los bots: simulan cada jugada con el motor y la puntúan
    autoplay.js            partidas bot-contra-bot instantáneas (simulador y tests)
  ui/                      pantallas, tablero, manos, HUD, editor, debug, orquestador de la IA
    controller.js          une motor e interfaz: acción → eventos → efectos → render
  fx/                      partículas, efectos y constantes de "juice" (juice.js)
  audio/                   efectos de sonido y música generativa (WebAudio, sin archivos)
  i18n/                    textos (es.js) y t()
  storage.js               localStorage con esquema versionado
  art.js                   arte bitmap opcional + markup de piezas
assets/icons/              iconos de la app
assets/art/                arte bitmap opcional (ver más abajo)
tests/                     node --test: oráculo de reglas, reglas concretas e IA
tools/                     servidor, oráculo, simulador, prueba de humo, manifiesto de arte
sw.js, manifest.webmanifest   PWA
```

**Flujo:** la interfaz llama a una acción del motor (`game.clickCard`, `clickCell`, `endTurn`…), el motor
cambia el estado y emite eventos (`move`, `impact`, `sink`, `card`, `rewind`, `resolved`…), y
`ui/controller.js` los convierte en sonido, efectos y animaciones antes de renderizar.

## Añadir contenido

**Una carta nueva:** crea `src/content/cards/mi-carta.js` y añádela a `CARD_LIST` en `cards/index.js`
(el orden es el del mazo y los paneles). Pon su nombre en `src/i18n/es.js` → `cards.<id>.name`.

```js
export default {
  id: 'palo4', color: 'black', copies: 2,
  icon: '<span class="ico ico-palo"></span>', art: 'icon.palo', stroke: true,
  canPlay(game, p) { return !game.inTrap(game.ownBall(p)); },       // reglas propias (opcional)
  play(game, p, idx) {                                              // abre una acción o resuelve
    const ball = game.ownBall(p);
    game.setPending({ kind: 'move', p, idx, n: 4, ball, targets: game.straightTargets(ball, 4) });
  },
};
```

Si usa los tipos de acción pendiente existentes (`move`, `pickBall`, `dedoAmount`, `placeTile`…), la
**IA la juega sin tocar nada**: enumera las elecciones del motor y simula el resultado.

**Una loseta nueva:** módulo en `src/content/tiles/` con sus rasgos (`trap`, `portal`, `maxOnBoard`) y su
aspecto (`cellClass`, `emoji`, `tileArt`…); regístrala en `tiles/index.js` y crea la carta que la coloca con
`placeTile('tipo')` (ver `cards/place-tile.js`).

**Un nivel de historia:** diséñalo en el Creador de Niveles, expórtalo, guarda el objeto del nivel como
`src/content/levels/story/05.json` y añádelo a `story/index.json`. Campos opcionales: `name`,
`extraBalls` (pelotas de obstáculo) y `tips` (bocadillos: `{ "hit" | "bunker" | "portal": "clave.i18n" }`).

**Arte bitmap:** suelta los PNG en `assets/art/` con los nombres de `ART_FILES` (`src/art.js`) y ejecuta
`npm run art-manifest`. Lo que no exista usa el respaldo emoji/CSS; el juego no pide archivos que no estén
en el manifiesto.

**Textos / idioma:** español en `src/i18n/es.js` e inglés en `src/i18n/en.js` (misma estructura; una clave
que falte cae al español). Idioma inicial: el elegido en Ajustes (🎚 → Idioma); si no hay, español si la zona
horaria del navegador es de España y si no inglés. Otro idioma = copiar `en.js` y registrarlo en
`src/i18n/index.js`. Los niveles pueden traer `name_en`.

**Guardado automático:** las partidas de Modo Historia y Partida rápida se guardan en `localStorage`
(`chaoticgolf_save`) tras cada jugada y al cerrar la pestaña, incluido el estado del RNG, así que al
continuar la partida sigue exactamente igual. El menú muestra "Continuar partida"; se borra al terminar.

**Sensación de juego:** duraciones, partículas, volumen y ritmo de la IA en `src/fx/juice.js`.

**Aspecto de las cartas:** cada carta declara `face: { art, value }` en su módulo; las ilustraciones SVG
están en `src/ui/card-art.js` (añadir una ilustración = una función más en `ARTS`). La descripción del
tooltip sale de `cards.<id>.desc` en i18n, y el motivo de bloqueo de `blockedReason`.

## Dirección de arte

"Club de golf premium visto desde el aire": ilustración vectorial plana y cenital, césped segado en
franjas diagonales, búnkeres orgánicos, grano fino (feTurbulence) y sombras planas largas a 45°.
Tipografía **Outfit** (OFL, alojada en `assets/fonts/` para funcionar sin conexión). Toda la paleta está
en variables de `styles/base.css` (`--grass-dark`, `--green-putt`, `--sand`, `--cream`, `--ink`, `--accent`…).
La ilustración aérea y los iconos de línea viven como `<symbol>` en el sprite SVG de `index.html`
(`#aerial`, `#i-…`) y se reutilizan con `<svg><use href="#…"/></svg>`.

## Interfaz de partida

```
[← Menú] [↺]            ( J2 · Turno de Jugador 2 · ▮▮ )           [📜] [🔊]
 asientos de rivales  |          tablero          |  mazo · descartes · última jugada
        ( barra de acción: qué hay que hacer ahora / JAQUE con cuenta atrás )
 [ tu avatar ]            [ tus cartas ]            [Descartar] [TERMINAR TURNO]
```

- La píldora central dice siempre de quién es el turno (color del jugador) y cuántas negras le quedan.
- Los asientos marcan al jugador activo, si un bot está pensando, si alguien puede reaccionar en un JAQUE.
- Cada carta jugada (tuya o de un bot) vuela, se exhibe sobre el tablero y cae en descartes; al robar,
  las cartas salen del mazo; al pulsar una carta bloqueada se explica por qué; un marcador flota sobre la
  pelota que juega. Atajos: **E** terminar turno, **D** descartar, **Esc** cancelar.

## Tests y herramientas

```bash
npm test                          # oráculo de reglas + reglas concretas + IA (~3 s)
npm run simulate                  # telemetría: 500 partidas bot-contra-bot, victorias y uso de cartas
npm run simulate -- --random 0 --players 4 --size l --games 2000
npm run smoke                     # prueba de humo en Chrome real (capturas en smoke-out/)
npm run golden                    # regenera el oráculo desde tests/oracle/original.html
```

**El oráculo** (`tests/fixtures/golden.json.gz`) son ~44.000 acciones aleatorias grabadas en el juego
original (`tests/oracle/original.html`, la versión de un solo archivo) con el hash del estado tras cada una.
`tests/engine.golden.test.mjs` las repite sobre el motor y exige el mismo estado, log incluido, texto por
texto. Si un cambio altera una regla sin querer, el test dice la partida, el paso y el log esperado frente al
obtenido. Si se cambia una regla **a propósito**, hay que cambiarla también en el oráculo y regenerar.

**Semillas:** cada partida tiene una semilla (panel `dbg` → "Estado del mazo"). Escribirla en
"Semilla" y pulsar "Aplicar y reiniciar" reproduce exactamente el mismo reparto, útil para reproducir bugs.

## Cambios de comportamiento respecto al original

- **Bug corregido:** con dos portales y dos pelotas alineadas (`P2 · A · B · P1`) un golpe creaba un
  bucle de choques infinito y la página reventaba ("Maximum call stack size exceeded"), perdiendo la carta.
  Ahora la cadena se corta tras 12 choques y se avisa en el historial.
- **IA nueva:** simula cada jugada posible con el motor real en lugar de aproximar las reglas.
  Personalidades `aggro` / `trick`, reacciones naranjas una vez por jugada, salva JAQUEs también con el
  palo reactivo y renueva la mano en vez de atascarse. Frente a un jugador aleatorio gana ~98 % de las
  veces (`npm run simulate -- --random 0`).
- Exportar/importar niveles con diálogos propios (copiar, descargar `.json`, cargar archivo) en lugar de
  `prompt()`; los niveles guardados llevan versión de esquema (los antiguos se migran solos) y nombre.
- Teclado: el tablero es una cuadrícula navegable con flechas + Enter; cartas con Tab + Enter; Escape
  cierra paneles o cancela la acción en curso. Etiquetas ARIA en casillas y cartas.
