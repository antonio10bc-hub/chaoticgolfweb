/* =========================================================
   TAPETE ANIMADO + TELE CRT (todo decorativo)
   - Tapete: un shader WebGL a muy baja resolución (cada píxel del lienzo son PX píxeles de pantalla,
     escalado sin suavizado) con un líquido marmoleado que se arremolina despacio, como pintura o humo.
     Tres tonos planos con tramado ordenado: nada de degradados limpios.
   - El color sigue al contexto: verde en los menús y en la partida clásica, azul en el contrarreloj,
     rojo en los desafíos, naranja en el reto diario, morado de noche, pizarra en el creador; cada baraja
     con escena propia, el suyo (turquesa el agua, madera el minigolf, morado el multiverso, psicodélico
     el Ultimate, el de la estación en las estaciones); durante un JAQUE se enciende de rojo. Siempre el
     mismo movimiento; el color cambia con un fundido.
   - CRT: una capa fija por encima de todo (sin eventos) con scanlines, viñeteado, curvatura en las
     esquinas, aberración cromática en los bordes y un parpadeo muy leve (styles/casino.css).
   Sin WebGL (o con movimiento reducido) se pinta igual, pero quieto.
   ========================================================= */
import { app } from '../ui/app.js';
import { REDUCED } from './juice.js';

const PX = 4;            // píxeles de pantalla por píxel del tapete
const FPS = 30;

// paletas del tapete: oscuro, medio, claro (los remolinos) y un brillo puntual
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const FELTS = {
  green:  ['#1E4436', '#2E5E4E', '#3F7A63', '#5A9A7C'],
  blue:   ['#0F2B52', '#17427A', '#2160A6', '#3C86CC'],
  red:    ['#4A1418', '#7A2226', '#A8332F', '#D0584A'],
  purple: ['#24123E', '#3A1F62', '#56338C', '#7A55B4'],
  orange: ['#5A2A0C', '#8A4512', '#B8661C', '#E08E34'],
  olive:  ['#33340F', '#4D4D1A', '#6B6A28', '#8E8A3C'],
  ice:    ['#2E4652', '#45636F', '#62848F', '#89AAB2'],
  slate:  ['#141D22', '#1E2A30', '#2B3A42', '#3D525C'],
  teal:   ['#0B3A40', '#11565C', '#1A7A7C', '#3AA6A0'],
  wood:   ['#3A220F', '#5C3818', '#835226', '#B07A3C'],
  pink:   ['#4A1834', '#6E2650', '#9A3A72', '#C8609A'],
  prism:  ['#2A0F4A', '#0F5C7A', '#B0306E', '#F0A030'],
};
// cada baraja con su escena (la del lago, el tren…) lleva su tapete; las estaciones, el de la estación en pantalla
const SCENE_FELT = { lake: 'teal', mini: 'wood', rail: 'red', space: 'purple', prism: 'prism', mat: 'slate' };
const SEASON_FELT = { spring: 'pink', summer: 'green', autumn: 'orange', winter: 'ice' };
const COURSE_FELT = { classic: 'green', ocean: 'blue', ember: 'red', sunset: 'orange', night: 'purple', autumn: 'olive', snow: 'ice' };

function feltKey() {
  const scr = document.body.dataset.screen || 'menu';
  if (scr === 'editor') return 'slate';
  if (scr !== 'game') return 'green';
  const S = app.game?.S;
  if (S?.jaque) return 'red';
  if (app.mode === 'test') return 'slate';
  // los modos especiales, siempre con su color (reto diario naranja, contrarreloj azul, desafíos rojo, puzles morado)
  const MODE = { daily: 'orange', rush: 'blue', challenge: 'red', weekly: 'red', puzzle: 'purple' };
  if (MODE[app.variant]) return MODE[app.variant];
  const gs = document.getElementById('gameScreen')?.dataset || {};
  if (gs.scene === 'seasons' && SEASON_FELT[gs.season]) return SEASON_FELT[gs.season];
  if (SCENE_FELT[gs.scene]) return SCENE_FELT[gs.scene];
  return COURSE_FELT[document.documentElement.dataset.course] || 'green';
}

const VS = `attribute vec2 a; void main(){ gl_Position = vec4(a, 0., 1.); }`;
const FS = `precision mediump float;
uniform vec2 uRes; uniform float uT;
uniform vec3 uA, uB, uC, uD;
// matriz de Bayer 4x4 (tramado ordenado)
float bayer2(vec2 a){ a = floor(a); return fract(dot(a, vec2(.5, a.y * .75))); }
float bayer4(vec2 a){ return bayer2(.5 * a) * .25 + bayer2(a); }
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  float t = uT * .045;
  // remolino lento alrededor del centro (más fuerte cerca, casi nada en los bordes)
  float r = length(uv);
  float ang = atan(uv.y, uv.x) + .9 * sin(t * .7) * exp(-r * 1.1) + t * .35 / (r + .6);
  vec2 p = vec2(cos(ang), sin(ang)) * r * 3.2;
  // líquido: deformación del dominio en varias pasadas
  for (int i = 1; i < 6; i++) {
    float fi = float(i);
    p.x += .55 / fi * sin(fi * p.y * 1.25 + t * 1.6 + .37 * fi);
    p.y += .55 / fi * cos(fi * p.x * 1.05 - t * 1.25 + .71 * fi);
  }
  float v = .5 + .5 * sin(p.x * .9 + p.y * 1.1);
  float w = .5 + .5 * sin(p.x * 2.3 - p.y * 1.7 + t * 2.);
  v = mix(v, w, .28);
  v += (bayer4(gl_FragCoord.xy) - .5) * .07;   // tramado ordenado: bandas con borde de pixel
  vec3 col = v < .34 ? uA : v < .62 ? uB : v < .86 ? uC : uD;
  // viñeta suave hacia los bordes (la del CRT se suma por encima)
  col *= 1. - .18 * smoothstep(.45, 1.05, r);
  gl_FragColor = vec4(col, 1.);
}`;

let canvas, crt, gl, prog, loc = {}, raf = 0, last = 0, t0 = performance.now();
let cur = FELTS.green.map(hex), target = cur, key = 'green', staticDrawn = false;

function compile(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

function resize() {
  const w = Math.max(32, Math.ceil(innerWidth / PX)), h = Math.max(32, Math.ceil(innerHeight / PX));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; staticDrawn = false; }
}

function draw(now) {
  resize();
  const k = feltKey();
  if (k !== key) { key = k; target = FELTS[k].map(hex); staticDrawn = false; }
  // fundido de color: cada canal se acerca al de destino
  let moving = false;
  cur = cur.map((c, i) => c.map((v, j) => { const d = target[i][j] - v; if (Math.abs(d) > .002) moving = true; return v + d * .06; }));
  if (!gl) { paintFallback(); return; }
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.uniform2f(loc.uRes, canvas.width, canvas.height);
  gl.uniform1f(loc.uT, REDUCED ? 40 : (now - t0) / 1000);
  ['uA', 'uB', 'uC', 'uD'].forEach((u, i) => gl.uniform3fv(loc[u], cur[i]));
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  staticDrawn = !moving;
}

// sin WebGL: el mismo tapete en tres tonos, quieto (bandas diagonales con borde de pixel)
function paintFallback() {
  const ctx = canvas.getContext('2d');
  const [a, b, c] = cur.map(x => `rgb(${x.map(v => Math.round(v * 255)).join(',')})`);
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x += 1) {
    const v = Math.sin((x + y) * .08) + Math.sin(x * .05 - y * .11);
    ctx.fillStyle = v < -.4 ? a : v < .7 ? b : c; ctx.fillRect(x, y, 1, 1);
  }
  staticDrawn = true;
}

function tick(now) {
  raf = requestAnimationFrame(tick);
  if (document.hidden) return;
  if (REDUCED && staticDrawn && feltKey() === key) return;
  if (now - last < 1000 / FPS) return;
  last = now;
  draw(now);
}

// enciende el tapete y la tele (se crean la primera vez); al apagarlos se quedan escondidos y quietos
export function startCasinoBg() {
  if (!canvas) create();
  canvas.hidden = false; crt.hidden = false;
  staticDrawn = false;
  if (!raf) raf = requestAnimationFrame(tick);
}
export function stopCasinoBg() {
  if (!canvas) return;
  cancelAnimationFrame(raf); raf = 0;
  canvas.hidden = true; crt.hidden = true;
}

function create() {
  canvas = document.createElement('canvas');
  canvas.id = 'feltBg'; canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  try {
    gl = canvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false, powerPreference: 'low-power' });
    if (gl) {
      prog = gl.createProgram();
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog); gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const a = gl.getAttribLocation(prog, 'a');
      gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
      ['uRes', 'uT', 'uA', 'uB', 'uC', 'uD'].forEach(u => { loc[u] = gl.getUniformLocation(prog, u); });
    }
  } catch (e) { gl = null; }
  // la tele: scanlines, viñeta, curvatura, aberración y parpadeo
  crt = document.createElement('div');
  crt.id = 'crt'; crt.setAttribute('aria-hidden', 'true');
  crt.innerHTML = '<i class="crtLines"></i><i class="crtFringe"></i><i class="crtVig"></i>';
  document.body.appendChild(crt);
}
