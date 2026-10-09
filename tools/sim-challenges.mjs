// Simulador de desafíos y reto diario: dibuja el campo en ASCII y juega partidas bot
// contra bot con telemetría (rondas, ventaja por posición de salida, uso de cada mecánica por partida).
// Sirve para diseñar y equilibrar campos en src/content/challenges.js.
//   node tools/sim-challenges.mjs [ids|ch|warmup|mid|expert|base|vars] [partidas=40] [dibujar=1] [variantes.mjs]
//     ids: lista separada por comas (p. ej. pinball,prism) · ch: todos los desafíos · warmup/mid/expert: los de un grupo
//     base: partidas normales de referencia · vars: solo las variantes del archivo (export default [ {id, board, …} ])
// Referencia: una partida normal de 7×9 dura unas 6 rondas y de 9×11 unas 7,5. Objetivo por grupo:
// calentamiento ~4-6, intermedio ~6-8, experto ~7-10, sin colas largas (p90) ni una salida que gane de más.
import { Game, PLAYER_COLORS } from '../src/engine/game.js';
import { mulberry32 } from '../src/engine/rng.js';
import { simulateGame } from '../src/ai/autoplay.js';
import { CHALLENGES, challengeCfg, setupChallenge } from '../src/content/challenges.js';
const [which = 'all', Narg = '40', show = '1', variantsFile] = process.argv.slice(2);
const N = +Narg;
const BASES = [{ id: 'base7', board: { cols: 7, rows: 9, par: 3 }, opps: 2, diff: 'normal' }, { id: 'base9', board: { cols: 9, rows: 11, par: 4 }, opps: 2, diff: 'normal' }, { id: 'baseMini', board: { cols: 9, rows: 9, par: 4 }, opps: 2, diff: 'normal', deck: 'minigolf' }];
const VARS = variantsFile ? (await import(new URL(variantsFile, 'file://' + process.cwd() + '/').href)).default : [];
const list = [...VARS, ...BASES, ...CHALLENGES].filter(c => which === 'all' || which.split(',').includes(c.id) || c.group === which || (which === 'vars' && VARS.includes(c)) || (which === 'ch' && CHALLENGES.includes(c)) || (which === 'base' && c.id.startsWith('base')));
const SYM = { river: '~', lake: 'L', bunker: 'b', portal: 'P', block: '#', tunnel: 'T', leaf: 'h', puddle: 'c', ice: '=', plant: 'Y', fire: 'F', blackhole: '@', meteorite: 'R', dice: 'D' }; // (estaciones; * bola de nieve; casino: G dorada, o moneda)
const CR = ['◤', '◥', '◢', '◣'], LA = ['↑', '→', '↓', '←'];
function make(ch, seed) {
  const { cfg, extra } = challengeCfg(ch);
  const g = Game.pve({ players: cfg.opps + 1, humans: 1, aiLevel: cfg.diff, ...extra, humanColor: PLAYER_COLORS[0] }, { seed });
  setupChallenge(g.S, ch, seed, Game.designed); // (como en el juego: su agua no cuenta para el máximo; su tren)
  return g;
}
function draw(S) {
  let s = '';
  for (let y = 0; y < S.rows; y++) {
    for (let x = 0; x < S.cols; x++) {
      const tl = S.tiles.find(t => t.x === x && t.y === y), b = S.balls.find(q => q.x === x && q.y === y);
      let ch = S.parCells.some(p => p.x === x && p.y === y) ? ':' : '.';
      if (tl) ch = tl.type === 'corner' ? CR[tl.rot || 0] : tl.type === 'launcher' ? LA[tl.rot || 0] : tl.type === 'portal' ? 'ABC'[(tl.pair || 1) - 1] : SYM[tl.type];
      if (S.train?.path.some(([px, py]) => px === x && py === y)) ch = S.train.stations.some(i => S.train.path[i][0] === x && S.train.path[i][1] === y) ? 'S' : '=';
      if (S.train && S.train.path[S.train.pos][0] === x && S.train.path[S.train.pos][1] === y) ch = 'T';
      if (S.season?.snow && S.season.snow.x === x && S.season.snow.y === y) ch = '*';
      if (S.gamble?.gold && S.gamble.gold.x === x && S.gamble.gold.y === y) ch = 'G';
      if (S.gamble?.coins.some(c => c.x === x && c.y === y)) ch = 'o';
      if (S.hole.x === x && S.hole.y === y) ch = 'H';
      if (b) ch = String(b.player + 1);
      s += ch + ' ';
    }
    s += '\n';
  }
  return s;
}
const MECH = ['train', 'drift', 'splash', 'bump', 'deflect', 'tunnel', 'launch', 'teleport', 'fall', 'settle', 'iri', 'impact',
  'gust', 'crunch', 'puddle', 'slide', 'flare', 'burn', 'eaten', 'snow', 'season', 'absorb', 'gravity', 'gstuck', 'meteor', 'meteorRock', 'coinFlip', 'goHome', 'diceRoll', 'roulette', 'goldWin']; // (las últimas: estaciones, multiverso y casino)
for (const ch of list) {
  const rand = mulberry32(4242);
  if (show === '1') { const g = make(ch, 12345); console.log(`\n== ${ch.id} ${g.S.cols}x${g.S.rows} par ${g.S.par} · ${ch.opps + 1} jug · ${ch.diff}`); console.log(draw(g.S)); }
  let fin = 0, trainW = 0, turns = [], mech = Object.fromEntries(MECH.map(m => [m, 0])), seatW = {}, stuck = 0, err = 0, placed = 0, t0 = performance.now();
  for (let i = 0; i < N; i++) {
    const seed = (rand() * 2 ** 32) >>> 0;
    let g;
    try { g = make(ch, seed); } catch (e) { err++; console.log(e.stack); continue; }
    g.S.human = -1; g.S.aiStyles = g.S.aiStyles.map(s => s || ['aggro', 'trick'][Math.floor(rand() * 2)]);
    const orig = g.anim.bind(g), origE = g.emit.bind(g);
    g.anim = ev => { if (ev.t === 'move' && ev.iri) mech.iri++; else if (mech[ev.t] !== undefined) mech[ev.t]++; return orig(ev); };
    g.emit = ev => { if (ev.t === 'tilePlaced') placed++; return origE(ev); };
    try {
      const r = simulateGame(g, { rand, maxTurns: 300 });
      if (g.S.trainWin) { fin++; trainW++; turns.push(r.turns / g.S.nPlayers); } // (el tren ha metido una pelota él solo)
      else if (g.S.winner !== null) { fin++; turns.push(r.turns / g.S.nPlayers); const sx = g.S.balls[g.S.winner].spawnX - Math.floor(g.S.cols / 2); seatW[sx] = (seatW[sx] || 0) + 1; } else stuck++;
    } catch (e) { err++; if (err < 3) console.log(e.stack); }
  }
  turns.sort((a, b) => a - b);
  const avg = turns.reduce((a, b) => a + b, 0) / (turns.length || 1);
  const per = Object.fromEntries(Object.entries(mech).filter(([, n]) => n).map(([k, n]) => [k, +(n / N).toFixed(1)]));
  console.log(`${ch.id}: fin ${fin}/${N} err ${err} · rondas media ${avg.toFixed(1)} p10 ${(turns[Math.floor(turns.length * .1)] || 0).toFixed(1)} p90 ${(turns[Math.floor(turns.length * .9)] || 0).toFixed(1)} · gana por salida ${JSON.stringify(seatW)}${trainW ? ` · gana el tren ${trainW}` : ''} · por partida ${JSON.stringify(per)}${placed ? ' · piezas puestas ' + (placed / N).toFixed(1) : ''} · ${Math.round((performance.now() - t0) / N)}ms`);
}
