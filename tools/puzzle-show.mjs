// Muestra un candidato del buscador: tablero en ASCII y su solución paso a paso.
//   node tools/puzzle-show.mjs <tema> [n=0]
// Leyenda: H hoyo · O tu pelota · o obstáculo · ~ río · L lago · b búnker · P portal · # bloque · T túnel · ◤◥◢◣ esquinas · ↑→↓← lanzaderas
import fs from 'node:fs';
import { Game } from '../src/engine/game.js';
import { applyAction } from '../src/ai/bot.js';
const [theme, n = 0] = process.argv.slice(2);
const c = JSON.parse(fs.readFileSync(`puzzle-candidates/${theme}.json`))[+n];
if (!c) { console.log('sin candidato'); process.exit(); }
const L = c.L;
const SYM = { river: '~', lake: 'L', bunker: 'b', portal: 'P', block: '#', tunnel: 'T' };
const CR = ['◤', '◥', '◢', '◣'], LA = ['↑', '→', '↓', '←'];
const draw = (hole, balls, tiles) => {
  let s = '';
  for (let y = 0; y < L.rows; y++) {
    for (let x = 0; x < L.cols; x++) {
      const tl = tiles.find(t => t.x === x && t.y === y), b = balls.find(q => q.x === x && q.y === y && !q.holed);
      let ch = '.';
      if (tl) ch = tl.type === 'corner' ? CR[tl.rot || 0] : tl.type === 'launcher' ? LA[tl.rot || 0] : SYM[tl.type];
      if (hole.x === x && hole.y === y) ch = 'H';
      if (b) ch = b.player === 0 ? 'O' : 'o';
      s += ch + ' ';
    }
    s += '\n';
  }
  return s;
};
console.log(theme, n, `ratio ${c.ratio} (${c.wins}/${c.total})`, L.cols + 'x' + L.rows, 'mano:', L.hand.join(', '));
console.log(draw(L.hole, [{ player: 0, ...L.ball }, ...(L.extraBalls || []).map(e => ({ player: 1, ...e }))], L.tiles));
const g = Game.fromLevel(L, { seed: 3 }); g.takeEvents();
let line = [];
for (const a of c.sol) {
  if (a[0] === 'card') line.push(`[${g.S.hands[0][a[2]]}]`); else line.push(a.slice(1).join(','));
  applyAction(g, a);
}
console.log('solución:', line.join(' '), '→ gana:', g.S.winner !== null);
