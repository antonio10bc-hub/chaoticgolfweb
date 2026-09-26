// Simulador del contrarreloj: juega cientos de hoyos generados de cada nivel (1-5) con un bot en solitario
// y mide turnos (media, p50, p90), hoyos sin terminar y uso de cada mecánica.
//   node tools/sim-rush.mjs [hoyos=150]
import { Game } from '../src/engine/game.js';
import { mulberry32 } from '../src/engine/rng.js';
import { simulateGame } from '../src/ai/autoplay.js';
import { generateLevel } from '../src/content/levels/generate.js';
const N = +(process.argv[2] || 150), rand = mulberry32(31);
for (let tier = 0; tier < 5; tier++) {
  const turns = []; let fail = 0, mech = {};
  for (let i = 0; i < N; i++) {
    const seed = (rand() * 2 ** 32) >>> 0, L = generateLevel(seed, tier);
    const g = Game.fromLevel(L, { seed: seed ^ 0x5bd1e995 });
    const orig = g.anim.bind(g); g.anim = ev => { if (['drift', 'splash', 'bump', 'deflect', 'launch', 'teleport', 'fall', 'settle'].includes(ev.t)) mech[ev.t] = (mech[ev.t] || 0) + 1; return orig(ev); };
    const r = simulateGame(g, { rand, maxTurns: 40 });
    if (g.S.winner === null) fail++; else turns.push(r.turns);
  }
  turns.sort((a, b) => a - b);
  const avg = turns.reduce((a, b) => a + b, 0) / turns.length;
  console.log(`hoyo ${tier + 1}: sin terminar ${fail}/${N} · turnos media ${avg.toFixed(1)} p50 ${turns[turns.length >> 1]} p90 ${turns[Math.floor(turns.length * .9)]} · ${JSON.stringify(Object.fromEntries(Object.entries(mech).map(([k, v]) => [k, +(v / N).toFixed(1)])))}`);
}
