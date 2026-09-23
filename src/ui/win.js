// Overlay de victoria: mensaje, colores del ganador, resumen de la partida y botones según el modo.
import { app } from './app.js';
import { $ } from './dom.js';
import { pColor } from '../art.js';
import { loadProgress, saveProgress } from '../storage.js';
import { fxWinConfetti } from '../fx/effects.js';
import { sfx } from '../audio/sfx.js';
import { t, joinAnd } from '../i18n/index.js';
import { stats } from './controller.js';
import * as screens from './screens.js';

export const hideWin = () => $('winOverlay').classList.remove('visible');

export function showWin() {
  const S = app.game.S, mode = app.mode;
  const names = joinAnd(S.winners.map(i => t('player.name', { n: i + 1 })));
  let msg;
  if (mode === 'story' || mode === 'test') msg = t('win.levelDone');
  else if (mode === 'pve' && S.winners.length === 1 && S.winners[0] === S.human) msg = t('win.youWon');
  else if (mode === 'pve' && S.winners.includes(S.human)) msg = t('win.tieWithYou', { names });
  else msg = S.winners.length > 1 ? t('win.tie', { names }) : t('win.one', { names });
  $('winMsg').textContent = msg;

  // colores del ganador bien visibles: fichas de color + acento de la caja
  const box = $('winOverlay').querySelector('.box');
  if (mode === 'story' || mode === 'test') {
    $('winChips').innerHTML = '';
    box.style.borderColor = 'transparent';
    box.style.boxShadow = '';
  } else {
    $('winChips').innerHTML = S.winners.map(i =>
      `<span class="winChip" style="background:${pColor(i)}">${t('player.name', { n: i + 1 })}</span>`).join('');
    const wc = pColor(S.winners[0]);
    box.style.borderColor = wc;
    box.style.boxShadow = `0 0 0 6px ${wc}55, 0 14px 44px rgba(20,50,30,.45)`;
  }
  // resumen post-partida: estadísticas contadas durante la partida (decorativo)
  const st = stats;
  $('winStats').innerHTML = st ? [
    ['⛳', st.golpes, t('win.stats.strokes')],
    ['🕳️', st.hundidas, t('win.stats.sunk')],
    ['💥', st.colisiones, t('win.stats.collisions')],
    ['🌀', st.portales, t('win.stats.portals')],
    ['💨', st.caidas, t('win.stats.falls')],
  ].map(([i, v, l]) => `<div class="st"><b>${i} ${v}</b>${l}</div>`).join('') : '';

  // botones y progreso según el modo
  const btn = (act, label, danger) => `<button data-act="${act}"${danger ? ' class="danger"' : ''}>${label}</button>`;
  let btns;
  if (mode === 'story') {
    if (app.levelIndex !== null) {
      const prog = loadProgress();
      prog[app.levelIndex] = true;
      saveProgress(prog);
    }
    const hasNext = app.levelIndex !== null && !!screens.storyLevelAt(app.levelIndex + 1);
    btns = btn('replay', t('win.replay')) + (hasNext ? btn('next', t('win.next')) : '') + btn('levels', t('win.levels'), true);
  } else if (mode === 'test') {
    btns = btn('replay', t('win.retry')) + btn('editor', t('win.backToEditor'), true);
  } else if (mode === 'pve') {
    btns = btn('pve', t('win.newGame')) + btn('menu', t('win.menu'), true);
  } else {
    btns = btn('free', t('win.newGame'));
  }
  $('winBtns').innerHTML = btns;
  $('winOverlay').classList.add('visible');
  $('winBtns').querySelector('button')?.focus();
  fxWinConfetti(); // celebración (decorativo)
  sfx('win');
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
