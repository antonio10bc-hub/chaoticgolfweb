// Simulador del contrarreloj: juega cientos de hoyos generados de cada nivel (1-5) con un bot en tu lugar y los dos
// cazadores (src/ai/bot.js, estilo 'hunter'), y mide tus turnos (media, p50, p90), hoyos sin terminar, los golpes
// que te dan los cazadores, cuántos cazadores acaban en el hoyo y el uso de cada mecánica.
//   node tools/sim-rush.mjs [hoyos=150] [cazadores=2]
import { Game } from '../src/engine/game.js';
import { mulberry32 } from '../src/engine/rng.js';
import { simulateGame } from '../src/ai/autoplay.js';
import { generateLevel, placeHunters } from '../src/content/levels/generate.js';
const N = +(process.argv[2] || 150), NH = +(process.argv[3] ?? 2), rand = mulberry32(31);
for (let tier = 0; tier < 5; tier++) {
  const turns = []; let fail = 0, hits = 0, gone = 0, mech = {};
  for (let i = 0; i < N; i++) {
    const seed = (rand() * 2 ** 32) >>> 0, L = generateLevel(seed, tier);
    L.hunters = placeHunters(L, seed, NH);
    const g = Game.fromLevel(L, { seed: seed ^ 0x5bd1e995 });
    const orig = g.anim.bind(g); g.anim = ev => { if (['drift', 'splash', 'bump', 'deflect', 'launch', 'teleport', 'fall', 'settle'].includes(ev.t)) mech[ev.t] = (mech[ev.t] || 0) + 1; return orig(ev); };
    // tus turnos: los que terminan siendo tuyos (el jugador 0)
    let mine = 0; const end = g.finishTurn.bind(g); g.finishTurn = () => { if (g.S.turn === 0) mine++; return end(); };
    simulateGame(g, { rand, maxTurns: 40 * (1 + NH) });
    hits += g.S.huntHits || 0; gone += g.S.balls.filter(b => b.hunter && b.holed).length;
    if (g.S.winner === null) fail++; else turns.push(mine + 1);
  }
  turns.sort((a, b) => a - b);
  const avg = turns.reduce((a, b) => a + b, 0) / turns.length;
  console.log(`hoyo ${tier + 1}: sin terminar ${fail}/${N} · tus turnos media ${avg.toFixed(1)} p50 ${turns[turns.length >> 1]} p90 ${turns[Math.floor(turns.length * .9)]}` +
    ` · golpes recibidos ${(hits / N).toFixed(1)} · cazadores en el hoyo ${(gone / N).toFixed(2)} · ${JSON.stringify(Object.fromEntries(Object.entries(mech).map(([k, v]) => [k, +(v / N).toFixed(1)])))}`);
}
