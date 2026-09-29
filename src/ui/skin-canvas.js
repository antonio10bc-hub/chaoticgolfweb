// Tu pelota con su skin, dibujada en un lienzo (la imagen de compartir la jugada final). En el juego las skins son
// CSS animado (styles/skins.css); aquí se pinta un fotograma quieto con las mismas medidas (todo en función de D, el
// diámetro de la bola) y las mismas piezas SVG (llamas, laurel, corona, gotas…, de skins.js) como imágenes.
import { SKIN_ART } from './skins.js';

const DEFS = '<defs>' +
  '<linearGradient id="skFlame" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FFE066"/><stop offset=".45" stop-color="#F5A33A"/><stop offset="1" stop-color="#E0482A"/></linearGradient>' +
  '<linearGradient id="skFlameCore" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#FFE9A8"/></linearGradient>' +
  '<linearGradient id="skGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE9A0"/><stop offset=".5" stop-color="#E6B94A"/><stop offset="1" stop-color="#B8862A"/></linearGradient></defs>';
const cache = new Map();
// una pieza SVG de skins.js como imagen (con los degradados que en la página viven en el sprite)
function svgImg(svg) {
  if (cache.has(svg)) return cache.get(svg);
  const src = svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ').replace(/aria-hidden="true"/, '').replace(/(<svg[^>]*>)/, `$1${DEFS}`);
  const p = new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src); });
  cache.set(svg, p);
  return p;
}
const rad = d => d * Math.PI / 180;
function glow(c, x, y, r, stops) { // aura: degradado radial
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  for (const [o, col] of stops) g.addColorStop(o, col);
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
}
function conic(c, x, y, cols, a0 = 0) { // degradado cónico (con respaldo lineal en navegadores antiguos)
  if (c.createConicGradient) { const g = c.createConicGradient(a0, x, y); cols.forEach((col, i) => g.addColorStop(i / (cols.length - 1), col)); return g; }
  const g = c.createLinearGradient(x - 50, y - 50, x + 50, y + 50); cols.forEach((col, i) => g.addColorStop(i / (cols.length - 1), col)); return g;
}
function ring(c, x, y, r0, r1, fill) { c.fillStyle = fill; c.beginPath(); c.arc(x, y, r1, 0, 7); c.arc(x, y, r0, 0, 7, true); c.fill(); }
// pieza en órbita (gotas, destellos, piezas de puzle): ángulo desde arriba, a 0,74 D del centro
const orbit = (x, y, D, a) => [x + Math.sin(rad(a)) * D * .74, y - Math.cos(rad(a)) * D * .74];
async function put(c, svg, cx, cy, w, h, rot = 0) {
  const img = await svgImg(svg); if (!img) return;
  c.save(); c.translate(cx, cy); if (rot) c.rotate(rot); c.drawImage(img, -w / 2, -h / 2, w, h); c.restore();
}

// la bola: color, sombra, brillo, hoyuelos y media luna de volumen (como .skCore)
function ballBody(c, x, y, R, color) {
  c.fillStyle = 'rgba(20,40,20,.3)'; c.beginPath(); c.ellipse(x + R * .08, y + R * .14, R * 1.02, R, 0, 0, 7); c.fill();
  c.fillStyle = color; c.beginPath(); c.arc(x, y, R, 0, 7); c.fill();
  c.save(); c.beginPath(); c.arc(x, y, R, 0, 7); c.clip();
  c.fillStyle = 'rgba(0,0,0,.13)'; const st = R * .15;
  for (let yy = y - R; yy < y + R; yy += st) for (let xx = x - R; xx < x + R; xx += st) { c.beginPath(); c.arc(xx, yy, R * .03, 0, 7); c.fill(); }
  c.fillStyle = 'rgba(0,0,0,.14)'; c.beginPath(); c.arc(x, y, R, 0, 7); c.arc(x - R * .12, y - R * .12, R, 0, 7, true); c.fill('evenodd');
  c.restore();
  c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.arc(x - R * .38, y - R * .46, R * .24, 0, 7); c.fill();
}
const clipBall = (c, x, y, R) => { c.save(); c.beginPath(); c.arc(x, y, R, 0, 7); c.clip(); };

// x, y: centro · R: radio · sk: { id, lvl } o null (la normal)
export async function drawSkinBall(c, x, y, R, color, sk) {
  const D = R * 2, A = SKIN_ART, lvl = sk?.lvl || 0;
  const back = [], front = [], surf = []; // (capas: detrás, sobre la superficie, delante)
  switch (sk?.id) {
    case 'fire': {
      const n = [3, 5, 7][lvl - 1], spread = [64, 120, 176][lvl - 1], h = D * [.52, .7, .9][lvl - 1];
      if (lvl >= 2) back.push(() => glow(c, x, y, D * .92, [[0, 'rgba(255,176,64,.6)'], [.45, 'rgba(255,110,40,.18)'], [.68, 'rgba(255,110,40,0)']]));
      const svg = lvl >= 3 ? A.FLAME : A.FLAME.replace('class="flCore"', 'class="flCore" opacity="0"');
      for (let i = 0; i < n; i++) {
        const a = n === 1 ? 0 : -spread / 2 + spread * i / (n - 1), k = 1 - Math.abs(a) / 260;
        back.push(async () => { c.save(); c.translate(x, y); c.rotate(rad(a)); await put(c, svg, 0, -(R * .6 + h * k / 2), D * .42 * k, h * k); c.restore(); });
      }
      surf.push(() => glow(c, x, y + R * 1.24, R * 1.16, [[0, 'rgba(255,160,50,.75)'], [1, 'rgba(255,120,40,0)']]));
      if (lvl >= 3) for (let i = 0; i < 7; i++) front.push(() => { const ex = x + (i - 3) * D * .13, ey = y - R - D * (.1 + (i % 3) * .14);
        c.fillStyle = '#FFE066'; c.shadowColor = '#FF9A3C'; c.shadowBlur = D * .06; c.beginPath(); c.arc(ex, ey, D * .035 * (.8 + (i % 3) * .25), 0, 7); c.fill(); c.shadowBlur = 0; });
      break;
    }
    case 'classic':
      if (lvl >= 2) back.push(() => put(c, A.laurel(), x, y, D * 1.88, D * 1.88));
      front.push(() => { if (lvl >= 3) { c.shadowColor = 'rgba(255,215,110,.8)'; c.shadowBlur = D * .25; }
        ring(c, x, y, R + D * .008, R + D * .06, '#E0B040'); c.shadowBlur = 0; ring(c, x, y, R + D * .008, R + D * .022, '#FFF0BE'); });
      if (lvl >= 3) {
        surf.push(() => { const g = c.createLinearGradient(x - R, y - R, x + R, y + R); g.addColorStop(.35, 'rgba(255,255,255,0)'); g.addColorStop(.48, 'rgba(255,255,255,.7)'); g.addColorStop(.6, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(x - R, y - R, D, D); });
        for (const [dx, dy] of [[-.58, -.42], [.58, -.3], [-.44, .5], [.52, .46]]) front.push(() => put(c, A.SPARK('#FFF4C2'), x + dx * D + D * .12, y + dy * D + D * .12, D * .24, D * .24));
      }
      break;
    case 'water': {
      const h = [.4, .52, .62][lvl - 1];
      surf.push(() => put(c, A.WAVE.replace('<path ', '<path fill="rgba(91,182,214,.6)" '), x - D * .3, y + R - D * h * .9 / 2, D * 1.6, D * h * .9),
        () => put(c, A.WAVE.replace('<path ', '<path fill="rgba(125,208,236,.65)" '), x + D * .2, y + R - D * h / 2, D * 1.6, D * h),
        () => { c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(x - R * .34, y - R * .54, R * .34, R * .22, rad(-28), 0, 7); c.fill(); });
      if (lvl >= 2) back.push(() => { for (const [s, a] of [[1.3, .55], [1.65, .25]]) { c.strokeStyle = `rgba(150,222,244,${a})`; c.lineWidth = D * .04; c.beginPath(); c.arc(x, y, R * s, 0, 7); c.stroke(); } });
      if (lvl >= 3) {
        surf.push(() => { c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 1.5; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(x - R * .6 + i * R * .4, y + R * (.55 - (i % 2) * .3), D * .045, 0, 7); c.stroke(); } });
        for (const a of [30, 150, 270]) front.push(() => { const [ox, oy] = orbit(x, y, D, a); return put(c, A.DROP, ox, oy, D * .22, D * .29); });
      }
      break;
    }
    case 'wood':
      surf.push(() => { c.strokeStyle = 'rgba(80,45,15,.24)'; c.lineWidth = D * .025;
        for (let i = 1; i < 9; i++) { c.beginPath(); c.ellipse(x - R * .56, y + R * 1.36, D * .16 * i * 1.3, D * .16 * i * .7, 0, 0, 7); c.stroke(); } });
      if (lvl >= 3) back.push(() => put(c, A.WINDMILL, x, y, D * 2, D * 2, rad(18)));
      if (lvl >= 2) front.push(() => { ring(c, x, y, R * .996, R * 1.2, '#B98552'); c.strokeStyle = 'rgba(122,82,48,.55)'; c.lineWidth = 1.2;
        for (let i = 0; i < 36; i++) { const a = rad(i * 10); c.beginPath(); c.moveTo(x + Math.cos(a) * R, y + Math.sin(a) * R); c.lineTo(x + Math.cos(a + .08) * R * 1.2, y + Math.sin(a + .08) * R * 1.2); c.stroke(); }
        c.strokeStyle = '#7A5230'; c.lineWidth = D * .02; c.beginPath(); c.arc(x, y, R * 1.2, 0, 7); c.stroke(); });
      break;
    case 'prism': {
      const IRI = ['#FF8FC4', '#8FB6FF', '#7EE8C8', '#FFE38A', '#C39BFF', '#FF8FC4'];
      surf.push(() => { c.globalAlpha = lvl >= 3 ? .62 : .5; c.fillStyle = conic(c, x, y, IRI, rad(30)); c.fillRect(x - R, y - R, D, D); c.globalAlpha = 1; });
      if (lvl >= 3) back.push(() => glow(c, x, y, D * .92, [[0, 'rgba(200,170,255,.55)'], [.45, 'rgba(255,160,210,.2)'], [.68, 'rgba(255,160,210,0)']]));
      if (lvl >= 2) back.push(() => ring(c, x, y, R * 1.02, R * 1.24, conic(c, x, y, IRI)));
      if (lvl >= 3) ['#FFD1E8', '#CFE3FF', '#C8F5E6', '#FFF1C9'].forEach((col, i) => front.push(() => { const [ox, oy] = orbit(x, y, D, 45 + i * 90); return put(c, A.SPARK(col), ox, oy, D * .26, D * .26); }));
      break;
    }
    case 'bolt':
      back.push(() => { c.fillStyle = '#3E6AA8'; c.beginPath(); c.roundRect(x - D * .1, y - R - D * .2, D * .2, D * .26, [D * .05, D * .05, 0, 0]); c.fill();
        c.fillStyle = '#FFD84A'; c.fillRect(x - D * .08, y - R - D * .24, D * .16, D * .05);
        for (const [dy, w] of [[-.16, .7], [0, 1], [.16, .8]]) { const g = c.createLinearGradient(x - R - D * .85 * w, 0, x - R * .6, 0);
          g.addColorStop(0, 'rgba(200,230,255,0)'); g.addColorStop(1, 'rgba(225,242,255,.95)'); c.fillStyle = g;
          c.beginPath(); c.roundRect(x - R * .2 - D * .85 * w, y + dy * D - D * .045, D * .85 * w, D * .09, D * .045); c.fill(); } });
      if (lvl >= 3) back.push(() => glow(c, x, y, D * .92, [[0, 'rgba(127,196,255,.6)'], [.5, 'rgba(63,111,168,.15)'], [.68, 'rgba(63,111,168,0)']]));
      if (lvl >= 2) front.push(() => { ring(c, x, y, R * 1.014, R * 1.3, '#E4F0FF'); c.strokeStyle = '#2D4F7C'; c.lineWidth = D * .036;
        for (let i = 0; i < 12; i++) { const a = rad(i * 30); c.beginPath(); c.moveTo(x + Math.sin(a) * R * 1.06, y - Math.cos(a) * R * 1.06); c.lineTo(x + Math.sin(a) * R * 1.26, y - Math.cos(a) * R * 1.26); c.stroke(); }
        c.lineWidth = D * .018; c.beginPath(); c.arc(x, y, R * 1.3, 0, 7); c.stroke();
        const [tx, ty] = [x + Math.sin(rad(60)) * D * .585, y - Math.cos(rad(60)) * D * .585]; c.fillStyle = '#FFD84A'; c.beginPath(); c.arc(tx, ty, D * .06, 0, 7); c.fill(); });
      if (lvl >= 3) front.push(() => put(c, A.BOLT, x - R * .75, y - R * .7, D * .3, D * .48, rad(-18)), () => put(c, A.BOLT, x + R * 1.1, y - R * .55, D * .3, D * .48, rad(22)));
      break;
    case 'crown': {
      const w = D * (lvl >= 2 ? .7 : .56), h = D * (lvl >= 2 ? .5 : .4), top = y - R - D * (lvl >= 2 ? .4 : .3);
      if (lvl >= 3) back.push(() => { c.save(); for (let i = 0; i < 12; i++) { c.fillStyle = 'rgba(240,150,90,.35)'; c.beginPath(); c.moveTo(x, y);
        c.arc(x, y, D * .84, rad(i * 30 - 4.5 - 90), rad(i * 30 + 4.5 - 90)); c.closePath(); c.fill(); } c.restore(); });
      if (lvl >= 2) back.push(() => glow(c, x, y, D * .92, [[0, 'rgba(232,110,90,.55)'], [.45, 'rgba(181,71,63,.18)'], [.68, 'rgba(181,71,63,0)']]));
      front.push(() => put(c, A.CROWN(lvl - 1), x, top + h / 2, w, h, rad(-8)));
      if (lvl >= 3) front.push(() => put(c, A.SPARK('#FFE3B0'), x - D * .5, y - D * .1, D * .24, D * .24), () => put(c, A.SPARK('#FFE3B0'), x + D * .72, y, D * .24, D * .24));
      break;
    }
    case 'puzzle':
      surf.push(() => put(c, A.JIGSAW, x, y, D, D));
      if (lvl >= 3) back.push(() => glow(c, x, y, D * .92, [[0, 'rgba(126,232,200,.55)'], [.45, 'rgba(46,138,128,.18)'], [.68, 'rgba(46,138,128,0)']]));
      if (lvl >= 2) (lvl >= 3 ? ['#2E8A80', '#E8873A', '#8E6BE0'] : ['#2E8A80']).forEach((col, i, arr) => front.push(() => { const [ox, oy] = orbit(x, y, D, 40 + i * 360 / arr.length); return put(c, A.PIECE(col), ox, oy, D * .3, D * .3); }));
      break;
  }
  for (const f of back) await f();
  ballBody(c, x, y, R, color);
  if (surf.length) { clipBall(c, x, y, R); for (const f of surf) await f(); c.restore(); }
  for (const f of front) await f();
}
