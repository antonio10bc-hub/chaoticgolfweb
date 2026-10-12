// Duración de la partida rápida: cada baraja en cada tamaño (Ultimate, las 7 juntas y solo en el grande), bot contra bot,
// configurada como en el juego (startPveMatch: su mazo, sus cartas de inicio, tren, estaciones, casino).
//
//   npm run sim:decks                         300 partidas por casilla, 3 jugadores (tú y 2 bots, lo de inicio)
//   npm run sim:decks -- --games 1000 --players 4 --seed 7
//
// Informa: % de partidas terminadas, rondas (media, mediana y p90), cartas por turno y una estimación en minutos:
// el turno de un bot con los tiempos de la IA (JUICE.AI: pensar, cada carta con su animación, terminar) y el tuyo, ~15 s.
import { Game, PLAYER_COLORS } from '../src/engine/game.js';
import { mulberry32 } from '../src/engine/rng.js';
import { simulateGame } from '../src/ai/autoplay.js';
import { defaultCounts } from '../src/content/cards/index.js';
import { DECKS, PVE_SIZES, deckSize, deckHasTrain, comboCfg, ALL_COMBO } from '../src/content/decks.js';

const args = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean)
  .map(s => s.trim().split(/\s+/)).map(([k, v]) => [k, v ?? true]));
const GAMES = +(args.games || 300), PLAYERS = +(args.players || 3), HUMAN_TURN_S = +(args.human || 15);
const rand = mulberry32(+(args.seed || 12345));
// un turno de bot: pensar + por carta (elegir, la carta en la mesa, el movimiento, la pausa entre cartas) + terminar
const BOT = { think: 1.25, end: 1.1, perCard: 0.38 + 0.52 + 0.9 + 1.25 };

function cfgFor(dk, sz) { // (como startPveMatch)
  if (dk.ultimate) {
    const c = comboCfg(ALL_COMBO);
    return { counts: c.counts, startWith: c.startWith, ...c.size, train: c.train, trainLayout: c.trainLayout, seasons: c.seasons, gambling: c.gambling };
  }
  return { ...deckSize(dk, sz), ...(dk.counts ? { counts: dk.counts(defaultCounts()) } : {}), ...(dk.newCards?.length ? { startWith: dk.newCards } : {}),
    train: deckHasTrain(dk), trainLayout: !!dk.trainLayout, seasons: !!dk.seasons, gambling: !!dk.gambling };
}

const rows = [];
for (const dk of DECKS) for (const k of dk.ultimate ? ['l'] : ['s', 'm', 'l']) {
  const cfg = cfgFor(dk, PVE_SIZES[k]), rounds = [];
  if (PLAYERS > cfg.cols) continue; // (en el pequeño, como mucho 5: una pelota por columna)
  let finished = 0, turns = 0, plays = 0, errors = 0, games = 0;
  for (let i = 0; i < GAMES; i++) {
    const seed = (rand() * 2 ** 32) >>> 0, game = Game.pve({ players: PLAYERS, ...cfg, humanColor: PLAYER_COLORS[0] }, { seed });
    const S = game.S;
    S.human = -1; // todos son bots
    S.aiStyles = S.aiStyles.map(s => s || (rand() < .5 ? 'aggro' : 'trick'));
    let r;
    try { r = simulateGame(game, { rand }); } catch (e) { errors++; console.error(`error · ${dk.id} ${k} · semilla ${seed}: ${e.message}`); continue; }
    games++;
    if (r.finished) finished++;
    turns += r.turns; plays += r.plays; rounds.push(r.turns / PLAYERS);
  }
  rounds.sort((a, b) => a - b);
  const mean = turns / PLAYERS / games, cardsPerTurn = plays / turns;
  const botTurn = BOT.think + BOT.end + cardsPerTurn * BOT.perCard;
  const min = mean * ((PLAYERS - 1) * botTurn + HUMAN_TURN_S) / 60;
  rows.push({ deck: dk.id, size: `${cfg.cols}×${cfg.rows} PAR ${cfg.par}`, fin: finished / games, mean, med: rounds[games >> 1], p90: rounds[Math.floor(games * .9)], cardsPerTurn, min, errors });
}

const pad = (s, n) => String(s).padEnd(n);
console.log(`\n${GAMES} partidas por casilla · ${PLAYERS} jugadores · tu turno ~${HUMAN_TURN_S} s\n`);
console.log(pad('baraja', 12) + pad('campo', 15) + pad('terminadas', 12) + pad('rondas', 8) + pad('mediana', 9) + pad('p90', 6) + pad('cartas/turno', 14) + pad('minutos', 9) + 'errores');
for (const r of rows) console.log(pad(r.deck, 12) + pad(r.size, 15) + pad((100 * r.fin).toFixed(1) + '%', 12) + pad(r.mean.toFixed(1), 8) +
  pad(r.med.toFixed(1), 9) + pad(r.p90.toFixed(1), 6) + pad(r.cardsPerTurn.toFixed(2), 14) + pad('~' + r.min.toFixed(1), 9) + r.errors);
