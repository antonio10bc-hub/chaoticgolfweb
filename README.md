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
    editor.js / my-levels.js / lab.js  creador de niveles, Mis niveles (guardar, compartir, recibir) y trampas al probar
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

**Un nivel de historia:** diséñalo en el Creador de Niveles, compártelo y decodifica el código
(`decodeLevel` en `src/content/levels/share.js`, o el borrador en `localStorage.chaoticgolf_editor`), guarda el objeto del nivel como
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
  los rivales, su personalidad y la dificultad, y hay **una sola mecánica** pensada para el 5×5 —portales, catapultas,
  arenero, río pequeño, caja con agujeros, bloque, charca, esquina o palo iridiscente—, en un orden fijo que nunca la
  repite dos días seguidos; algún día el tablero crece una o dos filas o columnas: `dailyChallenge` en
  `src/content/challenges.js`; récord del día en turnos propios y racha de días) y debajo
  Lo básico y Modos de juego. Crear una partida rápida nueva con otra guardada avisa y la borra.
  La tarjeta tiene la misma forma en cualquier estado y con cualquier mecánica: cada línea ocupa una fila
  (fecha y dificultad; título y mecánica, que baja si no cabe; rivales; estado), el tic verde de completado es
  una insignia sobre la miniatura de los rivales y en el móvil el botón es un círculo (flecha, o repetir si ya
  está completado).
  **La racha** va en grande sobre la miniatura (llama y número): apagada y latiendo en rojo si hoy aún no has
  jugado, encendida (con una llamarada la primera vez que vuelves al menú) cuando ya cuenta. La línea de estado
  avisa: "¡No pierdas tu racha!", "Perdiste tu racha de 12", "Empieza hoy tu racha" o, con el reto de hoy
  jugado, la próxima meta ("Faltan 3 días para 15", "¡Mañana llegas a 7!"). Metas: 3, 7, 15, 30, 50, 100, 150,
  200, 365 y cada 100 después (`nextStreakGoal` / `dailyStreakInfo` en `src/ui/records.js`); al llegar a una,
  el final de partida lo celebra una vez ese día con un chip grande y confeti de fuego; si no, muestra
  "Racha: N días · meta: M". La racha cuenta por jugar el reto, no por ganarlo. Con el reto del día completado sale ese tic verde (y, la primera vez que vuelves al menú, la bola de la
  ilustración rueda hasta el hoyo: `src/ui/menu-ball.js`); con la app instalada, un punto en su icono avisa de que
  el reto de hoy está pendiente (API de insignias). Al terminarlo, "Compartir" copia (o abre la hoja de
  compartir en el móvil) un resumen estilo Wordle: un cuadrado por turno (🟩 te acercas, 🟨 igual, 🟥 te
  alejas), choques, portales, caídas, rivales y racha.
- **Modos de juego:** dos pestañas que se deslizan (también con el dedo en el móvil) y se recuerdan:
  **Partidas rápidas** — una tarjeta por baraja (`src/content/decks.js`): Baraja clásica, **Baraja de agua** y
  Baraja de minigolf (aún bloqueada, "Próximamente"). Cada una con su color, su última partida, "Repetir" y sus
  estadísticas (jugadas, victorias y %: `records.decks`). El contrarreloj, cada desafío (`records.chStats`)
  y el semanal de esa semana muestran las mismas mini estadísticas en una línea. Dentro, primero se elige contra la máquina o
  multijugador local. **Juegos especiales** —  contrarreloj (5 hoyos generados con cuenta atrás; el tablero se tiñe de rojo según se acaba
  el tiempo; puntos por turnos y segundos de sobra; si llega a cero, se acaba la serie; cada hoyo presenta una
  mecánica —búnker; río y pelota de obstáculo; portales y madera; lago, esquinas y lanzadera; todo en campo grande—,
  con las piezas en la zona entre la pelota y el hoyo: `src/content/levels/generate.js`) y 18 **desafíos** en tres grupos de 6
  por dificultad (calentamiento, intermedio, experto). Viven en `src/content/challenges.js` (sin interfaz): cada uno
  tiene su tamaño de campo, mazo, rivales, reglas y un **campo diseñado a mano** en coordenadas relativas al recorrido
  (hoyo, columna de PAR y salidas), que cada partida varía con su semilla (se refleja de lado, cambian giros o una pieza
  elige entre varios sitios). Calentamiento: paso corto, hoyo inquieto, mar de arena (eslalon de búnkeres), trampolines, rápidos,
  archipiélago. Intermedio: atajos (3 parejas de portales), pinball, madrigueras, pista de despegue (cadenas de
  lanzaderas que se abren y cierran al girar), campo largo (palos de 4, 5 y 10), solo naranjas. Experto: aserradero,
  esclusas (ríos que desembocan en lanzaderas), espejos (laberinto de esquinas), prisma (iridiscentes con búnkeres de
  tope), multitud y caos total. El **desafío semanal** remezcla esos campos con una regla nueva cada semana (12, igual
  para todos: tablero, mazo y rivales) con su récord. Todos se han equilibrado con cientos de partidas entre bots
  (duración, uso de cada mecánica, ventaja por posición) y `tests/challenges.test.mjs` comprueba sus campos y que se
  juegan hasta el final.
  La primera vez que entras en un modo, una tarjeta corta te lo explica (`src/ui/mode-intro.js`). También en
  Modos de juego: los 24 puzles de "gana en 1 turno" en tres grupos por dificultad (campo `group` de su JSON): cada
  carta de la mano hace falta (salvo alguna pista falsa a propósito en los difíciles), cada pieza cambia la jugada o es
  una trampa para quien juega mal, y la solución no depende del azar (el test la repite con varias semillas); y **Tus niveles** (los del creador, que también está aquí:
  cada uno se edita o se elimina —con "Deshacer", sin diálogo— y se puede añadir el código de un nivel recibido).
- **Creador de niveles** (`src/ui/editor.js`): un taller sobre una alfombrilla de corte, con la misma barra que la
  partida (volver, Mis niveles, nombre y estado del nivel, deshacer/rehacer, guardar, compartir). A la izquierda las
  herramientas por baraja con el dibujo real de cada pieza (pelota, hoyo, PAR, obstáculo, borrar; búnker, portal con
  parejas A/B/C; río, lago; bloque, esquina, túnel y lanzadera, con su giro) y sus opciones; en el centro el tablero
  con reglas numeradas y +/− de columnas y filas en sus bordes; a la derecha el mazo (plantillas por baraja y cada
  carta con su número) o la mano inicial (puzles). Un nivel nuevo es de 12×9 con PAR 5 en el centro. Se pinta arrastrando, clic derecho borra, R gira, Ctrl+Z/Ctrl+Y,
  Ctrl+S. El estado dice si está listo para jugar o qué falta (mazo, portal sin pareja…). El borrador se guarda solo.
  **Probar nivel** (naranja, junto al nombre en la barra) lo juega sobre la misma alfombrilla del taller con el panel de **trampas** (`src/ui/lab.js`): cualquier carta a mano, deshacer ilimitado
  y mover piezas (botón "Mover piezas", o con la rueda del ratón: clic central en una pieza y otro en una casilla
  marcada, en cualquier momento). En el móvil, las herramientas van en una tira y las cartas en una hoja.
- **Sin cuadrados desplazados:** ninguna pieza de la interfaz usa sombras duras desplazadas ni bordes gruesos en un
  solo lado; la profundidad va en sombras suaves y el tipo de carta (negra / naranja) en el borde completo.
- **Compartir niveles** (`src/content/levels/share.js`, `src/ui/my-levels.js`): el nivel entero en un código corto
  (`CG1…`, JSON compacto comprimido y validado al leerlo) o un enlace `…#nivel=CÓDIGO`. Quien abre el enlace ve
  "Te han pasado un nivel" (guardar / guardar y jugar); con el código, "Añadir código". Se guarda como recibido y
  no se duplica.
  Lo básico tiene 8 niveles.
- **Final de partida:** mini-mapa con el recorrido de tu pelota (saltos de portal, choques, caídas y embocada).
- **Baraja de agua** (`tiles/river.js`, `tiles/lake.js`): sin búnkeres ni portales; 5 cartas de río y 5 de lago
  (0 copias en el resto de barajas, así su reparto no cambia). **Río**: una sola columna; la primera carta va
  donde sea y las demás lo alargan por arriba o por abajo. Quien entra (pelota u hoyo) pierde el resto del
  movimiento y la corriente lo baja hasta la casilla justo debajo del río; si hay otra pelota, la empuja 1 y
  ocupa su sitio; si el río acaba en el borde, se cae del tablero. **Lago**: crece pegando casillas por un lado;
  caer dentro es como caerse del tablero (el hoyo vuelve a su casilla inicial). Si en la salida hay agua, el río
  arrastra o se va a la casilla libre más cercana. Si la salida la tapa una pieza de madera o un portal (Ultimate),
  la corriente la lleva a través como un paso normal (túnel, esquina, portal; búnker y lanzadera se aplican igual);
  contra un bloque (o la espalda de una esquina) rebota un par de veces y acaba en una casilla libre cercana al azar
  (`riverThrough`, `holeRiverThrough`). La partida tiene fondo de lago (el campo es una isla), la bola
  flota río abajo y hay chapuzón al caer al lago. Reglas en el motor (`canPlaceTile`, `ballInWater`, `holeInWater`).
- **Baraja de minigolf** (piezas de madera, `tiles/block|corner|tunnel|launcher.js`; campo 8 columnas más ancho):
  **Bloque** (rebota y vuelve por donde venía), **Esquina** (se gira al colocarla: por su cara inclinada desvía
  90°, por la espalda rebota), **Túnel** (sale por uno de sus 4 lados al azar, con animación de tensión),
  **Lanzadera** (quien pasa por encima vuela 3 casillas hacia su flecha; gira cada turno; la que ya ha lanzado en el
  turno se apaga hasta el siguiente —`S.launched`—: se pasa por encima como por el césped y quien acaba en ella se
  recoloca en la casilla libre de al lado, así que no hay ping-pong) y palos de 4 y 5. Sin búnkeres ni portales.
  Las piezas no cuentan como casilla y nadie se queda encima; el hoyo las usa igual que una pelota
  (`nextCell`, `launchBall` / `launchHole` en el motor). Par 5. Las piezas que giran se colocan en dos pasos:
  tocas la casilla (queda marcada con la pieza fantasma), la giras ("Girar", tecla R o tocándola otra vez) y
  confirmas con "Colocar" (o Intro). La lanzadera hace un salto con anticipación, sombra en el suelo, giro y
  aterrizaje con polvo.
- **Ultimate Chaotic Golf**: las cartas de todas las barajas (`counts` las suma solas: una baraja nueva entra
  sin tocar nada), un campo enorme (+12 columnas y +4 filas), par 7, palos de 10 y el **palo iridiscente** (no se para
  nunca: rebota en los bloques, gira en las esquinas y sigue hasta chocar con otra pelota, que hereda el impulso y
  hace lo mismo, o hasta caerse del tablero; tras saltar una lanzadera sigue avanzando hacia donde volaba; si entra
  en un bucle sin fin, se corta; deja una estela iridiscente). Fondo iridiscente animado (manchas de color y un barrido de luz).
- **Cartas nuevas de cada baraja** (`src/ui/deck-intro.js`): la primera vez que juegas una baraja con cartas
  especiales (`newCards` en `decks.js`), un diálogo las presenta con un tablero de ejemplo animado; la escena
  de cada carta (`demo`) se juega con el motor real, así que siempre coincide con las reglas. También con el
  botón "Cartas nuevas" de la tarjeta de la baraja. Sirve para cualquier baraja futura.
- **Lo básico:** el botón del menú muestra tu progreso ("3/8") o un tic gris con todo completado. Cada situación
  del tablero tiene su aviso la primera vez que pasa (choque, carambola, búnker, salir del búnker, portal,
  salirse del tablero, mover el hoyo, el hoyo que se sale o se traga una pelota, pelotas de obstáculo…).
- **Compartir la jugada final** (todos los modos, `src/ui/share-play.js`): imagen 1080×1350 con el tablero tal
  como acabó y el recorrido de la última jugada (salida, saltos de portal, choques, caídas y el hoyo), la carta,
  quién la jugó y el resultado. En el móvil, hoja de compartir del sistema; en el ordenador, copiar o descargar.
  En el reto diario, además, "Copiar resultado" (el texto estilo Wordle).
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
- **Estela:** cada pieza va dejando puntos de su color detrás según avanza; al acabar la jugada se quitan
  rápido, uno a uno, del primero al último (`fxTrailPush` / `fxTrailShow`, tiempos en `JUICE.trail`).
- **Caídas:** al salirse del tablero, el borde por el que cae la pieza destella con su color y una onda
  entra desde ese lado.
- **Móvil:** pellizcar para hacer zoom en el tablero y arrastrar para moverlo.
- **Tableros grandes** (minigolf, Ultimate): si las casillas quedarían pequeñas se hacen más cuadradas para
  crecer (`fitCellsTo` en `geometry.js`), y en el ordenador la rueda del ratón hace zoom y se arrastra para moverlo.
  Piezas y efectos usan la misma métrica que la rejilla (`GAP`/`PAD`), así que quedan centradas en cualquier tamaño.
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

**Diseño de niveles** (equilibrar con datos antes de tocar un campo o un puzle):

```bash
npm run sim:challenges -- pinball,prism 60      # desafíos: campo en ASCII + rondas, ventaja por salida, uso de mecánicas
npm run sim:challenges -- ch 60 0               # todos los desafíos (weekly: las semanales · base: partidas normales)
npm run sim:challenges -- vars 80 1 mis-variantes.mjs   # probar variantes de un campo (export default [{ id, board, layout, … }])
npm run sim:rush -- 200                          # contrarreloj: turnos por hoyo generado, hoyos sin terminar
npm run puzzles:audit                            # puzles: soluciones, % de jugadas que ganan, cartas o piezas que sobran
npm run puzzles:search -- lakeCorner 20000 5     # buscar puzles nuevos de un tema (candidatos en puzzle-candidates/)
npm run puzzles:show -- lakeCorner 0             # ver un candidato: tablero y solución paso a paso
```

Objetivos usados: una partida normal de 7×9 dura ~6 rondas; desafíos de calentamiento ~4-6, intermedios ~6-8 y
expertos ~7-10, sin colas largas ni una salida que gane de más. Puzles: cada carta hace falta (salvo alguna pista
falsa a propósito en los difíciles), cada pieza cambia la solución o es una trampa, la solución no depende del azar;
dificultad por el % de jugadas que ganan (calentamiento ~14 %, intermedio 2-6 %, experto <4 %).

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
- Los niveles guardados llevan versión de esquema (los antiguos se migran solos) y nombre; se comparten con un
  código (ver "Compartir niveles").
- Teclado: el tablero es una cuadrícula navegable con flechas + Enter; cartas con Tab + Enter; Escape
  cierra paneles o cancela la acción en curso. Etiquetas ARIA en casillas y cartas.
