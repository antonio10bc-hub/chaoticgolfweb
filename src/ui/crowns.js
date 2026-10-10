// Desafíos de la semana (Modos de juego › Eventos): cada lunes, 5 desafíos nuevos (content/challenges.js: weekChallenges) y
// cada uno ganado da una corona. La sección tiene su cabecera (plana, como el menú: la corona que flota con tus coronas de
// siempre, el tiempo que queda y el botón de compartir: una imagen con tus coronas, las 5 de la semana y tu pelota), las 5 tarjetas (baraja,
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
// gold: ganada (oro, con una pelota de golf en el centro y bolitas de oro en las puntas) · si no, su silueta vacía
// (discontinua). El cuerpo y la banda van pegados
const BODY = 'M9 41 L5 15 L20 27 L32 7 L44 27 L59 15 L55 41 Z';
const DIMPLES = [[-2.6, -2.2], [.4, -3.4], [3, -1.2], [-3.4, .8], [-.6, .2], [2.4, 2.2], [-1.6, 3.2], [1, 4.2]]; // (los hoyuelos de la pelota, desde su centro)
export function crownSVG(gold = true, cls = 'crIcon') {
  if (!gold) return `<svg class="${cls} empty" viewBox="0 0 64 52" aria-hidden="true"><path d="${BODY} M9 41 H55 V45.5 A2.5 2.5 0 0 1 52.5 48 H11.5 A2.5 2.5 0 0 1 9 45.5 Z" fill="rgba(36,36,36,.04)" ` +
    `stroke="currentColor" stroke-width="2.4" stroke-dasharray="4 3.2" stroke-linejoin="round"/></svg>`;
  // (plana, como el menú: el oro y su mitad en sombra, la banda más oscura, las bolitas y la pelota de golf, sin contornos)
  return `<svg class="${cls}" viewBox="0 0 64 52" aria-hidden="true">` +
    `<path d="${BODY}" fill="#F2C24E"/><path d="M32 7 L44 27 L59 15 L55 41 L32 41Z" fill="#E3AD3A"/>` +
    `<rect x="9" y="40" width="46" height="8" rx="2.5" fill="#D99A2B"/><path d="M32 40 H52.5 A2.5 2.5 0 0 1 55 42.5 V45.5 A2.5 2.5 0 0 1 52.5 48 H32Z" fill="#C98B22"/>` +
    `<circle cx="5" cy="15" r="3.8" fill="#F2C24E"/><circle cx="32" cy="7" r="4.2" fill="#F2C24E"/><circle cx="59" cy="15" r="3.8" fill="#E3AD3A"/>` +
    `<circle cx="32" cy="31" r="7" fill="#FFFFFF"/><path d="M38.2 27.6 A7 7 0 0 1 28.4 37 A7.4 7.4 0 0 0 38.2 27.6Z" fill="#E7E4D8"/>` +
    `<g fill="#E2DFD2">${DIMPLES.map(([x, y]) => `<circle cx="${32 + x}" cy="${31 + y}" r=".9"/>`).join('')}</g></svg>`;
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
// lo que queda, en tres casillas: días, horas y minutos (el último día, horas, minutos y segundos)
export function timeParts(ms) {
  const s = Math.max(0, Math.floor(ms / 1000)), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
  const two = n => String(n).padStart(2, '0');
  return d ? [[String(d), d === 1 ? 'crowns.day' : 'crowns.days'], [two(h), 'crowns.hours'], [two(m), 'crowns.mins']]
    : [[two(h), 'crowns.hours'], [two(m), 'crowns.mins'], [two(s % 60), 'crowns.secs']];
}
export const clockHTML = () => timeParts(weekEndsAt() - Date.now()).map(([v, k], i) =>
  (i ? '<i class="crColon" aria-hidden="true"></i>' : '') + `<span class="crT"><b>${v}</b><small>${esc(t(k))}</small></span>`).join('');

/* ---------- la sección ---------- */
const icon = id => `<svg class="i" aria-hidden="true"><use href="#${id}"/></svg>`;
const PIPS = { warmup: 1, mid: 2, expert: 3 };
export function crownsSectionHTML(R = loadRecords(), csave = null) {
  const { wk, list } = thisWeek(), won = crownsOf(wk, R), n = R.crowns?.n || 0;
  const head = `<header class="crHead">` +
    `<div class="crMain"><div class="crBadge">${crownSVG(true, 'crBig')}</div>` +
    `<div class="crInfo"><span class="crTitle">${esc(t('crowns.title'))}</span>` +
    `<span class="crTotal"><b>${n}</b><small>${esc(t(n === 1 ? 'crowns.total1' : 'crowns.total'))}</small></span></div></div>` +
    `<div class="crClock"><span class="crClockLbl">${esc(t('crowns.newIn'))}</span><span class="crTimer" data-crclock>${clockHTML()}</span></div>` +
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
  return `<button class="crCard g-${g}${done ? ' won' : ''}${saved ? ' saved' : ''}" style="--n:${i}" data-chid="${ch.id}" data-mode="${saved ? 'resume:challenge' : 'ch:' + ch.id}" ` +
    `aria-label="${esc(`${name}. ${desc} ${done ? t('crowns.won') : ''}`)}">` +
    `<span class="crPic${decks.length > 1 ? ' two' : ''}">${art}<span class="crChIco">${icon(ch.icon)}</span></span>` +
    `<span class="crBody"><span class="crTag">${pips}<span>${esc(t('modes.groups.' + g))}</span></span>` +
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

// las cuentas atrás de la pantalla (la de los desafíos y la del contrarreloj; cada segundo, mientras se ven): la casilla
// que cambia da un salto; al cambiar de semana, la pantalla se vuelve a pintar
let tick = null;
export function startCrownClock(repaint) {
  clearInterval(tick);
  tick = setInterval(() => {
    const sec = document.querySelector('.mdSection.crowns');
    if (!sec || app.screen !== 'modes') { clearInterval(tick); return; }
    if (sec.dataset.week !== weekKey()) { repaint(); return; }
    const parts = timeParts(weekEndsAt() - Date.now());
    for (const el of document.querySelectorAll('[data-crclock]')) {
      const boxes = [...el.querySelectorAll('.crT')];
      if (boxes.length !== parts.length || parts.some(([, k], i) => boxes[i].querySelector('small').textContent !== t(k))) { el.innerHTML = clockHTML(); continue; }
      parts.forEach(([v], i) => { const b = boxes[i].querySelector('b'); if (b.textContent === v) return;
        b.textContent = v; boxes[i].classList.remove('flip'); void boxes[i].offsetWidth; boxes[i].classList.add('flip'); });
    }
  }, 1000);
}

/* ---------- compartir: tus coronas, las de esta semana y tu pelota ---------- */
const W = 1080, H = 1350;
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); };
function crownPath(c, x, y, s) { // (la misma corona que el SVG, 64×52, con el centro en x, y)
  const p = (px, py) => [x + (px - 32) * s, y + (py - 28) * s];
  c.beginPath(); c.moveTo(...p(9, 39)); for (const q of [[5, 15], [20, 27], [32, 7], [44, 27], [59, 15], [55, 39]]) c.lineTo(...p(...q)); c.closePath();
  return p;
}
// (la misma corona plana que el SVG: el oro y su mitad en sombra, la banda, las bolitas y la pelota de golf)
function drawCrown(c, x, y, s, gold = true) {
  const p = crownPath(c, x, y, s);
  const band = () => { c.beginPath(); c.roundRect(...p(9, 40), 46 * s, 8 * s, 2.5 * s); };
  if (!gold) {
    c.setLineDash([6 * s / 1.6, 5 * s / 1.6]); c.lineWidth = 2.4 * s; c.strokeStyle = 'rgba(255,240,220,.55)'; c.stroke();
    band(); c.stroke(); c.setLineDash([]); return;
  }
  const poly = (pts, col) => { c.beginPath(); pts.forEach((q, i) => c[i ? 'lineTo' : 'moveTo'](...p(...q))); c.closePath(); c.fillStyle = col; c.fill(); };
  const dot = (px, py, r, col) => { c.beginPath(); c.arc(...p(px, py), r * s, 0, 7); c.fillStyle = col; c.fill(); };
  c.fillStyle = '#F2C24E'; c.fill();
  poly([[32, 7], [44, 27], [59, 15], [55, 41], [32, 41]], '#E3AD3A');
  band(); c.fillStyle = '#D99A2B'; c.fill();
  c.beginPath(); c.roundRect(...p(32, 40), 23 * s, 8 * s, [0, 2.5 * s, 2.5 * s, 0]); c.fillStyle = '#C98B22'; c.fill();
  dot(5, 15, 3.8, '#F2C24E'); dot(32, 7, 4.2, '#F2C24E'); dot(59, 15, 3.8, '#E3AD3A');
  dot(32, 31, 7, '#FFFFFF');
  for (const [dx, dy] of DIMPLES) dot(32 + dx, 31 + dy, .9, '#E2DFD2');
}
export async function buildCrownImage() {
  await document.fonts?.ready;
  const R = loadRecords(), { wk, list } = thisWeek(), won = crownsOf(wk, R), n = R.crowns?.n || 0;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  // fondo: el rojo de los desafíos, con rayos de luz desde la corona
  // fondo: plano, como el menú: el rojo de los desafíos con rayas diagonales a dos tonos
  c.fillStyle = '#B5473F'; c.fillRect(0, 0, W, H);
  c.save(); c.translate(W / 2, H / 2); c.rotate(Math.PI / 4); c.fillStyle = 'rgba(255,255,255,.045)';
  for (let i = -24; i < 24; i += 2) c.fillRect(i * 90, -H * 1.5, 90, H * 3);
  c.restore();
  const cx = W / 2, cy = 430;
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
  shareImageDialog(await buildCrownImage(), { text, what: 'coronas', name: 'chaotic-golf-coronas.png', title: t('crowns.shareTitle'), alt: t('crowns.shareTitle'), simple: true });
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
