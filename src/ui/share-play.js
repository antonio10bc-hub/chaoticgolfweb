// Compartir la jugada final: al terminar cualquier partida, una imagen (PNG 1080×1350, 4:5) con el
// tablero tal como acabó y el recorrido de la última jugada (de dónde salió cada pieza, choques,
// portales, caídas y la bola en el hoyo), la carta jugada, quién la jugó y el resultado.
// En el móvil se comparte con la hoja del sistema; en el ordenador, copiar o descargar.
import { app } from './app.js';
import { $, esc } from './dom.js';
import { t } from '../i18n/index.js';
import { CARDS } from '../content/cards/index.js';
import { cardArtSVG } from './card-art.js';
import { pColor } from '../art.js';
import { displayName } from './players.js';
import { playerTag } from '../engine/game.js';
import { toast } from './hud.js';
import { sfx } from '../audio/sfx.js';

/* ---------- registro de la última jugada (desde el controlador) ---------- */
const MOVES = new Set(['move', 'teleport', 'fall', 'appear', 'impact', 'sink', 'drift', 'splash', 'launch', 'bump']);
// posiciones antes de la jugada (barato: solo pelotas y hoyo)
export const piecesBefore = g => ({
  balls: g.S.balls.map(b => ({ player: b.player, x: b.x, y: b.y, holed: b.holed })),
  hole: { x: g.S.hole.x, y: g.S.hole.y },
});
// guarda la jugada si ha movido algo (las que no, p. ej. confirmar la victoria, no la sustituyen)
export function notePlay(g, pre, events, card, actor) {
  const anim = events.filter(e => MOVES.has(e.t));
  if (!anim.length) return;
  app.finalPlay = { pre, events: anim.map(e => ({ ...e })), card, actor };
}

/* ---------- la imagen ---------- */
const W = 1080, H = 1350, PAD = 64;
const PT = { 1: ['#2D4F7C', '#A9C3E6'], 2: ['#5B3A8C', '#CDB8EC'], 3: ['#1E6B63', '#A6DDD5'] };
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); };

function themeColors() {
  const cs = getComputedStyle($('gameScreen')), v = (k, d) => cs.getPropertyValue(k).trim() || d;
  return { dark: v('--grass-dark', '#4F8A4B'), mid: v('--grass-mid', '#5C9854'), par: v('--par-cell', '#6FA052'),
    grout: v('--grout', '#3F7440'), bgA: v('--bg-a', '#8BBE7A'), bgB: v('--bg-b', '#94C584') };
}
// la carta jugada como imagen (su arte es un SVG autónomo); si no se puede, sin arte
function cardImage(def) {
  return new Promise(res => {
    const svg = cardArtSVG(def);
    if (!svg.startsWith('<svg')) return res(null);
    const img = new Image();
    img.onload = () => res(img); img.onerror = () => res(null);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" '));
  });
}

function drawBoard(c, S, fp, box, col) {
  const cw = Math.min(box.w / S.cols, box.h / (S.rows * 1.28)), ch = cw * 1.28, gap = Math.max(3, cw * .06);
  const bw = cw * S.cols, bh = ch * S.rows, ox = box.x + (box.w - bw) / 2, oy = box.y + (box.h - bh) / 2;
  const cx = x => ox + x * cw + cw / 2, cy = y => oy + y * ch + ch / 2;
  // marco crema y juntas
  c.fillStyle = '#F1F1DC'; rr(c, ox - 18, oy - 18, bw + 36, bh + 36, 26); c.fill();
  c.fillStyle = col.grout; rr(c, ox - 4, oy - 4, bw + 8, bh + 8, 12); c.fill();
  const par = new Map(S.parCells.map(p => [p.x + ',' + p.y, p.n]));
  for (let y = 0; y < S.rows; y++) for (let x = 0; x < S.cols; x++) {
    const n = par.get(x + ',' + y);
    c.fillStyle = n ? col.par : ((x + y) >> 1) & 1 ? col.mid : col.dark;
    rr(c, ox + x * cw + gap / 2, oy + y * ch + gap / 2, cw - gap, ch - gap, Math.min(10, cw * .14)); c.fill();
  }
  // etiquetas del PAR (arriba de cada casilla; se repintan al final por encima del recorrido)
  const parLabels = () => { for (const pc of S.parCells) {
    c.fillStyle = 'rgba(241,241,220,.8)'; c.font = `600 ${Math.round(cw * .17)}px Outfit, sans-serif`; c.textAlign = 'center';
    c.fillText('PAR ' + pc.n, cx(pc.x), oy + pc.y * ch + ch * .2);
  } };
  parLabels();
  for (const tl of S.tiles) {
    if (['block', 'corner', 'tunnel', 'launcher'].includes(tl.type)) { // piezas de madera
      const x0 = ox + tl.x * cw + gap, y0 = oy + tl.y * ch + gap, w = cw - gap * 2, h = ch - gap * 2, r = tl.rot || 0;
      c.fillStyle = '#A8743F'; c.strokeStyle = '#7A5230'; c.lineWidth = cw * .03;
      if (tl.type === 'corner') {
        const P = [[[x0, y0], [x0 + w, y0], [x0, y0 + h]], [[x0, y0], [x0 + w, y0], [x0 + w, y0 + h]], [[x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h]], [[x0, y0], [x0, y0 + h], [x0 + w, y0 + h]]][r % 4];
        c.beginPath(); P.forEach(([px, py], i) => c[i ? 'lineTo' : 'moveTo'](px, py)); c.closePath(); c.fill(); c.stroke();
      } else if (tl.type === 'launcher') {
        c.beginPath(); c.arc(cx(tl.x), cy(tl.y), cw * .38, 0, 7); c.fill(); c.stroke();
        c.save(); c.translate(cx(tl.x), cy(tl.y)); c.rotate(r * Math.PI / 2); c.fillStyle = '#E8873A';
        c.beginPath(); c.moveTo(0, -cw * .26); c.lineTo(cw * .17, 0); c.lineTo(-cw * .17, 0); c.fill(); c.fillRect(-cw * .06, 0, cw * .12, cw * .22); c.restore();
      } else {
        rr(c, x0, y0, w, h, cw * .12); c.fill(); c.stroke();
        c.fillStyle = '#E2B77E'; rr(c, x0 + w * .14, y0 + h * .12, w * .72, h * .7, cw * .08); c.fill();
        if (tl.type === 'tunnel') { c.fillStyle = '#3A2614'; c.font = `700 ${Math.round(cw * .36)}px Outfit, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', cx(tl.x), cy(tl.y)); c.textBaseline = 'alphabetic'; }
      }
    } else if (tl.type === 'river' || tl.type === 'lake') {
      const rv = tl.type === 'river', x0 = ox + tl.x * cw, y0 = oy + tl.y * ch;
      c.fillStyle = rv ? '#5BB6D6' : '#2E7E8C';
      const up = S.tiles.some(o => o.type === tl.type && o.x === tl.x && o.y === tl.y - 1), dn = S.tiles.some(o => o.type === tl.type && o.x === tl.x && o.y === tl.y + 1);
      rr(c, x0 + gap / 2, y0 + (up ? -gap / 2 : gap / 2), cw - gap, ch - gap + (up ? gap / 2 : 0) + (dn ? gap / 2 : 0), rv ? 4 : Math.min(14, cw * .2)); c.fill();
      c.strokeStyle = 'rgba(241,251,255,.85)'; c.lineWidth = cw * .05; c.lineCap = 'round'; c.lineJoin = 'round';
      if (rv) for (const k of [.3, .62]) { c.beginPath(); c.moveTo(cx(tl.x) - cw * .14, y0 + ch * k); c.lineTo(cx(tl.x), y0 + ch * k + cw * .1); c.lineTo(cx(tl.x) + cw * .14, y0 + ch * k); c.stroke(); }
      else { c.fillStyle = 'rgba(255,255,255,.2)'; c.beginPath(); c.ellipse(cx(tl.x) - cw * .1, cy(tl.y) - ch * .15, cw * .2, cw * .05, 0, 0, 7); c.fill();
        c.fillStyle = '#5E9A58'; c.beginPath(); c.arc(cx(tl.x) + cw * .12, cy(tl.y) + ch * .1, cw * .11, .4, 5.9); c.lineTo(cx(tl.x) + cw * .12, cy(tl.y) + ch * .1); c.fill(); }
    } else if (tl.type === 'portal') {
      const [d, l] = PT[tl.pair] || PT[1];
      c.fillStyle = d; c.beginPath(); c.arc(cx(tl.x), cy(tl.y), cw * .36, 0, 7); c.fill();
      c.strokeStyle = l; c.lineWidth = cw * .05; c.beginPath(); c.arc(cx(tl.x), cy(tl.y), cw * .24, 0, 7); c.stroke();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(cx(tl.x), cy(tl.y), cw * .07, 0, 7); c.fill();
    } else {
      c.fillStyle = '#ECE6CC'; c.beginPath(); c.ellipse(cx(tl.x), cy(tl.y), cw * .4, cw * .3, -.25, 0, 7); c.fill();
      c.fillStyle = '#F6F2E0'; c.beginPath(); c.ellipse(cx(tl.x) - cw * .05, cy(tl.y) - cw * .06, cw * .22, cw * .13, -.25, 0, 7); c.fill();
    }
  }
  // hoyo con bandera
  const hx = cx(S.hole.x), hy = cy(S.hole.y);
  c.fillStyle = 'rgba(241,241,220,.28)'; c.beginPath(); c.arc(hx, hy, cw * .42, 0, 7); c.fill();
  c.fillStyle = '#242424'; c.beginPath(); c.ellipse(hx, hy + cw * .08, cw * .2, cw * .14, 0, 0, 7); c.fill();
  c.strokeStyle = '#F1F1DC'; c.lineWidth = cw * .045; c.lineCap = 'round'; c.beginPath(); c.moveTo(hx, hy + cw * .06); c.lineTo(hx, hy - cw * .42); c.stroke();
  c.fillStyle = '#E8873A'; c.beginPath(); c.moveTo(hx + cw * .02, hy - cw * .42); c.lineTo(hx + cw * .3, hy - cw * .32); c.lineTo(hx + cw * .02, hy - cw * .22); c.fill();

  // recorrido de la jugada final
  const pos = {}, colOf = id => id === 'hole' ? '#242424' : pColor(+id.slice(1));
  for (const b of fp.pre.balls) pos['b' + b.player] = { x: b.x, y: b.y, start: { x: b.x, y: b.y }, moved: false, holed: b.holed };
  pos.hole = { x: fp.pre.hole.x, y: fp.pre.hole.y, start: { ...fp.pre.hole }, moved: false };
  const segs = [], marks = [];
  for (const e of fp.events) {
    const p = pos[e.p]; if (!p) continue;
    const from = { x: p.x, y: p.y };
    if (e.t === 'move' || e.t === 'drift') { segs.push({ id: e.p, from, to: { x: e.x, y: e.y } }); p.x = e.x; p.y = e.y; p.moved = true; }
    else if (e.t === 'launch') { const to = { x: Math.max(-.45, Math.min(S.cols - .55, e.x)), y: Math.max(-.45, Math.min(S.rows - .55, e.y)) }; segs.push({ id: e.p, from, to, jump: true }); p.x = e.x; p.y = e.y; p.moved = true; }
    else if (e.t === 'bump') marks.push({ k: 'hit', x: p.x, y: p.y });
    else if (e.t === 'teleport') { segs.push({ id: e.p, from, to: { x: e.x, y: e.y }, jump: true }); p.x = e.x; p.y = e.y; p.moved = true; }
    else if (e.t === 'fall') { const to = { x: Math.max(-.45, Math.min(S.cols - .55, e.x)), y: Math.max(-.45, Math.min(S.rows - .55, e.y)) }; segs.push({ id: e.p, from, to }); marks.push({ k: 'fall', ...to }); p.moved = true; }
    else if (e.t === 'splash') { segs.push({ id: e.p, from, to: { x: e.x, y: e.y } }); p.x = e.x; p.y = e.y; marks.push({ k: 'fall', x: e.x, y: e.y }); p.moved = true; }
    else if (e.t === 'appear') { p.x = e.x; p.y = e.y; marks.push({ k: 'back', id: e.p, x: e.x, y: e.y }); }
    else if (e.t === 'impact') marks.push({ k: 'hit', x: p.x, y: p.y });
    else if (e.t === 'sink') marks.push({ k: 'sink', id: e.p, x: p.x, y: p.y });
  }
  // fantasma de la salida de cada pieza que se ha movido
  for (const [id, p] of Object.entries(pos)) if (p.moved && id !== 'hole') {
    c.strokeStyle = colOf(id); c.lineWidth = cw * .06; c.setLineDash([cw * .08, cw * .07]);
    c.beginPath(); c.arc(cx(p.start.x), cy(p.start.y), cw * .26, 0, 7); c.stroke(); c.setLineDash([]);
  }
  for (const s of segs) {
    c.strokeStyle = s.jump ? 'rgba(169,195,230,.95)' : colOf(s.id); c.lineWidth = s.jump ? cw * .05 : cw * .1; c.lineCap = 'round';
    c.setLineDash(s.jump ? [cw * .1, cw * .12] : []);
    c.beginPath(); c.moveTo(cx(s.from.x), cy(s.from.y)); c.lineTo(cx(s.to.x), cy(s.to.y)); c.stroke(); c.setLineDash([]);
  }
  // punta de flecha al final de cada tramo continuo
  for (const s of segs) if (!s.jump) {
    const a = Math.atan2(cy(s.to.y) - cy(s.from.y), cx(s.to.x) - cx(s.from.x)), L = cw * .2, x = cx(s.to.x), y = cy(s.to.y);
    c.fillStyle = colOf(s.id); c.beginPath(); c.moveTo(x + Math.cos(a) * L * .6, y + Math.sin(a) * L * .6);
    c.lineTo(x + Math.cos(a + 2.5) * L, y + Math.sin(a + 2.5) * L); c.lineTo(x + Math.cos(a - 2.5) * L, y + Math.sin(a - 2.5) * L); c.fill();
  }
  // pelotas donde han acabado (las embocadas, más pequeñas, dentro del hoyo y con anillo dorado)
  for (const b of S.balls) {
    if (b.decoy && b.holed) continue;
    const x = cx(b.x), y = cy(b.y), r = cw * (b.holed ? .2 : .27);
    if (b.holed) { c.fillStyle = '#242424'; c.beginPath(); c.arc(x, y, cw * .3, 0, 7); c.fill(); }
    c.fillStyle = 'rgba(20,40,20,.3)'; c.beginPath(); c.arc(x + r * .18, y + r * .22, r, 0, 7); c.fill();
    c.fillStyle = b.decoy ? '#F1F1DC' : pColor(b.player); c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
    c.strokeStyle = '#F1F1DC'; c.lineWidth = r * .16; c.stroke();
    if (!b.decoy) { c.fillStyle = '#fff'; c.font = `700 ${Math.round(r * .78)}px Outfit, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(playerTag(b.player), x, y + 1); c.textBaseline = 'alphabetic'; }
  }
  parLabels();
  for (const m of marks) {
    const x = cx(m.x), y = cy(m.y);
    if (m.k === 'sink') {
      c.strokeStyle = '#F2B705'; c.lineWidth = cw * .07; c.beginPath(); c.arc(x, y, cw * .4, 0, 7); c.stroke();
      // la bandera, por encima (que se vea que es el hoyo)
      c.strokeStyle = '#F1F1DC'; c.lineWidth = cw * .045; c.lineCap = 'round'; c.beginPath(); c.moveTo(x + cw * .34, y - cw * .06); c.lineTo(x + cw * .34, y - cw * .56); c.stroke();
      c.fillStyle = '#E8873A'; c.beginPath(); c.moveTo(x + cw * .36, y - cw * .56); c.lineTo(x + cw * .62, y - cw * .47); c.lineTo(x + cw * .36, y - cw * .38); c.fill();
    }
    if (m.k === 'hit') { c.fillStyle = '#F2B705'; c.strokeStyle = '#F1F1DC'; c.lineWidth = cw * .03; star(c, x + cw * .28, y - cw * .28, cw * .17, cw * .08); c.fill(); c.stroke(); }
    if (m.k === 'fall') { c.strokeStyle = '#F1F1DC'; c.lineWidth = cw * .14; xMark(c, x, y, cw * .13); c.strokeStyle = '#D9603A'; c.lineWidth = cw * .07; xMark(c, x, y, cw * .13); }
  }
}
function star(c, x, y, R, r, n = 8) {
  c.beginPath();
  for (let i = 0; i < n * 2; i++) { const a = Math.PI * i / n - Math.PI / 2, d = i % 2 ? r : R; c[i ? 'lineTo' : 'moveTo'](x + d * Math.cos(a), y + d * Math.sin(a)); }
  c.closePath();
}
function xMark(c, x, y, s) { c.lineCap = 'round'; c.beginPath(); c.moveTo(x - s, y - s); c.lineTo(x + s, y + s); c.moveTo(x + s, y - s); c.lineTo(x - s, y + s); c.stroke(); }
function fit(c, text, max, size, weight = 600) {
  let s = size; c.font = `${weight} ${s}px Outfit, sans-serif`;
  while (c.measureText(text).width > max && s > 20) { s -= 2; c.font = `${weight} ${s}px Outfit, sans-serif`; }
}

export async function buildShareImage({ title, meta }) {
  const fp = app.finalPlay, S = app.game.S;
  await document.fonts?.ready;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d'), col = themeColors();
  // fondo: franjas de césped segado, como la partida
  c.fillStyle = col.bgA; c.fillRect(0, 0, W, H);
  c.save(); c.translate(W / 2, H / 2); c.rotate(-Math.PI / 4); c.fillStyle = col.bgB;
  for (let i = -20; i < 20; i += 2) c.fillRect(i * 70, -H, 70, H * 2);
  c.restore();
  // cabecera
  c.fillStyle = '#F1F1DC'; rr(c, PAD - 16, PAD - 16, W - 2 * PAD + 32, 214, 30); c.fill();
  c.textAlign = 'left'; c.fillStyle = '#4F8A4B'; c.font = '600 40px Outfit, sans-serif'; c.fillText('chaotic golf', PAD + 12, PAD + 42);
  c.fillStyle = '#E8873A'; c.fillText('.', PAD + 12 + c.measureText('chaotic golf').width, PAD + 42);
  c.fillStyle = '#242424'; fit(c, title, W - 2 * PAD - 24, 72); c.fillText(title, PAD + 12, PAD + 124);
  c.fillStyle = '#66725F'; fit(c, meta, W - 2 * PAD - 24, 30, 500); c.fillText(meta, PAD + 12, PAD + 170);
  // tablero con la jugada
  drawBoard(c, S, fp, { x: PAD, y: PAD + 250, w: W - 2 * PAD, h: H - PAD * 2 - 250 - 200 }, col);
  // pie: la carta y quién la jugó
  const fy = H - PAD - 150;
  c.fillStyle = '#F1F1DC'; rr(c, PAD - 16, fy - 16, W - 2 * PAD + 32, 166, 30); c.fill();
  const def = CARDS[fp.card];
  let tx = PAD + 12;
  if (def) {
    c.fillStyle = '#FBFBF1'; rr(c, PAD + 8, fy - 2, 96, 130, 14); c.fill();
    c.fillStyle = def.color === 'orange' ? '#E8873A' : '#242424'; rr(c, PAD + 8, fy - 2, 96, 16, [14, 14, 0, 0]); c.fill();
    const img = await cardImage(def);
    if (img) c.drawImage(img, PAD + 18, fy + 26, 76, 76);
    tx = PAD + 132;
  }
  c.textAlign = 'left';
  c.fillStyle = '#66725F'; c.font = '600 22px Outfit, sans-serif'; c.fillText(t('share.finalPlay').toUpperCase(), tx, fy + 34);
  const who = fp.actor != null ? t('share.by', { card: def ? def.short || def.name : '', name: displayName(fp.actor) }) : (def ? def.short || def.name : '');
  c.fillStyle = '#242424'; fit(c, who, W - tx - PAD - 12, 44); c.fillText(who, tx, fy + 86);
  c.fillStyle = '#66725F'; c.font = '500 22px Outfit, sans-serif'; c.fillText((location.host || 'chaotic golf').replace(/^www\./, ''), tx, fy + 122);
  return new Promise(res => cv.toBlob(res, 'image/png'));
}

/* ---------- el diálogo de compartir ---------- */
// text: resultado en texto que se puede copiar además de la imagen (reto diario)
export async function openShareDialog({ title, meta, text = null }) {
  if (!app.finalPlay || !app.game) return;
  const blob = await buildShareImage({ title, meta });
  if (!blob) { toast(t('share.failed'), 'warn'); return; }
  const file = new File([blob], 'chaotic-golf.png', { type: 'image/png' });
  const url = URL.createObjectURL(blob);
  const caption = t('share.caption') + ' ' + location.origin + location.pathname;
  const canShareFile = !!navigator.canShare?.({ files: [file] });
  const canCopyImg = !!(navigator.clipboard?.write && window.ClipboardItem);
  const dlg = $('dialog');
  const btn = (v, label, main = false) => `<button type="button" data-share="${v}" class="${main ? 'btn-primary' : 'btn-light'}">${esc(label)}</button>`;
  dlg.innerHTML = `<form method="dialog" class="dlgBox shareBox">
    <h3>${esc(t('share.title'))}</h3>
    <img class="sharePreview" src="${url}" alt="${esc(t('share.previewAlt'))}">
    <div class="shareBtns">${canShareFile ? btn('native', t('share.image'), true) : ''}${canCopyImg ? btn('copy', t('share.copyImg'), !canShareFile) : ''}` +
    `${btn('download', t('share.download'), !canShareFile && !canCopyImg)}${text ? btn('text', t('share.copyText')) : ''}</div>
    <div class="dlgBtns"><button value="close">${esc(t('common.close'))}</button></div></form>`;
  const onClick = async e => {
    const b = e.target.closest('[data-share]');
    if (!b) return;
    sfx('select');
    try {
      if (b.dataset.share === 'native') await navigator.share({ files: [file], text: caption });
      if (b.dataset.share === 'copy') { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); toast(t('share.imgCopied')); }
      if (b.dataset.share === 'text') { await navigator.clipboard.writeText(text); toast(t('share.copied')); }
      if (b.dataset.share === 'download') {
        const a = document.createElement('a'); a.href = url; a.download = 'chaotic-golf.png'; a.click();
      }
    } catch (err) { if (err?.name !== 'AbortError') toast(t('share.failed'), 'warn'); }
  };
  dlg.addEventListener('click', onClick);
  dlg.addEventListener('close', () => { dlg.removeEventListener('click', onClick); setTimeout(() => URL.revokeObjectURL(url), 1000); }, { once: true });
  dlg.showModal();
  dlg.querySelector('[data-share]')?.focus();
}
