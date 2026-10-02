// Cartas de la baraja de las estaciones (0 copias fuera de su baraja: el resto de barajas no cambia).
//   estacion  (negra)   cambia a la siguiente estación (primavera → verano → otoño → invierno → primavera)
//   charco    (negra)   según la estación: charco (otoño), hielo (invierno) o planta carnívora (primavera); en
//                       verano no se puede jugar. Como mucho 6 en el campo (los de la lluvia no cuentan)
//   incendio  (naranja) (verano) prende fuego a una casilla vacía; crece sola una casilla por turno, hasta 5
//   oNieve    (naranja) (invierno) la bola de nieve rueda hacia donde elijas hasta toparse con algo
// Sin estaciones en la partida (o fuera de la suya) no se pueden jugar.
const hasSeasons = g => !!g.S.season;
const inSeason = s => g => g.S.season?.now === s;

// escenas de ejemplo (presentación de la baraja, src/ui/deck-intro.js): se juegan con el motor
export const estacion = {
  id: 'estacion', color: 'black', copies: 0,
  icon: '<span class="ico ico-season"></span>',
  face: { art: 'estacion' },
  blockedReason: 'reason.noSeasons',
  canPlay: hasSeasons,
  play(game, p, idx) {
    game.consumeCard(p, idx);
    game.changeSeason();
    game.afterPlay();
  },
  // del otoño al invierno: el charco se hiela y llega la bola de nieve
  demo: { cols: 5, rows: 4, seed: 4, season: { now: 'autumn' }, hole: { x: 4, y: 0 }, ball: { x: 0, y: 3 },
    tiles: [{ type: 'puddle', x: 2, y: 1 }, { type: 'leaf', x: 1, y: 2 }, { type: 'leaf', x: 3, y: 2 }], card: 'estacion' },
};
export const charco = {
  id: 'charco', color: 'black', copies: 0,
  icon: '<span class="ico ico-puddle"></span>',
  face: { art: 'charco', forms: true },
  blockedReason: 'reason.noPuddle',
  canPlay: g => { const type = g.placeType(); return !!type && g.anyPlaceFor(type); },
  play(game, p, idx) { game.setPending({ kind: 'placeTile', p, idx, tileType: game.placeType() }); },
  // otoño: un charco en el camino, y el palo 3 se queda en 2
  demo: { cols: 5, rows: 4, seed: 2, season: { now: 'autumn' }, hole: { x: 4, y: 3 }, ball: { x: 0, y: 1 }, card: 'charco', cell: { x: 1, y: 1 },
    then: { card: 'palo3', dir: 'right' } },
};
export const incendio = {
  id: 'incendio', color: 'orange', copies: 0,
  icon: '<span class="ico ico-fire"></span>',
  face: { art: 'incendio' },
  blockedReason: 'reason.notSummer',
  canPlay: g => inSeason('summer')(g) && g.anyPlaceFor('fire'),
  play(game, p, idx) { game.setPending({ kind: 'placeTile', p, idx, tileType: 'fire' }); },
  // prende el fuego y lo cruza un palo 2: +2, llega hasta el final
  demo: { cols: 5, rows: 4, seed: 6, season: { now: 'summer' }, hole: { x: 4, y: 3 }, ball: { x: 0, y: 1 }, card: 'incendio', cell: { x: 1, y: 1 },
    then: { card: 'palo2', dir: 'right' } },
};
export const oNieve = {
  id: 'oNieve', color: 'orange', copies: 0,
  icon: '<span class="ico ico-snow"></span>',
  face: { art: 'nieve' },
  blockedReason: 'reason.noSnow',
  canPlay: g => inSeason('winter')(g) && g.snowTargets().length > 0,
  play(game, p, idx) { game.setPending({ kind: 'snowRoll', p, idx, targets: game.snowTargets() }); },
  // la bola de nieve rueda, atrapa la pelota y se la lleva
  demo: { cols: 5, rows: 4, seed: 3, season: { now: 'winter', snow: { x: 0, y: 1 } }, hole: { x: 4, y: 3 }, ball: { x: 2, y: 1 }, card: 'oNieve', dir: 'right' },
};
