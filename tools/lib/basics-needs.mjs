// Lo que un nivel de Lo básico tiene que enseñar: predicados sobre los eventos del motor de una solución
// (tools/basics-design.mjs exige que TODAS las soluciones los cumplan; tools/basics-search.mjs busca tableros así).
const tip = k => evs => evs.some(e => e.t === 'tip' && e.key === k);
const ev = (t, f = () => true) => evs => evs.some(e => e.t === t && f(e));
const card = re => ev('card', e => re.test(e.key));
// (copias de tu pelota: COPY_BASE + 10·n + 0)
const mine = p => typeof p === 'string' && /^b\d+$/.test(p) && +p.slice(1) % 10 === 0 && (p === 'b0' || +p.slice(1) >= 100);
export const NEED = {
  // palos, hoyo y pelotas
  hit: tip('hit'), chain: tip('chain'), decoy: tip('decoy'), swallow: tip('swallow'), holeFell: tip('holeFell'),
  fall: ev('fall', e => e.p === 'b0'), orange: card(/^o/), dedo: card(/^dedo$/),
  dedoHit: evs => evs.some((e, i) => e.t === 'card' && e.key === 'dedo' && evs.slice(i).some(m => m.t === 'impact' && m.p === 'b0')),
  // clásica
  bunker: tip('bunker'), trapExit: tip('trapExit'), portal: ev('teleport', e => e.p === 'b0'), holePortal: ev('teleport', e => e.p === 'hole'),
  holeTrap: ev('settle', e => e.p === 'hole'), placed: ev('tilePlaced'),
  // agua
  river: ev('drift', e => e.p === 'b0'), holeRiver: ev('drift', e => e.p === 'hole'), lake: ev('splash', e => e.p === 'b0'), holeLake: ev('splash', e => e.p === 'hole'),
  riverPush: evs => evs.some((e, i) => e.t === 'impact' && e.dir === 'down' && evs.slice(0, i).some(d => d.t === 'drift' && d.p === e.p)),
  riverFall: evs => evs.some((e, i) => e.t === 'fall' && e.p === 'b0' && evs.slice(0, i).some(d => d.t === 'drift' && d.p === 'b0')),
  // minigolf
  long: card(/^palo[45]$/), bump: ev('bump', e => e.p === 'b0' && !e.dice), holeBump: ev('bump', e => e.p === 'hole' && !e.dice),
  deflect: ev('deflect', e => e.p === 'b0'), holeDeflect: ev('deflect', e => e.p === 'hole'),
  launch: ev('launch', e => e.p === 'b0'), holeLaunch: ev('launch', e => e.p === 'hole'), tunnel: ev('tunnel'),
  launchFall: evs => evs.some((e, i) => e.t === 'fall' && e.p === 'b0' && evs.slice(0, i).some(d => d.t === 'launch' && d.p === 'b0' && d.out)),
  launchHit: evs => evs.some((e, i) => e.t === 'impact' && e.p === 'b0' && i > 0 && evs[i - 1].t === 'launch'),
  launch2: evs => evs.filter(e => e.t === 'launch' && e.p === 'b0' && !e.out).length >= 2,
  iri: ev('move', e => e.iri), palo10: card(/^palo10$/),
  // tren
  train: ev('train'), wagon: ev('wagon'), trainShove: ev('move', e => e.p === 'b0' && e.shove), ride: ev('move', e => e.ride && e.p === 'b0'),
  holeShove: evs => evs.some((e, i) => e.t === 'move' && e.p === 'hole' && evs.slice(Math.max(0, i - 3), i).some(d => d.t === 'train')),
  holeRide: ev('move', e => e.ride && e.p === 'hole'), trainFall: evs => evs.some((e, i) => e.t === 'fall' && e.p === 'b0' && evs.slice(0, i).some(d => d.t === 'train')),
  // estaciones
  wind: ev('gust', e => e.p === 'b0'), holeWind: ev('gust', e => e.p === 'hole'), eaten: ev('eaten', e => e.p === 'b0'), holeEaten: ev('eaten', e => e.p === 'hole'),
  flare: ev('flare', e => e.p === 'b0'), burn: ev('burn', e => e.p === 'b0'), leaf: ev('crunch', e => e.p === 'b0'), puddle: ev('puddle', e => e.p === 'b0'),
  slide: ev('slide', e => e.p === 'b0'), snow: ev('snow'), snowBall: ev('move', e => e.ride && e.p === 'b0'), snowHole: ev('move', e => e.ride && e.p === 'hole'),
  season: ev('season'), fireCard: card(/^incendio$/),
  // multiverso
  absorb: ev('absorb', e => mine(e.p)), holeSplit: ev('absorb', e => e.p === 'hole'), copySink: ev('sink', e => /^b\d{3}$/.test(e.p) && +e.p.slice(1) % 10 === 0),
  copyGone: ev('vanish', e => /^b\d{3}$/.test(e.p)), gravity: ev('gravity'), gpullBall: ev('gpull', e => e.p === 'b0'), gpullHole: ev('gpull', e => e.p === 'hole'),
  clash: ev('clash'), gstuck: ev('gstuck'), meteor: ev('meteor'), rockBump: evs => evs.some(e => e.t === 'bump' && e.p === 'b0'),
  gpullCopy: ev('gpull', e => /^b\d{3}$/.test(e.p)), meteorCopy: ev('vanish', e => /^b\d{3}$/.test(e.p) && e.why === 'meteor'),
  holeCopyGone: ev('vanish', e => /^hole\d/.test(e.p)), meteorHit: ev('meteor', e => e.hit === 'b0'),
  dicePortal: ev('diceRoll', e => !!e.via), iriBump: ev('bump', e => e.p === 'b0'),
  iriHit: evs => evs.some((e, i) => e.t === 'impact' && e.p === 'b0' && evs.slice(0, i).some(m => m.t === 'move' && m.iri)),
  copyLake: evs => evs.some((e, i) => e.t === 'vanish' && /^b\d{3}$/.test(e.p) && evs.slice(0, i).some(m => m.t === 'splash' && m.p === e.p)),
  copyEaten: evs => evs.some(e => e.t === 'eaten' && /^b\d{3}$/.test(e.p)), teleportAny: ev('teleport'),
  pickOwn: evs => evs.some(e => e.t === 'move' && /^b\d{3}$/.test(e.p)),
  // casino
  dice: ev('bump', e => e.p === 'b0' && e.dice), holeDice: ev('bump', e => e.p === 'hole' && e.dice), diceRoll: ev('diceRoll'),
  diceTwice: evs => evs.filter(e => e.t === 'diceRoll').length >= 2, coin: ev('coinPick', e => e.p === 'b0'), holeCoin: ev('coinPick', e => e.p === 'hole'),
  heads: ev('coinFlip', e => e.side === 'heads'), tails: ev('coinFlip', e => e.side === 'tails'), gold: ev('goldWin', e => e.p === 'b0'),
  roulette: ev('roulette'), goHome: ev('goHome', e => e.p === 'b0'),
};
