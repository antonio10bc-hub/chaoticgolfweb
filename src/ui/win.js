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
import { humansOf, multiHuman, displayName } from './players.js';
import { recordEnd, turnsLabel } from './records.js';
import { replayLevel, nextLevel, openStory, hasNextLevel } from './screen-story.js';
import { startPveMatch } from './screen-pve.js';
import { openModes, startDaily, rushHoleDone, startRushHole, startRush, challengeDone, startChallenge, modeStore, RUSH_KEY, streakLabel } from './screen-modes.js';
import { backToEditor, leaveToMenu, newFreeGame } from './screens.js';
import { keyMomentHTML } from './why-lost.js';

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
  else if (!multi && S.winners.length === 1 && S.winners[0] === me) msg = t(slot === 'challenge' ? 'win.challengeDone' : 'win.youWon');
  else if (!multi && S.winners.includes(me)) msg = t('win.tieWithYou', { names });
  else msg = S.winners.length > 1 ? t('win.tie', { names }) : t('win.one', { names });
  $('winMsg').textContent = msg;

  // estadísticas globales y récords del modo
  const kind = mode === 'pve' ? (slot === 'pve' ? (multi ? 'local' : 'pve') : slot) : slot;
  const rec = recordEnd(kind, { won: !lost, stats, levelIndex: app.levelIndex, date: app.run?.date });
  $('winIcon').innerHTML = `<svg class="i"><use href="#${lost ? 'i-flag' : 'i-trophy'}"/></svg>`;
  $('winOverlay').classList.toggle('lost', lost);

  // celebración según cómo se ha ganado (solo si gana quien juega aquí)
  const style = !lost ? app.winStyle?.[S.winners[0]] : null;
  const fx = STYLE_FX[style];
  $('winStyle').innerHTML = fx ? `<span class="wsChip ${style}"><svg class="i" aria-hidden="true"><use href="#${fx.icon}"/></svg>${esc(t('win.style.' + style))}</span>` : '';

  const box = $('winOverlay').querySelector('.box');
  const turns = (stats?.turnos || 0) + 1;
  let chips = '', btns = '';
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
      btns = (hasNextLevel() ? btn('next', t('win.next'), true) + btn('replay', t('win.replay')) : btn('replay', t('win.replay'), true)) + btn('levels', t('win.levels'));
      break;
    }
    case 'puzzle':
      chips = recChip(t('win.puzzleChip'), true);
      btns = (hasNextLevel() ? btn('next', t('win.nextPuzzle'), true) + btn('replay', t('win.replay')) : btn('replay', t('win.replay'), true)) + btn('levels', t('win.levels'));
      break;
    case 'daily':
      chips = recChip((rec.newBest ? t('win.dailyBest') + ' · ' : '') + turnsLabel(turns), rec.newBest) +
        (rec.best && !rec.newBest && rec.best.turns !== turns ? recChip(t('win.dailyToday', { turns: turnsLabel(rec.best.turns) })) : '') +
        recChip(streakLabel(rec.dailyStreak || 1));
      btns = btn('daily', t('modes.again'), true) + btn('menuHome', t('win.menu'));
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

  // ¿por qué he perdido? (con una persona contra la máquina)
  const why = lost && !multi ? keyMomentHTML() : '';
  $('winWhy').innerHTML = why ? `<button class="btn-text winWhyBtn" data-act="why" aria-expanded="false"><svg class="i" aria-hidden="true"><use href="#i-help"/></svg>${esc(t('why.button'))}</button><div class="whyPanel" hidden>${why}</div>` : '';

  // logros de fin de partida
  if (mode !== 'free' && mode !== 'test' && !lost) unlock('firstWin');
  if (slot === 'story' && (stats?.turnos || 0) === 0) unlock('holeInOne');
  if ((kind === 'pve' || kind === 'challenge') && !lost && S.aiLevel === 'hard') unlock('winHard');
  if (kind === 'pve' && rec.streak >= 3) unlock('streak3');
  if (kind === 'local') unlock('localGame');

  $('winBtns').innerHTML = btns;
  $('winOverlay').classList.add('visible');
  $('winBtns').querySelector('button')?.focus();
  fxWinConfetti(fx?.colors); // celebración (con los colores de cómo se ha ganado)
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
  $('winStats').innerHTML = ''; $('winSummary').innerHTML = ''; $('winWhy').innerHTML = '';
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
  $('winStats').innerHTML = ''; $('winSummary').innerHTML = ''; $('winWhy').innerHTML = '';
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
      case 'modes': hideWin(); openModes(); break;
      case 'daily': hideWin(); startDaily(); break;
      case 'rushNext': hideWin(); startRushHole(modeStore.get(RUSH_KEY)); break;
      case 'rushNew': hideWin(); startRush(true); break;
      case 'menuHome': leaveToMenu(); break;
      case 'challengeRetry': hideWin(); startChallenge(app.run?.id); break;
    }
  });
}
