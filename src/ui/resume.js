// Continuar una partida guardada: los botones naranjas de cada pantalla (Lo básico, Partida
// rápida, Modos, reto diario), con un subtítulo que dice qué es.
import { app } from './app.js';
import { Game } from '../engine/game.js';
import { startGame } from './controller.js';
import { aiStart } from './ai-driver.js';
import { updateMenuBtn, toast } from './hud.js';
import { t } from '../i18n/index.js';
import { loadSave, latestSave, applySaveExtras, VS_SLOTS } from './save.js';
import { humansOf } from './players.js';
import { showScreen, levelName } from './screens.js';

// subtítulo de un guardado: "Lo básico · Nivel 3" / "Partida rápida · 2 bots" / "Contrarreloj · hoyo 2 de 5"…
export function saveSub(d) {
  const slot = d.slot || d.mode, r = d.run || {};
  switch (slot) {
    case 'story': return `${t('story.title')} · ${t('story.level', { n: (d.levelIndex ?? 0) + 1 })}`;
    case 'puzzle': return `${t('story.puzzlesH')} · ${levelName(d.level) || t('story.level', { n: (d.levelIndex ?? 0) + 1 })}`;
    case 'daily': return t('modes.daily.title');
    case 'rush': return `${t('modes.rush.title')} · ${t('modes.holeN', { n: (r.hole ?? 0) + 1, total: r.total || 5 })}`;
    case 'challenge': return `${t('modes.challenge.title')} · ${t('challenges.' + r.id + '.name')}`;
    case 'weekly': return `${t('modes.weekly.title')} · ${t('weekly.' + r.id + '.name')}`;
  }
  const S = d.game.S, nh = (S.humans || [S.human]).length, nb = S.nPlayers - nh;
  if (nh > 1) return `${t('pve.localTitle')} · ${t('pve.peopleN', { n: nh })}${nb ? ' + ' + t(nb > 1 ? 'pve.botsN' : 'pve.botN', { n: nb }) : ''}`;
  return `${t('pve.title')} · ${t(nb > 1 ? 'pve.botsN' : 'pve.botN', { n: nb })}`;
}

// sin ranura: la más reciente
export function resumeGame(slot) {
  const d = typeof slot === 'string' ? loadSave(slot) : latestSave();
  if (!d) return;
  startGame(Game.restore(d.game), d.mode, { levelIndex: d.levelIndex, level: d.level, variant: d.variant || null, run: d.run || null });
  applySaveExtras(d);
  // multijugador local: por privacidad, al volver se pasa el dispositivo antes de enseñar manos
  app.viewer = humansOf().length > 1 ? null : d.game.S.human;
  updateMenuBtn();
  showScreen('game');
  toast(t('save.restored'));
  if (d.mode === 'pve' && VS_SLOTS.includes(d.slot || d.mode)) aiStart(700); // (retos diarios antiguos: en solitario)
}
