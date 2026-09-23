// Panel de debug / testing tool: ajustes de partida, mazo, semilla y herramientas en vivo.
import { app } from './app.js';
import { $, esc } from './dom.js';
import { CARDS } from '../content/cards/index.js';
import { ART, ART_FILES } from '../art.js';
import { debugAction, render } from './controller.js';
import { newFreeGame } from './screens.js';
import { fxPerfWatch } from '../fx/effects.js';
import { t } from '../i18n/index.js';

export function buildDebugPanel() {
  $('dbgDeck').innerHTML = Object.entries(CARDS).map(([k, def]) =>
    `<div class="drow ${def.color}"><label for="cnt_${k}">${esc(def.name)}</label>` +
    `<input type="number" id="cnt_${k}" min="0" max="30" value="${def.copies}"></div>`).join('');
  $('dbgGiveCard').innerHTML = Object.entries(CARDS).map(([k, d]) => `<option value="${k}">${esc(d.name)}</option>`).join('');
  refreshGivePlayer();
}

export function refreshGivePlayer() {
  const n = app.game ? app.game.S.nPlayers : 2;
  $('dbgGivePlayer').innerHTML = Array.from({ length: n }, (_, i) => `<option value="${i}">${t('player.name', { n: i + 1 })}</option>`).join('');
}

const num = (id, def) => parseInt($(id).value) || def;
export function readDebugSettings() {
  const counts = {};
  for (const k of Object.keys(CARDS)) {
    const el = $('cnt_' + k);
    counts[k] = el ? Math.max(0, parseInt(el.value) || 0) : CARDS[k].copies;
  }
  const seedTxt = $('dbgSeed').value.trim();
  return {
    players: Math.min(6, Math.max(1, num('dbgPlayers', 2))),
    par:     Math.min(5, Math.max(1, num('dbgPar', 3))),
    cols:    Math.min(25, Math.max(3, num('dbgCols', 9))),
    rows:    Math.min(25, Math.max(5, num('dbgRows', 11))),
    counts,
    seed: seedTxt && /^\d+$/.test(seedTxt) ? (+seedTxt >>> 0) : undefined,
  };
}

export function renderDebugState() {
  const S = app.game.S;
  if (!$('debugPanel').classList.contains('visible')) return; // panel cerrado: no hace falta pintarlo
  const counts = {};
  for (const k of S.deck) counts[k] = (counts[k] || 0) + 1;
  const artInfo = t('debug.art', { n: Object.keys(ART).length, total: Object.keys(ART_FILES).length });
  const seed = app.game.seed != null ? t('debug.seed', { seed: app.game.seed }) : '';
  $('dbgState').innerHTML = `${seed}<br>${artInfo}<br><br>` +
    (Object.entries(counts).map(([k, n]) => `${esc(CARDS[k].name)} x${n}`).join(' · ') || t('debug.empty'));
}

export function updateGodHint() {
  const g = app.game;
  $('godHint').textContent = g.godPick ? t('debug.godPicked', { kind: g.godPick.kind }) : t('debug.godHint');
}

export function bindDebug() {
  $('debugBtn').addEventListener('click', () => {
    const open = $('debugPanel').classList.toggle('visible');
    $('debugBtn').setAttribute('aria-expanded', open);
    if (open) { fxPerfWatch(); if (app.game) renderDebugState(); }
  });
  $('dbgReset').addEventListener('click', () => newFreeGame());
  $('dbgSeedUse').addEventListener('click', () => { if (app.game?.seed != null) $('dbgSeed').value = app.game.seed; });
  $('dbgUndo').addEventListener('click', () => debugAction(g => g.undo()));
  $('dbgGiveBtn').addEventListener('click', () => debugAction(g => g.giveCard(+$('dbgGivePlayer').value, $('dbgGiveCard').value)));
  $('dbgDraw').addEventListener('click', () => debugAction(g => g.debugDraw()));
  $('dbgSkip').addEventListener('click', () => debugAction(g => g.skipTurn()));
  $('dbgGod').addEventListener('click', () => {
    const g = app.game;
    if (!g) return;
    g.toggleGod();
    $('dbgGod').style.background = g.godMode ? '#c99b2e' : '';
    $('dbgGod').setAttribute('aria-pressed', g.godMode);
    $('godHint').style.display = g.godMode ? 'block' : 'none';
    updateGodHint();
    render();
  });
}
