// Partida rápida: configuración (personas, colores, tablero, rivales y dificultad), "Repetir la
// última" y el arranque de partidas contra la máquina (también lo usan los desafíos).
import { app } from './app.js';
import { $, $$, esc } from './dom.js';
import { Game, PLAYER_COLORS } from '../engine/game.js';
import { mulberry32 } from '../engine/rng.js';
import { startGame } from './controller.js';
import { aiStart } from './ai-driver.js';
import { updateMenuBtn } from './hud.js';
import { t } from '../i18n/index.js';
import { saveGame, loadSave } from './save.js';
import { recordStart, loadRecords, nemesisId } from './records.js';
import { musicScene } from '../audio/sfx.js';
import { humansOf, isBot } from './players.js';
import { loadProfile, saveProfile, cleanName, MAX_NAME } from './profile.js';
import { PERSONAS, personaById, assignPersonas, faceSVG } from './persona.js';
import { showScreen, confirmReplaceSave, MODE_NAV } from './screens.js';
import { resumeGame, saveSub } from './resume.js';
import { openModes } from './screen-modes.js';

export const PVE_SIZES = {
  s: { cols: 5, rows: 5, par: 2 },
  m: { cols: 7, rows: 9, par: 3 },
  l: { cols: 9, rows: 11, par: 4 },
};
export const PVE_COLORS = [...PLAYER_COLORS, '#e8833a'];
// color de muestra de cada personalidad (en la elección de rivales)
export const STYLE_COLOR = { aggro: '#f26d6d', trick: '#9b6dd6', cautious: '#5b8def', chaos: '#f2b705' };

export function openPveSetup() { app.pveCfg.color = loadProfile().color; buildPveSetup(); showScreen('pve'); }

// límites de la mesa: de 2 a 6 jugadores. "Contra la máquina": 1 persona y de 1 a 5 bots;
// "Multijugador local": de 2 a 4 personas y, si se quiere, bots
function clampPve(cfg) {
  if (cfg.kind !== 'local' && cfg.kind !== 'bots') cfg.kind = (cfg.humans || 1) > 1 ? 'local' : 'bots';
  if (cfg.kind === 'bots') cfg.humans = 1;
  else cfg.humans = Math.min(4, Math.max(2, cfg.humans || 2));
  cfg.opps = Math.max(cfg.humans > 1 ? 0 : 1, Math.min(6 - cfg.humans, cfg.opps ?? 2));
  if (!['easy', 'normal', 'hard'].includes(cfg.diff)) cfg.diff = 'normal';
  cfg.rivals = Array.isArray(cfg.rivals) ? cfg.rivals.slice(0, 5) : [];
}

// ficha de un rival: su cara, su nombre y su personalidad (o "al azar"), tu balance contra él
// y si es tu némesis; con flechas a los lados para pasar al anterior / siguiente personaje
export function rivalChip(id, i, R = loadRecords(), nemesis = nemesisId(R)) {
  const pr = personaById(id), rec = pr && R.rivals[pr.id];
  const extra = pr && rec ? `<span class="rvRec" title="${esc(t('pve.rivalRecordTitle', { w: rec.w, l: rec.l }))}">${esc(t('pve.rivalRecord', { w: rec.w, l: rec.l }))}</span>` +
    (nemesis === pr.id ? `<span class="rvNemesis">${esc(t('pve.nemesis'))}</span>` : '') : '';
  const ava = pr
    ? `<span class="avatar hasFace" style="--pc:${STYLE_COLOR[pr.style]}">${faceSVG(-1, pr.style, 'idle')}</span>`
    : `<span class="avatar rivalRandom" aria-hidden="true">?</span>`;
  return `<div class="pveOpt rival${pr ? ' picked' : ''}">` +
    `<button class="rivalArrow" data-rival="${i}" data-dir="-1" aria-label="${esc(t('pve.rivalPrev'))}"><svg class="i" aria-hidden="true"><use href="#i-arrow-l"/></svg></button>` +
    `<span class="rivalBody">${ava}<b>${esc(pr ? pr.name : t('pve.rivalRandom'))}</b><small>${esc(pr ? t('persona.style.' + pr.style) : t('pve.rivalAny'))}</small>${extra}</span>` +
    `<button class="rivalArrow" data-rival="${i}" data-dir="1" aria-label="${esc(t('pve.rivalNext'))}"><svg class="i" aria-hidden="true"><use href="#i-arrow-r"/></svg></button></div>`;
}

function buildPveSetup() {
  const cfg = app.pveCfg;
  clampPve(cfg);
  const local = cfg.kind === 'local';
  $$('#pveKind .pveOpt').forEach(b => { const on = cfg.kind === b.dataset.kind; b.classList.toggle('sel', on); b.setAttribute('aria-pressed', on); });
  $('pveHumansRow').hidden = !local;
  $$('#pveHumans .pveOpt').forEach(b => { const on = cfg.humans === +b.dataset.h; b.classList.toggle('sel', on); b.setAttribute('aria-pressed', on); });
  $('pveOppsH').textContent = t(local ? 'pve.oppsLocal' : 'pve.opps');
  $$('#pveDiff .pveOpt').forEach(b => { const on = cfg.diff === b.dataset.diff; b.classList.toggle('sel', on); b.setAttribute('aria-pressed', on); });
  $$('#pveOpps .pveOpt').forEach(b => {
    const n = +b.dataset.n;
    // contra la máquina, al menos un bot; y nunca más de 6 en la mesa (sin huecos en la fila)
    b.disabled = n + cfg.humans > 6;
    b.hidden = (n === 0 && !local) || b.disabled;
  });
  $('pveDiffRow').hidden = cfg.opps === 0;
  $('pveRivalsRow').hidden = cfg.opps === 0;
  const R = loadRecords(), nem = nemesisId(R);
  $('pveRivals').innerHTML = Array.from({ length: cfg.opps }, (_, i) => rivalChip(cfg.rivals[i], i, R, nem)).join('');
  $('pveColorH').textContent = t(cfg.humans > 1 ? 'pve.colorFirst' : 'pve.color');
  $('pveCard').classList.toggle('local', cfg.humans > 1);
  $('pveCard').querySelector('.sub').textContent = t(cfg.humans > 1 ? (cfg.opps ? 'pve.subLocalBots' : 'pve.subLocal') : 'pve.sub');
  const d = loadSave('pve');
  $('pveContinue').hidden = !d;
  if (d) $('pveContinueSub').textContent = saveSub(d);
  // nombres (y, con varias personas, el color de cada una): se recuerdan en el perfil
  const prof = loadProfile();
  $('pveColors').hidden = cfg.humans > 1;
  $('pvePeople').innerHTML = cfg.humans === 1
    ? `<input class="pveName" data-person="me" maxlength="${MAX_NAME}" value="${esc(prof.name)}" placeholder="${esc(t('pve.namePh'))}" aria-label="${esc(t('pve.nameAria'))}">`
    : prof.people.slice(0, cfg.humans).map((pp, i) =>
      `<div class="pvePerson"><button class="pveDot" data-cycle="${i}" style="background:${PVE_COLORS[pp.color % PVE_COLORS.length]}" title="${esc(t('pve.cycleColor'))}" aria-label="${esc(t('pve.cycleColor'))}"></button>` +
      `<input class="pveName" data-person="${i}" maxlength="${MAX_NAME}" value="${esc(pp.name)}" placeholder="${esc(t('player.name', { n: i + 1 }))}" aria-label="${esc(t('pve.nameAriaN', { n: i + 1 }))}"></div>`).join('');
  $('pveColors').innerHTML = PVE_COLORS.map((c, i) =>
    `<button class="pveColor${cfg.color === i ? ' sel' : ''}" style="background:${c}" data-color="${i}"` +
    ` title="${esc(t('pve.pickColor'))}" aria-label="${esc(t('pve.colorAria', { n: i + 1 }))}" aria-pressed="${cfg.color === i}"></button>`).join('');
  $$('#pveSizes .pveOpt').forEach(b => { b.classList.toggle('sel', cfg.size === b.dataset.size); b.setAttribute('aria-pressed', cfg.size === b.dataset.size); });
  $$('#pveOpps .pveOpt').forEach(b => { b.classList.toggle('sel', cfg.opps === +b.dataset.n); b.setAttribute('aria-pressed', cfg.opps === +b.dataset.n); });
}

// nombres y colores propios sobre los asientos de las personas (cosmético: el motor no los usa).
// Los bots que coincidan de color con una persona reciben otro libre.
export function applyOwnLook(S, seats, people) {
  const n = S.nPlayers;
  S.colorMap = S.colorMap ? [...S.colorMap] : Array.from({ length: n }, (_, i) => PLAYER_COLORS[i % PLAYER_COLORS.length]);
  S.playerNames = Array(n).fill(null);
  const taken = new Set();
  seats.forEach((seat, i) => {
    const pp = people[i]; if (!pp) return;
    let ci = pp.color % PVE_COLORS.length;
    while (taken.has(PVE_COLORS[ci])) ci = (ci + 1) % PVE_COLORS.length;
    S.colorMap[seat] = PVE_COLORS[ci]; taken.add(PVE_COLORS[ci]);
    S.playerNames[seat] = cleanName(pp.name) || null;
  });
  for (let p = 0; p < n; p++) {
    if (seats.includes(p)) continue;
    if (taken.has(S.colorMap[p])) S.colorMap[p] = PVE_COLORS.find(c => !taken.has(c) && !S.colorMap.includes(c)) || S.colorMap[p];
    taken.add(S.colorMap[p]);
  }
}

// crea una partida contra la máquina con tus nombres/colores y los rivales elegidos.
// extra: { counts, rules } (desafíos) · rivals: ids de personajes (el resto, al azar)
// seed: partida igual para todo el mundo (reto diario)
export function createVsGame(cfg, { extra = {}, rivals = [], seed } = {}) {
  const sz = PVE_SIZES[cfg.size] || PVE_SIZES.m;
  const prof = loadProfile();
  const people = cfg.humans > 1 ? prof.people.slice(0, cfg.humans) : [{ name: prof.name, color: cfg.color ?? prof.color }];
  const game = Game.pve({ players: cfg.opps + cfg.humans, humans: cfg.humans, aiLevel: cfg.diff, ...sz, ...extra,
    humanColor: PVE_COLORS[people[0].color % PVE_COLORS.length] }, seed != null ? { seed } : {});
  return { game, people, rivals };
}
// tras startGame: aplica caras, nombres y colores (necesita app.mode = 'pve' ya puesto)
export function dressVsGame({ game, people, rivals }) {
  const S = game.S, hs = humansOf(S);
  applyOwnLook(S, hs, people);
  const bots = [...Array(S.nPlayers).keys()].filter(isBot);
  assignPersonas(S, bots, rivals, mulberry32(((game.seed ?? 7) ^ 0x2c1b3c6d) >>> 0));
  // con una persona, el dispositivo es suyo; con varias, se pasa antes de enseñar ninguna mano
  app.viewer = hs.length > 1 ? null : S.human;
}

/* ---------- "Repetir la última" (partida rápida con la misma configuración) ---------- */
const LAST_PVE = 'chaoticgolf_lastpve';
export function lastPve() { try { const c = JSON.parse(localStorage.getItem(LAST_PVE)); return c && PVE_SIZES[c.size] ? c : null; } catch (e) { return null; } }
export function cfgSub(c) {
  const sz = PVE_SIZES[c.size], parts = [`${sz.cols}×${sz.rows}`];
  if (c.humans > 1) parts.push(t('pve.peopleN', { n: c.humans }));
  if (c.opps) parts.push(t(c.opps > 1 ? 'pve.botsN' : 'pve.botN', { n: c.opps }), t('pve.diff' + c.diff[0].toUpperCase() + c.diff.slice(1)));
  return parts.join(' · ');
}
export async function repeatLastPve() {
  const c = lastPve();
  if (!c || !await confirmReplaceSave('pve')) return;
  app.pveCfg = { ...app.pveCfg, ...c };
  startPveMatch();
}

export function startPveMatch() {
  const cfg = app.pveCfg;
  clampPve(cfg);
  app.lastPveCfg = { ...cfg };
  const made = createVsGame(cfg, { rivals: cfg.rivals.slice(0, cfg.opps) });
  startGame(made.game, 'pve');
  dressVsGame(made);
  try { localStorage.setItem(LAST_PVE, JSON.stringify(app.lastPveCfg)); } catch (e) { /* sin storage */ }
  updateMenuBtn();
  musicScene('game', { newGame: true });
  showScreen('game');
  saveGame();
  recordStart(cfg.humans > 1 ? 'local' : 'pve');
  aiStart(900); // si abre la máquina, que juegue (cancelable si se sale antes)
}

export function bindPve() {
  $('pveContinue').addEventListener('click', () => resumeGame('pve'));
  $('pvePlay').addEventListener('click', async () => { if (await confirmReplaceSave('pve')) startPveMatch(); });
  $('pveBack').addEventListener('click', openModes);
  // nombres del perfil: se guardan al escribir
  $('pveScreen').addEventListener('input', e => {
    const inp = e.target.closest('.pveName');
    if (!inp) return;
    const prof = loadProfile();
    if (inp.dataset.person === 'me') prof.name = inp.value.slice(0, MAX_NAME);
    else prof.people[+inp.dataset.person].name = inp.value.slice(0, MAX_NAME);
    saveProfile(prof);
  });
  $('pveScreen').addEventListener('click', e => {
    const c = e.target.closest('[data-color]'), s = e.target.closest('[data-size]'), n = e.target.closest('#pveOpps [data-n]');
    const h = e.target.closest('#pveHumans [data-h]'), d = e.target.closest('#pveDiff [data-diff]');
    const cy = e.target.closest('[data-cycle]'), rv = e.target.closest('[data-rival]');
    if (rv) { // rival: al azar ↔ cada personaje del catálogo (sin repetir los ya elegidos), en los dos sentidos
      const i = +rv.dataset.rival, dir = +rv.dataset.dir || 1, cfg = app.pveCfg, others = cfg.rivals.filter((_, j) => j !== i);
      const ids = [null, ...PERSONAS.map(p => p.id).filter(id => !others.includes(id))];
      cfg.rivals[i] = ids[(ids.indexOf(cfg.rivals[i] ?? null) + dir + ids.length) % ids.length];
      buildPveSetup(); return;
    }
    const k = e.target.closest('#pveKind [data-kind]');
    if (k) { app.pveCfg.kind = k.dataset.kind; if (k.dataset.kind === 'local' && app.pveCfg.opps > 2) app.pveCfg.opps = 0; buildPveSetup(); return; }
    if (cy) { // multijugador local: cada persona cambia su color (sin repetir el de otra)
      const prof = loadProfile(), i = +cy.dataset.cycle, used = prof.people.slice(0, app.pveCfg.humans).map((pp, j) => j !== i && pp.color % PVE_COLORS.length);
      let ci = prof.people[i].color;
      do ci = (ci + 1) % PVE_COLORS.length; while (used.includes(ci));
      prof.people[i].color = ci; saveProfile(prof); buildPveSetup(); return;
    }
    if (c) { app.pveCfg.color = +c.dataset.color; const prof = loadProfile(); prof.color = app.pveCfg.color; saveProfile(prof); }
    else if (s) app.pveCfg.size = s.dataset.size;
    else if (n && !n.disabled) app.pveCfg.opps = +n.dataset.n;
    else if (h) { app.pveCfg.humans = +h.dataset.h; if (app.pveCfg.humans > 1 && app.pveCfg.opps > 6 - app.pveCfg.humans) app.pveCfg.opps = 6 - app.pveCfg.humans; }
    else if (d) app.pveCfg.diff = d.dataset.diff;
    else return;
    buildPveSetup();
  });
  MODE_NAV.pve = { back: openModes, restart: () => { if (app.lastPveCfg) app.pveCfg = { ...app.lastPveCfg }; startPveMatch(); } };
}
