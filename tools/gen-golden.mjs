// Genera el oráculo de reglas: juega partidas aleatorias en el juego ORIGINAL
// (tests/oracle/original.html, cargado en jsdom) y guarda, por cada acción,
// el hash canónico del estado resultante. tests/engine.golden.test.mjs repite
// exactamente las mismas acciones sobre el motor nuevo y exige los mismos hashes.
//
//   npm run golden            (requiere las devDependencies: jsdom)
//
// Solo hace falta regenerarlo si se cambian las reglas A PROPÓSITO.
import fs from 'node:fs';
import zlib from 'node:zlib';
import { JSDOM, VirtualConsole } from 'jsdom';
import { mkRng, canonical, hash } from '../tests/helpers/canon.mjs';

const ORACLE = new URL('../tests/oracle/original.html', import.meta.url);
const OUT = new URL('../tests/fixtures/golden.json.gz', import.meta.url);
const GAMES = +(process.argv[2] || 360);
const html = fs.readFileSync(ORACLE, 'utf8');

function boot(seed) {
  const vc = new VirtualConsole();
  const dom = new JSDOM(html, {
    url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      const r = mkRng(seed); w.__rc = 0;
      w.Math.random = () => { w.__rc++; return r(); };
      w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: () => () => {}, set: () => true });
      w.Element.prototype.animate = () => ({});
      w.confirm = () => true;
      w.Date.now = () => 1e6;
    },
  });
  return dom;
}

const games = [];
for (let g = 1; g <= GAMES; g++) {
  const seed = g * 7919;
  const dom = boot(seed);
  const w = dom.window;
  const E = s => w.eval(s);
  const act = mkRng(g * 104729 + 17);
  const pick = n => Math.floor(act() * n);
  const cardKeys = JSON.parse(E('JSON.stringify(Object.keys(CARD_DEFS))'));
  const drain = () => E('animating = false; animQueue = [];');
  const state = () => hash(canonical(E('S'), E('pending')));

  // ---- preparación de la partida ----
  const skip = E("__rc"); // llamadas a Math.random antes de preparar la partida (arranque de la página)
  let setup;
  const kind = g % 5;
  if (kind <= 1) { // modo libre con ajustes de debug aleatorios
    const counts = {};
    for (const k of cardKeys) counts[k] = act() < .15 ? 0 : pick(k === 'no' || k === 'portal' ? 4 : 7);
    const cfgIn = { players: 1 + pick(6), par: 1 + pick(5), cols: 3 + pick(10), rows: 5 + pick(8) };
    E(`dbgPlayers.value=${cfgIn.players}; dbgPar.value=${cfgIn.par}; dbgCols.value=${cfgIn.cols}; dbgRows.value=${cfgIn.rows};`);
    for (const k of cardKeys) E(`document.getElementById('cnt_${k}').value=${counts[k]}`);
    const cfg = JSON.parse(E('JSON.stringify(readDebugSettings())'));
    setup = { type: 'free', cfg };
    E('newGame()');
  } else if (kind === 2) { // nivel (historia integrado o nivel aleatorio de creador)
    let level;
    if (act() < .5) level = JSON.parse(E(`JSON.stringify(STORY_LEVELS[${pick(4)}])`));
    else {
      const cols = 3 + pick(7), rows = 5 + pick(6);
      const used = new Set();
      const cell = () => { for (;;) { const x = pick(cols), y = pick(rows); if (!used.has(x + ',' + y)) { used.add(x + ',' + y); return { x, y }; } } };
      const hole = cell(), ball = cell();
      const tiles = [];
      const nb = pick(4), np = act() < .5 ? 2 : pick(2);
      for (let i = 0; i < nb; i++) tiles.push({ type: 'bunker', ...cell() });
      for (let i = 0; i < np; i++) tiles.push({ type: 'portal', ...cell() });
      const extraBalls = act() < .4 ? Array.from({ length: 1 + pick(3) }, cell) : undefined;
      const deckCounts = {};
      for (const k of cardKeys) deckCounts[k] = pick(4);
      level = { cols, rows, hole, ball, parCells: [{ x: hole.x, y: Math.min(rows - 1, hole.y + 1), n: 1 }], tiles, deckCounts };
      if (extraBalls) level.extraBalls = extraBalls;
    }
    setup = { type: 'level', level };
    E(`newGameFromLevel(${JSON.stringify(level)}); appMode = 'story';`);
  } else { // PVE
    const sizes = [{ cols: 5, rows: 5, par: 2 }, { cols: 7, rows: 9, par: 3 }, { cols: 9, rows: 11, par: 4 }];
    const sz = sizes[pick(3)];
    const colors = JSON.parse(E('JSON.stringify(PVE_COLORS())'));
    const cfg = { players: 2 + pick(4), ...sz, humanColor: colors[pick(colors.length)] };
    setup = { type: 'pve', cfg };
    E(`newGamePve(${JSON.stringify(cfg)}); clearTimeout(aiTimer); aiActing = true;`);
  }
  drain();
  E('var __nl = []; const __ol = log; log = m => { __nl.push(m); __ol(m); };');
  const steps = [];
  const initHash = state();

  // ---- acciones aleatorias ----
  for (let step = 0; step < 150; step++) {
    drain();
    if (E('S.winner !== null && !S.jaque')) break;
    const pend = E('pending && pending.kind');
    const god = E('godMode');
    const r = act();
    let a;
    if (r < .012) a = ['godToggle'];
    else if (r < .02) a = ['undo'];
    else if (r < .026) a = ['give', pick(E('S.nPlayers')), cardKeys[pick(cardKeys.length)]];
    else if (r < .03) a = ['draw'];
    else if (r < .034) a = ['skip'];
    else if (god) { a = act() < .3 ? ['godToggle'] : ['cell', pick(E('S.cols')), pick(E('S.rows'))]; }
    else if (pend === 'dedoAmount') a = act() < .1 ? ['cancel'] : ['amount', 1 + pick(3)];
    else if (pend === 'pickHoled') a = act() < .15 ? ['cancel'] : ['pickHoled', E('S.balls.filter(b=>b.holed)[' + pick(E('S.balls.filter(b=>b.holed).length')) + '].player')];
    else if (pend === 'discard') a = act() < .6 && E('S.hands[pending.p].length') ? ['card', E('pending.p'), pick(E('S.hands[pending.p].length'))] : (act() < .85 ? ['confirmDiscard'] : ['cancel']);
    else if (pend) {
      if (act() < .07 && pend !== 'serpent') a = ['cancel'];
      else {
        const cells = JSON.parse(E('JSON.stringify((()=>{const a=[];for(let y=0;y<S.rows;y++)for(let x=0;x<S.cols;x++)if(selectableAt(x,y))a.push([x,y]);return a;})())'));
        if (cells.length && act() < .9) a = ['cell', ...cells[pick(cells.length)]];
        else a = ['cell', pick(E('S.cols')), pick(E('S.rows'))];
      }
    } else {
      const q = act();
      if (q < .1) a = ['end'];
      else if (q < .15) a = ['discard'];
      else if (q < .2 && E('S.jaque')) a = ['confirmWin'];
      else {
        const p = act() < .7 ? E('S.turn') : pick(E('S.nPlayers'));
        const hl = E(`S.hands[${p}].length`);
        a = hl ? ['card', p, pick(hl)] : ['end'];
      }
    }
    switch (a[0]) {
      case 'card': E(`onCardClick(${a[1]},${a[2]})`); break;
      case 'cell': E(`onCellClick(${a[1]},${a[2]})`); break;
      case 'amount': E(`dedoChoose(${a[1]})`); break;
      case 'pickHoled': E(`pickHoledBall(${a[1]})`); break;
      case 'cancel': E('cancelPending()'); break;
      case 'end': E('endTurn()'); break;
      case 'discard': E('startDiscard()'); break;
      case 'confirmDiscard': E('confirmDiscard()'); break;
      case 'confirmWin': E('confirmWin()'); break;
      case 'godToggle': E('dbgGod.onclick()'); break;
      case 'undo': E('dbgUndo.onclick()'); break;
      case 'give': E(`dbgGivePlayer.innerHTML = '<option value="${a[1]}">x</option>'; dbgGivePlayer.value='${a[1]}'; dbgGiveCard.value='${a[2]}'; dbgGiveBtn.onclick()`); break;
      case 'draw': E('dbgDraw.onclick()'); break;
      case 'skip': E('dbgSkip.onclick()'); break;
    }
    drain();
    steps.push({ a, h: state(), log: JSON.parse(E('JSON.stringify(__nl.splice(0))')) });
  }
  games.push({ seed, skip, setup, init: initHash, steps });
  w.close();
  if (g % 40 === 0) console.error(`${g}/${GAMES}`);
}
fs.writeFileSync(OUT, zlib.gzipSync(JSON.stringify(games)));
const n = games.reduce((a, g) => a + g.steps.length, 0);
console.log(`golden: ${games.length} partidas, ${n} acciones -> ${OUT.pathname}`);
