// Overlay de victoria: mensaje, colores del ganador, resumen de la partida y botones según el modo.
import { app } from './app.js';
import { $, esc } from './dom.js';
import { CARDS } from '../content/cards/index.js';
import { unlock } from './achievements.js';
import { pColor } from '../art.js';
import { loadProgress, saveProgress } from '../storage.js';
import { fxWinConfetti } from '../fx/effects.js';
import { sfx } from '../audio/sfx.js';
import { t, joinAnd } from '../i18n/index.js';
import { stats } from './controller.js';
import * as screens from './screens.js';
import { clearSave } from './save.js';
import { humansOf, multiHuman, displayName } from './players.js';
const whoName = p => displayName(p);
import { recordEnd, turnsLabel } from './records.js';

export const hideWin = () => $('winOverlay').classList.remove('visible');

export function showWin() {
  clearSave(); // partida terminada: ya no hay nada que continuar
  const S = app.game.S, mode = app.mode;
  const names = joinAnd(S.winners.map(displayName));
  const multi = multiHuman(), me = S.human;
  let msg;
  if (mode === 'story' || mode === 'test') msg = t('win.levelDone');
  else if (mode === 'pve' && !multi && S.winners.length === 1 && S.winners[0] === me) msg = t('win.youWon');
  else if (mode === 'pve' && !multi && S.winners.includes(me)) msg = t('win.tieWithYou', { names });
  else msg = S.winners.length > 1 ? t('win.tie', { names }) : t('win.one', { names });
  $('winMsg').textContent = msg;
  // con varias personas nadie "pierde" frente a la pantalla salvo que ganen los bots
  const lost = mode === 'pve' && !humansOf().some(h => S.winners.includes(h));

  // estadísticas globales y récord del nivel
  const kind = mode === 'pve' ? (multi ? 'local' : 'pve') : mode;
  const rec = recordEnd(kind, { won: mode === 'story' || (mode === 'pve' && !lost), stats, levelIndex: app.levelIndex });
  $('winIcon').innerHTML = `<svg class="i"><use href="#${lost ? 'i-flag' : 'i-trophy'}"/></svg>`;
  $('winOverlay').classList.toggle('lost', lost);

  // colores del ganador bien visibles: fichas de color + acento de la caja
  const box = $('winOverlay').querySelector('.box');
  if (mode === 'story' || mode === 'test') {
    // turnos del nivel y, si lo hay, el récord personal
    const turns = (stats?.turnos || 0) + 1;
    $('winChips').innerHTML = mode === 'story'
      ? `<span class="winRec${rec.newBest ? ' new' : ''}">${rec.newBest ? t('stats.newBest') + ' · ' : ''}${turnsLabel(turns)}` +
        (rec.best && !rec.newBest && rec.best.turns !== turns ? ` · ${t('stats.bestN', { n: rec.best.turns })}` : '') + `</span>` : '';
    box.style.borderColor = 'transparent';
    box.style.boxShadow = '';
  } else {
    // partida rápida con una persona: racha de victorias y victoria más rápida
    const extra = kind === 'pve' && !lost
      ? (rec.streak > 1 ? `<span class="winRec new">${esc(t('stats.streakN', { n: rec.streak }))}</span>` : '') +
        (rec.newFastest ? `<span class="winRec new">${esc(t('stats.newFastest', { n: rec.fastest }))}</span>` : '')
      : '';
    $('winChips').innerHTML = S.winners.map(i =>
      `<span class="winChip" style="background:${pColor(i)}">${esc(displayName(i))}</span>`).join('') + extra;
    const wc = pColor(S.winners[0]);
    box.style.borderColor = wc;
    box.style.boxShadow = ''; // borde fino del color del ganador; la sombra la pone el CSS
  }
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

  // logros de fin de partida
  const humanWon = mode === 'story' || (mode === 'pve' && !lost);
  if (mode !== 'free' && mode !== 'test' && humanWon) unlock('firstWin');
  if (mode === 'story' && (stats?.turnos || 0) === 0) unlock('holeInOne');
  if (kind === 'pve' && !lost && S.aiLevel === 'hard') unlock('winHard');
  if (kind === 'pve' && rec.streak >= 3) unlock('streak3');
  if (kind === 'local') unlock('localGame');

  // botones y progreso según el modo
  // kind: 'main' (acción principal, grande) | 'alt' (secundaria)
  const btn = (act, label, kind = 'alt') => `<button data-act="${act}" class="${kind === 'main' ? 'btn-primary btn-lg' : 'btn-light'}">${label}</button>`;
  let btns;
  if (mode === 'story') {
    if (app.levelIndex !== null) {
      const prog = loadProgress();
      prog[app.levelIndex] = true;
      saveProgress(prog);
      if (app.storyLevels.length && app.storyLevels.every((_, i) => prog[i])) unlock('basicsAll');
    }
    const hasNext = app.levelIndex !== null && !!screens.storyLevelAt(app.levelIndex + 1);
    btns = (hasNext ? btn('next', t('win.next'), 'main') + btn('replay', t('win.replay')) : btn('replay', t('win.replay'), 'main')) + btn('levels', t('win.levels'));
  } else if (mode === 'test') {
    btns = btn('replay', t('win.retry'), 'main') + btn('editor', t('win.backToEditor'));
  } else if (mode === 'pve') {
    btns = btn('pve', t('win.newGame'), 'main') + btn('menu', t('win.menu'));
  } else {
    btns = btn('free', t('win.newGame'), 'main');
  }
  $('winBtns').innerHTML = btns;
  $('winOverlay').classList.add('visible');
  $('winBtns').querySelector('button')?.focus();
  fxWinConfetti(); // celebración (decorativo)
  sfx('win');
}

// resumen de la partida: la jugada más larga, quién te golpeó más y tu carta más usada
function summaryHTML(st, me) {
  if (!st) return '';
  // tú, con tu nombre si te lo has puesto
  const displayName = p => p === me && !app.game.S.playerNames?.[p] ? t('win.sum.you') : whoName(p);
  const tiles = [];
  if (st.longest?.n > 1 && st.longest.p != null) {
    tiles.push(['i-arrow-r', t('win.sum.longest'), t('win.sum.longestV', { n: st.longest.n, name: displayName(st.longest.p) })]);
  }
  const hits = Object.entries(st.hitsOnMe || {}).sort((a, b) => b[1] - a[1])[0];
  if (hits) tiles.push(['i-burst', t('win.sum.hitter'), t('win.sum.hitterV', { name: displayName(+hits[0]), n: hits[1] })]);
  const card = Object.entries(st.cardsUsed || {}).sort((a, b) => b[1] - a[1])[0];
  if (card && CARDS[card[0]]) tiles.push(['i-hand', t('win.sum.card'), t('win.sum.cardV', { card: CARDS[card[0]].short || CARDS[card[0]].name, n: card[1] })]);
  return tiles.map(([i, h, v]) => `<div class="sumTile"><svg class="i" aria-hidden="true"><use href="#${i}"/></svg>` +
    `<span><small>${esc(h)}</small><b>${esc(v)}</b></span></div>`).join('');
}

export function bindWin() {
  $('winBtns').addEventListener('click', e => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    switch (b.dataset.act) {
      case 'replay': screens.replayLevel(); break;
      case 'next': screens.nextLevel(); break;
      case 'levels': screens.openStory(); break;
      case 'editor': screens.backToEditor(); break;
      case 'pve': screens.startPveMatch(); break;
      case 'menu': screens.leaveToMenu(); break;
      case 'free': screens.newFreeGame(); break;
    }
  });
}
