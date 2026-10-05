// Telemetría de balanceo: partidas bot-contra-bot instantáneas.
//
//   npm run simulate                       500 partidas, 3 jugadores, tablero mediano
//   npm run simulate -- --games 2000 --players 4 --size l
//   npm run simulate -- --random 0         el asiento 0 juega al azar (mide la fuerza de la IA)
//   npm run simulate -- --seed 42          reproducible
//   npm run simulate -- --deck seasons     con una baraja (su mazo, su tamaño y lo suyo: tren, estaciones…)
//
// Informa: % de partidas terminadas, duración, victorias por asiento y por
// personalidad, y uso de cada carta (qué se juega y cuánto).
import { Game, PLAYER_COLORS } from '../src/engine/game.js';
import { mulberry32 } from '../src/engine/rng.js';
import { simulateGame } from '../src/ai/autoplay.js';
import { enumeratePlays } from '../src/ai/bot.js';
import { CARDS, defaultCounts } from '../src/content/cards/index.js';
import { deckById, deckSize, deckHasTrain } from '../src/content/decks.js';

const args = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean)
  .map(s => s.trim().split(/\s+/)).map(([k, v]) => [k, v ?? true]));
const GAMES = +(args.games || 500), PLAYERS = +(args.players || 3);
const SIZES = { s: { cols: 5, rows: 5, par: 2 }, m: { cols: 7, rows: 9, par: 3 }, l: { cols: 9, rows: 11, par: 4 } };
const dk = args.deck ? deckById(args.deck) : null;
const size = dk ? deckSize(dk, SIZES[args.size || 'm']) : SIZES[args.size || 'm'];
const deckCfg = dk ? { ...(dk.counts ? { counts: dk.counts(defaultCounts()) } : {}), ...(dk.newCards ? { startWith: dk.newCards } : {}),
  ...(deckHasTrain(dk) ? { train: true } : {}), ...(dk.trainLayout ? { trainLayout: true } : {}), ...(dk.seasons ? { seasons: true } : {}) } : {};
const EV = ['season', 'wind', 'gust', 'crunch', 'puddle', 'slide', 'flare', 'burn', 'eaten', 'grow', 'snow', 'train', 'absorb', 'clone', 'vanish', 'gravity', 'clash', 'meteor', 'gstuck', 'meteorRock'];
const randomSeat = args.random !== undefined ? +args.random : null;
const rand = mulberry32(+(args.seed || Date.now() % 1e9));

// bot aleatorio: una jugada legal cualquiera (o pasar), para comparar
const randomPlan = (game, p, r) => {
  const plays = enumeratePlays(game, p);
  if (!plays.length || r() < .25) return null;
  const pl = plays[Math.floor(r() * plays.length)];
  return { actions: pl.actions, key: pl.key };
};

const t0 = performance.now();
const tot = { finished: 0, turns: 0, plays: 0, reactions: 0, saves: 0, seat: Array(PLAYERS).fill(0), style: {}, styleSeats: {}, cards: {}, ties: 0, ev: {}, start: {} };
for (let i = 0; i < GAMES; i++) {
  const game = Game.pve({ players: PLAYERS, ...size, humanColor: PLAYER_COLORS[0], ...deckCfg }, { seed: (rand() * 2 ** 32) >>> 0 });
  const S = game.S;
  if (S.season) tot.start[S.season.now] = (tot.start[S.season.now] || 0) + 1;
  { const emit = game.emit.bind(game); game.emit = game.anim = ev => { if (EV.includes(ev.t)) tot.ev[ev.t] = (tot.ev[ev.t] || 0) + 1; emit(ev); }; } // (cuántas veces actúa cada mecánica)
  S.human = -1; // todos son bots
  S.aiStyles = S.aiStyles.map(s => s || (rand() < .5 ? 'aggro' : 'trick'));
  for (const s of S.aiStyles) tot.styleSeats[s] = (tot.styleSeats[s] || 0) + 1;
  const r = simulateGame(game, { rand, planFor: p => (p === randomSeat ? randomPlan : null) });
  if (r.finished) {
    tot.finished++;
    if (r.winners.length > 1) tot.ties++;
    for (const w of r.winners) { tot.seat[w]++; tot.style[S.aiStyles[w]] = (tot.style[S.aiStyles[w]] || 0) + 1; }
  }
  tot.turns += r.turns; tot.plays += r.plays; tot.reactions += r.reactions; tot.saves += r.saves;
  for (const [k, n] of Object.entries(r.cards)) tot.cards[k] = (tot.cards[k] || 0) + n;
}
const ms = performance.now() - t0;
const pct = (a, b) => (100 * a / Math.max(1, b)).toFixed(1) + '%';

console.log(`\n${GAMES} partidas · ${PLAYERS} jugadores · tablero ${size.cols}x${size.rows} par ${size.par}` + (dk ? ` · baraja ${dk.id}` : '') +
  (randomSeat !== null ? ` · asiento ${randomSeat} ALEATORIO` : '') + ` · ${(ms / GAMES).toFixed(1)} ms/partida`);
console.log(`terminadas: ${pct(tot.finished, GAMES)} · empates: ${tot.ties} · turnos/partida: ${(tot.turns / GAMES).toFixed(1)} · ` +
  `cartas/partida: ${(tot.plays / GAMES).toFixed(1)} · reacciones: ${(tot.reactions / GAMES).toFixed(2)} · JAQUEs salvados: ${(tot.saves / GAMES).toFixed(2)}`);
console.log('victorias por asiento: ' + tot.seat.map((n, i) => `J${i + 1} ${pct(n, tot.finished)}`).join(' · ') +
  `  (reparto justo: ${pct(1, PLAYERS)})`);
console.log('victorias por personalidad (victorias / asientos): ' +
  Object.keys(tot.styleSeats).map(s => `${s} ${pct(tot.style[s] || 0, tot.styleSeats[s])}`).join(' · '));
if (Object.keys(tot.ev).length) console.log('mecánicas (por partida): ' + Object.entries(tot.ev).map(([k, n]) => `${k} ${(n / GAMES).toFixed(2)}`).join(' · '));
if (Object.keys(tot.start).length) console.log('estación al empezar: ' + JSON.stringify(tot.start));
console.log('uso de cartas (por partida):');
for (const k of Object.keys(CARDS)) console.log(`  ${CARDS[k].name.padEnd(22)} ${((tot.cards[k] || 0) / GAMES).toFixed(2)}`);
