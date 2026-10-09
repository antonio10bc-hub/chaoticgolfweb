// Contrarreloj de la semana (Juegos especiales): cada lunes, una serie fija de 5 hoyos, la misma para todo el mundo
// (screen-modes.js: newRush), que se puede repetir para mejorar. Cada semana da una medalla, la mejor que saques: bronce por
// completarla, plata y oro por puntos (records.js: RUSH_MEDALS). La sección tiene su cabecera (como la de los desafíos:
// tus medallas de siempre, la cuenta atrás hasta la serie nueva y compartir) y la tarjeta de la serie (sus 5 hoyos, tu
// mejor resultado de la semana y las tres medallas en su barra).
import { esc } from './dom.js';
import { t, getLang } from '../i18n/index.js';
import { weekKey } from '../content/levels/generate.js';
import { loadRecords, RUSH_MEDALS, rushMedalCounts } from './records.js';
import { clockHTML } from './crowns.js';
import { equippedSkin } from './skins.js';
import { myColor, skinName } from './my-ball.js';
import { drawSkinBall } from './skin-canvas.js';
import { loadProfile } from './profile.js';
import { shareImageDialog } from './share-play.js';
import { sfx } from '../audio/sfx.js';

const icon = id => `<svg class="i" aria-hidden="true"><use href="#${id}"/></svg>`;
const fmt = n => Number(n || 0).toLocaleString(getLang() === 'es' ? 'es-ES' : 'en-GB');
const GOAL = Object.fromEntries(RUSH_MEDALS); // (puntos de cada medalla)
const MEDALS = ['bronze', 'silver', 'gold'];

/* ---------- la medalla ---------- */
// un disco con su cinta (azul, la del contrarreloj) y un rayo en el centro; sin medalla, su silueta discontinua
export const MEDAL_COLORS = {
  gold: ['#FFF0B0', '#F2C24E', '#B9822A', '#8C5E17'],
  silver: ['#FFFFFF', '#CFD5DA', '#8E979E', '#5E676E'],
  bronze: ['#F8D2AE', '#D98F57', '#9C5A2E', '#6B3A1A'],
};
let seq = 0;
export function medalSVG(kind, cls = 'rwMedal') {
  const ribbon = '<path d="M14 2 H22 L28 22 H20 Z" fill="#3F6FA8"/><path d="M34 2 H26 L20 22 H28 Z" fill="#5B8BC8"/>';
  if (!MEDAL_COLORS[kind]) return `<svg class="${cls} empty" viewBox="0 0 48 60" aria-hidden="true">` +
    `<path d="M14 2 H22 L28 22 M34 2 H26 L20 22" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="3.4 3"/>` +
    `<circle cx="24" cy="39" r="17" fill="rgba(36,36,36,.04)" stroke="currentColor" stroke-width="2.4" stroke-dasharray="4 3.2"/></svg>`;
  const [hi, mid, lo, line] = MEDAL_COLORS[kind], id = 'rwm' + (++seq);
  return `<svg class="${cls} m-${kind}" viewBox="0 0 48 60" aria-hidden="true"><defs>` +
    `<linearGradient id="${id}" x1="0" y1="0" x2=".7" y2="1"><stop offset="0" stop-color="${hi}"/><stop offset=".5" stop-color="${mid}"/><stop offset="1" stop-color="${lo}"/></linearGradient>` +
    `<clipPath id="${id}c"><circle cx="24" cy="39" r="17"/></clipPath></defs>${ribbon}` +
    `<circle cx="24" cy="39" r="17" fill="url(#${id})" stroke="${line}" stroke-width="1.4"/>` +
    `<circle cx="24" cy="39" r="12.6" fill="none" stroke="${line}" stroke-opacity=".45" stroke-width="1.2"/>` +
    `<path d="M26.4 29 L18.6 41 H23.6 L21.6 49.4 L29.4 37 H24.4 Z" fill="${line}" fill-opacity=".85"/>` +
    `<g clip-path="url(#${id}c)"><path class="crSheen" d="M-6 60 L10 18 L18 18 L2 60Z" fill="rgba(255,255,255,.55)"/></g></svg>`;
}

/* ---------- la sección ---------- */
// run: la serie a medias de esta semana (o null) · rsave: la partida guardada del contrarreloj
export function rushSectionHTML(R = loadRecords(), run = null, rsave = null) {
  const wk = weekKey(), wb = R.rush?.weeks?.[wk] || null, counts = rushMedalCounts(R), n = counts.gold + counts.silver + counts.bronze;
  const top = counts.gold ? 'gold' : counts.silver ? 'silver' : counts.bronze ? 'bronze' : 'gold';
  const sparks = Array.from({ length: 7 }, (_, i) => `<span class="crSpark" style="--i:${i}"></span>`).join('');
  const tally = MEDALS.slice().reverse().map(m => `<span class="rwTally" title="${esc(t('rushw.' + m))}">${medalSVG(m, 'rwMini')}<b>${counts[m]}</b></span>`).join('');
  const head = `<header class="crHead rwHead"><span class="crRays" aria-hidden="true"></span>${sparks}` +
    `<div class="crMain"><div class="crBadge">${medalSVG(top, 'crBig rwBig')}</div>` +
    `<div class="crInfo"><span class="crTitle">${esc(t('rushw.title'))}</span>` +
    `<span class="crTotal"><b>${n}</b><small>${esc(t(n === 1 ? 'rushw.total1' : 'rushw.total'))}</small></span><span class="rwTallies">${tally}</span></div></div>` +
    `<div class="crClock"><span class="crClockLbl">${esc(t('rushw.newIn'))}</span><span class="crTimer" data-crclock>${clockHTML()}</span></div>` +
    `<button type="button" class="crShare" data-mode="rwShare" aria-label="${esc(t('rushw.share'))}" title="${esc(t('rushw.share'))}">${icon('i-share')}</button></header>`;

  // los 5 hoyos de la serie (con la serie a medias: los hechos, con sus puntos, y el siguiente)
  const holes = Array.from({ length: 5 }, (_, i) => {
    const pts = run?.scores?.[i], cur = run && i === run.hole;
    return `<span class="rwHole${pts != null ? ' done' : ''}${cur ? ' cur' : ''}"><b>${pts != null ? fmt(pts) : i + 1}</b><small>${esc(t(pts != null ? 'rushw.pts' : 'rushw.hole'))}</small></span>`;
  }).join('<i class="rwLink" aria-hidden="true"></i>');
  // las tres medallas sobre su barra (de 0 al oro): las conseguidas, de color; tu mejor de la semana, la marca
  const best = wb?.best || 0, max = GOAL.gold * 1.15, pos = v => Math.min(100, 100 * v / max);
  const have = m => wb?.medal && { bronze: 1, silver: 2, gold: 3 }[wb.medal] >= { bronze: 1, silver: 2, gold: 3 }[m];
  const marks = MEDALS.map(m => `<span class="rwMark${have(m) ? ' got' : ''}" style="--x:${m === 'bronze' ? 6 : pos(GOAL[m])}%">${medalSVG(have(m) ? m : null)}` +
    `<b>${esc(t('rushw.' + m))}</b><small>${esc(m === 'bronze' ? t('rushw.finish') : t('rushw.goal', { n: fmt(GOAL[m]) }))}</small></span>`).join('');
  const bar = `<div class="rwTrack"><div class="rwMarks">${marks}</div><div class="rwBar"><i style="width:${wb ? pos(best) : 0}%"></i></div></div>`;
  const btns = rsave ? `<button class="btn-continue" data-mode="resume:rush">${esc(t('menu.continue'))}</button>`
    : run ? `<button class="btn-continue" data-mode="rush">${esc(t('rushw.continue', { n: run.hole + 1 }))}</button><button class="btn-light btn-sm" data-mode="rushNew">${esc(t('rushw.restart'))}</button>`
    : `<button class="rwPlay" data-mode="rushNew">${icon('i-play')}${esc(t(wb ? 'rushw.improve' : 'modes.play'))}</button>`;
  const card = `<article class="rwCard${wb?.medal ? ' m-' + wb.medal : ''}">` +
    `<div class="rwTop"><div class="rwInfo"><h3>${esc(t('rushw.series'))}</h3><p>${esc(t('rushw.seriesSub'))}</p>` +
    `<span class="rwBest">${icon('i-trophy')}<span>${wb ? esc(t('rushw.best', { n: '\u0001' })).replace('\u0001', `<b>${fmt(best)}</b>`) : esc(t('rushw.noBest'))}</span></span></div>` +
    `<div class="rwBtns">${btns}</div></div>` +
    `<div class="rwHoles">${holes}</div>${bar}</article>`;
  return `<section class="mdSection rushWeek" data-week="${wk}">${head}<div class="rwBody">${card}</div></section>`;
}

/* ---------- compartir: tu medalla de la semana, tus medallas y tu pelota ---------- */
const W = 1080, H = 1350;
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); };
function drawMedal(c, x, y, s, kind) { // (la misma medalla que el SVG, 48×60, con el centro del disco en x, y)
  const p = (px, py) => [x + (px - 24) * s, y + (py - 39) * s];
  if (!MEDAL_COLORS[kind]) {
    c.setLineDash([4 * s, 3.2 * s]); c.lineWidth = 2.4 * s; c.strokeStyle = 'rgba(230,240,255,.55)';
    c.beginPath(); c.arc(x, y, 17 * s, 0, 7); c.stroke(); c.setLineDash([]); return;
  }
  const [hi, mid, lo, line] = MEDAL_COLORS[kind];
  for (const [pts, col] of [[[[14, 2], [22, 2], [28, 22], [20, 22]], '#3F6FA8'], [[[34, 2], [26, 2], [20, 22], [28, 22]], '#5B8BC8']]) {
    c.beginPath(); pts.forEach((q, i) => c[i ? 'lineTo' : 'moveTo'](...p(...q))); c.closePath(); c.fillStyle = col; c.fill();
  }
  const g = c.createLinearGradient(x - 17 * s, y - 17 * s, x + 12 * s, y + 17 * s);
  g.addColorStop(0, hi); g.addColorStop(.5, mid); g.addColorStop(1, lo);
  c.beginPath(); c.arc(x, y, 17 * s, 0, 7); c.fillStyle = g; c.fill(); c.lineWidth = 1.4 * s; c.strokeStyle = line; c.stroke();
  c.beginPath(); c.arc(x, y, 12.6 * s, 0, 7); c.globalAlpha = .45; c.lineWidth = 1.2 * s; c.stroke(); c.globalAlpha = 1;
  c.beginPath(); [[26.4, 29], [18.6, 41], [23.6, 41], [21.6, 49.4], [29.4, 37], [24.4, 37]].forEach((q, i) => c[i ? 'lineTo' : 'moveTo'](...p(...q)));
  c.closePath(); c.fillStyle = line; c.globalAlpha = .85; c.fill(); c.globalAlpha = 1;
}
export async function buildRushImage() {
  await document.fonts?.ready;
  const R = loadRecords(), wk = weekKey(), wb = R.rush?.weeks?.[wk] || null, counts = rushMedalCounts(R);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const bg = c.createLinearGradient(0, 0, W * .4, H); bg.addColorStop(0, '#5B8BC8'); bg.addColorStop(1, '#162B4A'); c.fillStyle = bg; c.fillRect(0, 0, W, H);
  const cx = W / 2, cy = 420;
  c.save(); c.translate(cx, cy); c.fillStyle = 'rgba(210,230,255,.08)';
  for (let i = 0; i < 16; i++) { c.rotate(Math.PI / 8); c.beginPath(); c.moveTo(0, 0); c.lineTo(-70, -1000); c.lineTo(70, -1000); c.fill(); }
  c.restore();
  const halo = c.createRadialGradient(cx, cy, 20, cx, cy, 380); halo.addColorStop(0, 'rgba(255,230,160,.35)'); halo.addColorStop(1, 'rgba(255,230,160,0)');
  c.fillStyle = halo; c.fillRect(0, 0, W, H);
  c.font = '600 44px Outfit, sans-serif';
  const brand = 'chaotic golf', bw = c.measureText(brand + '.').width;
  c.textAlign = 'left'; c.fillStyle = '#F1F1DC'; c.fillText(brand, cx - bw / 2, 112); c.fillStyle = '#E8873A'; c.fillText('.', cx - bw / 2 + c.measureText(brand).width, 112);
  // la medalla de esta semana (o su silueta)
  drawMedal(c, cx, cy + 20, 8.2, wb?.medal);
  c.textAlign = 'center'; c.fillStyle = '#F4F8FF';
  c.font = '700 84px Outfit, sans-serif'; c.fillText(wb?.medal ? t('rushw.' + wb.medal) : t('rushw.noMedal'), cx, cy + 300);
  c.fillStyle = 'rgba(230,240,255,.85)'; c.font = '500 36px Outfit, sans-serif';
  c.fillText(wb ? t('rushw.shareWeek', { n: fmt(wb.best) }) : t('rushw.noBest'), cx, cy + 360);
  // tus medallas de siempre
  const py = cy + 470;
  c.fillStyle = 'rgba(8,20,40,.3)'; rr(c, 200, py - 70, W - 400, 140, 40); c.fill();
  ['gold', 'silver', 'bronze'].forEach((m, i) => {
    const x = cx + (i - 1) * 210;
    drawMedal(c, x - 36, py, 1.9, m);
    c.textAlign = 'left'; c.fillStyle = '#F4F8FF'; c.font = '700 54px Outfit, sans-serif'; c.fillText(String(counts[m]), x + 6, py + 20);
  });
  // tu pelota (con la que llevas puesta) y tu nombre
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
export async function shareRush() {
  sfx('select');
  const wb = loadRecords().rush?.weeks?.[weekKey()];
  const text = (wb?.medal ? t('rushw.shareText', { medal: t('rushw.' + wb.medal).toLowerCase(), n: fmt(wb.best) }) : t('rushw.shareTextNone')) +
    ' ' + location.origin + location.pathname;
  shareImageDialog(await buildRushImage(), { text, what: 'medallas', name: 'chaotic-golf-contrarreloj.png', title: t('rushw.shareTitle'), alt: t('rushw.shareTitle'), simple: true });
}
export const rushMedalLabel = m => t('rushw.' + m);
export { GOAL as RUSH_GOAL };
