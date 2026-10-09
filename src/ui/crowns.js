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
// gold: ganada (oro, con una pelota de golf en el centro y bolitas de oro en las puntas) · si no, su silueta vacía
// (discontinua). El cuerpo y la banda van pegados
let crownSeq = 0;
const BODY = 'M9 41 L5 15 L20 27 L32 7 L44 27 L59 15 L55 41 Z';
const DIMPLES = [[-2.6, -2.2], [.4, -3.4], [3, -1.2], [-3.4, .8], [-.6, .2], [2.4, 2.2], [-1.6, 3.2], [1, 4.2]]; // (los hoyuelos de la pelota, desde su centro)
export function crownSVG(gold = true, cls = 'crIcon') {
  const id = 'crg' + (++crownSeq);
  if (!gold) return `<svg class="${cls} empty" viewBox="0 0 64 52" aria-hidden="true"><path d="${BODY} M9 41 H55 V45.5 A2.5 2.5 0 0 1 52.5 48 H11.5 A2.5 2.5 0 0 1 9 45.5 Z" fill="rgba(36,36,36,.04)" ` +
    `stroke="currentColor" stroke-width="2.4" stroke-dasharray="4 3.2" stroke-linejoin="round"/></svg>`;
  const tip = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#${id}t)" stroke="#8C5E17" stroke-width="1.1"/>`;
  return `<svg class="${cls}" viewBox="0 0 64 52" aria-hidden="true"><defs>` +
    `<linearGradient id="${id}" x1="0" y1="0" x2=".7" y2="1"><stop offset="0" stop-color="#FFF0B0"/><stop offset=".45" stop-color="#F2C24E"/><stop offset="1" stop-color="#B9822A"/></linearGradient>` +
    `<radialGradient id="${id}t" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#FFF6CF"/><stop offset=".55" stop-color="#F2C24E"/><stop offset="1" stop-color="#B9822A"/></radialGradient>` +
    `<radialGradient id="${id}b" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#fff"/><stop offset=".7" stop-color="#F3F1E6"/><stop offset="1" stop-color="#CFCBB8"/></radialGradient>` +
    `<clipPath id="${id}c"><path d="${BODY}"/><rect x="9" y="40" width="46" height="8" rx="2.5"/></clipPath></defs>` +
    `<path d="${BODY}" fill="url(#${id})" stroke="#8C5E17" stroke-width="1.4" stroke-linejoin="round"/>` +
    `<rect x="9" y="40" width="46" height="8" rx="2.5" fill="url(#${id})" stroke="#8C5E17" stroke-width="1.4"/>` +
    `<path d="M11 44 H53" stroke="rgba(140,94,23,.3)" stroke-width="1" stroke-dasharray="1.2 2.4"/>` +
    tip(5, 15, 3.6) + tip(32, 7, 4) + tip(59, 15, 3.6) +
    `<g clip-path="url(#${id}c)"><path class="crSheen" d="M-14 52 L4 0 L14 0 L-4 52Z" fill="rgba(255,255,255,.6)"/></g>` +
    `<circle cx="32" cy="31" r="7" fill="url(#${id}b)" stroke="#8C5E17" stroke-width="1.2"/>` +
    `<g fill="rgba(120,110,80,.22)">${DIMPLES.map(([x, y]) => `<circle cx="${32 + x}" cy="${31 + y}" r=".9"/>`).join('')}</g>` +
    `<ellipse cx="29.6" cy="28.4" rx="2" ry="1.3" fill="rgba(255,255,255,.9)" transform="rotate(-30 29.6 28.4)"/></svg>`;
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
const clockHTML = () => timeParts(weekEndsAt() - Date.now()).map(([v, k], i) =>
  (i ? '<i class="crColon" aria-hidden="true">:</i>' : '') + `<span class="crT"><b>${v}</b><small>${esc(t(k))}</small></span>`).join('');

/* ---------- la sección ---------- */
const icon = id => `<svg class="i" aria-hidden="true"><use href="#${id}"/></svg>`;
const PIPS = { warmup: 1, mid: 2, expert: 3 };
export function crownsSectionHTML(R = loadRecords(), csave = null) {
  const { wk, list } = thisWeek(), won = crownsOf(wk, R), n = R.crowns?.n || 0;
  const minis = list.map(c => `<i class="${won.includes(c.id) ? 'on' : ''}">${crownSVG(won.includes(c.id), 'crMini')}</i>`).join('');
  const sparks = Array.from({ length: 7 }, (_, i) => `<span class="crSpark" style="--i:${i}"></span>`).join('');
  const head = `<header class="crHead">` +
    `<span class="crRays" aria-hidden="true"></span>${sparks}` +
    `<div class="crMain"><div class="crBadge">${crownSVG(true, 'crBig')}</div>` +
    `<div class="crInfo"><span class="crTitle">${esc(t('crowns.title'))}</span>` +
    `<span class="crTotal"><b>${n}</b><small>${esc(t(n === 1 ? 'crowns.total1' : 'crowns.total'))}</small></span></div></div>` +
    `<div class="crClock"><span class="crClockLbl">${esc(t('crowns.newIn'))}</span><span class="crTimer" data-crclock>${clockHTML()}</span>` +
    `<span class="crMinis" title="${esc(t('crowns.weekAria', { n: won.length }))}">${minis}</span></div>` +
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
  return `<button class="crCard g-${g}${done ? ' won' : ''}${saved ? ' saved' : ''}" style="--n:${i}" data-mode="${saved ? 'resume:challenge' : 'ch:' + ch.id}" ` +
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

// la cuenta atrás de la cabecera (cada segundo, mientras se ve): la casilla que cambia da un salto; al cambiar de semana,
// la sección se vuelve a pintar
let tick = null;
export function startCrownClock(repaint) {
  clearInterval(tick);
  tick = setInterval(() => {
    const sec = document.querySelector('.mdSection.crowns');
    if (!sec || app.screen !== 'modes') { clearInterval(tick); return; }
    if (sec.dataset.week !== weekKey()) { repaint(); return; }
    const el = sec.querySelector('[data-crclock]'), parts = timeParts(weekEndsAt() - Date.now()), boxes = el ? [...el.querySelectorAll('.crT')] : [];
    if (!el || boxes.length !== parts.length || parts.some(([, k], i) => boxes[i].querySelector('small').textContent !== t(k))) { if (el) el.innerHTML = clockHTML(); return; }
    parts.forEach(([v], i) => { const b = boxes[i].querySelector('b'); if (b.textContent === v) return;
      b.textContent = v; boxes[i].classList.remove('flip'); void boxes[i].offsetWidth; boxes[i].classList.add('flip'); });
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
function drawCrown(c, x, y, s, gold = true) {
  const g = c.createLinearGradient(x - 30 * s, y - 24 * s, x + 20 * s, y + 24 * s);
  g.addColorStop(0, '#FFF0B0'); g.addColorStop(.45, '#F2C24E'); g.addColorStop(1, '#B9822A');
  const p = crownPath(c, x, y, s);
  const band = () => { c.beginPath(); c.roundRect(...p(9, 40), 46 * s, 8 * s, 2.5 * s); };
  if (!gold) {
    c.setLineDash([6 * s / 1.6, 5 * s / 1.6]); c.lineWidth = 2.4 * s; c.strokeStyle = 'rgba(255,240,220,.55)'; c.stroke();
    band(); c.stroke(); c.setLineDash([]); return;
  }
  c.fillStyle = g; c.fill(); c.lineWidth = 1.4 * s; c.strokeStyle = '#8C5E17'; c.lineJoin = 'round'; c.stroke();
  band(); c.fill(); c.stroke();
  for (const [px, py, r] of [[5, 15, 3.6], [32, 7, 4], [59, 15, 3.6]]) { // (bolitas de oro)
    const [cx, cy] = p(px, py), tg = c.createRadialGradient(cx - r * s * .3, cy - r * s * .4, 0, cx, cy, r * s);
    tg.addColorStop(0, '#FFF6CF'); tg.addColorStop(.55, '#F2C24E'); tg.addColorStop(1, '#B9822A');
    c.beginPath(); c.arc(cx, cy, r * s, 0, 7); c.fillStyle = tg; c.fill(); c.lineWidth = 1.1 * s; c.strokeStyle = '#8C5E17'; c.stroke();
  }
  // la pelota de golf, en el centro
  const [bx, by] = p(32, 31), bg = c.createRadialGradient(bx - 2.4 * s, by - 2.6 * s, 0, bx, by, 7 * s);
  bg.addColorStop(0, '#fff'); bg.addColorStop(.7, '#F3F1E6'); bg.addColorStop(1, '#CFCBB8');
  c.beginPath(); c.arc(bx, by, 7 * s, 0, 7); c.fillStyle = bg; c.fill(); c.lineWidth = 1.2 * s; c.strokeStyle = '#8C5E17'; c.stroke();
  c.fillStyle = 'rgba(120,110,80,.22)';
  for (const [dx, dy] of DIMPLES) { c.beginPath(); c.arc(bx + dx * s, by + dy * s, .9 * s, 0, 7); c.fill(); }
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
