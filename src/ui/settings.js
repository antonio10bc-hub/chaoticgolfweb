// Pantalla de Ajustes (sonido, idioma, velocidad, tema del campo, accesibilidad, tutorial)
// y de Estadísticas. Es una capa sobre cualquier pantalla; en partida, mientras está abierta, la partida se pausa.
// El panel rápido de sonido comparte los mismos ajustes (se mantienen sincronizados).
import { app } from './app.js';
import { $, esc } from './dom.js';
import { t, getLang } from '../i18n/index.js';
import { prefs, setPref, resetPrefs, THEMES, TRACKS, currentTheme, currentThemeSlot, setTheme } from './prefs.js';
import { resetModeIntros } from './mode-intro.js';
import { chartsHTML } from './stats-charts.js';
import { SFX, MUSIC, sfx, sfxApplyVolumes, musicStart, musicStop, musicRefresh, sndSave } from '../audio/sfx.js';
import { loadRecords, resetRecords, turnsLabel } from './records.js';
import { resetTutorial } from './tutorial.js';
import { confirmDialog } from './dialog.js';
import { levelName } from './screens.js';
import { storyLevelAt } from './screen-story.js';
import * as ctl from './controller.js';
import { pauseGame, resumePlay } from './pause.js';
import { ensureGuard } from './back.js';
import { loadProfile, saveProfile, MAX_NAME } from './profile.js';
import { achievementsHTML } from './achievements.js';
import { PVE_COLORS } from './screen-pve.js';

let tab = 'settings', lastFocus = null;

const seg = (name, opts, cur, label = o => t(`settings.${o}`)) =>
  `<span class="segBtns">${opts.map(o => `<button class="btn-sm" data-${name}="${o}" aria-pressed="${o === cur}">${esc(label(o))}</button>`).join('')}</span>`;
const toggle = (id, on, label, sub = '') =>
  `<label class="setToggle"><input type="checkbox" id="${id}"${on ? ' checked' : ''}><span class="sw" aria-hidden="true"></span>` +
  `<span class="tl"><b>${esc(label)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span></label>`;

function settingsHTML() {
  const themeBtn = th => `<button class="themeOpt" data-course-opt="${th}" aria-pressed="${currentTheme() === th}">` +
    `<span class="sw ${th}" aria-hidden="true"><i></i><i></i><i></i></span><b>${esc(t('settings.theme_' + th))}</b></button>`;
  const prof = loadProfile();
  return `
  <section><h4>${esc(t('settings.profileH'))}</h4>
    <div class="setRow"><span>${esc(t('settings.name'))}</span><input class="setName" id="setName" maxlength="${MAX_NAME}" value="${esc(prof.name)}" placeholder="${esc(t('pve.namePh'))}"></div>
    <div class="setRow col"><span>${esc(t('settings.color'))}</span><div class="setColors">${PVE_COLORS.map((c, i) =>
      `<button class="pveColor${prof.color === i ? ' sel' : ''}" style="background:${c}" data-prof-color="${i}" aria-label="${esc(t('pve.colorAria', { n: i + 1 }))}" aria-pressed="${prof.color === i}"></button>`).join('')}</div></div>
  </section>
  <section><h4>${esc(t('settings.soundH'))}</h4>
    <label class="setRange"><svg class="i" aria-hidden="true"><use href="#i-sound"/></svg><span>${esc(t('sound.sfx'))}</span><input type="range" id="setSfx" min="0" max="100" value="${Math.round(SFX.sfxVol * 100)}"></label>
    <label class="setRange"><svg class="i" aria-hidden="true"><use href="#i-music"/></svg><span>${esc(t('sound.music'))}</span><input type="range" id="setMus" min="0" max="100" value="${Math.round(SFX.musVol * 100)}"></label>
    ${toggle('setMusOn', MUSIC.on, t('sound.musicOn'), t('settings.musicSub'))}
    <div class="setRow"><span>${esc(t('settings.track'))}</span>${seg('track', TRACKS, prefs.track, o => t('settings.track_' + o))}</div>
  </section>
  <section><h4>${esc(t('settings.gameH'))}</h4>
    <div class="setRow"><span>${esc(t('settings.speed'))}</span>${seg('speed', ['slow', 'normal', 'fast'], prefs.speed)}</div>
    <div class="setRow"><span>${esc(t('lang.label'))}</span><span class="segBtns">${['es', 'en'].map(l => `<button class="btn-sm" data-lang="${l}" aria-pressed="${l === getLang()}">${esc(t('lang.' + l))}</button>`).join('')}</span></div>
    <div class="setRow col"><span>${esc(t('settings.theme'))}${currentThemeSlot() !== 'default' ? ` <small class="themeFor">· ${esc(t('settings.themeFor_' + currentThemeSlot()))}</small>` : ''}</span><div class="themeOpts">${THEMES.map(themeBtn).join('')}</div></div>
    ${toggle('setBotFast', prefs.botFast, t('settings.botFast'), t('settings.botFastSub'))}
    ${toggle('setHints', prefs.hints, t('settings.hints'), t('settings.hintsSub'))}
    ${toggle('setCaddie', prefs.caddie, t('settings.caddie'), t('settings.caddieSub'))}
  </section>
  <section><h4>${esc(t('settings.a11yH'))}</h4>
    ${toggle('setReduce', prefs.reduce, t('settings.reduce'), t('settings.reduceSub'))}
    ${toggle('setShapes', prefs.shapes, t('settings.shapes'), t('settings.shapesSub'))}
    ${toggle('setBigText', prefs.bigText, t('settings.bigText'), t('settings.bigTextSub'))}
    ${toggle('setContrast', prefs.contrast, t('settings.contrast'), t('settings.contrastSub'))}
    ${toggle('setLeftHand', prefs.leftHand, t('settings.leftHand'), t('settings.leftHandSub'))}
  </section>
  <section><h4>${esc(t('settings.tutorialH'))}</h4>
    <div class="setRow"><span class="muted">${esc(t('settings.tutorialSub'))}</span><button class="btn-light btn-sm" data-set-act="tutorial">${esc(t('settings.tutorialReset'))}</button></div>
  </section>
  <section><div class="setRow"><span class="muted">${esc(t('settings.resetSub'))}</span><button class="btn-sm danger" data-set-act="resetPrefs">${esc(t('settings.reset'))}</button></div></section>`;
}

function statsHTML() {
  const r = loadRecords();
  const tot = r.totals;
  const totals = [['i-club', tot.golpes, 'win.stats.strokes'], ['i-hole', tot.hundidas, 'win.stats.sunk'],
    ['i-burst', tot.colisiones, 'win.stats.collisions'], ['i-spiral', tot.portales, 'win.stats.portals'], ['i-out', tot.caidas, 'win.stats.falls']]
    .map(([i, v, k]) => `<div class="st"><svg class="i" aria-hidden="true"><use href="#${i}"/></svg><b>${v}</b>${esc(t(k))}</div>`).join('');
  const lv = Object.entries(r.levels).sort((a, b) => a[0] - b[0]).map(([i, b]) => {
    const L = storyLevelAt(+i);
    return `<tr><td class="n">${+i + 1}</td><td>${esc(levelName(L) || t('story.untitled'))}</td><td>${esc(turnsLabel(b.turns))}</td><td>${esc(t('stats.strokesShort', { n: b.strokes }))}</td></tr>`;
  }).join('');
  const pv = r.pve;
  const quick = `<div class="stTotals">` +
    `<div class="st"><svg class="i" aria-hidden="true"><use href="#i-flag"/></svg>${esc(t('stats.streak'))} <b>${pv.streak}</b></div>` +
    `<div class="st"><svg class="i" aria-hidden="true"><use href="#i-trophy"/></svg>${esc(t('stats.bestStreak'))} <b>${pv.bestStreak}</b></div>` +
    `<div class="st"><svg class="i" aria-hidden="true"><use href="#i-bolt"/></svg>${esc(t('stats.fastest'))} <b>${pv.fastest != null ? esc(turnsLabel(pv.fastest)) : '—'}</b></div></div>`;
  const dl = r.daily, nCh = Object.keys(r.challenges).length, nPz = Object.keys(r.puzzles).length;
  const modes = `<div class="stTotals">` +
    `<div class="st"><svg class="i" aria-hidden="true"><use href="#i-calendar"/></svg>${esc(t('stats.dailyStreak'))} <b>${dl.streak}</b> · ${esc(t('stats.bestStreak'))} <b>${dl.bestStreak}</b></div>` +
    `<div class="st"><svg class="i" aria-hidden="true"><use href="#i-timer"/></svg>${esc(t('modes.rush.title'))} <b>${r.rush.best || 0}</b> pts</div>` +
    `<div class="st"><svg class="i" aria-hidden="true"><use href="#i-bolt"/></svg>${esc(t('modes.challengesH'))} <b>${nCh}/6</b></div>` +
    `<div class="st"><svg class="i" aria-hidden="true"><use href="#i-check"/></svg>${esc(t('story.puzzlesH'))} <b>${nPz}</b></div></div>`;
  return `${chartsHTML(r)}
  <section><h4>${esc(t('stats.quickH'))}</h4>${quick}</section>
  <section><h4>${esc(t('stats.modesH'))}</h4>${modes}</section>
  <section><h4>${esc(t('ach.title'))}</h4>${achievementsHTML()}</section>
  <section><h4>${esc(t('stats.totals'))}</h4><div class="stTotals">${totals}</div></section>
  <section><h4>${esc(t('stats.bestH'))}</h4>${lv
    ? `<div class="stTableWrap"><table class="stTable"><thead><tr><th>#</th><th>${esc(t('stats.level'))}</th><th>${esc(t('stats.turns'))}</th><th>${esc(t('stats.strokes'))}</th></tr></thead><tbody>${lv}</tbody></table></div>`
    : `<p class="muted">${esc(t('stats.noBest'))}</p>`}</section>
  <section><div class="setRow"><span class="muted">${esc(t('stats.resetSub'))}</span><button class="btn-sm danger" data-set-act="resetStats">${esc(t('stats.reset'))}</button></div></section>`;
}

export function openSettings(which = 'settings') {
  tab = which;
  lastFocus = document.activeElement;
  paint();
  $('settingsOverlay').classList.add('visible');
  $('setBox').querySelector('.setTabs button[aria-selected="true"]')?.focus({ preventScroll: true });
  $('sndPanel').classList.remove('open');
  if (app.screen === 'game') pauseGame('settings'); // en partida, mientras se ajusta, la máquina espera
  ensureGuard();
}
export function closeSettings() {
  $('settingsOverlay').classList.remove('visible');
  resumePlay('settings');
  lastFocus?.focus?.({ preventScroll: true });
}
export const settingsOpen = () => $('settingsOverlay').classList.contains('visible');

function paint() {
  $('setBox').innerHTML = `<header><h2 id="setTitle">${esc(t(tab === 'stats' ? 'stats.title' : 'settings.title'))}</h2>` +
    `<button class="btn-ghost btn-sm btn-icon setClose" data-set-act="close" aria-label="${esc(t('common.close'))}"><svg class="i" aria-hidden="true"><use href="#i-x"/></svg></button></header>` +
    `<nav class="setTabs" role="tablist">` +
    `<button role="tab" data-tab="settings" aria-selected="${tab === 'settings'}"><svg class="i" aria-hidden="true"><use href="#i-gear"/></svg>${esc(t('settings.title'))}</button>` +
    `<button role="tab" data-tab="stats" aria-selected="${tab === 'stats'}"><svg class="i" aria-hidden="true"><use href="#i-chart"/></svg>${esc(t('stats.title'))}</button></nav>` +
    `<div class="setBody">${tab === 'stats' ? statsHTML() : settingsHTML()}</div>`;
}
// refresca el contenido si está abierta (p. ej. al cambiar de idioma)
export function repaintSettings() { if (settingsOpen()) paint(); paintSpeedBtns(); }

function paintSpeedBtns() {
  document.querySelectorAll('[data-speed]').forEach(b => b.setAttribute('aria-pressed', b.dataset.speed === prefs.speed));
}
const syncSoundPanel = () => {
  $('sfxVol').value = Math.round(SFX.sfxVol * 100);
  $('musVol').value = Math.round(SFX.musVol * 100);
  $('musOn').checked = MUSIC.on;
};

export function bindSettings() {
  paintSpeedBtns();
  $('settingsBtn').addEventListener('click', () => openSettings('settings'));
  $('statsBtn').addEventListener('click', () => openSettings('stats'));
  $('moreSettings').addEventListener('click', () => openSettings('settings'));
  const ov = $('settingsOverlay');
  ov.addEventListener('click', async e => {
    if (e.target === ov) { closeSettings(); return; }
    const tb = e.target.closest('[data-tab]');
    if (tb) { tab = tb.dataset.tab; paint(); return; }
    const th = e.target.closest('[data-course-opt]');
    if (th) { setTheme(th.dataset.courseOpt); musicRefresh(); paint(); if (app.game) ctl.render(); return; }
    const pc = e.target.closest('[data-prof-color]');
    if (pc) { const prof = loadProfile(); prof.color = +pc.dataset.profColor; saveProfile(prof); app.pveCfg.color = prof.color; paint(); return; }
    const tr = e.target.closest('[data-track]');
    if (tr) { setPref('track', tr.dataset.track); musicRefresh(); paint(); return; }
    const a = e.target.closest('[data-set-act]');
    if (!a) return;
    if (a.dataset.setAct === 'close') closeSettings();
    if (a.dataset.setAct === 'tutorial') { resetTutorial(); resetModeIntros(); a.disabled = true; a.textContent = t('settings.tutorialDone'); }
    if (a.dataset.setAct === 'resetStats' && await confirmDialog(t('stats.resetConfirm'), t('stats.reset'), true)) { resetRecords(); paint(); }
    if (a.dataset.setAct === 'resetPrefs' && await confirmDialog(t('settings.resetConfirm'), t('settings.reset'), true)) {
      resetPrefs();
      Object.assign(SFX, { muted: false, sfxVol: .45, musVol: .55 }); MUSIC.on = true;
      sfxApplyVolumes(); sndSave(); musicStart(); musicRefresh(); syncSoundPanel();
      paint(); paintSpeedBtns();
      if (app.game) { ctl.fitBoard(); ctl.render(); }
    }
  });
  ov.addEventListener('input', e => {
    if (e.target.id === 'setName') { const prof = loadProfile(); prof.name = e.target.value.slice(0, MAX_NAME); saveProfile(prof); }
    if (e.target.id === 'setSfx') { SFX.sfxVol = e.target.value / 100; sfxApplyVolumes(); sndSave(); syncSoundPanel(); }
    if (e.target.id === 'setMus') { SFX.musVol = e.target.value / 100; sfxApplyVolumes(); sndSave(); syncSoundPanel(); }
  });
  ov.addEventListener('change', e => {
    const id = e.target.id, on = e.target.checked;
    if (id === 'setMusOn') { MUSIC.on = on; if (on) musicStart(); else musicStop(); sndSave(); syncSoundPanel(); }
    if (id === 'setHints') setPref('hints', on);
    if (id === 'setReduce') setPref('reduce', on);
    if (id === 'setShapes') setPref('shapes', on);
    if (id === 'setShapes' && app.game) ctl.render();
    if (id === 'setBotFast') setPref('botFast', on);
    if (id === 'setCaddie') { setPref('caddie', on); if (app.game) ctl.render(); }
    if (id === 'setContrast') setPref('contrast', on);
    if (id === 'setBigText' || id === 'setLeftHand') {
      setPref(id === 'setBigText' ? 'bigText' : 'leftHand', on);
      if (app.game) requestAnimationFrame(() => { ctl.fitBoard(); ctl.render(); }); // cambia el hueco del tablero
    }
  });
  // velocidad: botones del panel rápido y de Ajustes
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-speed]');
    if (!b) return;
    setPref('speed', b.dataset.speed);
    paintSpeedBtns();
    sfx('select');
  });
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && settingsOpen() && !document.querySelector('dialog[open]')) { e.stopImmediatePropagation(); closeSettings(); }
  }, true);
}
