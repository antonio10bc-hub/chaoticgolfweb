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
// el destello que cruza la bola (clásica, prisma y corona III)
function shine(c, x, y, R) {
  const g = c.createLinearGradient(x - R, y - R, x + R, y + R); g.addColorStop(.35, 'rgba(255,255,255,0)'); g.addColorStop(.48, 'rgba(255,255,255,.7)'); g.addColorStop(.6, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(x - R, y - R, R * 2, R * 2);
}

// x, y: centro · R: radio · sk: { id, lvl } o null (la normal)
export async function drawSkinBall(c, x, y, R, color, sk) {
  const D = R * 2, A = SKIN_ART, lvl = sk?.lvl || 0;
  const back = [], front = [], surf = []; // (capas: detrás, sobre la superficie, delante)
  switch (sk?.id) {
    case 'fire': { // fuego dentro · corona de llamas · lava y bolas de fuego en órbita
      const noCore = A.FLAME.replace('class="flCore"', 'class="flCore" opacity="0"'), hi = D * (lvl >= 3 ? .8 : .5);
      if (lvl >= 2) for (let i = 0; i < 5; i++) {
        const a = -58 + 29 * i, k = 1 - Math.abs(a) / 260, h = D * .5;
        back.push(async () => { c.save(); c.translate(x, y); c.rotate(rad(a)); await put(c, noCore, 0, -(R * .6 + h * k / 2), D * .4 * k, h * k); c.restore(); });
      }
      surf.push(() => glow(c, x, y + R * 1.24, R * 1.24, [[0, 'rgba(255,160,50,.8)'], [1, 'rgba(255,120,40,0)']]));
      if (lvl >= 3) surf.push(() => glow(c, x, y + R, D, [[0, 'rgba(255,230,120,.95)'], [.4, 'rgba(255,140,40,.8)'], [.68, 'rgba(255,150,50,.3)'], [.88, 'rgba(255,150,50,0)']]));
      for (const [px, k] of [[-6, .9], [20, 1.15], [46, .95], [70, 1.1]]) surf.push(() => { c.globalAlpha = .9;
        const p = put(c, lvl >= 3 ? A.FLAME : noCore, x - R + D * (px + 18) / 100, y + R + D * .1 - hi * k / 2, D * .36 * k, hi * k); return p.then(() => { c.globalAlpha = 1; }); });
      if (lvl >= 3) for (const a of [30, 150, 270]) front.push(() => { const [ox, oy] = orbit(x, y, D, a);
        c.shadowColor = 'rgba(255,150,50,.85)'; c.shadowBlur = D * .05; return put(c, A.FLAME, ox, oy, D * .24, D * .32).then(() => { c.shadowBlur = 0; }); });
      break;
    }
    case 'classic': // bañada en oro · laurel · destello y destellos en órbita
      if (lvl >= 2) back.push(() => put(c, A.laurel(), x, y, D * 1.88, D * 1.88));
      surf.push(() => { c.fillStyle = 'rgba(242,200,88,.85)'; const st = D * .075;
        for (let yy = y - R + st / 2; yy < y + R; yy += st) for (let xx = x - R + st / 2; xx < x + R; xx += st) { c.beginPath(); c.arc(xx, yy, D * .015, 0, 7); c.fill(); }
        glow(c, x, y, R * Math.SQRT2, lvl >= 3 ? [[.5, 'rgba(255,226,130,0)'], [.76, 'rgba(255,226,130,.7)'], [1, '#EFC24E']] : [[.56, 'rgba(242,200,88,0)'], [.8, 'rgba(242,200,88,.5)'], [1, 'rgba(230,185,74,.85)']]); });
      if (lvl >= 3) surf.push(() => shine(c, x, y, R));
      front.push(() => { if (lvl >= 3) { c.shadowColor = 'rgba(255,215,110,.8)'; c.shadowBlur = D * .25; }
        ring(c, x, y, R + D * .008, R + D * .06, '#E0B040'); c.shadowBlur = 0; ring(c, x, y, R + D * .008, R + D * .022, '#FFF0BE'); });
      if (lvl >= 3) ['#FFF4C2', '#FFE38A', '#FFF4C2', '#FFE38A'].forEach((col, i) => front.push(() => { const [ox, oy] = orbit(x, y, D, 45 + i * 90); return put(c, A.SPARK(col), ox, oy, D * .24, D * .24); }));
      break;
    case 'water': { // agua dentro · ondas · más agua, burbujas y gotas en órbita
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
    case 'wood': // vetas · marco de madera · barnizada (nudo y brillo) y el molino
      surf.push(() => { c.strokeStyle = lvl >= 3 ? 'rgba(80,45,15,.42)' : 'rgba(80,45,15,.24)'; c.lineWidth = D * (lvl >= 3 ? .03 : .025);
        for (let i = 1; i < 9; i++) { c.beginPath(); c.ellipse(x - R * .56, y + R * 1.36, D * .16 * i * 1.3, D * .16 * i * .7, 0, 0, 7); c.stroke(); } });
      if (lvl >= 3) surf.push(() => { c.fillStyle = 'rgba(160,100,40,.25)'; c.fillRect(x - R, y - R, D, D);
        c.save(); c.translate(x + R * .34, y - R * .38); c.rotate(rad(-20)); c.fillStyle = 'rgba(70,38,12,.75)'; c.beginPath(); c.ellipse(0, 0, D * .04, D * .025, 0, 0, 7); c.fill();
        c.strokeStyle = 'rgba(70,38,12,.35)'; c.lineWidth = D * .015; for (const k of [1.8, 2.8]) { c.beginPath(); c.ellipse(0, 0, D * .04 * k, D * .025 * k, 0, 0, 7); c.stroke(); } c.restore();
        c.fillStyle = 'rgba(255,250,235,.45)'; c.beginPath(); c.ellipse(x - R * .3, y - R * .58, R * .46, R * .2, rad(-26), 0, 7); c.fill(); });
      if (lvl >= 3) back.push(() => put(c, A.WINDMILL, x, y, D * 2, D * 2, rad(18)));
      if (lvl >= 2) front.push(() => { ring(c, x, y, R * .996, R * 1.2, '#B98552'); c.strokeStyle = 'rgba(122,82,48,.55)'; c.lineWidth = 1.2;
        for (let i = 0; i < 36; i++) { const a = rad(i * 10); c.beginPath(); c.moveTo(x + Math.cos(a) * R, y + Math.sin(a) * R); c.lineTo(x + Math.cos(a + .08) * R * 1.2, y + Math.sin(a + .08) * R * 1.2); c.stroke(); }
        c.strokeStyle = '#7A5230'; c.lineWidth = D * .02; c.beginPath(); c.arc(x, y, R * 1.2, 0, 7); c.stroke(); });
      break;
    case 'steam': // cinturón de hierro · bocanadas de vapor · la caldera encendida y el tren en su vía
      if (lvl >= 3) surf.push(() => glow(c, x, y + R, R * 1.1, [[0, 'rgba(255,214,90,.9)'], [.45, 'rgba(240,110,40,.7)'], [1, 'rgba(200,52,31,0)']]));
      surf.push(() => { const g = c.createLinearGradient(0, y - D * .09, 0, y + D * .09); g.addColorStop(0, '#6A7078'); g.addColorStop(1, '#383C42');
        c.fillStyle = g; c.fillRect(x - R, y - D * .09, D, D * .18); c.fillStyle = lvl >= 3 ? '#FFE38A' : '#D9A441';
        for (let i = -3; i <= 3; i++) { c.beginPath(); c.arc(x + i * D * .16, y, D * .025, 0, 7); c.fill(); } });
      if (lvl >= 2) back.push(() => { c.fillStyle = 'rgba(255,255,255,.88)'; for (const [dx, dy, r] of [[-.12, -.62, .12], [.06, -.8, .15], [.24, -.98, .12]]) { c.beginPath(); c.arc(x + dx * D, y + dy * D, r * D, 0, 7); c.fill(); } });
      if (lvl >= 3) {
        back.push(() => { c.save(); c.strokeStyle = '#8A5A33'; c.lineWidth = D * .09; c.setLineDash([D * .05, D * .1]); c.beginPath(); c.arc(x, y, R * 1.62, 0, 7); c.stroke(); c.restore();
          c.strokeStyle = '#4B5057'; c.lineWidth = D * .025; for (const s of [1.5, 1.74]) { c.beginPath(); c.arc(x, y, R * s, 0, 7); c.stroke(); } });
        front.push(() => { const [ox, oy] = orbit(x, y, D, 60); return put(c, A.LOCO_MINI, ox, oy, D * .4, D * .3); });
      }
      break;
    case 'seasons': { // cuatro colores · pétalos, hojas y copos · colores vivos y las cuatro en órbita
      surf.push(() => { c.globalAlpha = lvl >= 3 ? .88 : .62; c.fillStyle = conic(c, x, y, ['#BFE0F0', '#BFE0F0', '#F4A9C4', '#F4A9C4', '#FFD23F', '#FFD23F', '#D9703A', '#D9703A', '#BFE0F0'], rad(-135)); c.fillRect(x - R, y - R, D, D); c.globalAlpha = 1; });
      if (lvl >= 2) ['#F8C3D6', '#D9703A', '#FFFFFF'].forEach((col, i) => back.push(() => { c.fillStyle = col; c.beginPath(); c.ellipse(x - R * .6 + i * R * .6, y - R * 1.15 + i * R * .2, D * .07, D * .05, .6, 0, 7); c.fill(); }));
      if (lvl >= 3) ['spring', 'summer', 'autumn', 'winter'].forEach((s, i) => front.push(() => { const [ox, oy] = orbit(x, y, D, i * 90);
        c.fillStyle = '#F1F1DC'; c.beginPath(); c.arc(ox, oy, D * .15, 0, 7); c.fill(); return put(c, A.SEASON_SVG(s), ox, oy, D * .3, D * .3); }));
      break;
    }
    case 'cosmos': { // el espacio dentro · el disco de Gargantua · más estrellas y copias en órbita
      surf.push(() => { c.globalAlpha = lvl >= 3 ? .85 : .55; c.globalCompositeOperation = 'multiply'; glow(c, x, y, R * 1.2, [[0, '#6A58B8'], [.7, '#2A1F5E'], [1, '#2A1F5E']]);
        glow(c, x - R * .16, y - R * .08, R * .7, [[0, 'rgba(214,120,200,.75)'], [1, 'rgba(214,120,200,0)']]);
        glow(c, x + R * .24, y + R * .16, R * .6, [[0, 'rgba(110,150,255,.6)'], [1, 'rgba(110,150,255,0)']]);
        c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.fillStyle = '#fff';
        for (const [dx, dy, r] of [[-.4, -.32, .04], [.28, -.44, .03], [.12, .4, .035], [-.24, .24, .025]]) { c.beginPath(); c.arc(x + dx * R, y + dy * R, r * R, 0, 7); c.fill(); }
        if (lvl >= 3) for (const [px, py] of [[24, 30], [62, 22], [44, 66], [72, 54]]) glow(c, x - R + D * px / 100, y - R + D * py / 100, D * .06, [[0, '#fff'], [.3, 'rgba(220,210,255,.6)'], [1, 'rgba(220,210,255,0)']]); });
      const disk = half => () => { c.save(); c.translate(x, y); c.rotate(rad(-14)); c.beginPath(); c.rect(-D, half ? 0 : -D, D * 2, D); c.clip();
        c.shadowColor = 'rgba(255,180,90,.8)'; c.shadowBlur = D * .08; c.strokeStyle = '#F4A954'; c.lineWidth = D * .055;
        c.beginPath(); c.ellipse(0, 0, D * .84, D * .12, 0, 0, 7); c.stroke(); c.restore(); };
      if (lvl >= 2) { back.push(disk(false)); front.push(disk(true)); }
      if (lvl >= 3) [0, 120, 240].forEach(a => front.push(() => { const [ox, oy] = orbit(x, y, D, a);
        c.globalAlpha = .7; c.fillStyle = color; c.beginPath(); c.arc(ox, oy, D * .12, 0, 7); c.fill(); c.globalAlpha = 1;
        c.save(); c.setLineDash([D * .04, D * .03]); c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = D * .02; c.beginPath(); c.arc(ox, oy, D * .14, 0, 7); c.stroke(); c.restore(); }));
      break;
    }
    case 'prism': { // brillo iridiscente · halo arcoíris · iris más vivo (y su destello) y destellos en órbita
      const IRI = ['#FF8FC4', '#8FB6FF', '#7EE8C8', '#FFE38A', '#C39BFF', '#FF8FC4'];
      surf.push(() => { c.globalAlpha = lvl >= 3 ? .78 : .5; c.fillStyle = conic(c, x, y, IRI, rad(30)); c.fillRect(x - R, y - R, D, D); c.globalAlpha = 1; });
      if (lvl >= 3) surf.push(() => shine(c, x, y, R));
      if (lvl >= 2) back.push(() => ring(c, x, y, R * 1.02, R * 1.24, conic(c, x, y, IRI)));
      if (lvl >= 3) ['#FFD1E8', '#CFE3FF', '#C8F5E6', '#FFF1C9'].forEach((col, i) => front.push(() => { const [ox, oy] = orbit(x, y, D, 45 + i * 90); return put(c, A.SPARK(col), ox, oy, D * .26, D * .26); }));
      break;
    }
    case 'bolt': // esfera de cronómetro · su corona y la estela · cargada de electricidad y rayos en órbita
      if (lvl >= 2) back.push(() => { c.fillStyle = '#3E6AA8'; c.beginPath(); c.roundRect(x - D * .1, y - R - D * .2, D * .2, D * .26, [D * .05, D * .05, 0, 0]); c.fill();
        c.fillStyle = '#FFD84A'; c.fillRect(x - D * .08, y - R - D * .24, D * .16, D * .05);
        for (const [dy, w] of [[-.16, .7], [0, 1], [.16, .8]]) { const g = c.createLinearGradient(x - R - D * .85 * w, 0, x - R * .6, 0);
          g.addColorStop(0, 'rgba(200,230,255,0)'); g.addColorStop(1, 'rgba(225,242,255,.95)'); c.fillStyle = g;
          c.beginPath(); c.roundRect(x - R * .2 - D * .85 * w, y + dy * D - D * .045, D * .85 * w, D * .09, D * .045); c.fill(); } });
      if (lvl >= 3) surf.push(() => glow(c, x, y, R * 1.25, [[0, 'rgba(200,235,255,.5)'], [.55, 'rgba(90,170,255,.32)'], [.8, 'rgba(63,111,168,0)']]),
        () => put(c, A.BOLT, x + R * .3, y - R * .32, D * .3, D * .48, rad(14)));
      surf.push(() => { c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = D * .03;
        for (let i = 0; i < 12; i++) { const a = rad(i * 30); c.beginPath(); c.moveTo(x + Math.sin(a) * R * .72, y - Math.cos(a) * R * .72); c.lineTo(x + Math.sin(a) * R, y - Math.cos(a) * R); c.stroke(); }
        const ha = rad(lvl >= 3 ? 130 : 70); c.lineCap = 'round'; c.strokeStyle = '#2D4F7C'; c.lineWidth = D * .074; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.sin(ha) * R * .68, y - Math.cos(ha) * R * .68); c.stroke();
        c.strokeStyle = '#FFD84A'; c.lineWidth = D * .05; c.stroke(); c.lineCap = 'butt';
        c.fillStyle = '#FFD84A'; c.beginPath(); c.arc(x, y, D * .07, 0, 7); c.fill(); c.fillStyle = '#2D4F7C'; c.beginPath(); c.arc(x, y, D * .055, 0, 7); c.fill(); });
      if (lvl >= 3) [30, 150, 270].forEach(a => front.push(() => { const [ox, oy] = orbit(x, y, D, a);
        c.shadowColor = '#FFE27A'; c.shadowBlur = D * .05; return put(c, A.BOLT, ox, oy, D * .2, D * .32).then(() => { c.shadowBlur = 0; }); }));
      break;
    case 'crown': { // orbe real · la corona encima · gemas en sus bandas, brillo y gemas en órbita
      surf.push(() => { c.save(); c.shadowColor = 'rgba(90,50,10,.35)'; c.shadowBlur = D * .02; c.strokeStyle = '#E6B94A'; c.lineWidth = D * (lvl >= 3 ? .07 : .05);
        c.beginPath(); c.ellipse(x, y, D * .16 - c.lineWidth / 2, R * 1.04 - c.lineWidth / 2, 0, 0, 7); c.stroke(); c.restore();
        const bh = D * (lvl >= 3 ? .18 : .14), g = c.createLinearGradient(0, y - bh / 2, 0, y + bh / 2); g.addColorStop(0, '#F6D77A'); g.addColorStop(.55, '#D9A93A'); g.addColorStop(1, '#A87A22');
        c.fillStyle = g; c.fillRect(x - R, y - bh / 2, D, bh);
        if (lvl >= 3) for (const px of [22, 50, 78]) { const gx = x - R + D * px / 100; c.fillStyle = '#FFF0BE'; c.beginPath(); c.arc(gx, y, D * .062, 0, 7); c.fill();
          c.fillStyle = '#D9453A'; c.beginPath(); c.arc(gx, y, D * .05, 0, 7); c.fill(); } });
      if (lvl >= 3) surf.push(() => shine(c, x, y, R));
      if (lvl >= 2) { const w = D * (lvl >= 3 ? .66 : .56), h = D * (lvl >= 3 ? .47 : .4), top = y - R - D * (lvl >= 3 ? .37 : .3);
        front.push(() => put(c, A.CROWN(lvl >= 3 ? 2 : 0), x, top + h / 2, w, h, rad(-8))); }
      if (lvl >= 3) [30, 150, 270].forEach(a => front.push(() => { const [ox, oy] = orbit(x, y, D, a); return put(c, A.GEM, ox, oy, D * .2, D * .2); }));
      break;
    }
    case 'puzzle': // piezas dibujadas · el marco del puzle · piezas de colores y tres en órbita
      if (lvl >= 3) surf.push(() => { c.globalAlpha = .5; c.fillStyle = conic(c, x, y, ['#2E8A80', '#2E8A80', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', '#E8873A', '#E8873A', '#8E6BE0', '#8E6BE0'], rad(-90)); c.fillRect(x - R, y - R, D, D); c.globalAlpha = 1; });
      surf.push(() => put(c, lvl >= 3 ? A.JIGSAW.replace('rgba(255,255,255,.55)', 'rgba(255,255,255,.9)') : A.JIGSAW, x, y, D, D));
      if (lvl >= 2) back.push(() => { c.globalAlpha = .75; return put(c, A.FRAME, x, y, D * 1.56, D * 1.56).then(() => { c.globalAlpha = 1; }); });
      if (lvl >= 3) ['#2E8A80', '#E8873A', '#8E6BE0'].forEach((col, i) => front.push(() => { const [ox, oy] = orbit(x, y, D, 40 + i * 120); return put(c, A.PIECE(col), ox, oy, D * .3, D * .3); }));
      break;
  }
  for (const f of back) await f();
  ballBody(c, x, y, R, color);
  if (surf.length) { clipBall(c, x, y, R); for (const f of surf) await f(); c.restore(); }
  for (const f of front) await f();
}
