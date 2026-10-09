// Desafíos de la semana (Juegos especiales): cada lunes, 5 desafíos nuevos (content/challenges.js: weekChallenges) y cada
// uno ganado da una corona. La sección tiene su cabecera animada (la corona con tus coronas de siempre, las 5 de esta
// semana, el tiempo que queda y el botón de compartir: una imagen con tus coronas y tu pelota), las 5 tarjetas (baraja,
// dificultad, campo, rivales y, a la derecha, su corona: vacía o ganada) y, una sola vez, el aviso del cambio (con las
// coronas regaladas por lo que ya habías superado).
import { app } from './app.js';
import { $, esc } from './dom.js';
import { t } from '../i18n/index.js';
import { mulberry32 } from '../engine/rng.js';
import { weekKey, seedOf } from '../content/levels/generate.js';
import { weekChallenges, weekEndsAt, challengeDecks, WEEK_SLOTS } from '../content/challenges.js';
import { deckById } from '../content/decks.js';
import { loadRecords, crownsOf } from './records.js';
import { PERSONAS, personaById, faceSVG } from './persona.js';
import { STYLE_COLOR } from './screen-pve.js';
import { deckArt } from './screen-modes.js';
import { equippedSkin } from './skins.js';
import { myColor, skinName } from './my-ball.js';
import { drawSkinBall } from './skin-canvas.js';
import { loadProfile } from './profile.js';
import { shareImageDialog } from './share-play.js';
import { sfx } from '../audio/sfx.js';
import { track } from './analytics.js';
import { REDUCED } from '../fx/juice.js';

/* ---------- la corona ---------- */
// gold: ganada (oro, con sus gemas) · si no, su silueta vacía (discontinua)
let crownSeq = 0;
export function crownSVG(gold = true, cls = 'crIcon') {
  const id = 'crg' + (++crownSeq);
  const body = 'M9 39 L5 15 L20 27 L32 7 L44 27 L59 15 L55 39 Z';
  if (!gold) return `<svg class="${cls} empty" viewBox="0 0 64 52" aria-hidden="true"><path d="${body}" fill="rgba(36,36,36,.04)" stroke="currentColor" stroke-width="2.4" stroke-dasharray="4 3.2" stroke-linejoin="round"/>` +
    `<rect x="9" y="41" width="46" height="7" rx="3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-dasharray="4 3.2"/></svg>`;
  return `<svg class="${cls}" viewBox="0 0 64 52" aria-hidden="true"><defs>` +
    `<linearGradient id="${id}" x1="0" y1="0" x2=".7" y2="1"><stop offset="0" stop-color="#FFF0B0"/><stop offset=".45" stop-color="#F2C24E"/><stop offset="1" stop-color="#B9822A"/></linearGradient>` +
    `<clipPath id="${id}c"><path d="${body}"/><rect x="9" y="41" width="46" height="7" rx="3"/></clipPath></defs>` +
    `<path d="${body}" fill="url(#${id})" stroke="#8C5E17" stroke-width="1.4" stroke-linejoin="round"/>` +
    `<path d="M12 35 L52 35" stroke="rgba(140,94,23,.35)" stroke-width="1.4"/>` +
    `<rect x="9" y="41" width="46" height="7" rx="3" fill="url(#${id})" stroke="#8C5E17" stroke-width="1.4"/>` +
    `<circle cx="5" cy="15" r="3.6" fill="#E25A6E" stroke="#8C5E17" stroke-width="1.1"/><circle cx="32" cy="7" r="4" fill="#4FB3E8" stroke="#8C5E17" stroke-width="1.1"/>` +
    `<circle cx="59" cy="15" r="3.6" fill="#E25A6E" stroke="#8C5E17" stroke-width="1.1"/>` +
    `<circle cx="22" cy="44.5" r="2" fill="#4FB3E8"/><circle cx="32" cy="44.5" r="2.2" fill="#E25A6E"/><circle cx="42" cy="44.5" r="2" fill="#4FB3E8"/>` +
    `<g clip-path="url(#${id}c)"><path class="crSheen" d="M-14 52 L4 0 L14 0 L-4 52Z" fill="rgba(255,255,255,.6)"/></g></svg>`;
}

/* ---------- la semana ---------- */
// los rivales de cada desafío de la semana: los mismos para todos, sin repetir y, mientras se pueda, de personalidades distintas
export function weekRivals(wk, ch) {
  const r = mulberry32(seedOf('crownBots:' + wk + ':' + ch.id)), pool = [...PERSONAS], rivals = [], styles = new Set();
  while (rivals.length < ch.opps && pool.length) {
    const fresh = pool.filter(p => !styles.has(p.style)), from = fresh.length ? fresh : pool, pick = from[Math.floor(r() * from.length)];
    rivals.push(pick.id); styles.add(pick.style); pool.splice(pool.indexOf(pick), 1);
  }
  return rivals;
}
export const thisWeek = () => { const wk = weekKey(); return { wk, list: weekChallenges(wk) }; };
// "2d 14h" · "14h 05m" · "42m"
export function timeLeft(ms) {
  const m = Math.max(1, Math.ceil(ms / 60000)), d = Math.floor(m / 1440), h = Math.floor(m % 1440 / 60), mm = m % 60;
  return d ? `${d}d ${h}h` : h ? `${h}h ${String(mm).padStart(2, '0')}m` : `${mm}m`;
}
const left = () => timeLeft(weekEndsAt() - Date.now());

/* ---------- la sección ---------- */
const icon = id => `<svg class="i" aria-hidden="true"><use href="#${id}"/></svg>`;
const deckName = id => id === 'ultimate' ? 'Ultimate' : t('ult.short.' + id);
const PIPS = { warmup: 1, mid: 2, expert: 3 };
export function crownsSectionHTML(R = loadRecords(), csave = null) {
  const { wk, list } = thisWeek(), won = crownsOf(wk, R), n = R.crowns?.n || 0;
  const minis = list.map(c => `<i class="${won.includes(c.id) ? 'on' : ''}">${crownSVG(won.includes(c.id), 'crMini')}</i>`).join('');
  const sparks = Array.from({ length: 7 }, (_, i) => `<span class="crSpark" style="--i:${i}"></span>`).join('');
  const head = `<header class="crHead">` +
    `<span class="crRays" aria-hidden="true"></span>${sparks}` +
    `<div class="crBadge">${crownSVG(true, 'crBig')}</div>` +
    `<div class="crInfo"><span class="crTitle">${esc(t('crowns.title'))}</span>` +
    `<span class="crTotal"><b>${n}</b><small>${esc(t(n === 1 ? 'crowns.total1' : 'crowns.total'))}</small></span>` +
    `<span class="crWeek"><span class="crMinis" title="${esc(t('crowns.weekAria', { n: won.length }))}">${minis}</span>` +
    `<span class="crTime">${icon('i-timer')}<span>${esc(t('crowns.newIn'))} <b data-crleft>${esc(left())}</b></span></span></span></div>` +
    `<button type="button" class="crShare" data-mode="crShare" aria-label="${esc(t('crowns.share'))}" title="${esc(t('crowns.share'))}">${icon('i-share')}</button>` +
    `</header>`;
  const cards = list.map((ch, i) => crownCard(ch, i, wk, won.includes(ch.id), csave?.run?.id === ch.id && csave?.run?.week === wk, R.chStats[ch.id])).join('');
  return `<section class="mdSection challenges crowns" data-week="${wk}">${head}<div class="crList">${cards}</div></section>`;
}
function crownCard(ch, i, wk, done, saved, st) {
  const decks = challengeDecks(ch), name = t('challenges.' + ch.id + '.name'), desc = t('challenges.' + ch.id + '.desc');
  const g = WEEK_SLOTS[i], pips = `<span class="gPips" aria-hidden="true">${[1, 2, 3].map(k => `<i${k <= PIPS[g] ? ' class="on"' : ''}></i>`).join('')}</span>`;
  const art = decks.map(id => `<span class="crDk">${deckArt(deckById(id))}</span>`).join('');
  const faces = weekRivals(wk, ch).map(personaById).map(p => `<span class="avatar hasFace" style="--pc:${STYLE_COLOR[p.style]}" title="${esc(p.name)}">${faceSVG(-1, p.style, 'idle')}</span>`).join('');
  const b = ch.board, size = `${b.cols}×${b.rows}${ch.noPar ? '' : ' · PAR ' + b.par}`;
  const diff = t(ch.diff === 'hard' ? 'pve.diffHard' : 'pve.diffNormal');
  const end = saved ? `<span class="crSlot"><span class="chCont">${esc(t('menu.continue'))}</span></span>`
    : done ? `<span class="crSlot won">${crownSVG(true, 'crSlotIc')}<small>${esc(t('crowns.won'))}</small></span>`
    : `<span class="crSlot">${crownSVG(false, 'crSlotIc')}<span class="crPlay">${icon('i-play')}${esc(t('modes.play'))}</span></span>`;
  const dk = decks[0] === 'ultimate' ? '#5E8FA0' : deckById(decks[0]).color; // (el nácar de Ultimate, más oscuro: se lee sobre crema)
  return `<button class="crCard g-${g}${done ? ' won' : ''}${saved ? ' saved' : ''}" style="--dk:${dk};--n:${i}" data-mode="${saved ? 'resume:challenge' : 'ch:' + ch.id}" ` +
    `aria-label="${esc(`${name}. ${desc} ${done ? t('crowns.won') : ''}`)}">` +
    `<span class="crPic${decks.length > 1 ? ' two' : ''}">${art}<span class="crChIco">${icon(ch.icon)}</span></span>` +
    `<span class="crBody"><span class="crTag">${pips}<span>${esc(t('modes.groups.' + g))}</span><em>${esc(decks.map(deckName).join(' + '))}</em></span>` +
    `<b class="crName">${esc(name)}</b><small class="crDesc">${esc(desc)}</small>` +
    `<span class="crMeta"><span class="crM">${icon('i-grid')}${esc(size)}</span>` +
    `<span class="crM crVs"><span class="crFaces">${faces}</span>${esc(diff)}</span>` +
    (st?.p ? `<span class="crM crSt" title="${esc(t('modes.chStat', { w: st.w || 0, p: st.p }))}">${icon('i-trophy')}${st.w || 0}/${st.p}</span>` : '') + `</span></span>` +
    `<span class="crEnd">${end}</span></button>`;
}

// el total sube desde el último que viste (la primera vez, desde 0; al volver tras ganar, el +1)
let shown = 0;
export function animateCrownTotal() {
  const el = document.querySelector('.crTotal b'), n = el ? +el.textContent : 0, from = Math.min(shown, n);
  shown = n;
  if (!el || REDUCED || from === n) return;
  const t0 = performance.now(), dur = Math.min(1100, 350 + 60 * (n - from));
  const step = now => { const k = Math.min(1, (now - t0) / dur); el.textContent = Math.round(from + (n - from) * (1 - (1 - k) ** 3)); if (k < 1) requestAnimationFrame(step); };
  el.textContent = from; requestAnimationFrame(step);
}

// la cuenta atrás de la cabecera (cada 20 s, mientras se ve); al cambiar de semana, la sección se vuelve a pintar
let tick = null;
export function startCrownClock(repaint) {
  clearInterval(tick);
  tick = setInterval(() => {
    const sec = document.querySelector('.mdSection.crowns');
    if (!sec || app.screen !== 'modes') { clearInterval(tick); return; }
    if (sec.dataset.week !== weekKey()) { repaint(); return; }
    const el = sec.querySelector('[data-crleft]');
    if (el) el.textContent = left();
  }, 20000);
}

/* ---------- compartir: tus coronas, las de esta semana y tu pelota ---------- */
const W = 1080, H = 1350;
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); };
function crownPath(c, x, y, s) { // (la misma corona que el SVG, 64×52, con el centro en x, y)
  const p = (px, py) => [x + (px - 32) * s, y + (py - 28) * s];
  c.beginPath(); c.moveTo(...p(9, 39)); for (const q of [[5, 15], [20, 27], [32, 7], [44, 27], [59, 15], [55, 39]]) c.lineTo(...p(...q)); c.closePath();
  return p;
}
function drawCrown(c, x, y, s, gold = true) {
  const g = c.createLinearGradient(x - 30 * s, y - 24 * s, x + 20 * s, y + 24 * s);
  g.addColorStop(0, '#FFF0B0'); g.addColorStop(.45, '#F2C24E'); g.addColorStop(1, '#B9822A');
  const p = crownPath(c, x, y, s);
  if (!gold) {
    c.setLineDash([6 * s / 1.6, 5 * s / 1.6]); c.lineWidth = 2.4 * s; c.strokeStyle = 'rgba(255,240,220,.55)'; c.stroke();
    c.beginPath(); c.roundRect(...p(9, 41), 46 * s, 7 * s, 3 * s); c.stroke(); c.setLineDash([]); return;
  }
  c.fillStyle = g; c.fill(); c.lineWidth = 1.4 * s; c.strokeStyle = '#8C5E17'; c.lineJoin = 'round'; c.stroke();
  c.beginPath(); c.roundRect(...p(9, 41), 46 * s, 7 * s, 3 * s); c.fill(); c.stroke();
  const gem = (px, py, r, col) => { c.beginPath(); c.arc(...p(px, py), r * s, 0, 7); c.fillStyle = col; c.fill(); c.lineWidth = 1.1 * s; c.strokeStyle = '#8C5E17'; c.stroke(); };
  gem(5, 15, 3.6, '#E25A6E'); gem(32, 7, 4, '#4FB3E8'); gem(59, 15, 3.6, '#E25A6E');
  for (const [px, col] of [[22, '#4FB3E8'], [32, '#E25A6E'], [42, '#4FB3E8']]) { c.beginPath(); c.arc(...p(px, 44.5), 2.1 * s, 0, 7); c.fillStyle = col; c.fill(); }
}
export async function buildCrownImage() {
  await document.fonts?.ready;
  const R = loadRecords(), { wk, list } = thisWeek(), won = crownsOf(wk, R), n = R.crowns?.n || 0;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  // fondo: el rojo de los desafíos, con rayos de luz desde la corona
  const bg = c.createLinearGradient(0, 0, W * .4, H); bg.addColorStop(0, '#C9564B'); bg.addColorStop(1, '#5E1A16'); c.fillStyle = bg; c.fillRect(0, 0, W, H);
  const cx = W / 2, cy = 430;
  c.save(); c.translate(cx, cy); c.fillStyle = 'rgba(255,226,170,.09)';
  for (let i = 0; i < 16; i++) { c.rotate(Math.PI / 8); c.beginPath(); c.moveTo(0, 0); c.lineTo(-70, -1000); c.lineTo(70, -1000); c.fill(); }
  c.restore();
  const halo = c.createRadialGradient(cx, cy, 20, cx, cy, 380); halo.addColorStop(0, 'rgba(255,220,140,.42)'); halo.addColorStop(1, 'rgba(255,220,140,0)');
  c.fillStyle = halo; c.fillRect(0, 0, W, H);
  // destellos
  c.fillStyle = 'rgba(255,240,200,.85)';
  for (const [x, y, r] of [[230, 250, 10], [860, 300, 14], [180, 560, 8], [900, 600, 9], [300, 130, 6], [780, 150, 7]]) {
    c.beginPath(); for (let i = 0; i < 8; i++) { const a = Math.PI * i / 4, d = i % 2 ? r * .3 : r; c[i ? 'lineTo' : 'moveTo'](x + d * Math.cos(a), y + d * Math.sin(a)); } c.fill();
  }
  // la marca
  c.textAlign = 'center'; c.font = '600 44px Outfit, sans-serif';
  const brand = 'chaotic golf', bw = c.measureText(brand + '.').width;
  c.textAlign = 'left'; c.fillStyle = '#F1F1DC'; c.fillText(brand, cx - bw / 2, 112); c.fillStyle = '#E8873A'; c.fillText('.', cx - bw / 2 + c.measureText(brand).width, 112);
  // la corona y el total
  drawCrown(c, cx, cy - 20, 6.4);
  c.textAlign = 'center'; c.fillStyle = '#FFF4D6'; c.font = '700 210px Outfit, sans-serif'; c.fillText(String(n), cx, cy + 370);
  c.fillStyle = 'rgba(255,240,220,.85)'; c.font = '600 46px Outfit, sans-serif'; c.fillText(t(n === 1 ? 'crowns.total1' : 'crowns.total').toUpperCase(), cx, cy + 440);
  // esta semana: sus 5 coronas
  const py = cy + 520;
  c.fillStyle = 'rgba(36,10,8,.28)'; rr(c, 150, py - 64, W - 300, 150, 40); c.fill();
  list.forEach((ch, i) => drawCrown(c, cx + (i - 2) * 140, py + 6, 1.55, won.includes(ch.id)));
  c.fillStyle = 'rgba(255,240,220,.8)'; c.font = '500 28px Outfit, sans-serif'; c.fillText(t('crowns.shareWeek', { n: won.length }), cx, py + 72 + 50);
  // tu pelota (con la que llevas puesta) sobre su green y tu nombre
  const fy = H - 150;
  c.fillStyle = '#F1F1DC'; rr(c, 64, fy - 70, W - 128, 160, 34); c.fill();
  const bx = 200, by = fy - 10, sk = equippedSkin();
  c.fillStyle = '#79A456'; c.beginPath(); c.ellipse(bx, by + 54, 84, 21, 0, 0, 7); c.fill();
  await drawSkinBall(c, bx, by, 50, myColor(), sk);
  const name = loadProfile().name || t('crowns.shareYou');
  c.textAlign = 'left'; c.fillStyle = '#242424'; c.font = '600 46px Outfit, sans-serif'; c.fillText(name.slice(0, 22), 310, fy - 2);
  c.fillStyle = '#66725F'; c.font = '500 28px Outfit, sans-serif'; c.fillText(t('crowns.shareBall', { ball: skinName(sk) }), 310, fy + 42);
  c.textAlign = 'right'; c.font = '500 22px Outfit, sans-serif'; c.fillText((location.host || 'chaotic golf').replace(/^www\./, ''), W - 100, fy + 74);
  return new Promise(res => cv.toBlob(res, 'image/png'));
}
export async function shareCrowns() {
  sfx('select');
  const R = loadRecords(), n = R.crowns?.n || 0;
  const text = t('crowns.shareText', { n }) + ' ' + location.origin + location.pathname;
  shareImageDialog(await buildCrownImage(), { text, what: 'coronas', name: 'chaotic-golf-coronas.png' });
}

/* ---------- el aviso del cambio (una vez) ---------- */
const INTRO_KEY = 'chaoticgolf_crownsIntro';
// solo a quien ya jugaba antes (a quien empieza ahora no le ha cambiado nada); se apunta como visto igualmente
export function maybeCrownsIntro() {
  try { if (localStorage.getItem(INTRO_KEY)) return; localStorage.setItem(INTRO_KEY, '1'); } catch (e) { return; }
  const R = loadRecords(), played = Object.values(R.played || {}).reduce((a, b) => a + b, 0), gift = R.crowns?.legacy || 0;
  if (!played && !gift) return;
  const dlg = $('dialog');
  if (dlg.open) return;
  track('coronas', { aviso: true, regaladas: gift });
  dlg.innerHTML = `<form method="dialog" class="dlgBox crIntro"><div class="crIntroArt">${crownSVG(true, 'crBig')}</div>` +
    `<h3>${esc(t('crowns.introTitle'))}</h3><ul>` +
    `<li>${icon('i-calendar')}<span>${esc(t('crowns.intro1'))}</span></li>` +
    `<li>${crownSVG(true, 'crLi')}<span>${esc(t('crowns.intro2'))}</span></li>` +
    (gift ? `<li class="gift">${icon('i-check')}<span>${esc(t(gift === 1 ? 'crowns.introGift1' : 'crowns.introGift', { n: gift }))}</span></li>` : '') +
    `</ul><div class="dlgBtns"><button value="ok" class="btn-primary">${esc(t('crowns.introOk'))}</button></div></form>`;
  dlg.returnValue = '';
  dlg.showModal();
  sfx('season');
}
