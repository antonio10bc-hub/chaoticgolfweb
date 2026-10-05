// Cartas de la baraja del multiverso (0 copias fuera de su baraja: el resto de barajas no cambia). Reglas en
// src/engine/multiverse.js.
//   agujeroNegro (negra)   pon un agujero negro en una casilla vacía: parte en 4 la pelota que pasa o se para a su lado
//   gravedad     (negra)   en cualquier casilla: atrae hacia ella lo que haya en su cruz de 2 (pelotas y el hoyo)
//   oGravedad    (naranja) lo mismo con la cruz de 1, en cualquier momento (también en el JAQUE)
//   meteoritos   (negra)   lluvia de meteoritos sobre la mitad de las casillas: copias fuera; originales, a su salida
// demo: escena de ejemplo para la presentación de la baraja (src/ui/deck-intro.js), que se juega con el motor
export const agujeroNegro = {
  id: 'agujeroNegro', color: 'black', copies: 0,
  tile: 'blackhole',
  staysOnBoard: true, // (como las demás piezas: no vuelve a los descartes)
  icon: '<span class="ico ico-blackhole"></span>',
  face: { art: 'agujeroNegro' },
  // como mucho uno por partida: una sola carta en la baraja y, si ya hay uno en el tablero (la carta se descartó y
  // volvió a salir, o lo trae el nivel), no se juega
  blockedReason: g => g.S.tiles.some(tl => tl.type === 'blackhole') ? 'reason.oneBlackhole' : 'reason.noBlackholeSpot',
  canPlay: g => !g.S.tiles.some(tl => tl.type === 'blackhole') && g.anyPlaceFor('blackhole'),
  play(game, p, idx) { game.setPending({ kind: 'placeTile', p, idx, tileType: 'blackhole' }); },
  // el agujero en medio y un palo 3 que pasa a su lado: salen 4 pelotas
  demo: { cols: 7, rows: 5, hole: { x: 6, y: 0 }, ball: { x: 0, y: 2 }, card: 'agujeroNegro', cell: { x: 3, y: 2 },
    then: { card: 'palo3', dir: 'right' } },
};
function gravedad(id, color, r) {
  return {
    id, color, copies: 0, r,
    icon: '<span class="ico ico-gravity"></span>',
    face: { art: 'gravedad', value: String(r) },
    play(game, p, idx) { game.setPending({ kind: 'gravity', p, idx, r }); },
  };
}
// la pelota y el hoyo van a la vez hacia el centro: el hoyo llega a la pelota y se la traga
export const gravedad2 = { ...gravedad('gravedad', 'black', 2),
  demo: { cols: 5, rows: 5, hole: { x: 4, y: 2 }, ball: { x: 2, y: 0 }, spawn: { x: 0, y: 4 }, card: 'gravedad', cell: { x: 2, y: 2 } } };
// en el hoyo: la pelota que tiene al lado cae dentro
export const oGravedad = { ...gravedad('oGravedad', 'orange', 1),
  demo: { cols: 5, rows: 4, hole: { x: 2, y: 1 }, ball: { x: 2, y: 2 }, spawn: { x: 0, y: 3 }, card: 'oGravedad', cell: { x: 2, y: 1 } } };
export const meteoritos = {
  id: 'meteoritos', color: 'black', copies: 0,
  icon: '<span class="ico ico-meteor"></span>',
  face: { art: 'meteoritos' },
  random: true, // (dónde caen es al azar: sin vista previa)
  play(game, p, idx) {
    game.consumeCard(p, idx);
    game.meteorShower();
    game.afterPlay();
  },
  // le cae uno a la pelota: vuelve a su salida
  demo: { cols: 5, rows: 4, seed: 2, hole: { x: 4, y: 0 }, ball: { x: 2, y: 1 }, spawn: { x: 0, y: 3 }, card: 'meteoritos' },
};
