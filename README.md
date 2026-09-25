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
styles/                    CSS por área: base, board, hands, hud, screens, editor, fx, icons, ui,
                           themes (temas del campo) y features (componentes nuevos)
src/
  main.js                  punto de entrada: listeners, carga de niveles y arte
  engine/                  REGLAS PURAS — sin DOM, sin sonido, sin timers
    game.js                clase Game: estado S + acción pendiente + eventos
    rng.js                 RNG con semilla (partidas reproducibles)
  content/
    cards/                 una carta (o familia) por archivo + registro ordenado (index.js)
    tiles/                 losetas (búnker, portal) con sus rasgos: trap / portal
    levels/story/          niveles de Lo básico en JSON (+ index.json)
    levels/puzzles/        puzles de "gana en 1 turno" (mano fija)
    levels/generate.js     generador determinista (contrarreloj)
  ai/
    bot.js                 decisiones de los bots: simulan cada jugada con el motor y la puntúan
    autoplay.js            partidas bot-contra-bot instantáneas (simulador y tests)
  ui/                      pantallas, tablero, manos, HUD, editor, orquestador de la IA
    controller.js          une motor e interfaz: acción → eventos → efectos → render
    screens.js             navegación, salir / reiniciar, modo libre
    screen-story.js        Lo básico y puzles · screen-pve.js  Partida rápida (y rivales)
    screen-modes.js        reto diario, contrarreloj y desafíos · resume.js  continuar
    assist.js / why-lost.js  consejo del caddie, deshacer y "¿por qué he perdido?"
    board-zoom.js          pellizcar y desplazar el tablero
    players.js / hotseat.js  personas y bots de la mesa; multijugador local ("pasa el móvil")
    persona.js / bot-react.js  nombres, caras y bocadillos de los bots
    preview.js             vista previa de la jugada (se simula sobre una copia del motor)
    tutorial.js            presentación del nivel 1 y explicación de cada carta la primera vez
    settings.js / prefs.js   pantalla de Ajustes (velocidad, tema, accesibilidad…) y Estadísticas
    save.js / records.js   guardado por modo y estadísticas globales (rachas, récords)
    pause.js / rules.js    pausa real (congela la IA) y hoja de reglas
    back.js / wake.js      botón de atrás del sistema y pantalla siempre encendida en partida
    profile.js / achievements.js  tu nombre y color (y los de cada persona) y logros
  fx/                      partículas, efectos y constantes de "juice" (juice.js)
  audio/                   efectos de sonido y música generativa (WebAudio, sin archivos)
  i18n/                    textos (es.js, en.js) y t()
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

**Guardado automático:** las partidas de cada modo se guardan en `localStorage`
(una ranura por modo) tras cada jugada y al cerrar la pestaña, incluido el estado del RNG, así que al
continuar la partida sigue exactamente igual. Cada pantalla (Lo básico, Modos, Partida rápida, reto diario)
muestra su "Continuar partida" en naranja; se borra al terminar.

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
- Cada carta jugada (tuya o de un bot) crece sobre su origen y reaparece un instante en descartes; al robar,
  las cartas salen del mazo; al pulsar una carta bloqueada se explica por qué; un marcador flota sobre la
  pelota que juega. Atajos: **E** terminar turno, **D** descartar, **P** pausa, **H** reglas, **Esc** cancelar.
- **Vista previa:** al pasar por un destino (o por una carta de hoyo) se dibuja el recorrido real: choques en
  cadena, portales, búnker, caídas y hoyo. En pantallas táctiles, primer toque = vista previa, segundo = jugar.
- **Bots con personalidad:** nombre, cara que cambia de humor y bocadillos al jugar, recibir un golpe,
  caerse o embocar. Dificultad fácil / normal / difícil (`LEVELS` en `src/ai/bot.js`).
- **Multijugador local:** en Partida rápida, de 1 a 4 personas en el mismo dispositivo (con o sin bots).
  Antes de cada turno aparece "pasa el dispositivo"; las manos ajenas van boca abajo y quien quiera
  reaccionar fuera de turno pide el dispositivo con "Reaccionar".
- **Guardado:** uno por modo; tras cada jugada un aviso breve "Guardado" en la barra de la partida. Salir al menú guarda; el "Continuar partida" naranja de cada modo la retoma;
  Reiniciar pide confirmación; empezar otra partida del mismo modo avisa de que sustituye la guardada.
- **Ajustes** (el botón redondo del engranaje, en cualquier pantalla; pestañas Ajustes y Estadísticas):
  sonido y pista de música (con fundido menú ↔ partida), idioma,
  velocidad de las animaciones, acelerar solo los turnos de la máquina, tema del campo (clásico, otoño,
  nieve, noche, lago, brasas, atardecer; cada modo recuerda el suyo y tiene su color por defecto:
  contrarreloj azul, desafíos rojo, reto diario naranja y el resto verde), avisos de jugada, reducir movimiento, formas en las bolas, texto grande, alto contraste,
  modo zurdo y restablecer. Abrir Ajustes o las reglas en partida la pausa. El nombre y el color se eligen
  en Partida rápida. El Creador de Niveles está en Modos de juego.
- **Calidad de vida:** pausa (**P**), reglas y cartas (**H** / "?"), historial agrupado por turnos con filtro
  "solo mis jugadas", tocar otra vez la carta elegida la suelta, "Repetir la última" partida rápida, atrás del
  sistema cierra paneles y vuelve de pantalla, aviso al cerrar la pestaña con una jugada a medias y
  pantalla de carga.
- **Menú:** título, tarjeta del reto diario (tablero pequeño contra 2 bots, igual para todos; cada día cambian
  los rivales, su personalidad y la dificultad; récord del día en turnos propios y racha de días) y debajo
  Lo básico y Modos de juego. Crear una partida rápida nueva con otra guardada avisa y la borra.
  Con el reto del día completado sale un tic verde (y, la primera vez que vuelves al menú, la bola de la
  ilustración rueda hasta el hoyo: `src/ui/menu-ball.js`); con la app instalada, un punto en su icono avisa de que
  el reto de hoy está pendiente (API de insignias). Al terminarlo, "Compartir" copia (o abre la hoja de
  compartir en el móvil) un resumen estilo Wordle: un cuadrado por turno (🟩 te acercas, 🟨 igual, 🟥 te
  alejas), choques, portales, caídas, rivales y racha.
- **Modos de juego:** Partida rápida (primero se elige contra la máquina o multijugador local, cada uno con su
  configuración), contrarreloj (5 hoyos generados con cuenta atrás; el tablero se tiñe de rojo según se acaba
  el tiempo; puntos por turnos y segundos de sobra; si llega a cero, se acaba la serie) y 6 desafíos con reglas
  especiales (solo naranjas, sin palo 3, hoyo inquieto, mar de arena, atajos, multitud) y el **desafío
  semanal**: cada semana una regla nueva de 8 (igual para todos: tablero, mazo y rivales) con su récord.
  La primera vez que entras en un modo, una tarjeta corta te lo explica (`src/ui/mode-intro.js`). También en
  Modos de juego: los 6 puzles de "gana en 1 turno" y **Tus niveles** (los del creador, que también está aquí).
  Lo básico tiene 8 niveles.
- **Final de partida:** mini-mapa con el recorrido de tu pelota (saltos de portal, choques, caídas y embocada).
- **Estadísticas con gráficas** (`src/ui/stats-charts.js`): evolución de los últimos 14 días, victorias por
  modo, balance contra cada rival y tus cartas más usadas (victorias en azul, derrotas en naranja).
- **Rivales:** 12 personajes con 4 personalidades (agresivo, tramposo, cauteloso, caótico), elegibles en
  Partida rápida, con tu balance contra cada uno y tu **némesis** (el que más te gana). Tras cada jugada un
  bot explica por qué la ha hecho.
- **Ayudas:** consejo del caddie (misma IA que los bots; queda anotado), deshacer en Lo básico y en fácil,
  "¿Por qué he perdido?" con el momento clave (antes / después) y un consejo.
- **Música** minimalista y suave (timbres redondos, filtro y eco ligeros): se tensa en el JAQUE, fanfarria al ganar. Cada forma de ganar tiene
  su celebración (de portal, carambola, el hoyo se la traga, robo, tiro largo, zigzag, a la primera).
- **Portal:** disco azul con anillos concéntricos que nacen en el centro y crecen sin salirse de la esfera.
- **Caídas:** al salirse del tablero, el borde por el que cae la pieza destella con su color y una onda
  entra desde ese lado.
- **Móvil:** pellizcar para hacer zoom en el tablero y arrastrar para moverlo.
- **Progreso:** barra de Lo básico, racha y victoria más rápida en Partida rápida, 10 logros y resumen final
  (jugada más larga, quién te golpeó más, tu carta más usada).

## Tests y herramientas

```bash
npm test                          # oráculo de reglas + reglas concretas + IA + niveles y puzles (~3 s)
npm run test:ui                   # interfaz en Chrome real: guardado, pausa, multijugador, logros, deshacer, reto, puzles
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

**Semillas:** cada partida tiene una semilla (`chaoticGolf.app.game.seed` en la consola). `Game.pve(cfg,
{ seed })` con la misma semilla reproduce exactamente el mismo reparto, útil para reproducir bugs.

## Cambios de comportamiento respecto al original

- **Bug corregido:** con dos portales y dos pelotas alineadas (`P2 · A · B · P1`) un golpe creaba un
  bucle de choques infinito y la página reventaba ("Maximum call stack size exceeded"), perdiendo la carta.
  Ahora la cadena se corta tras 12 choques y se avisa en el tablero ("¡Bucle cortado!") y en el historial.
- **Regla nueva:** si una pelota se cae del tablero y su casilla de salida tiene ahora un portal, lo atraviesa
  y aparece una casilla más allá del otro portal en la dirección de la caída (como ya hacía el hoyo). Si esa
  casilla está fuera del tablero u ocupada, se queda sobre el otro portal. El oráculo da por buenas las
  partidas grabadas que se desvían justo por esta regla (`NEW_RULES` en `tests/engine.golden.test.mjs`).
- **IA nueva:** simula cada jugada posible con el motor real en lugar de aproximar las reglas.
  Personalidades `aggro` / `trick`, reacciones naranjas una vez por jugada, salva JAQUEs también con el
  palo reactivo y renueva la mano en vez de atascarse. Frente a un jugador aleatorio gana ~98 % de las
  veces (`npm run simulate -- --random 0`).
- Exportar/importar niveles con diálogos propios (copiar, descargar `.json`, cargar archivo) en lugar de
  `prompt()`; los niveles guardados llevan versión de esquema (los antiguos se migran solos) y nombre.
- Teclado: el tablero es una cuadrícula navegable con flechas + Enter; cartas con Tab + Enter; Escape
  cierra paneles o cancela la acción en curso. Etiquetas ARIA en casillas y cartas.
