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
import { clearSave } from './save.js';
import { humansOf, multiHuman, displayName } from './players.js';
import { recordEnd } from './records.js';

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
      ? `<span class="winRec${rec.newBest ? ' new' : ''}">${rec.newBest ? t('stats.newBest') + ' · ' : ''}${t('stats.turnsN', { n: turns })}` +
        (rec.best && !rec.newBest ? ` · ${t('stats.bestN', { n: rec.best.turns })}` : '') + `</span>` : '';
    box.style.borderColor = 'transparent';
    box.style.boxShadow = '';
  } else {
    $('winChips').innerHTML = S.winners.map(i =>
      `<span class="winChip" style="background:${pColor(i)}">${displayName(i)}</span>`).join('');
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

  // botones y progreso según el modo
  // kind: 'main' (acción principal, grande) | 'alt' (secundaria)
  const btn = (act, label, kind = 'alt') => `<button data-act="${act}" class="${kind === 'main' ? 'btn-primary btn-lg' : 'btn-light'}">${label}</button>`;
  let btns;
  if (mode === 'story') {
    if (app.levelIndex !== null) {
      const prog = loadProgress();
      prog[app.levelIndex] = true;
      saveProgress(prog);
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
