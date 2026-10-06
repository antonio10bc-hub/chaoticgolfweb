// Estadísticas del reto diario: la etiqueta de las barras, junto a la racha en la tarjeta del menú, abre una ventana con
//   · días jugados, % ganados, racha actual y racha máxima (en una fila)
//   · las insignias de la racha: los tres niveles de la pelota de fuego (7 · 30 · 365 días, skins.js)
//   · en cuántos turnos has completado cada reto (tu mejor resultado de cada día; el de hoy, resaltado)
// Se comparte como imagen (PNG 1080×1350, como la jugada final) con el resumen en texto y el enlace al reto de hoy:
// en el móvil, con la hoja del sistema; en el ordenador, al portapapeles (imagen y texto de una vez, o solo el texto).
import { $, esc } from './dom.js';
import { t } from '../i18n/index.js';
import { dailyStats } from './records.js';
import { dateKey } from '../content/levels/generate.js';
import { skinById, skinProgress, skinBall, ROMAN } from './skins.js';
import { myColor, goalLabel } from './my-ball.js';
import { drawSkinBall } from './skin-canvas.js';
import { dailyLink } from './screen-modes.js';
import { toast } from './hud.js';
import { sfx } from '../audio/sfx.js';
import { track } from './analytics.js';

const icon = id => `<svg class="i" aria-hidden="true"><use href="#${id}"/></svg>`;
const FIRE = () => skinById('fire');

// columnas de la distribución: de 1 turno al más alto que tengas (al menos 6); a partir de 10, juntos en "10+"
const MAX_COL = 10;
function distCols(dist) {
  const keys = Object.keys(dist).map(Number).filter(k => dist[k] > 0);
  const hi = Math.min(MAX_COL, Math.max(6, ...keys));
  return Array.from({ length: hi }, (_, i) => {
    const n = i + 1, last = n === MAX_COL;
    return { n, label: last ? n + '+' : String(n), count: last ? keys.filter(k => k >= n).reduce((a, k) => a + dist[k], 0) : dist[n] || 0 };
  });
}
const colOf = (cols, turns) => turns == null ? -1 : Math.min(turns, cols.length) - 1;

// los cuatro números, las insignias (nivel ganado y lo que falta para el siguiente) y las columnas
function model(date = dateKey()) {
  const st = dailyStats(date), s = FIRE(), p = skinProgress(s);
  const cols = distCols(st.dist);
  return { st, cols, today: colOf(cols, st.today), top: Math.max(1, ...cols.map(c => c.count)),
    badges: s.at.map((at, i) => ({ lvl: i + 1, at, got: p.lvl > i, next: p.lvl === i, pct: p.lvl === i ? p.pct : 0, label: goalLabel(s, i + 1) })) };
}
const NUMS = st => [[st.played, 'dstats.played'], [st.pct + '%', 'dstats.pct'], [st.streak, 'dstats.streak'], [st.best, 'dstats.best']];

function html(m) {
  const color = myColor();
  const nums = NUMS(m.st).map(([v, k]) => `<div class="dsNum"><b>${v}</b><small>${esc(t(k))}</small></div>`).join('');
  const badges = m.badges.map(b => `<div class="dsBadge${b.got ? ' got' : ''}" title="${esc(t('skins.fire.name') + ' ' + ROMAN[b.lvl] + ' · ' + b.label)}">` +
    `<span class="dsBall">${skinBall({ id: 'fire', lvl: b.lvl }, { size: 40, color })}${b.got ? '' : `<span class="dsLock">${icon('i-lock')}</span>`}</span>` +
    `<small>${esc(b.label)}</small>${b.next ? `<span class="dsBar"><i style="width:${Math.round(b.pct * 100)}%"></i></span>` : ''}</div>`).join('');
  const any = m.cols.some(c => c.count);
  const cols = m.cols.map((c, i) => `<div class="dsCol${i === m.today ? ' today' : ''}${c.count ? '' : ' zero'}">` +
    `<span class="dsBarV" style="--h:${c.count / m.top}"><em>${c.count}</em></span><small>${c.label}</small></div>`).join('');
  return `<form method="dialog" class="dlgBox dsBox" aria-label="${esc(t('dstats.aria'))}">` +
    `<div class="dsHead"><span class="dsIco">${icon('i-stats')}</span><h3>${esc(t('dstats.title'))}</h3></div>` +
    `<div class="dsNums">${nums}</div>` +
    `<h4>${esc(t('dstats.badges'))}</h4><div class="dsBadges">${badges}</div>` +
    `<h4>${esc(t('dstats.dist'))}</h4>` +
    (any ? `<div class="dsDist" role="img" aria-label="${esc(m.cols.filter(c => c.count).map(c => `${c.label}: ${c.count}`).join(', '))}">${cols}</div>`
      : `<p class="dsNone">${esc(t('dstats.none'))}</p>`) +
    `<div class="dlgBtns"><button type="button" value="close" class="btn-light">${esc(t('common.close'))}</button>` +
    `<button type="button" class="btn-primary dsShare" data-ds="share">${icon('i-share')}${esc(t('dstats.share'))}</button></div></form>`;
}

/* ---------- la imagen y el texto para compartir ---------- */
const W = 1080, H = 1350, PAD = 72;
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); };
function fit(c, text, max, size, weight = 600) {
  let s = size; c.font = `${weight} ${s}px Outfit, sans-serif`;
  while (c.measureText(text).width > max && s > 16) { s -= 2; c.font = `${weight} ${s}px Outfit, sans-serif`; }
}
export async function buildStatsImage(m = model()) {
  await document.fonts?.ready;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  // fondo: franjas de césped segado (como la imagen de la jugada final) y la tarjeta crema
  c.fillStyle = '#8BBE7A'; c.fillRect(0, 0, W, H);
  c.save(); c.translate(W / 2, H / 2); c.rotate(-Math.PI / 4); c.fillStyle = '#94C584';
  for (let i = -20; i < 20; i += 2) c.fillRect(i * 70, -H, 70, H * 2);
  c.restore();
  c.fillStyle = '#F1F1DC'; rr(c, PAD - 24, PAD - 24, W - 2 * PAD + 48, H - 2 * PAD + 48, 40); c.fill();
  const L = PAD + 24, R = W - PAD - 24, IW = R - L;
  // cabecera
  c.textAlign = 'left'; c.fillStyle = '#4F8A4B'; c.font = '600 40px Outfit, sans-serif'; c.fillText('chaotic golf', L, PAD + 48);
  c.fillStyle = '#E8873A'; c.fillText('.', L + c.measureText('chaotic golf').width, PAD + 48);
  c.fillStyle = '#242424'; fit(c, t('modes.daily.title'), IW, 76, 500); c.fillText(t('modes.daily.title'), L, PAD + 140);
  c.fillStyle = '#66725F'; c.font = '500 32px Outfit, sans-serif'; c.fillText(t('dstats.title'), L, PAD + 190);
  // los cuatro números
  let y = PAD + 250;
  const cw = IW / 4;
  NUMS(m.st).forEach(([v, k], i) => {
    const x = L + cw * i + cw / 2;
    c.textAlign = 'center'; c.fillStyle = '#242424'; c.font = '600 92px Outfit, sans-serif'; c.fillText(String(v), x, y + 90);
    c.fillStyle = '#66725F'; fit(c, t(k), cw - 16, 26, 500); c.fillText(t(k), x, y + 134);
  });
  // insignias: las tres pelotas de fuego (las que faltan, apagadas)
  y += 196;
  c.textAlign = 'left'; c.fillStyle = '#66725F'; c.font = '600 24px Outfit, sans-serif'; c.fillText(t('dstats.badges').toUpperCase(), L, y);
  const bw = IW / 3, color = myColor();
  for (const [i, b] of m.badges.entries()) {
    const x = L + bw * i + bw / 2, by = y + 128;
    c.save(); if (!b.got) c.globalAlpha = .28;
    await drawSkinBall(c, x, by, 46, b.got ? color : '#9AA393', { id: 'fire', lvl: b.lvl });
    c.restore();
    c.textAlign = 'center'; c.fillStyle = b.got ? '#242424' : '#9AA393'; c.font = '600 28px Outfit, sans-serif'; c.fillText(b.label, x, by + 96);
  }
  // distribución: una columna por número de turnos (la de hoy, en naranja)
  y += 300;
  c.textAlign = 'left'; c.fillStyle = '#66725F'; c.font = '600 24px Outfit, sans-serif'; c.fillText(t('dstats.dist').toUpperCase(), L, y);
  const top = y + 40, base = H - PAD - 120, n = m.cols.length, gw = IW / n, bwid = Math.min(72, gw * .72);
  for (const [i, col] of m.cols.entries()) {
    const x = L + gw * i + gw / 2, h = col.count ? Math.max(14, (base - top - 50) * col.count / m.top) : 6;
    c.fillStyle = i === m.today ? '#E8873A' : col.count ? '#4F8A4B' : '#D9D9C4';
    rr(c, x - bwid / 2, base - h, bwid, h, 10); c.fill();
    c.textAlign = 'center';
    if (col.count) { c.fillStyle = '#242424'; c.font = '600 30px Outfit, sans-serif'; c.fillText(String(col.count), x, base - h - 12); }
    c.fillStyle = '#66725F'; c.font = '500 28px Outfit, sans-serif'; c.fillText(col.label, x, base + 40);
  }
  c.textAlign = 'left'; c.fillStyle = '#66725F'; c.font = '500 24px Outfit, sans-serif';
  c.fillText((location.host || 'chaotic golf').replace(/^www\./, ''), L, H - PAD - 6);
  return new Promise(res => cv.toBlob(res, 'image/png'));
}
export function statsShareText(m = model()) {
  const s = m.st, got = m.badges.filter(b => b.got).length;
  return [
    `Chaotic Golf · ${t('modes.daily.title')} · ${t('dstats.title')}`,
    `📅 ${s.played} · ✅ ${s.pct}% · 🔥 ${s.streak} · 🏆 ${s.best}`,
    got ? `🏅 ${t('skins.fire.name')} ${ROMAN[got]}` : '',
    dailyLink(),
  ].filter(Boolean).join('\n');
}

// en el móvil, la hoja del sistema (imagen y texto); si no, imagen y texto al portapapeles, o al menos el texto.
// (el portapapeles se pide en el mismo toque, con la imagen como promesa: Safari solo lo permite así)
async function share(btn, blob, text) {
  sfx('select');
  const touch = window.matchMedia('(pointer: coarse)').matches;
  if (touch && navigator.share) {
    try {
      const b = await blob, file = b && new File([b], 'chaotic-golf.png', { type: 'image/png' });
      const data = file && navigator.canShare?.({ files: [file] }) ? { files: [file], text } : { text };
      await navigator.share(data); track('compartir', { que: 'estadisticas', como: 'sistema' }); return;
    } catch (e) { if (e?.name === 'AbortError') return; }
  }
  const tries = [];
  if (navigator.clipboard?.write && window.ClipboardItem) tries.push(['imagen+texto', () => navigator.clipboard.write([new ClipboardItem({
    'image/png': blob.then(b => b || Promise.reject(new Error('sin imagen'))), 'text/plain': Promise.resolve(new Blob([text], { type: 'text/plain' })) })])]);
  tries.push(['texto', () => navigator.clipboard.writeText(text)]);
  for (const [como, go] of tries) {
    try {
      await go();
      track('compartir', { que: 'estadisticas', como });
      btn.classList.add('done'); btn.innerHTML = `${icon('i-check')}${esc(t('share.copiedBtn'))}`;
      return;
    } catch (e) { /* el siguiente */ }
  }
  toast(t('share.failed'), 'warn');
}

export function openDailyStats() {
  const m = model(), dlg = $('dialog');
  sfx('select');
  track('estadisticas', { de: 'reto' });
  dlg.innerHTML = html(m);
  const blob = buildStatsImage(m), text = statsShareText(m); // (la imagen se prepara ya: al tocar Compartir está lista)
  dlg.onclick = e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.ds === 'share') share(b, blob, text);
    else if (b.value === 'close') dlg.close('close');
  };
  dlg.addEventListener('close', () => { dlg.onclick = null; }, { once: true });
  dlg.returnValue = '';
  dlg.showModal();
  dlg.querySelector('.dsShare')?.focus();
}
