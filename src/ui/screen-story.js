// Pantalla de Lo básico: los niveles integrados, todos de "gana en 1 turno", en el orden en que se aprenden — primero
// cada baraja (palos y hoyo, clásica, agua…) y luego "Lo no tan básico" (combinaciones entre barajas). Cada bloque
// con su cabecera (la baraja, x/y) y sus filas de 5. Los niveles del creador ("Tus niveles") se muestran en Modos de
// juego, con las mismas tarjetas (sección de aquí). También arranca cualquier nivel en solitario (y el "probar" del editor).
import { modeArt } from './mode-art.js';
import { app } from './app.js';
import { $, esc } from './dom.js';
import { Game } from '../engine/game.js';
import { loadLevels, loadProgress } from '../storage.js';
import { startGame } from './controller.js';
import { hideWin } from './win.js';
import { aiStop } from './ai-driver.js';
import { t, getLang } from '../i18n/index.js';
import { saveGame, loadSave } from './save.js';
import { recordStart, levelBest, turnsLabel, loadRecords } from './records.js';
import { musicScene } from '../audio/sfx.js';
import { tutorialStart } from './tutorial.js';
import { loadProfile } from './profile.js';
import { showScreen, levelName, confirmReplaceSave, MODE_NAV, newFreeGame } from './screens.js';
import { applyOwnLook } from './screen-pve.js';
import { resumeGame } from './resume.js';
import { openModes, deckArt } from './screen-modes.js';
import { deckById } from '../content/decks.js';

// nivel de Lo básico por índice (el orden de la pantalla) y nivel del creador por el suyo
export const basicAt = i => app.basics[i] || null;
export const userLevelAt = j => loadLevels()[j];
// las dos secciones de Lo básico y los bloques de cada una (una baraja, o una combinación en Lo no tan básico)
export const SECTIONS = ['basics', 'advanced'];
// el contador de arriba y el del menú: solo lo más básico (palos y hoyo, los primeros 15); el resto lleva el suyo en cada bloque
// (con 145 de golpe asustaba)
const firstBlock = () => app.basics.filter(L => L.deck === 'basic');
const firstDone = (R = loadRecords()) => firstBlock().filter(L => R.basics[L.id]).length;
// ¿la partida en curso es un nivel del creador? (vuelve a Modos de juego)
export const levelFromModes = () => app.mode === 'story' && !app.variant && app.levelIndex != null;

// arranca un nivel en solitario. variant: null (tus niveles / editor) | 'puzzle' (Lo básico) | 'rush'
export function startLevel(level, mode, idx = null, { variant = null, run = null, seed } = {}) {
  const builtIn = mode === 'story' && variant === 'puzzle';
  seed ??= level.seed; // (con azar: la misma jugada da siempre lo mismo)
  startGame(Game.fromLevel(level, seed != null ? { seed } : undefined), mode, { levelIndex: idx, level: { ...level, builtIn }, variant, run });
  applyOwnLook(app.game.S, [0], [loadProfile()]); // tu color y tu nombre también en los niveles
  musicScene('game', { newGame: true });
  showScreen('game');
  saveGame();
  if (mode === 'story' && variant !== 'rush') recordStart(variant || 'story'); // (el contrarreloj cuenta la serie, no cada hoyo)
  if (builtIn) tutorialStart(); // (el primero, con la presentación; lo que enseña cada nivel sale en la pista de abajo)
}

// tarjeta de nivel (miniatura, número, nombre y estado)
// compact: tarjeta pequeña, sin "Jugar" (toda la tarjeta lo es): solo el estado si lo hay
function levelCard(i, L, { done, next, best, saved, attr, compact = false, num = i + 1 }) {
  const state = done ? 'done' : next ? 'next' : '';
  const label = compact && !done && !next ? '' : done ? `<svg class="i" aria-hidden="true"><use href="#i-check"/></svg><span class="lsTxt">${t('story.completed')}</span>` : next ? t('story.next') : t('story.play');
  // (solo las primeras entran animadas: con 145 a la vez, la entrada costaba más que pintarlas)
  return `<button class="lvlCard ${state}${saved ? ' saved' : ''}${num > 10 ? ' still' : ''}"${num <= 10 ? ` style="animation-delay:${(num - 1) * 45}ms"` : ''} ${attr}` +
    ` aria-label="${esc(t('story.levelAria', { n: num, name: levelName(L) }))}${done ? ` · ${esc(t('story.done'))}` : ''}">` +
    `<span class="lvlNum">${num}</span>` +
    `<span class="lvlPreview">${levelPreviewCached(L)}</span>` +
    `<span class="lvlName">${esc(levelName(L) || t('story.untitled'))}</span>` +
    (label || best ? `<span class="lvlFoot">${label ? `<span class="lvlState">${label}</span>` : ''}` +
      (best ? `<span class="lvlBest" title="${esc(t('stats.bestTitle'))}"><svg class="i" aria-hidden="true"><use href="#i-trophy"/></svg>${esc(turnsLabel(best.turns))}</span>` : '') + `</span>` : '') +
    `${saved ? `<span class="lvlSaved">${esc(t('story.inProgress'))}</span>` : ''}</button>`;
}

// cabecera de un bloque: el icono de su baraja (palos y hoyo: el suyo), el nombre, x/y y su barra
// (Lo no tan básico: 'ultimate', 'water+minigolf', 'train+mix'… — el icono y el color, los de la primera baraja; 'all', Ultimate)
const blockDeck = id => deckById(id === 'all' ? 'ultimate' : id.split('+')[0]);
const blockArt = id => id === 'basic' ? modeArt('basics', 'dkArt') : deckArt(blockDeck(id));
export const blockName = id => { const k = 'story.blocks.' + id.replace('+', '_'), v = t(k); return v !== k ? v : id.split('+').map(d => t('decks.' + d + '.name')).join(' + '); };
const blockColor = id => id === 'basic' ? '#5E9A4E' : blockDeck(id).color;
function blockHTML(b, done) {
  const n = b.items.length, d = b.items.filter(i => done[app.basics[i].id]).length, pct = Math.round(100 * d / n);
  return `<div class="bkBlock" style="--dk:${blockColor(b.deck)}">` +
    `<h4 class="bkHead"><span class="bkArt">${blockArt(b.deck)}</span><span class="bkName">${esc(blockName(b.deck))}</span>` +
    `<span class="bkBar" aria-hidden="true"><i style="width:${pct}%"></i></span><span class="bkCount${d === n ? ' all' : ''}">${d}/${n}</span></h4>` +
    b.rows.map(r => `<div class="lvlRow bkRow">${r}</div>`).join('') + `</div>`;
}

// las miniaturas de Lo básico, preparadas en ratos libres tras el arranque (la primera vez que se abre la pantalla ya están)
export function warmBasics() {
  const idle = window.requestIdleCallback || (f => setTimeout(() => f({ timeRemaining: () => 8 }), 60));
  let i = 0;
  const step = dl => { while (i < app.basics.length && dl.timeRemaining() > 2) levelPreviewCached(app.basics[i++]); if (i < app.basics.length) idle(step); };
  idle(step);
}

let lastKey = null; // (si nada ha cambiado —progreso, guardado, idioma—, la pantalla no se vuelve a montar)
export function openStory() {
  hideWin();
  aiStop();
  const R = loadRecords(), done = R.basics, sv = loadSave('puzzle');
  const key = JSON.stringify([getLang(), app.basics.length, Object.keys(done).sort(), sv ? [sv.levelIndex, sv.savedAt] : null]);
  if (key === lastKey && $('lvlGrid').childElementCount) { showScreen('story'); scrollToNext(); return; }
  lastKey = key;
  const next = app.basics.findIndex(L => !done[L.id]);
  // progreso: "3 de 15 completados" (lo más básico: palos y hoyo) + barra
  const nb = firstBlock().length, nd = firstDone(R);
  $('storyProgress').innerHTML = nb ? `<div class="spText"><b>${esc(t('story.progress', { n: nd, total: nb }))}</b>` +
    `${nd === nb ? `<span class="spAll"><svg class="i" aria-hidden="true"><use href="#i-check"/></svg>${esc(t('story.allDone'))}</span>` : ''}</div>` +
    `<div class="spBar" role="progressbar" aria-valuemin="0" aria-valuemax="${nb}" aria-valuenow="${nd}"><i style="width:${Math.round(100 * nd / nb)}%"></i></div>` : '';
  // nivel a medias: se ofrece continuarlo en naranja, como en el menú
  $('storyContinue').innerHTML = sv
    ? `<button class="mBtn continue" data-resume="puzzle"><span class="cTxt"><span>${esc(t('menu.continue'))}</span>` +
      `<small>${esc(t('story.level', { n: (sv.levelIndex ?? 0) + 1 }))}${sv.level ? ' · ' + esc(levelName(sv.level)) : ''}</small></span>` +
      `<svg class="i" aria-hidden="true"><use href="#i-arrow-r"/></svg></button>` : '';
  // secciones → bloques (filas seguidas de la misma baraja) → filas de 5
  const html = SECTIONS.map(sec => {
    const blocks = [];
    app.basics.forEach((L, i) => {
      if (L.section !== sec) return;
      let b = blocks.at(-1);
      if (!b || b.deck !== L.deck) blocks.push(b = { deck: L.deck, items: [], rows: [], lastRow: null });
      b.items.push(i);
      const card = levelCard(i, L, { done: done[L.id], next: i === next, saved: sv && sv.levelIndex === i, attr: `data-puzzle="${i}"`, compact: true });
      if (b.lastRow !== L.row) { b.rows.push(''); b.lastRow = L.row; }
      b.rows[b.rows.length - 1] += card;
    });
    if (!blocks.length) return '';
    return `<section class="lvlSection basics s-${sec}"><h3>${esc(t('story.sections.' + sec))}</h3>${blocks.map(b => blockHTML(b, done)).join('')}</section>`;
  }).join('');
  $('lvlGrid').innerHTML = html;
  showScreen('story');
  scrollToNext();
}
// el siguiente, a la vista si queda más abajo (los de las dos primeras filas ya se ven: no se mide nada; y se mide en el
// fotograma siguiente, para no obligar a maquetar la pantalla en mitad del clic)
function scrollToNext() {
  const nx = $('lvlGrid').querySelector('.lvlCard.next');
  if (!nx || +nx.dataset.puzzle < 10) return;
  requestAnimationFrame(() => { if (app.screen === 'story' && nx.getBoundingClientRect().bottom > innerHeight - 40) nx.scrollIntoView({ block: 'center' }); });
}

/* ---------- sección de Modos de juego: tus niveles ---------- */
// tus niveles (propios y recibidos): cada uno con editar y eliminar; arriba, crear y añadir un código
// El taller (Juegos especiales): tus niveles, bajo una cabecera de alfombrilla de corte como la del creador, y al final una
// casilla vacía con un + en el sitio del siguiente: abre el creador con un nivel nuevo (el que vendría después en la lista)
export function yoursSectionHTML() {
  const levels = loadLevels(), prog = loadProgress(), sv = loadSave('story');
  const icon = id => `<svg class="i" aria-hidden="true"><use href="#${id}"/></svg>`;
  const cards = levels.map((L, j) => { const name = L.name || t('story.untitled');
    return `<div class="lvlWrap">` + levelCard(j, L, { done: prog[j], best: levelBest(j), saved: sv && sv.levelIndex === j, attr: `data-level="${j}"`, compact: true }) +
      (L.origin === 'received' ? `<span class="lvlTag">${esc(t('lib.received'))}</span>` : '') + `<span class="lvlActs">` +
      `<button class="btn-light btn-sm btn-icon" data-lvedit="${j}" title="${esc(t('lib.edit'))}" aria-label="${esc(t('lib.editAria', { name }))}">${icon('i-wrench')}</button>` +
      `<button class="btn-light btn-sm btn-icon danger" data-lvdel="${j}" title="${esc(t('lib.delete'))}" aria-label="${esc(t('lib.deleteAria', { name }))}">${icon('i-trash')}</button></span></div>`; }).join('');
  const next = levels.length + 1;
  const add = `<button class="lvlNew" data-mode="editorNew" title="${esc(t('story.newLevel', { n: next }))}" aria-label="${esc(t('story.newLevel', { n: next }))}">` +
    `<span class="lvlNewBox">${icon('i-plus')}</span><small>${esc(t('story.level', { n: next }))}</small></button>`;
  return `<section class="lvlSection yours workshop"><header class="wsHead"><span class="wsArt">${modeArt('yours')}</span><h3>${esc(t('story.workshop'))}</h3></header>` +
    `<div class="wsBody"><div class="lvlRow">${cards}${add}</div></div></section>`;
}
// tarjeta de nivel pulsada (Lo básico o tus niveles): continúa el nivel a medias o lo empieza
export async function playLevelCard(b) {
  const basic = b.dataset.puzzle !== undefined;
  const i = +(basic ? b.dataset.puzzle : b.dataset.level), L = basic ? basicAt(i) : userLevelAt(i);
  if (!L) return;
  const slot = basic ? 'puzzle' : 'story';
  const sv = loadSave(slot);
  if (sv && sv.levelIndex === i) { resumeGame(slot); return; } // el nivel a medias: se continúa
  if (await confirmReplaceSave(slot)) startLevel(L, 'story', i, { variant: basic ? 'puzzle' : null });
}

// botón del menú: cuántos llevas de los primeros ("3/15", palos y hoyo) o, con ellos, un tic gris
export function paintStoryBtn() {
  const el = $('storyProg'), n = firstBlock().length;
  if (!el || !n) return;
  const done = firstDone(), all = done === n;
  el.classList.toggle('all', all);
  el.innerHTML = all ? `<svg class="i" aria-hidden="true"><use href="#i-check"/></svg>` : `${done}/${n}`;
  $('storyBtn').setAttribute('aria-label', `${t('menu.story')} · ${all ? t('story.allDone') : t('story.progress', { n: done, total: n })}`);
}

export function replayLevel() {
  hideWin();
  if (app.mode === 'test') startLevel(app.level, 'test', null, { variant: app.variant }); // (probar o laboratorio)
  else if (app.variant === 'puzzle') startLevel(basicAt(app.levelIndex), 'story', app.levelIndex, { variant: 'puzzle' });
  else if (app.mode === 'story') startLevel(userLevelAt(app.levelIndex), 'story', app.levelIndex);
  else newFreeGame();
}
export function nextLevel() {
  if (!hasNextLevel()) return;
  const i = app.levelIndex + 1;
  hideWin();
  if (app.variant === 'puzzle') startLevel(basicAt(i), 'story', i, { variant: 'puzzle' });
  else startLevel(userLevelAt(i), 'story', i);
}
// el siguiente de su lista (Lo básico o tus niveles)
export const hasNextLevel = () => {
  const i = app.levelIndex;
  if (i === null) return false;
  return app.variant === 'puzzle' ? !!basicAt(i + 1) : !!userLevelAt(i + 1);
};

// miniatura del tablero de un nivel (casillas, PAR, losetas, hoyo, pelota y obstáculos)
const PREV_FILL = { bunker: '#ECE6CC', portal: '#2D4F7C', river: '#5BB6D6', lake: '#2E7E8C', block: '#7A5230', corner: '#7A5230', tunnel: '#7A5230', launcher: '#7A5230',
  leaf: '#C98B3A', puddle: '#7FB6CC', ice: '#D6EEF4', plant: '#2F6B34', fire: '#E8733A', blackhole: '#120C22', meteorite: '#6E625A' };
export function levelPreviewSVG(L) {
  const s = 10, g = 2, W = L.cols * (s + g) - g, H = L.rows * (s + g) - g;
  const par = new Set((L.parCells || []).map(p => p.x + ',' + p.y));
  const tile = Object.fromEntries((L.tiles || []).map(tl => [tl.x + ',' + tl.y, tl.type]));
  const gold = L.gamble?.gold, casino = !!L.gamble;
  // las casillas, un solo trazo por color (con 145 niveles en pantalla, una <rect> por casilla eran miles de nodos)
  const cells = new Map(), rr = 2.5, side = s - 2 * rr;
  const cellPath = (x, y) => `M${x + rr} ${y}h${side}a${rr} ${rr} 0 0 1 ${rr} ${rr}v${side}a${rr} ${rr} 0 0 1-${rr} ${rr}h-${side}a${rr} ${rr} 0 0 1-${rr}-${rr}v-${side}a${rr} ${rr} 0 0 1 ${rr}-${rr}z`;
  let out = '';
  for (let y = 0; y < L.rows; y++) for (let x = 0; x < L.cols; x++) {
    const k = x + ',' + y, tp = tile[k];
    const base = casino ? ((x + y) % 2 ? '#2B2B30' : '#9E2B32') : ((x + y) % 2 ? '#5C9854' : '#4F8A4B'); // (casino: el suelo ajedrezado)
    const fill = gold && gold.x === x && gold.y === y ? '#E2B640' : PREV_FILL[tp] || (par.has(k) ? '#8DB05F' : base);
    cells.set(fill, (cells.get(fill) || '') + cellPath(x * (s + g), y * (s + g)));
    if (tp === 'block' || tp === 'corner' || tp === 'tunnel' || tp === 'launcher') out += `<rect x="${x * (s + g) + 2}" y="${y * (s + g) + 2}" width="${s - 4}" height="${s - 4}" rx="1.5" fill="#C99257"/>`;
    if (tp === 'dice') out += `<rect x="${x * (s + g) + 1.5}" y="${y * (s + g) + 1.5}" width="${s - 3}" height="${s - 3}" rx="2" fill="#F6F0E2" stroke="#4A3F3A" stroke-width=".6"/><circle cx="${x * (s + g) + s / 2}" cy="${y * (s + g) + s / 2}" r="1.3" fill="#C8243A"/>`; // (casino: el dado)
    if (tp === 'plant') out += `<circle cx="${x * (s + g) + s / 2}" cy="${y * (s + g) + s / 2}" r="2" fill="#D94A5A"/>`;
    if (tp === 'blackhole') out += `<circle cx="${x * (s + g) + s / 2}" cy="${y * (s + g) + s / 2}" r="3.4" fill="none" stroke="#F2B45A" stroke-width="1.1"/>`;
  }
  const c = (x, y) => [x * (s + g) + s / 2, y * (s + g) + s / 2];
  for (const cn of L.gamble?.coins || []) { const [cx, cy] = c(cn.x, cn.y); out += `<circle cx="${cx}" cy="${cy}" r="2.6" fill="#E9C25A" stroke="#8C6A1C" stroke-width=".6"/>`; }
  if (L.season?.snow) { const [cx, cy] = c(L.season.snow.x, L.season.snow.y); out += `<circle cx="${cx}" cy="${cy}" r="4" fill="#F4FAFC" stroke="#9FC3D1" stroke-width=".7"/>`; }
  if (L.train?.path?.length) { // (el tren) la vuelta de las vías y la locomotora
    out += `<polygon points="${L.train.path.map(([x, y]) => c(x, y).join(',')).join(' ')}" fill="none" stroke="#8A5A33" stroke-width="5" stroke-linejoin="round"/>` +
      `<polygon points="${L.train.path.map(([x, y]) => c(x, y).join(',')).join(' ')}" fill="none" stroke="#C9CED3" stroke-width="1.2" stroke-linejoin="round"/>`;
    const [lx, ly] = c(...L.train.path[L.train.pos ?? 0]); out += `<rect x="${lx - 3.6}" y="${ly - 3.6}" width="7.2" height="7.2" rx="2" fill="#242424" stroke="#B5483B" stroke-width="1.4"/>`;
  }
  if (L.spawn) { const [cx, cy] = c(L.spawn.x, L.spawn.y); out += `<circle cx="${cx}" cy="${cy}" r="3.6" fill="none" stroke="#fff" stroke-width="1.1" stroke-dasharray="2 1.4"/>`; } // (la salida, si no es donde empieza)
  if (L.home) { const [cx, cy] = c(L.home.x, L.home.y); out += `<circle cx="${cx}" cy="${cy}" r="3.6" fill="none" stroke="#242424" stroke-width="1.1" stroke-dasharray="2 1.4"/>`; } // (la casilla del hoyo, ídem)
  for (const eb of L.extraBalls || []) { const [cx, cy] = c(eb.x, eb.y); out += `<circle cx="${cx}" cy="${cy}" r="3.4" fill="#F1F1DC"/>`; }
  const [hx, hy] = c(L.hole.x, L.hole.y); out += `<circle cx="${hx}" cy="${hy}" r="4.2" fill="#242424"/><path d="M${hx} ${hy} v-7 l4.5 1.6 -4.5 1.6" fill="#E8873A" stroke="#F1F1DC" stroke-width=".8"/>`;
  const [bx, by] = c(L.ball.x, L.ball.y); out += `<circle cx="${bx + 1.2}" cy="${by + 1.2}" r="3.8" fill="rgba(20,40,20,.35)"/><circle cx="${bx}" cy="${by}" r="3.8" fill="#fff"/>`;
  const grid = [...cells].map(([fill, d]) => `<path d="${d}" fill="${fill}"/>`).join('');
  return `<svg viewBox="-3 -3 ${W + 6} ${H + 6}" aria-hidden="true">${grid}${out}</svg>`;
}
// en caché por nivel (los de Lo básico no cambian)
const PREV_CACHE = new WeakMap();
export function levelPreviewCached(L) {
  let svg = PREV_CACHE.get(L);
  if (!svg) PREV_CACHE.set(L, svg = levelPreviewSVG(L));
  return svg;
}

export function bindStory() {
  $('storyBtn').addEventListener('click', openStory);
  $('storyBack').addEventListener('click', () => showScreen('menu'));
  $('storyContinue').addEventListener('click', e => { if (e.target.closest('[data-resume]')) resumeGame('puzzle'); });
  $('lvlGrid').addEventListener('click', e => {
    const b = e.target.closest('[data-level], [data-puzzle]');
    if (b) playLevelCard(b);
  });
  // navegación y reinicio: Lo básico vuelve a su pantalla; tus niveles, a Modos de juego
  MODE_NAV.story = { back: () => openModes('special'), restart: replayLevel };
  MODE_NAV.puzzle = { back: openStory, restart: replayLevel };
  MODE_NAV.test = { back: () => showScreen('editor'), restart: replayLevel };
}
