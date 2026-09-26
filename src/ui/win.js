// Final de partida (o de hoyo): mensaje, celebración según cómo se ha ganado, colores del
// ganador, resumen, récords del modo y botones de lo que se puede hacer después.
// También el aviso de puzle fallado y el panel de "¿Por qué he perdido?".
import { app } from './app.js';
import { $, esc } from './dom.js';
import { CARDS } from '../content/cards/index.js';
import { unlock } from './achievements.js';
import { pColor } from '../art.js';
import { loadProgress, saveProgress } from '../storage.js';
import { fxWinConfetti } from '../fx/effects.js';
import { sfx, musicMood } from '../audio/sfx.js';
import { t, joinAnd } from '../i18n/index.js';
import { stats } from './controller.js';
import { clearSave, slotOf } from './save.js';
import { humansOf, multiHuman, displayName, isBot } from './players.js';
import { recordEnd, turnsLabel, claimStreakGoal, nextStreakGoal } from './records.js';
import { replayLevel, nextLevel, openStory, hasNextLevel, levelFromModes } from './screen-story.js';
import { startPveMatch } from './screen-pve.js';
import { openModes, startDaily, rushHoleDone, startRushHole, startRush, challengeDone, startChallenge, startWeekly, modeStore, RUSH_KEY, tabOfGame, streakLabel, dailyShareText } from './screen-modes.js';
import { backToEditor, leaveToMenu, newFreeGame } from './screens.js';
import { keyMomentHTML } from './why-lost.js';
import { openShareDialog } from './share-play.js';

export const hideWin = () => $('winOverlay').classList.remove('visible');

// cómo se ha ganado → celebración propia (la detecta el controlador al embocar)
const STYLE_FX = {
  portal: { icon: 'i-spiral', colors: ['#2D4F7C', '#7FA0CF', '#A9C3E6', '#F1F1DC'], sound: 'portal' },
  chain: { icon: 'i-burst', colors: ['#ffffff', '#ffe9a8', '#ffd06b', '#E8873A'], sound: 'knock' },
  swallow: { icon: 'i-hole', colors: ['#a98a5c', '#8DB05F', '#242424', '#F1F1DC'], sound: 'holeMove' },
  steal: { icon: 'i-hand', colors: ['#D9603A', '#E8873A', '#F1F1DC', '#242424'], sound: 'rewind' },
  long: { icon: 'i-arrow-r', colors: ['#8DB05F', '#A3C173', '#F1F1DC', '#E8873A'], sound: 'whoosh' },
  zigzag: { icon: 'i-hand', colors: ['#9b6dd6', '#f27bb4', '#F1F1DC', '#E8873A'], sound: 'select' },
  first: { icon: 'i-flag', colors: ['#E8873A', '#f2b705', '#F1F1DC', '#8DB05F'], sound: 'sink' },
};

const FIRE_C = ['#E8873A', '#F5A33A', '#FFD23F', '#D9603A', '#F1F1DC'];

export function showWin() {
  clearSave(); // partida terminada: ya no hay nada que continuar
  const S = app.game.S, mode = app.mode, slot = slotOf();
  const names = joinAnd(S.winners.map(displayName));
  const multi = multiHuman(), me = S.human;
  const solo = mode === 'story' || mode === 'test';
  // con varias personas nadie "pierde" frente a la pantalla salvo que ganen los bots
  const lost = mode === 'pve' && !humansOf().some(h => S.winners.includes(h));
  let msg;
  if (solo) msg = t({ puzzle: 'win.puzzleDone', daily: 'win.dailyDone', rush: 'win.rushHole' }[app.variant] || 'win.levelDone', { n: (app.run?.hole ?? 0) + 1 });
  else if (!multi && S.winners.length === 1 && S.winners[0] === me) msg = t({ challenge: 'win.challengeDone', daily: 'win.dailyDone', weekly: 'win.weeklyDone' }[slot] || 'win.youWon');
  else if (!multi && S.winners.includes(me)) msg = t('win.tieWithYou', { names });
  else msg = S.winners.length > 1 ? t('win.tie', { names }) : t('win.one', { names });
  $('winMsg').textContent = msg;

  // estadísticas globales y récords del modo
  const kind = mode === 'pve' ? (slot === 'pve' ? (multi ? 'local' : 'pve') : slot) : slot;
  // historial contra cada rival (con una persona contra la máquina)
  const rivals = mode === 'pve' && !multi ? [...Array(S.nPlayers).keys()].filter(p => isBot(p) && S.personas?.[p])
    .map(p => ({ id: S.personas[p], winner: S.winners.includes(p) })) : [];
  const deck = slot === 'pve' ? app.lastPveCfg?.deck || 'classic' : null; // partida rápida: estadísticas de su baraja
  const rec = recordEnd(kind, { won: !lost, stats, levelIndex: app.levelIndex, date: app.run?.date, week: app.run?.week, rivals, deck, challenge: slot === 'challenge' ? app.run?.id : null });
  $('winIcon').innerHTML = `<svg class="i"><use href="#${lost ? 'i-flag' : 'i-trophy'}"/></svg>`;
  $('winOverlay').classList.toggle('lost', lost);

  // celebración según cómo se ha ganado (solo si gana quien juega aquí)
  const style = !lost ? app.winStyle?.[S.winners[0]] : null;
  const fx = STYLE_FX[style];
  $('winStyle').innerHTML = fx ? `<span class="wsChip ${style}"><svg class="i" aria-hidden="true"><use href="#${fx.icon}"/></svg>${esc(t('win.style.' + style))}</span>` : '';

  const box = $('winOverlay').querySelector('.box');
  const turns = ((slot === 'daily' || slot === 'weekly') && mode === 'pve' ? stats?.misTurnos || 0 : stats?.turnos || 0) + 1;
  let chips = '', btns = '', streakGoal = false;
  const btn = (act, label, main = false) => `<button data-act="${act}" class="${main ? 'btn-primary btn-lg' : 'btn-light'}">${esc(label)}</button>`;
  const recChip = (txt, isNew = false) => `<span class="winRec${isNew ? ' new' : ''}">${esc(txt)}</span>`;

  switch (slot) {
    case 'story': {
      chips = recChip((rec.newBest ? t('stats.newBest') + ' · ' : '') + turnsLabel(turns) +
        (rec.best && !rec.newBest && rec.best.turns !== turns ? ` · ${t('stats.bestN', { n: rec.best.turns })}` : ''), rec.newBest);
      if (app.levelIndex !== null) {
        const prog = loadProgress();
        prog[app.levelIndex] = true;
        saveProgress(prog);
        if (app.storyLevels.length && app.storyLevels.every((_, i) => prog[i])) unlock('basicsAll');
      }
      btns = (hasNextLevel() ? btn('next', t('win.next'), true) + btn('replay', t('win.replay')) : btn('replay', t('win.replay'), true)) +
        (levelFromModes() ? btn('modes', t('win.modes')) : btn('levels', t('win.levels')));
      break;
    }
    case 'puzzle':
      chips = recChip(t('win.puzzleChip'), true);
      btns = (hasNextLevel() ? btn('next', t('win.nextPuzzle'), true) + btn('replay', t('win.replay')) : btn('replay', t('win.replay'), true)) + btn('modes', t('win.modes'));
      break;
    case 'daily': {
      // la racha, con su llama: al llegar a una meta (3, 7, 15, 30…) se celebra una vez ese día; si no, la próxima meta
      const n = rec.dailyStreak || 1;
      streakGoal = !!app.run?.date && claimStreakGoal(app.run.date);
      const flame = '<svg class="i" aria-hidden="true"><use href="#i-flame"/></svg>';
      const streakChip = streakGoal ? `<span class="winRec new streakGoal">${flame}${esc(t('win.streakGoal', { n }))}</span>`
        : `<span class="winRec streak">${flame}${esc(t('win.streakChip', { streak: streakLabel(n), m: nextStreakGoal(n) }))}</span>`;
      chips = (lost ? '' : recChip((rec.newBest ? t('win.dailyBest') + ' · ' : '') + turnsLabel(turns), rec.newBest) +
        (rec.best && !rec.newBest && rec.best.turns !== turns ? recChip(t('win.dailyToday', { turns: turnsLabel(rec.best.turns) })) : '')) + streakChip;
      btns = btn('daily', lost ? t('win.retry') : t('modes.again'), true) + btn('menuHome', t('win.menu'));
      if (mode === 'pve') app.shareText = dailyShareText({ won: !lost, turns, st: stats, S, date: app.run.date });
      break;
    }
    case 'weekly':
      chips = lost ? '' : recChip((rec.newBest ? t('win.weeklyBest') + ' · ' : '') + turnsLabel(turns), rec.newBest) +
        (rec.best && !rec.newBest && rec.best.turns !== turns ? recChip(t('win.weeklyToday', { turns: turnsLabel(rec.best.turns) })) : '');
      btns = btn('weekly', lost ? t('win.retry') : t('modes.again'), true) + btn('modes', t('win.modes'));
      break;
    case 'rush': {
      const r = rushHoleDone();
      chips = recChip(t('win.rushScore', { base: r.sc.base, bonus: r.sc.bonus }), true) + recChip(t('win.rushTotal', { n: r.sum }));
      if (r.last) {
        $('winMsg').textContent = t('win.rushDone', { n: r.sum });
        chips += r.newBest ? recChip(t('stats.newBest'), true) : recChip(t('modes.rush.best', { n: r.best }));
        btns = btn('rushNew', t('modes.again'), true) + btn('modes', t('win.modes'));
      } else btns = btn('rushNext', t('win.nextHole', { n: app.run.hole + 2 }), true) + btn('modes', t('win.modes'));
      break;
    }
    case 'challenge':
      challengeDone(!lost);
      chips = !lost ? recChip(t('win.challengeChip'), true) : '';
      btns = btn('challengeRetry', lost ? t('win.retry') : t('win.replay'), lost) + btn('modes', t('win.modes'), !lost);
      break;
    case 'test':
      btns = btn('replay', t('win.retry'), true) + btn('editor', t('win.backToEditor'));
      break;
    case 'pve':
      // partida rápida con una persona: racha de victorias y victoria más rápida
      chips = kind === 'pve' && !lost
        ? (rec.streak > 1 ? recChip(t('stats.streakN', { n: rec.streak }), true) : '') + (rec.newFastest ? recChip(t('stats.newFastest', { n: rec.fastest }), true) : '')
        : '';
      btns = btn('pve', t('win.newGame'), true) + btn('menu', t('win.menu'));
      break;
    default:
      btns = btn('free', t('win.newGame'), true);
  }
  // fichas con el color del ganador en las partidas con varios jugadores
  const winnerChips = !solo ? S.winners.map(i => `<span class="winChip" style="background:${pColor(i)}">${esc(displayName(i))}</span>`).join('') : '';
  $('winChips').innerHTML = winnerChips + chips;
  box.style.borderColor = solo ? 'transparent' : pColor(S.winners[0]);
  box.style.boxShadow = '';

  // resumen post-partida: estadísticas contadas durante la partida (decorativo)
  const st = stats;
  $('winStats').innerHTML = st ? [
    ['i-club', st.golpes, t('win.stats.strokes')],
    ['i-hole', st.hundidas, t('win.stats.sunk')],
    ['i-burst', st.colisiones, t('win.stats.collisions')],
    ['i-spiral', st.portales, t('win.stats.portals')],
    ['i-out', st.caidas, t('win.stats.falls')],
  ].map(([i, v, l]) => `<div class="st"><svg class="i" aria-hidden="true"><use href="#${i}"/></svg><b>${v}</b>${l}</div>`).join('') : '';
  $('winSummary').innerHTML = summaryHTML(st, mode === 'pve' ? (multi ? null : S.human) : 0);
  $('winRoute').innerHTML = routeHTML(st, S, mode === 'pve' ? (multi ? null : S.human) : mode === 'story' || mode === 'test' ? 0 : null);

  // ¿por qué he perdido? (con una persona contra la máquina)
  const why = lost && !multi ? keyMomentHTML() : '';
  $('winWhy').innerHTML = why ? `<button class="btn-text winWhyBtn" data-act="why" aria-expanded="false"><svg class="i" aria-hidden="true"><use href="#i-help"/></svg>${esc(t('why.button'))}</button><div class="whyPanel" hidden>${why}</div>` : '';

  // logros de fin de partida
  if (mode !== 'free' && mode !== 'test' && !lost) unlock('firstWin');
  if (slot === 'story' && (stats?.turnos || 0) === 0) unlock('holeInOne');
  if (['pve', 'challenge', 'daily', 'weekly'].includes(kind) && !lost && S.aiLevel === 'hard') unlock('winHard');
  if (kind === 'pve' && rec.streak >= 3) unlock('streak3');
  if (kind === 'local') unlock('localGame');

  // compartir la jugada final (todos los modos): imagen con el tablero y el recorrido; en el reto
  // diario, también el resultado en texto
  app.shareInfo = mode !== 'free' && app.finalPlay ? { title: $('winMsg').textContent, meta: shareMeta(slot, turns, lost),
    text: slot === 'daily' && mode === 'pve' ? app.shareText : null } : null;
  if (slot !== 'daily') app.shareText = null;
  if (app.shareInfo) btns += `<button data-act="share" class="btn-light winShare"><svg class="i" aria-hidden="true"><use href="#i-share"/></svg>${esc(t('share.button'))}</button>`;
  $('winBtns').innerHTML = btns;
  $('winOverlay').classList.add('visible');
  $('winBtns').querySelector('button')?.focus();
  fxWinConfetti(fx?.colors); // celebración (con los colores de cómo se ha ganado)
  if (streakGoal) setTimeout(() => fxWinConfetti(FIRE_C), 450); // meta de la racha: llamarada de confeti
  if (fx) setTimeout(() => sfx(fx.sound), 250);
  sfx(lost ? 'lose' : 'win');
  musicMood(lost ? 'calm' : 'win');
}

// contrarreloj: se ha acabado el tiempo (la serie termina con lo sumado)
export function showRushTimeUp({ sum, newBest, hole, best }) {
  $('winMsg').textContent = t('win.rushTimeUp');
  $('winIcon').innerHTML = `<svg class="i"><use href="#i-timer"/></svg>`;
  $('winOverlay').classList.add('lost');
  $('winStyle').innerHTML = '';
  $('winChips').innerHTML = `<span class="winRec">${esc(t('win.rushReached', { n: hole }))}</span>` +
    `<span class="winRec${newBest ? ' new' : ''}">${esc((newBest ? t('stats.newBest') + ' · ' : '') + t('win.rushTotal', { n: sum }))}</span>` +
    (!newBest ? `<span class="winRec">${esc(t('modes.rush.best', { n: best }))}</span>` : '');
  $('winStats').innerHTML = ''; $('winSummary').innerHTML = ''; $('winRoute').innerHTML = ''; $('winWhy').innerHTML = '';
  $('winOverlay').querySelector('.box').style.borderColor = 'transparent';
  $('winBtns').innerHTML = `<button data-act="rushNew" class="btn-primary btn-lg">${esc(t('modes.again'))}</button><button data-act="modes" class="btn-light">${esc(t('win.modes'))}</button>`;
  $('winOverlay').classList.add('visible');
  $('winBtns').querySelector('button')?.focus();
  sfx('lose');
  musicMood('calm');
}

// puzle: se ha terminado el turno sin embocar
export function showPuzzleFail() {
  clearSave('puzzle');
  $('winMsg').textContent = t('win.puzzleFail');
  $('winIcon').innerHTML = `<svg class="i"><use href="#i-reset"/></svg>`;
  $('winOverlay').classList.add('lost');
  $('winStyle').innerHTML = '';
  $('winChips').innerHTML = `<span class="winRec">${esc(t('win.puzzleFailSub'))}</span>`;
  $('winStats').innerHTML = ''; $('winSummary').innerHTML = ''; $('winRoute').innerHTML = ''; $('winWhy').innerHTML = '';
  $('winOverlay').querySelector('.box').style.borderColor = 'transparent';
  $('winBtns').innerHTML = `<button data-act="replay" class="btn-primary btn-lg">${esc(t('win.retry'))}</button><button data-act="levels" class="btn-light">${esc(t('win.levels'))}</button>`;
  $('winOverlay').classList.add('visible');
  $('winBtns').querySelector('button')?.focus();
  sfx('lose');
}

// resumen de la partida: la jugada más larga, quién te golpeó más y tu carta más usada
function summaryHTML(st, me) {
  if (!st) return '';
  // tú, con tu nombre si te lo has puesto
  const nm = p => p === me && !app.game.S.playerNames?.[p] ? t('win.sum.you') : displayName(p);
  const tiles = [];
  if (st.longest?.n > 1 && st.longest.p != null) tiles.push(['i-arrow-r', t('win.sum.longest'), t('win.sum.longestV', { n: st.longest.n, name: nm(st.longest.p) })]);
  const hits = Object.entries(st.hitsOnMe || {}).sort((a, b) => b[1] - a[1])[0];
  if (hits) tiles.push(['i-burst', t('win.sum.hitter'), t('win.sum.hitterV', { name: nm(+hits[0]), n: hits[1] })]);
  const card = Object.entries(st.cardsUsed || {}).sort((a, b) => b[1] - a[1])[0];
  if (card && CARDS[card[0]]) tiles.push(['i-hand', t('win.sum.card'), t('win.sum.cardV', { card: CARDS[card[0]].short || CARDS[card[0]].name, n: card[1] })]);
  if (st.caddie) tiles.push(['i-bulb', t('win.sum.caddie'), t('win.sum.caddieV', { n: st.caddie })]);
  if (st.undos) tiles.push(['i-rewind', t('win.sum.undos'), t('win.sum.undosV', { n: st.undos })]);
  return tiles.map(([i, h, v]) => `<div class="sumTile"><svg class="i" aria-hidden="true"><use href="#${i}"/></svg>` +
    `<span><small>${esc(h)}</small><b>${esc(v)}</b></span></div>`).join('');
}

// mini-mapa del recorrido de tu pelota: el camino (con saltos de portal discontinuos), la salida,
// los choques, las caídas por el borde y dónde embocó; losetas y hoyo tal como acabó la partida
const U = 20;
function routeHTML(st, S, me) {
  const r = st?.route;
  if (me == null || !r || r.filter(p => p[2] === 'm').length < 2) return '';
  const W = S.cols * U, H = S.rows * U, c = v => v * U + U / 2;
  const clampX = x => Math.max(1, Math.min(W - 1, x)), clampY = y => Math.max(1, Math.min(H - 1, y));
  const col = pColor(me);
  let segs = [], cur = [], jumps = [], marks = [];
  const flush = () => { if (cur.length > 1) segs.push(cur); cur = []; };
  let last = null;
  for (const [x, y, k] of r) {
    const px = c(x), py = c(y);
    if (k === 'o') { cur = [[px, py]]; marks.push(['start', px, py]); }
    else if (k === 'm') cur.push([px, py]);
    else if (k === 't') { flush(); if (last) jumps.push([last[0], last[1], px, py]); cur = [[px, py]]; marks.push(['portal', px, py]); }
    else if (k === 'f') { const ex = clampX(px), ey = clampY(py); cur.push([ex, ey]); flush(); marks.push(['fall', ex, ey]); }
    else if (k === 'a') { flush(); cur = [[px, py]]; marks.push(['back', px, py]); }
    else if (k === 'h' || k === 'H') marks.push([k === 'h' ? 'hit' : 'hitBy', px, py]);
    else if (k === 's') marks.push(['sink', px, py]);
    if (k !== 'h' && k !== 'H' && k !== 's') last = k === 'f' ? null : [px, py];
  }
  flush();
  const grid = [];
  for (let x = 1; x < S.cols; x++) grid.push(`M${x * U} 0V${H}`);
  for (let y = 1; y < S.rows; y++) grid.push(`M0 ${y * U}H${W}`);
  const PT = { 2: ['#5B3A8C', '#CDB8EC'], 3: ['#1E6B63', '#A6DDD5'] }; // colores de las parejas de Atajos
  const tiles = S.tiles.map(tl => ['block', 'corner', 'tunnel', 'launcher'].includes(tl.type)
    ? `<rect x="${tl.x * U + 2}" y="${tl.y * U + 2}" width="${U - 4}" height="${U - 4}" rx="${tl.type === 'launcher' ? U / 2 : 3}" fill="#A8743F" stroke="#7A5230" stroke-width="1"/>`
    : tl.type === 'river' || tl.type === 'lake'
    ? `<rect x="${tl.x * U + 1}" y="${tl.y * U + 1}" width="${U - 2}" height="${U - 2}" rx="${tl.type === 'lake' ? 6 : 2}" fill="${tl.type === 'lake' ? '#2E7E8C' : '#5BB6D6'}"/>`
    : tl.type === 'portal'
    ? `<circle cx="${c(tl.x)}" cy="${c(tl.y)}" r="${U * .36}" fill="${(PT[tl.pair] || ['#2D4F7C'])[0]}"/><circle cx="${c(tl.x)}" cy="${c(tl.y)}" r="${U * .16}" fill="${(PT[tl.pair] || [0, '#A9C3E6'])[1]}"/>`
    : `<ellipse cx="${c(tl.x)}" cy="${c(tl.y)}" rx="${U * .4}" ry="${U * .3}" fill="#ECE6CC"/>`).join('');
  const hole = `<circle cx="${c(S.hole.x)}" cy="${c(S.hole.y)}" r="${U * .3}" fill="#242424"/>`;
  const line = pts => `<polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="${col}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
  const jump = ([x1, y1, x2, y2]) => `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="#A9C3E6" stroke-width="2" stroke-dasharray="3 4" stroke-linecap="round"/>`;
  const mark = ([k, x, y]) => ({
    start: `<circle cx="${x}" cy="${y}" r="5" fill="#F1F1DC" stroke="${col}" stroke-width="2.5"/>`,
    back: `<circle cx="${x}" cy="${y}" r="3.5" fill="${col}"/>`,
    portal: '',
    fall: `<path d="M${x - 5} ${y - 5}L${x + 5} ${y + 5}M${x + 5} ${y - 5}L${x - 5} ${y + 5}" stroke="#F1F1DC" stroke-width="5" stroke-linecap="round"/><path d="M${x - 5} ${y - 5}L${x + 5} ${y + 5}M${x + 5} ${y - 5}L${x - 5} ${y + 5}" stroke="#D9603A" stroke-width="2.6" stroke-linecap="round"/>`,
    hit: `<path d="${burst(x, y, 7, 3.2)}" fill="#F2B705" stroke="#F1F1DC" stroke-width="1.2"/>`,
    hitBy: `<path d="${burst(x, y, 7, 3.2)}" fill="#F1F1DC" stroke="#242424" stroke-width="1.4"/>`,
    sink: `<circle cx="${x}" cy="${y}" r="6.5" fill="none" stroke="#F1F1DC" stroke-width="2.4"/>`,
  }[k] || '');
  // leyenda con los mismos símbolos que el mapa (el portal: el salto discontinuo)
  const kinds = new Set(marks.map(m => m[0]));
  const sw = inner => `<svg class="rtSw" viewBox="0 0 20 20" aria-hidden="true"><rect width="20" height="20" rx="5" fill="#4F8A4B"/>${inner}</svg>`;
  const swatch = k => k === 'portal' ? sw(`<path d="M3 15L17 5" stroke="#A9C3E6" stroke-width="2" stroke-dasharray="3 3" stroke-linecap="round"/>`)
    : k === 'sink' ? sw(`<circle cx="10" cy="10" r="4" fill="#242424"/>${mark([k, 10, 10])}`) : sw(mark([k, 10, 10]));
  const legend = ['start', 'hit', 'hitBy', 'portal', 'fall', 'sink']
    .filter(k => kinds.has(k)).map(k => `<span class="rtLg">${swatch(k)}${esc(t('win.route.' + k))}</span>`).join('');
  return `<h4>${esc(t('win.route.title'))}</h4><div class="rtWrap">` +
    `<svg class="rtMap" viewBox="-4 -4 ${W + 8} ${H + 8}" role="img" aria-label="${esc(t('win.route.aria', { n: r.filter(p => p[2] === 'm').length }))}">` +
    `<rect x="-4" y="-4" width="${W + 8}" height="${H + 8}" rx="8" fill="#F1F1DC"/><rect width="${W}" height="${H}" rx="4" fill="#4F8A4B"/>` +
    `<path d="${grid.join('')}" stroke="rgba(241,241,220,.13)" stroke-width="1"/>` +
    tiles + hole + jumps.map(jump).join('') + segs.map(line).join('') + marks.map(mark).join('') +
    `</svg><div class="rtLegend">${legend}</div></div>`;
}
// estrella de choque (n puntas)
function burst(x, y, R, r, n = 8) {
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const a = Math.PI * i / n - Math.PI / 2, rr = i % 2 ? r : R;
    d += (i ? 'L' : 'M') + (x + rr * Math.cos(a)).toFixed(1) + ' ' + (y + rr * Math.sin(a)).toFixed(1);
  }
  return d + 'Z';
}

// línea de contexto de la imagen: modo y turnos
function shareMeta(slot, turns, lost) {
  const modeName = { story: t('story.title'), puzzle: t('story.puzzlesH'), daily: t('modes.daily.title'), rush: t('modes.rush.title'),
    challenge: app.run?.id ? t('challenges.' + app.run.id + '.name') : t('modes.challenge.title'), weekly: t('modes.weekly.title'),
    pve: multiHuman() ? t('pve.localTitle') : t('decks.' + (app.lastPveCfg?.deck || 'classic') + '.name'), test: t('menu.editorTitle') }[slot] || '';
  return [modeName, lost ? '' : turnsLabel(turns)].filter(Boolean).join(' · ');
}

export function bindWin() {
  $('winOverlay').addEventListener('click', e => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'why') { // despliega el momento clave
      const p = $('winWhy').querySelector('.whyPanel');
      p.hidden = !p.hidden; b.setAttribute('aria-expanded', !p.hidden);
      return;
    }
    switch (act) {
      case 'replay': replayLevel(); break;
      case 'next': nextLevel(); break;
      case 'levels': openStory(); break;
      case 'editor': backToEditor(); break;
      case 'pve': startPveMatch(); break;
      case 'menu': leaveToMenu(); break;
      case 'free': newFreeGame(); break;
      case 'modes': hideWin(); openModes(tabOfGame()); break;
      case 'daily': hideWin(); startDaily(); break;
      case 'rushNext': hideWin(); startRushHole(modeStore.get(RUSH_KEY)); break;
      case 'rushNew': hideWin(); startRush(true); break;
      case 'menuHome': leaveToMenu(); break;
      case 'challengeRetry': hideWin(); startChallenge(app.run?.id); break;
      case 'weekly': hideWin(); startWeekly(); break;
      case 'share': if (app.shareInfo) openShareDialog(app.shareInfo); break;
    }
  });
}
