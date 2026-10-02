# Chaotic Golf

Mesa digital del juego de cartas: palos, dedo, búnkeres, portales, cartas de mover el hoyo y el **JAQUE**
(una jugada ganadora abre una ventana de reacción con cartas naranjas).

Sitio 100 % estático, sin paso de build: HTML + CSS + módulos ES nativos. Se puede instalar como app
(PWA) y funciona sin conexión.

Visitas y rendimiento con **Vercel Web Analytics** y **Speed Insights**: `main.js` carga
`/_vercel/insights/script.js` y `/_vercel/speed-insights/script.js` (los sirve Vercel en cada despliegue; no hacen
falta los paquetes npm, que son para React/Next). En local no se cargan, y el service worker no toca `/_vercel/`.
Hay que activar los dos en el proyecto de Vercel.

**Qué se juega: Umami** (cloud.umami.is, sin cookies ni datos personales; `src/ui/analytics.js`). `main.js` carga su
script solo en la web publicada (en local y en los tests no se envía nada), sin la búsqueda ni el `#nivel=…` de la
dirección. Cada pantalla cuenta como una **página** (`/`, `/modos`, `/lo-basico`, `/partida-rapida`, `/creador` y
`/partida/<modo>`: recorridos y tiempo en cada una) y hay estos **eventos**:
- **partida** (una nueva): `modo` (partida rápida, multijugador local, reto diario, contrarreloj, desafío, desafío
  semanal, lo básico, puzle, tus niveles), lo que la define (`baraja`, `dificultad`, `tablero`, `bots`, `personas`,
  `nivel`, `desafio`, `regla`, `hoyo`) y `app` (instalada / navegador).
- **final**: lo mismo más `resultado` (victoria / derrota: el % de victorias por modo), `turnos`, `segundos` y
  `motivo` (contrarreloj sin tiempo). **abandona**: salir o reiniciar a medias (`como`, `turnos`, `segundos`).
  **continua**: se retoma una partida guardada.
- **tutorial** (`completo` o saltado), **ayuda** (`tipo`: consejo / deshacer), **compartir** (`que`: resultado, jugada,
  nivel), **creador** (`accion`: abrir / probar), **baraja_nueva** (`baraja`, `jugar`: el anuncio de una baraja nueva) e **instalar**.
Todos llevan `interfaz` (táctil / ordenador) e `idioma`. Partidas y finales salen de `recordStart` / `recordEnd`
(`src/ui/records.js`), el mismo sitio que las estadísticas del jugador; si Umami no ha cargado aún, esperan en una cola.
Un evento nuevo: `track('nombre', { dato: valor })` (valores cortos y con pocas variantes, nunca datos personales).

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
                           themes (temas del campo), features (componentes nuevos), train y seasons (sus barajas),
                           skins (pelotas y "Tu pelota") y phone (interfaz táctil)
src/
  main.js                  punto de entrada: listeners, carga de niveles y arte
  boot-watch.js            script clásico: "Reintentar" si el juego no arranca en 10 s
  engine/                  REGLAS PURAS — sin DOM, sin sonido, sin timers
    game.js                clase Game: estado S + acción pendiente + eventos
    seasons.js             (baraja de las estaciones) viento, fuego, hojas y lluvia, bola de nieve y cambio de estación
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
    board-zoom.js          pellizcar y desplazar el tablero; en táctil, la cámara se acerca sola a los destinos
    device.js              ¿móvil o tableta? decide la interfaz táctil (html.phone) por el dispositivo
    bake.js                texturas precocinadas: grano y fondo desenfocado de los menús como imagen
    train-view.js          (baraja del tren) vías, andenes, locomotora y vagones; su animación
    seasons-view.js        (baraja de las estaciones) la estación en pantalla, su indicador, el viento, la bola de nieve
                           y sus animaciones · season-art.js  iconos de las estaciones y la bola de nieve
    new-deck.js            "¡Nueva baraja!": el anuncio, una vez, de la baraja que se estrena
    skins.js / my-ball.js  pelotas que se ganan (3 niveles cada una) y la ventana "Tu pelota"
    editor.js / my-levels.js / lab.js  creador de niveles, Mis niveles (guardar, compartir, recibir) y trampas al probar
    link-tabs.js           enlace de un nivel con el juego ya abierto: lo recoge esa pestaña (o la app instalada)
    players.js / hotseat.js  personas y bots de la mesa; multijugador local ("pasa el móvil")
    persona.js / bot-react.js  nombres, caras y bocadillos de los bots
    preview.js             vista previa de la jugada (se simula sobre una copia del motor)
    tutorial.js            presentación del nivel 1, explicación de cada carta la primera vez y el aviso naranja de
                           la primera carta naranja en tu mano (se juegan en cualquier momento, también fuera de turno)
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
sw.js, manifest.webmanifest   PWA (sin conexión; launch_handler: los enlaces van a la ventana ya abierta)
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
Tras añadir un módulo nuevo (carta, loseta…) o un nivel, `npm run preload` lo suma a la precarga de index.html
(si se olvida, `npm test` lo recuerda).

**Arte bitmap:** suelta los PNG en `assets/art/` con los nombres de `ART_FILES` (`src/art.js`) y ejecuta
`npm run art-manifest`. Lo que no exista usa el respaldo emoji/CSS; el juego no pide archivos que no estén
en el manifiesto.

**Textos / idioma:** español en `src/i18n/es.js` e inglés en `src/i18n/en.js` (misma estructura; una clave
que falte cae al español). Idioma inicial: el elegido con las banderas del menú principal (dos botones redondos pequeños abajo a la
derecha: España y EE. UU.; en el móvil en horizontal, arriba junto al sonido); si no hay, español si la zona
horaria del navegador es de España y si no inglés. Otro idioma = copiar `en.js` y registrarlo en
`src/i18n/index.js`. Los niveles pueden traer `name_en`.

**Guardado automático:** las partidas de cada modo se guardan en `localStorage`
(una ranura por modo) tras cada jugada y al cerrar la pestaña, incluido el estado del RNG, así que al
continuar la partida sigue exactamente igual. Cada pantalla (Lo básico, Modos, Partida rápida, reto diario)
muestra su "Continuar partida" en naranja; se borra al terminar.

**Sensación de juego:** duraciones, partículas, volumen y ritmo de la IA en `src/fx/juice.js`.
De vez en cuando cruza el tablero una ráfaga de viento (`shape: 'wind'` en `src/fx/particles.js`): una estela que
se traza, avanza ondulando y acaba en un remolino pequeño; a veces va acompañada de otra más fina.

**Juegos especiales** (`src/ui/mode-art.js`): el mismo estilo de carta ilustrada para el contrarreloj (cronómetro; su tarjeta es como la de las barajas, con récord, series completas y jugadas), los desafíos (trofeo), el semanal (calendario), los puzles (piezas que encajan) y tus niveles (el taller). Cada sección con su cabecera (icono, título, barra de progreso) y cada grupo de dificultad con sus marcas (1, 2 o 3) y su barra; los iconos de los desafíos, con un tono por dificultad. Se animan al pasar por encima.

**Iconos de las barajas** (`DECK_ART` en `screen-modes.js`): cada uno, una carta con su escena (el green; la gota sobre las olas; el molino de madera; el prisma que abre la luz en arcoíris), que se anima al pasar por la tarjeta y queda quieta en reposo.

**Textos:** sin rayas (—): el historial del motor las lleva (el oráculo compara su texto) y se cambian por dos puntos al mostrarlo (`logText` en `hud.js`).

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

- **Tu pelota en la bandeja:** en lugar del círculo con "J1", tu pelota con la que llevas puesta, flotando (en el móvil, más pequeña a la izquierda de la mano; en horizontal, encima). Se repinta solo si cambia, así la animación no vuelve a empezar en cada jugada.
- **JAQUE sin atajo:** no hay botón de "Nadie reacciona": la partida se resuelve sola, con la cuenta atrás si alguien puede reaccionar con una naranja (así nadie fuerza la victoria).
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
  El reto diario y el desafío semanal caducan: la partida guardada de ayer (o de la semana pasada) se borra y sale el reto nuevo.
- **Ajustes** (el botón redondo del engranaje, en cualquier pantalla; pestañas Ajustes y Estadísticas):
  sonido y pista de música (con fundido menú ↔ partida),
  velocidad de las animaciones, acelerar solo los turnos de la máquina, tema del campo (clásico, otoño,
  nieve, noche, lago, brasas, atardecer; cada modo recuerda el suyo y tiene su color por defecto:
  contrarreloj azul, desafíos rojo, reto diario naranja y el resto verde), avisos de jugada, reducir movimiento, formas en las bolas, texto grande, alto contraste,
  modo zurdo y restablecer. Abrir Ajustes o las reglas en partida la pausa. El nombre y el color se eligen
  en Partida rápida. El Creador de Niveles se abre con «Crear nivel» (Juegos especiales → Tus niveles).
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
  **La misma partida para todo el mundo:** la semilla sale de la fecha (el día de cada uno, a su medianoche), el reparto no depende del color que elijas (el motor recibe siempre el mismo y el tuyo se aplica después, solo de aspecto) y, en el reto diario y el semanal, los bots deciden con un azar que sale de la semilla y del momento de la partida (`decide` en `ai-driver.js`): con las mismas jugadas, los bots juegan igual y los turnos que compartís son comparables. La partida del reto lleva el fondo de su mecánica (`scene` en `DAILY_FEATURES`: río y charca, el lago; catapultas, caja con agujeros, bloque y esquina, la madera del minigolf; palo iridiscente, el de Ultimate; portales y arenero, el campo de siempre) y, al acabar, el final enseña tu pelota con la que llevas puesta sobre un green, en lugar del icono. La tarjeta tiene la misma forma en cualquier estado y con cualquier mecánica: cada línea ocupa una fila
  (fecha y dificultad; título con la racha; la mecánica; rivales; estado), el tic verde de completado es
  una insignia sobre la miniatura de los rivales y en el móvil el botón es un círculo (flecha, o repetir si ya
  está completado).
  **La racha** va junto al título (llama y número, lejos de las caras de los rivales): apagada y latiendo en rojo si hoy aún no has
  jugado, encendida (con una llamarada la primera vez que vuelves al menú) cuando ya cuenta. La línea de estado
  solo aparece cuando hay algo que decir: "Partida guardada", "¡No pierdas tu racha!", "Perdiste tu racha de 12"
  o "Empieza hoy tu racha"; con el reto de hoy jugado desaparece y la tarjeta queda más baja. Metas: 3, 7, 15, 30, 50, 100, 150,
  200, 365 y cada 100 después (`nextStreakGoal` / `dailyStreakInfo` en `src/ui/records.js`); al llegar a una,
  el final de partida lo celebra una vez ese día con un chip grande y confeti de fuego; si no, muestra
  "Racha: N días · meta: M". La racha cuenta por jugar el reto, no por ganarlo. Con el reto del día completado sale ese tic verde (y, la primera vez que vuelves al menú, la bola de la
  ilustración rueda hasta el hoyo: `src/ui/menu-ball.js`); con la app instalada, un punto en su icono avisa de que
  el reto de hoy está pendiente (API de insignias). Al terminarlo, "Compartir" copia (o abre la hoja de
  compartir en el móvil) un resumen estilo Wordle: un cuadrado por turno (🟩 te acercas, 🟨 igual, 🟥 te
  alejas), choques, portales, caídas, rivales y racha.
- **Modos de juego:** dos pestañas que se deslizan (también con el dedo en el móvil) y se recuerdan:
  **Partidas rápidas** — una tarjeta por baraja (`src/content/decks.js`): clásica, agua, minigolf, tren, **estaciones** y
  **Ultimate**. Una baraja nueva va siempre detrás de la última y Ultimate siempre al final, como tarjeta estrella: noche
  iridiscente, el prisma con destellos, el nombre en arcoíris, las barajas que reúne ("Incluye") y un brillo que la cruza
  al pasar por encima. Una baraja por fila; con altura normal de pantalla, las filas se compactan para que quepan sin
  desplazarse (las seis caben en 860 px de alto). Cada una con su color, su última partida, "Repetir" y sus
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
  marcada, en cualquier momento). En el móvil, las herramientas van en una tira y las cartas en una hoja; en horizontal,
  la barra en una fila, el tablero a todo el alto y las herramientas en una rejilla a la derecha. Sonido y ajustes, siempre
  arriba a la derecha (no encima de "← Modos").
- **Pelota en la arena** (búnker o vagón): medio enterrada en un montoncito que la rodea, con su borde de luz, su
  sombra y unos granos sueltos alrededor.
- **Sin cuadrados desplazados:** ninguna pieza de la interfaz usa sombras duras desplazadas ni bordes gruesos en un
  solo lado; la profundidad va en sombras suaves y el tipo de carta (negra / naranja) en el borde completo.
- **Compartir niveles** (`src/content/levels/share.js`, `src/ui/my-levels.js`): el nivel entero en un código corto
  (`CG1…`, JSON compacto comprimido y validado al leerlo) o un enlace `…#nivel=CÓDIGO`. Quien abre el enlace ve
  "Te han pasado un nivel" (guardar / guardar y jugar); con el código, "Añadir código". Se guarda como recibido y
  no se duplica: si ya lo tenías, el enlace avisa "¡Ya tienes este nivel guardado!" (cerrar / guardar de todas
  formas; si lo guardaste con otro nombre, lo dice). Con el juego ya abierto en otra pestaña, la pestaña del enlace
  le pasa el nivel (`src/ui/link-tabs.js`, BroadcastChannel) y se cierra, siempre que esa pestaña sea la que el
  navegador vuelve a mostrar (la que estaba delante o una visible en otra ventana); si no, se abre donde se pulsa.
  Con la app instalada, `launch_handler` + `launchQueue` lo llevan a la ventana abierta. Abrir el enlace con el
  navegador cerrado funciona igual que abrir el juego: el service worker guarda el juego entero desde la primera
  visita (la página le manda la lista de lo que ha cargado) y, si la red falla o no contesta en 3 s, sirve la
  copia; antes, un arranque con la red lenta se quedaba en la pantalla de carga. La ventana de compartir pone el enlace por delante (un botón grande "Copiar enlace": al abrirlo,
  el nivel está listo para jugar; si el portapapeles falla, aparece el enlace para copiarlo a mano) y, debajo y en
  pequeño, el código con su botón de copiar. Sin botón de compartir del sistema; la confirmación sale en el botón.
  Lo básico tiene 8 niveles.
- **Final de partida:** mini-mapa con el recorrido de tu pelota (saltos de portal, choques, caídas y embocada). Cabe
  siempre sin desplazarse (ordenador, móvil pequeño y en horizontal): cabecera (cómo se ha ganado, mensaje, fichas),
  las cinco cifras en una fila y, debajo, el recorrido y el resumen lado a lado (en el móvil estrecho, uno bajo otro;
  con poca altura, dos columnas con el mensaje y los botones a la izquierda). "¿Por qué he perdido?" se abre en el
  sitio del resumen ("Ver el resumen" vuelve), no debajo. `npm run test:ui` lo comprueba.
- **Tu pelota** (botón de la camiseta a la derecha de Ajustes, en el menú y en Modos de juego; `src/ui/skins.js`, `src/ui/my-ball.js`,
  `styles/skins.css`): una ventana con tu pelota en grande sobre un green (con la que llevas puesta y tu color) y, debajo,
  las 10 pelotas que se ganan, cada una con **3 niveles** de la misma idea, cada vez más espectacular:
  **Fuego** (racha del reto diario: 7 · 30 · 365 días; más llamas, más altas, brasas), **Clásica**, **Agua**, **Madera** y
  **Prisma** (victorias con cada baraja: 10 · 50 · 100; aro de oro · laurel · destellos, agua dentro · ondas · gotas,
  vetas · marco · molino que gira, brillo iridiscente · halo · destellos), **Rayo** (series de contrarreloj completas:
  1 · 5 · 15; cronómetro con estela · esfera de reloj · rayos), **Corona** (desafíos) y **Puzle** (puzles): un nivel por grupo
  completo (calentamiento · intermedio · experto). Cada tarjeta enseña sus niveles y lo que falta para el siguiente; tocar
  un nivel lo enseña en grande (también los que aún no tienes) y los ganados se ponen con un toque. Decoran la pelota sin
  cambiar su color (el color es quien juega). En el ordenador la ventana es ancha y todo cabe sin desplazarse: tu pelota en una columna a la izquierda y las 10 tarjetas a la derecha (4 × 2 desde 1200 px, 2 × 4 por debajo) y se ven en el tablero en cualquier modo de una sola persona. En Partida
  rápida, bajo el color, se elige también la pelota. Lo ganado se calcula siempre de las estadísticas; al conseguir un
  nivel, el final de partida lo anuncia una vez ("Pelota nueva: Fuego II", abre la ventana) y un punto rojo guía hasta
  ella: en el botón de la camiseta, dentro en el nivel recién ganado de su tarjeta y, al tocarlo, en "Ponérmela" (se da
  por vista al tocar su nivel o su tarjeta; el punto del botón sigue mientras quede alguna por ver). Hasta abrir "Tu pelota" por primera vez, el botón pide atención (el punto rojo late y la
  camiseta se balancea cada pocos segundos); `MYBALL_CTA` en `my-ball.js` lo vuelve a enseñar a todo el mundo si se sube. Una pelota nueva = una entrada en `SKINS`, su objetivo en `skinProgress` y su aspecto en
  `parts()` y `skins.css` (todo medido con `--bs`, el diámetro de la bola; solo se anima transform y opacity).
- **Quién juega y cuál es tu color** (ordenador y móvil): tu bandeja de abajo va teñida suavemente de tu color de bola y,
  en tu turno, con el borde de tu color; la píldora del turno y el marcador sobre la pelota que juega llevan el color de
  quien juega; los rivales que no juegan y tu mano fuera de tu turno pierden opacidad, salvo las cartas naranjas (se
  pueden jugar fuera de turno).
- **Cartas nuevas desde el principio:** en Partida rápida con una baraja nueva (agua, minigolf, Ultimate), cada jugador empieza con una de sus cartas especiales (`newCards`) en la mano: quien no tenga ninguna cambia una carta, al azar, por una de ellas del mazo (`dealOneOf` en el motor, con el azar de la partida; las copias del mazo no cambian).
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
  flota río abajo y hay chapuzón al caer al lago. El máximo de 5 ríos y 5 lagos y la regla de colocación cuentan solo los que ponen los jugadores: el agua que trae el nivel, el puzle o el desafío es parte del campo (`fixed`, lo marca `Game.designed` al montar la partida) y no gasta ese máximo. Reglas en el motor (`canPlaceTile`, `ballInWater`, `holeInWater`).
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
- **Baraja del tren** (`src/engine/train.js`, cartas en `cards/tren.js`, vista en `src/ui/train-view.js`; +4 columnas y
  +2 filas; sin búnkeres ni portales; con un palo 2 más): su **maqueta** pone las salidas abajo y el hoyo arriba, cada uno
  en una columna al azar y sin columna de PAR, y entre medias un **circuito de vías** a lo ancho (una banda de 5-6 filas):
  para llegar hay que cruzarla (pelotas · vía · césped · vía · hoyo). El circuito, distinto en cada partida, es un
  contorno con tramos rectos largos y escalones suaves (nada de serpentear), en el sentido del reloj, con **4 paradas**
  más o menos a las 12, 3, 6 y 9; nunca pasa por las salidas ni por el hoyo y la locomotora empieza en una parada.
  (En Ultimate, el mismo tipo de circuito alrededor de su recorrido de siempre.) Unas 11 rondas por partida entre bots
  y el tren gana alrededor del 8 %. Al acabar **cada turno** la locomotora va sola a la siguiente parada (se ve con un aro dorado en la vía).
  - **Empuja** lo que encuentra: la pelota de delante (y las que tenga pegadas en fila) una casilla; en una recta las
    sigue empujando y en la curva salen despedidas; el hoyo, igual que una pelota (en un JAQUE, se anula). Contra la
    madera, o si no se puede apartar a nadie, espera. Si al empujar mete una pelota en el hoyo, el tren se para ahí.
  - Para las reglas, la locomotora y los vagones son piezas "virtuales" en su casilla (`tileAt`): la locomotora es
    maciza como un bloque (se rebota contra ella) y el **vagón de arena** atrapa como un búnker; lo que queda en su
    arena (una pelota o el hoyo) viaja con el tren. Nada se puede colocar sobre las vías.
  - **Gana el tren:** si al acabar un turno, sin que nadie juegue, mete una pelota en el hoyo, pierde todo el mundo
    (sin JAQUE): primero se ve cómo la mete (y suena el silbato) y luego sale el final, con la locomotora echando humo
    arriba, donde iría la pelota ganadora. Con una carta, la pelota cuenta para su dueño. Los bots lo ven venir (`trainThreat`) y, en tu turno, un
    aviso rojo te dice si terminar así le daría la partida al tren.
  - Cartas: **Vuelta** ×3 (negra, una vuelta entera), **Tren 1** ×3 (naranja, 1 parada en cualquier momento) y
    **Vagón** ×3 (negra, engancha un vagón detrás; 3 como mucho; se queda en la mesa). (La de 2 paradas ya no existe:
    las partidas guardadas que la tuvieran la pierden al continuar.) En táctil se
    juegan tocando la parada donde acabará el tren (o la casilla del vagón nuevo), con su recorrido dibujado.
  - Locomotora de vapor (caldera negra, cabina roja, remates dorados) y vagones planos con su montón de arena, vistos
    desde arriba y girados según la vía (el vagón, una tolva de tablones llena de arena con sus dunas y marcas de
    rastrillo); vías continuas de traviesas y raíles; las paradas, una losa de cemento en el suelo alrededor de la vía
    con sus líneas amarillas (no son una pieza: no bloquean nada); humo, silbato al
    arrancar y "chu" a cada paso. Escena de campiña con un marco de andén. El circuito usa un azar aparte (el mazo sale
    igual) y va también en Ultimate, en el creador y en el código para compartir niveles.
  - **En el creador** (grupo Tren): **Vías** se ponen casilla a casilla (tocando o arrastrando; otra vez, se quitan),
    **Parada** marca las 4 paradas sobre la vía y **Locomotora** dónde empieza (con 0-3 vagones). Lo que aún no enlaza
    sale en rojo y no se puede probar ni guardar hasta que las vías forman una sola vuelta cerrada con 4 paradas
    (también hay "Circuito al azar", estirado hasta casi los bordes: entre 30 circuitos válidos, el que más vía pone;
    la plantilla Tren pone uno si no lo hay). El circuito ordenado, en el sentido del
    reloj, se saca al probar o guardar (`orderLoop` / `trainOf` en `editor.js`).
  - Pelota de logros **Vapor** (10 · 50 · 100 victorias): cinturón de hierro con remaches · bocanadas de vapor · una vía
    alrededor con su tren.
  - **Desafíos del tren** (uno por dificultad; `track` en `challenges.js`, un circuito diseñado con `outline` y su
    variación, `setupChallenge` lo monta): **Paso a nivel** (calentamiento: una vía a lo ancho entre la salida y el
    hoyo), **Estación central** (intermedio: el hoyo dentro de un circuito pequeño, con un vagón) y **Expreso** (experto:
    vía larga con escalón y charcas a la salida de sus curvas; dos vagones).
  - **Reto diario del tren** (en la rueda desde el 2 de octubre de 2026, sin cambiar los días anteriores): versión mínima
    en 5×6, con la vía alrededor de las salidas (entre ellas y el hoyo), solo 2 paradas y como mucho 1 vagón (`maxCars`).
  - **Puzles del tren** (p25-p27, al final del índice para no mover el progreso guardado; en pantalla se ordenan y
    numeran por dificultad): **Último tren** (llévala a la vía y que el tren la empuje al hoyo), **Vagón exprés** (súbete
    al vagón, viaja y sal de la arena) y **Hoyo en marcha** (pon el hoyo en la vía y que el tren se lo lleve hasta la
    pelota; con una pista falsa).
- **Baraja de las estaciones** (reglas en `src/engine/seasons.js`, cartas en `cards/estaciones.js`, piezas en
  `tiles/seasons.js`, vista en `src/ui/seasons-view.js` y `styles/seasons.css`; +2 columnas; sin búnkeres ni portales; fuera de
  Ultimate: `noUltimate`). La partida empieza en una **estación al azar** (con un RNG aparte: el mazo sale igual) y la
  carta negra **Cambio de estación** ×4 pasa a la siguiente: primavera → verano → otoño → invierno → primavera. Las salidas
  y la casilla inicial del hoyo son seguras: ahí no se pone ni cae nada.
  - **Primavera: viento**, en ciclos de **tres turnos**: uno en calma, uno de **aviso** (una ruta serpenteante de borde a
    borde, de un lado al de enfrente y nunca por las salidas; se ve tenue, con flechas) y uno en el que **sopla**: se lleva por la ruta, y
    **fuera del tablero**, lo que hay dentro al empezar a soplar y lo que caiga en ella ese turno: la pelota vuelve a su
    salida y el hoyo a su casilla inicial (`windExit`: el lado del borde donde acaba la ruta). Luego, otra vez en calma. **Plantas carnívoras**: se comen la pelota (o el hoyo) que se queda a su lado o encima (cuenta como caerse); no a
    quien pasa, ni a quien vuelve a su salida.
  - **Verano: incendios** (carta naranja **Incendio** ×1): fuego en una casilla vacía que crece solo una casilla vacía por
    turno, hasta 5, y dura hasta que cambia la estación. Cruzarlo **suma 2** al tiro; quedarse dentro es como caerse del
    tablero (también el hoyo).
  - **Otoño: hojas secas** (6 al llegar y van cayendo más entre turnos): restan 1 al tiro y se rompen. Entre turnos a veces
    **llueve**: una nubecilla deja caer unas gotas sobre la casilla y aparece un charco, que resta 1 al tiro de quien pasa
    (no atrapa).
  - **Invierno: la bola de nieve** no se mueve sola: solo con su carta naranja **Bola de nieve** (×3), **5 casillas**
    (`SNOW_STEPS`; antes si se topa con una pieza sólida o el borde). Lo que lleva dentro se ve todo:
    una pelota en el centro; varias, repartidas y más pequeñas (evento `snowPack`). Atrapa lo que pilla (pelotas y hoyo) y se lo lleva; de ella se sale con cualquier palo, sin coste
    (trampa `soft`). Una pelota y el hoyo dentro a la vez: la pelota entra. En un JAQUE, la carta se lleva la pelota del
    hoyo (no el hoyo). **Hielo** (cubre casi toda la casilla): suma 1 al tiro; con el dedo, al pisarlo la pelota resbala
    sola una casilla más hacia donde iba, sin gastar paso (`serpentSlide`).
  - Charcos, hielo y plantas no tienen carta: llegan solos (la lluvia deja charcos, que se hielan en invierno y se vuelven
    plantas en primavera; en verano se secan). Al cambiar de estación el campo cambia con ella: las hojas se van con el
    invierno, el fuego se apaga en otoño, la bola se derrite en primavera y el viento se calma en verano. Las cartas de una
    estación solo se juegan en ella. Mazo: Cambio de estación ×4, Incendio ×1 y Bola de nieve ×3.
  - Los modificadores cuentan casilla a casilla (también con el dedo y para el hoyo). La IA los ve al simular cada jugada y,
    además, mira dónde dejará el viento cada cosa (`windFate`) y no le gusta estar dentro de la bola de nieve.
  - **En pantalla:** fondo y césped de cada estación (cuatro capas que se funden al cambiar; motivos sueltos: flores, paja,
    hojas, copos; pétalos, motas, hojas o copos que caen), marco del campo de su color, indicador con las cuatro en orden y
    la de ahora resaltada, y un rótulo grande al cambiar. Lo que cambia durante una jugada (la hoja que cruje, el fuego que
    crece, el cambio de estación) se ve a su tiempo: `app.sv` guarda lo que se ve y cada evento lo pone al día. Viento en
    una capa SVG (banda, ráfagas a saltos, remolinos, pétalos que viajan por la ruta con `animateMotion` y flechas donde
    echa del tablero); al arrastrar una pieza, rachas blancas y algún pétalo; bola de nieve de nieve apretada como pieza móvil que gira al rodar y lleva dentro lo
    que atrapa (más pequeño y escarchado); llamas que tiemblan, la planta que abre y cierra la boca (y se lanza al comer),
    hielo con destellos y charcos con ondas. Sonidos propios. Vista previa del recorrido de la bola de nieve; la imagen de
    compartir dibuja sus piezas, la bola de nieve y el césped de la estación.
  - **Presentación** de sus tres cartas en fila (sin desplazarse) con escenas que se juegan con el motor (piezas que
    aparecen y desaparecen, el campo que cambia de color, la bola que rueda). Pelota de logros **Estaciones** (10 · 50 · 100
    victorias): la bola en cuatro colores · pétalos, hojas y copos · las cuatro estaciones en órbita.
  - **En el creador** (grupo Estaciones): hoja seca, charco, hielo, planta, fuego y bola de nieve (una por nivel), y en sus
    opciones la estación del nivel. Poner una pieza en un nivel sin estación lo pasa a la suya; la bola de nieve, a
    invierno. La plantilla Estaciones pone primavera si no hay estación. Va en el código para compartir niveles.
  - Equilibrio (`npm run simulate -- --deck seasons`): ~8 rondas de media (la clásica 5,9), 100 % terminadas.
- **Regalo de early tester** (`src/ui/gift.js`): en el menú, un aviso pequeño con un regalo (se mece) hasta que se abre.
  Al tocarlo, la caja se abre y cuenta que, por probar el juego tan pronto, puedes **congelar tu racha del reto diario**:
  no se pierde aunque pases días sin jugar (y jugando sigue sumando). Se descongela (o se vuelve a congelar) en Ajustes →
  Racha del reto diario, que aparece una vez abierto el regalo; al descongelarla sigue viva hoy, pero toca jugar el reto.
  Congelada, la llama del reto diario del menú se ve en azul hielo. `records.daily.frozen` (`setStreakFrozen`); evento
  **regalo** (`congelar`).
- **"¡Nueva baraja!"** (`src/ui/new-deck.js`): cuando el juego estrena una baraja, quien ya jugaba la ve anunciada una
  vez al llegar al menú principal: una ventana pequeña con la ilustración (ahora, el campo partido en sus cuatro
  estaciones, cada una con lo suyo, y una pelota que las cruza), el
  anuncio, una frase y "Jugar ahora" (su partida rápida) o "Luego". A quien llega por primera vez no se le anuncia
  (todo es nuevo). Para la próxima baraja: `ANNOUNCE` y su ilustración.
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
  Con una sola persona en la mesa, la franja de abajo lleva tu pelota con la que llevas puesta sobre su green (dibujada en
  el lienzo con las mismas piezas que en el juego: `src/ui/skin-canvas.js`). En el **reto diario** es un único botón
  "Compartir" (`shareNow`) que copia directamente, sin hoja del sistema: la imagen y el resultado estilo Wordle en texto,
  que acaba con el enlace `…/#reto` (quien lo abre entra directamente en el reto de ese día; `DAILY_HASHES`). La imagen se
  prepara al terminar y el portapapeles se pide en el mismo toque (Safari solo lo permite así); si no admite imagen y
  texto juntos, se copia el texto con el enlace. El botón pasa a "¡Copiado!".
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
- **Móvil:** pellizcar para hacer zoom en el tablero y arrastrar para moverlo. Cada pantalla empieza arriba y la partida mide lo visible (en Safari `100vh` es la altura con la barra del navegador escondida: con el menú desplazado, la partida salía cortada por arriba y sin forma de volver).
- **Interfaz táctil (móviles y tabletas, iPad incluido)** (`src/ui/device.js`, `styles/phone.css`): se decide por el
  **dispositivo** (pantalla táctil sin ratón), nunca por el ancho: una ventana estrecha del ordenador sigue con el diseño
  adaptable de siempre. Ajustes → **Interfaz** (automática / táctil / ordenador) la fuerza, y `?ui=phone` o `?ui=desktop`
  en la URL, solo esa carga. En la partida el tablero ocupa todo el hueco (casillas que llenan ancho y alto,
  `fitCellsFlex`) y la interfaz va encima, compacta y translúcida:
  - **Vertical:** barra con el menú (la pausa, que reúne reglas, ajustes, historial, reiniciar y salir), la píldora del
    turno y el mazo; debajo, los rivales como fichas (cara, cartas en la mano y nombre); el tablero de borde a borde;
    el aviso de acción (si ocupa más, crece por encima del tablero sin moverlo) y la mano con los botones de turno a la
    derecha (a la izquierda en modo zurdo). El JAQUE sale arriba, sobre los rivales, y deja el tablero libre.
  - **Horizontal:** a la izquierda la barra y la lista de rivales, en el centro el tablero a todo el alto y a la derecha
    el aviso, la mano y los botones. El menú principal y Lo básico caben sin desplazarse.
  - **Menús en vertical:** el menú principal mide la pantalla y acaba por encima de los botones redondos (la ilustración
    encoge si falta alto); Lo básico va en una sola columna, una fila por nivel (número, miniatura, nombre y estado).
  - **Lo que no importa ahora pierde opacidad:** los rivales que no juegan (quien juega, quien puede reaccionar al JAQUE
    y quien ha embocado se ven enteros y con anillo), y tu mano se aparta mientras juega otro.
  - **Entrada:** tocar = ver, tocar otra vez = hacer. Los destinos ya iban así; ahora también las cartas de efecto
    inmediato (hoyo, NO…): el primer toque la elige y marca en el tablero dónde acabará ("Toca aquí"); tocar esa marca
    la juega, como el palo (o tocar otra vez la carta; "Jugar" solo si no mueve nada visible). La etiqueta "Toca otra
    vez" se coloca debajo en la fila de arriba y nunca se sale por los lados (el marco del tablero la cortaba). Mantener
    pulsada una carta explica qué hace (sin jugarla). Botones de 40-54 px, sin zoom de página, selección de texto ni
    menú contextual en la partida, márgenes seguros (muesca, barra de gestos) y vibración breve en Android.
  - **Tableros grandes (Ultimate):** se ven enteros; al elegir destino con casillas de menos de 30 px la cámara se
    acerca a tu pelota y a las casillas posibles, y al resolverse la jugada se aleja (`autoZoom` en `board-zoom.js`).
  - En tabletas, la misma maqueta con la interfaz más grande. Si el hueco del tablero cambia sin que cambie la
    ventana (la ficha con "Reaccionar", la etiqueta del modo, girar el móvil), el tablero se reajusta solo.
  - `npm run test:ui` lo comprueba emulando un iPhone en vertical y en horizontal (tablero entero y sin solapes,
    opacidades, dos toques, mantener pulsado, menú de pausa y la cámara en Ultimate).
- **Tableros grandes** (minigolf, Ultimate): si las casillas quedarían pequeñas se hacen más cuadradas para
  crecer (`fitCellsTo` en `geometry.js`), y en el ordenador la rueda del ratón hace zoom y se arrastra para moverlo.
  Piezas y efectos usan la misma métrica que la rejilla (`GAP`/`PAD`), así que quedan centradas en cualquier tamaño.
- **Progreso:** barra de Lo básico, racha y victoria más rápida en Partida rápida, 10 logros y resumen final
  (jugada más larga, quién te golpeó más, tu carta más usada).

## Rendimiento

Medido navegando deprisa por los menús con un móvil emulado (pantalla ×3, CPU ×4) y pintado por software, y con
la partida quieta. Reglas que hay que mantener:

- **Nada de filtros SVG ni desenfoques en vivo en lo que se pinta mucho.** El grano (`--grain`) y el fondo
  desenfocado de los menús se pintan una vez al arrancar (`src/ui/bake.js`): el grano es el mismo SVG rasterizado a
  un PNG y el fondo, la ilustración ya desenfocada en un JPEG pequeño guardado en `localStorage` para el siguiente
  arranque. Si el navegador no deja leer el lienzo, se quedan los estilos originales. Pintado al navegar: −42 %.
- **La presentación escalonada, solo la primera vez.** El menú hace su entrada al arrancar (`body.menuIntro`); cada
  pantalla ya vista (`.revisit`) entra con un fundido de 0,2 s y todo a la vista (antes volvía a escalonar botones y
  tarjetas hasta 0,8 s y el título aparecía recortado). Las pestañas de Modos, más cortas.
- **Sin maquetar a la fuerza.** El fundido entre pantallas es una Web Animation (antes `void el.offsetWidth`) y no se
  pregunta `getAnimations()` (cada llamada recalcula estilos): cada módulo guarda las animaciones que lanza.
  Abrir Modos de juego: de ~60 a ~9 ms con la CPU ×4.
- **Nada que repinte la pantalla en cada fotograma.** Animar `background-position` a pantalla completa repinta todo:
  el oleaje del lago es una capa que se desliza con `transform` (`.dWaves`) y en el móvil el degradado de Ultimate
  queda quieto y sus manchas sin `blur(60px)`. Partida quieta con la baraja de agua: de ~1 s de pintado cada 3 s a
  casi nada. El borde iridiscente de Ultimate en Modos va a 15 pasos por segundo.
- **Nada de variables heredadas animadas en contenedores grandes.** La corriente del río y el lago se animaban con un
  reloj (`--flow`, `--lflow`) en todo `#board`: cada fotograma recalculaba todas las casillas y su contenido. En
  Ultimate (247 casillas, río y lago a la vez) el hilo principal estaba ocupado el 95 % del tiempo y la partida iba a
  tirones. Ahora el reloj va en cada casilla de agua, a saltos de 1-2 px (igual de fluido), y en fase con el reloj de la
  página (`--wd`, `waterDelay` en `board.js`): Ultimate quieto pasa al ~14 % y jugando al ~16-25 %.
- **Precarga del arranque:** index.html pide de golpe los 85 módulos y los 32 niveles (bloque generado con
  `npm run preload`; `tests/preload.test.mjs` avisa si falta alguno). Primera carga por HTTP/2 con red de móvil:
  de 1,5 s a 1,16 s.

## Tests y herramientas

```bash
npm test                          # oráculo de reglas + reglas concretas + IA + niveles y puzles (~3 s)
npm run test:ui                   # interfaz en Chrome real: guardado, pausa, multijugador, logros, deshacer, reto, puzles
npm run simulate                  # telemetría: 500 partidas bot-contra-bot, victorias y uso de cartas
npm run simulate -- --random 0 --players 4 --size l --games 2000
npm run simulate -- --deck seasons            # con una baraja: su mazo, su tamaño y lo suyo (y cuánto actúa cada mecánica)
npm run smoke                     # prueba de humo en Chrome real (capturas en smoke-out/)
npm run golden                    # regenera el oráculo desde tests/oracle/original.html
npm run preload                   # regenera la precarga de index.html (tras añadir un módulo o un nivel)
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
