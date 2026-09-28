// Pelotas personalizadas ("skins"): cada una se gana con un objetivo del juego y tiene 3 niveles, la misma
// idea cada vez más espectacular. Decoran la pelota sin cambiar su color (el color es quien juega).
//   fuego    racha del reto diario (7 · 30 · 365 días): más llamas, más altas, brasas
//   clásica  victorias con la baraja clásica: aro de oro · laurel · destellos
//   agua     victorias con la baraja de agua: agua dentro · ondas · gotas en órbita
//   madera   victorias con la de minigolf: vetas · marco de madera · molino que gira detrás
//   prisma   victorias con Ultimate: brillo iridiscente · halo arcoíris · destellos
//   rayo     series de contrarreloj completas: estela · esfera de reloj · rayos
//   corona   desafíos superados por grupo (calentamiento · intermedio · experto)
//   puzle    puzles resueltos por grupo: piezas dibujadas · una pieza en órbita · tres
// Lo ganado se calcula siempre desde las estadísticas (records.js): no hay nada más que guardar que la
// pelota puesta y qué niveles se han visto (para el aviso de "¡Nueva!"), en el perfil.
import { app } from './app.js';
import { loadRecords } from './records.js';
import { CHALLENGES, CH_GROUPS } from '../content/challenges.js';
import { loadProfile, saveProfile } from './profile.js';

export const GROUPS = CH_GROUPS; // (calentamiento, intermedio, experto: los tres niveles de corona y puzle)
export const SKINS = [
  { id: 'fire', kind: 'streak', at: [7, 30, 365], accent: '#E8733A' },
  { id: 'classic', kind: 'deck', deck: 'classic', at: [3, 15, 50], accent: '#C9962E' },
  { id: 'water', kind: 'deck', deck: 'water', at: [3, 15, 50], accent: '#2F9CC4' },
  { id: 'wood', kind: 'deck', deck: 'minigolf', at: [3, 15, 50], accent: '#A8743F' },
  { id: 'prism', kind: 'deck', deck: 'ultimate', at: [3, 15, 50], accent: '#8E6BE0' },
  { id: 'bolt', kind: 'rush', at: [1, 5, 15], accent: '#3F6FA8' },
  { id: 'crown', kind: 'groups', of: 'challenges', accent: '#B5473F' },
  { id: 'puzzle', kind: 'groups', of: 'puzzles', accent: '#2E8A80' },
];
export const skinById = id => SKINS.find(s => s.id === id) || null;
export const ROMAN = ['', 'I', 'II', 'III'];

// series de contrarreloj completas (antes de existir el contador: ~6 victorias por serie, 5 hoyos y la serie)
const rushDone = R => R.rush.done ?? Math.floor((R.won.rush || 0) / 6);
// grupos (desafíos o puzles): cuántos hay de cada uno y cuántos superados
function groupCounts(of, R, puzzles) {
  const items = of === 'challenges'
    ? CHALLENGES.map(c => ({ g: c.group, done: !!R.challenges[c.id] }))
    : (puzzles || []).map((L, i) => ({ g: L.group || 'warmup', done: !!R.puzzles[i] }));
  return GROUPS.map(g => ({ g, n: items.filter(x => x.g === g).length, done: items.filter(x => x.g === g && x.done).length }));
}

// progreso de una pelota: nivel ganado (0-3) y lo que falta para el siguiente
//   { lvl, value, target, pct, group? } (target null: ya tiene los 3)
export function skinProgress(s, R = loadRecords(), puzzles = app.puzzleLevels) {
  if (s.kind === 'groups') {
    const gs = groupCounts(s.of, R, puzzles);
    let lvl = 0;
    while (lvl < 3 && gs[lvl].n > 0 && gs[lvl].done >= gs[lvl].n) lvl++;
    const next = gs[lvl];
    return { lvl, value: next ? next.done : gs[2].n, target: next ? next.n : null, pct: next ? next.done / Math.max(1, next.n) : 1, group: next?.g || null };
  }
  const value = s.kind === 'streak' ? R.daily.bestStreak || 0 : s.kind === 'deck' ? R.decks[s.deck]?.w || 0 : rushDone(R);
  const lvl = s.at.filter(n => value >= n).length;
  const target = s.at[lvl] ?? null, prev = s.at[lvl - 1] ?? 0;
  return { lvl, value, target, pct: target ? Math.min(1, (value - prev) / (target - prev)) : 1 };
}
export const unlockedLevels = (R = loadRecords(), puzzles = app.puzzleLevels) =>
  Object.fromEntries(SKINS.map(s => [s.id, skinProgress(s, R, puzzles).lvl]));

/* ---------- la pelota puesta ---------- */
// { id, lvl } o null; si ya no se tiene ese nivel (estadísticas borradas), el más alto que quede
export function equippedSkin(levels = unlockedLevels()) {
  const e = loadProfile().skin;
  if (!e || !skinById(e.id)) return null;
  const have = levels[e.id] || 0;
  return have ? { id: e.id, lvl: Math.min(e.lvl || have, have) } : null;
}
export function equipSkin(sk) { const p = loadProfile(); p.skin = sk ? { id: sk.id, lvl: sk.lvl } : null; saveProfile(p); }

/* ---------- niveles nuevos: aviso en el final de partida (una vez) y "¡Nueva!" hasta verlos en el perfil ---------- */
function diff(map, levels) { return SKINS.filter(s => (levels[s.id] || 0) > (map?.[s.id] || 0)).map(s => ({ id: s.id, lvl: levels[s.id] })); }
export const unseenSkins = (levels = unlockedLevels()) => diff(loadProfile().skinSeen, levels);
export function markSkinsSeen(levels = unlockedLevels()) { const p = loadProfile(); p.skinSeen = { ...levels }; saveProfile(p); }
// lo ganado desde el último aviso (y se apunta como avisado)
export function takeNewSkins(levels = unlockedLevels()) {
  const p = loadProfile(), out = diff(p.skinAnn, levels);
  if (out.length) { p.skinAnn = { ...levels }; saveProfile(p); }
  return out;
}

// ¿qué asiento lleva tu pelota? (una sola persona: Lo básico, puzles, modos contra la máquina)
export function skinSeat(g = app.game) {
  if (!g) return null;
  if (app.mode === 'story' || app.mode === 'test') return 0;
  if (app.mode === 'pve') { const hs = g.S.humans || [g.S.human]; return hs.length === 1 ? hs[0] : null; }
  return null;
}

/* ---------- aspecto ----------
   La pelota: .skCore (vista previa) o .circ (en el tablero), con las clases sk-<id> sl<nivel> y tres capas:
     .skBack  detrás (llamas, ondas, laurel, molino, halo…)   .skSurf  sobre la superficie, recortada a la bola
     .skFront delante (brasas, aro, corona, destellos, piezas en órbita…)
   Todo se mide con --bs (el diámetro de la bola): se ve igual en el perfil, en la partida rápida y en el tablero. */
const FLAME = '<svg viewBox="0 0 24 32" aria-hidden="true"><path d="M12 1C13.5 7 20 10.5 20 19.5C20 26 16.4 31 12 31S4 26 4 19.5C4 15 7 12 8 7.5c1.5 3.5 2.5 4.5 3.3 5.5C11.6 8.5 10.8 5 12 1Z" fill="url(#skFlame)"/>' +
  '<path class="flCore" d="M12 13c1 4 4 5.5 4 10 0 4-2 7-4 7s-4-3-4-6.5c0-2.5 1.5-4 2.5-6 .5 1.5 1 2 1.5 2.5 0-3-.5-5 0-7Z" fill="url(#skFlameCore)"/></svg>';
const DROP = '<svg viewBox="0 0 20 26" aria-hidden="true"><path d="M10 1C13 7 18 11 18 16.5A8 8 0 0 1 2 16.5C2 11 7 7 10 1Z" fill="#7FD0EA"/><ellipse cx="7" cy="16" rx="2" ry="3.2" fill="#fff" opacity=".7"/></svg>';
const SPARK = c => `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 0C11 7 13 9 20 10 13 11 11 13 10 20 9 13 7 11 0 10 7 9 9 7 10 0Z" fill="${c}"/></svg>`;
const BOLT = '<svg viewBox="0 0 16 26" aria-hidden="true"><path d="M10 0 1 15h6l-2 11 10-16H9l1-10Z" fill="#FFD84A" stroke="#fff" stroke-width="1" stroke-linejoin="round"/></svg>';
const PIECE = c => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h4.2a2.6 2.6 0 1 1 5.2 0H18v4.4a2.6 2.6 0 1 1 0 5.2V21h-4.6a2.6 2.6 0 1 0-5.2 0H4v-4.4a2.6 2.6 0 1 0 0-5.2Z" fill="${c}" stroke="rgba(255,255,255,.85)" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
const CROWN = (gems) => `<svg viewBox="0 0 40 28" aria-hidden="true"><path d="M3 24 1 6l10 8 9-13 9 13 10-8-2 18Z" fill="url(#skGold)" stroke="#8C6A1C" stroke-width="1.2" stroke-linejoin="round"/>` +
  `<rect x="3" y="22" width="34" height="5" rx="2" fill="#B8862A"/>` +
  (gems ? `<circle cx="20" cy="15" r="3.2" fill="#D9453A" stroke="#fff" stroke-width=".8"/>` + (gems > 1 ? `<circle cx="10" cy="17.5" r="2.2" fill="#D9453A"/><circle cx="30" cy="17.5" r="2.2" fill="#D9453A"/>` : '') : '') +
  `<circle cx="1" cy="6" r="1.8" fill="#F6D77A"/><circle cx="20" cy="1.5" r="1.8" fill="#F6D77A"/><circle cx="39" cy="6" r="1.8" fill="#F6D77A"/></svg>`;
const WAVE = '<svg viewBox="0 0 200 40" preserveAspectRatio="none" aria-hidden="true"><path d="M0 10Q25 0 50 10T100 10T150 10T200 10V40H0Z"/></svg>';
const JIGSAW = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M0 20h8a3.5 3.5 0 1 1 7 0h10a3.5 3.5 0 1 0 7 0h8M20 0v8a3.5 3.5 0 1 0 0 7v10a3.5 3.5 0 1 1 0 7v8" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.6"/></svg>';
const WINDMILL = '<svg viewBox="-50 -50 100 100" aria-hidden="true"><g class="wmBlades">' +
  [0, 90, 180, 270].map(a => `<g transform="rotate(${a})"><rect x="-5" y="-48" width="10" height="36" rx="2" fill="#C99257" stroke="#7A5230" stroke-width="1.6"/>` +
    `<path d="M-5-40h10M-5-32h10M-5-24h10" stroke="#7A5230" stroke-width="1.2"/></g>`).join('') + '</g></svg>';
function laurel() { // dos ramas de laurel que suben por los lados desde abajo: tallo y hojas por parejas
  let out = '';
  const R = 41, f = v => v.toFixed(1), leaf = (x, y, rot, k = 1) =>
    `<path d="M0 0Q${f(5.5 * k)} ${f(-3.4 * k)} ${f(11 * k)} 0Q${f(5.5 * k)} ${f(3.4 * k)} 0 0Z" transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)})" fill="url(#skGold)" stroke="#8C6A1C" stroke-width=".6"/>`;
  for (const side of [-1, 1]) {
    const at = deg => { const th = deg * Math.PI / 180; return [side * Math.sin(th) * R, Math.cos(th) * R, Math.atan2(-Math.sin(th), side * Math.cos(th)) * 180 / Math.PI]; };
    const stem = Array.from({ length: 19 }, (_, k) => at(14 + k * 6).slice(0, 2).map(f).join(' '));
    out += `<path d="M${stem.join('L')}" fill="none" stroke="#B8862A" stroke-width="1.8" stroke-linecap="round"/>`;
    for (let i = 0; i < 6; i++) {
      const [x, y, tang] = at(24 + i * 17), k = 1 - i * .05;
      out += leaf(x, y, tang - side * 38, k) + leaf(x, y, tang + side * 30, k * .9);
    }
    const [tx, ty, tt] = at(122); out += leaf(tx, ty, tt, .95); // la hoja de la punta
  }
  return `<svg viewBox="-50 -50 100 100" aria-hidden="true">${out}</svg>`;
}
const around = (n, spread) => Array.from({ length: n }, (_, i) => n === 1 ? 0 : -spread / 2 + spread * i / (n - 1));
const is = (cls, n, fn) => Array.from({ length: n }, (_, i) => `<i class="${cls}" style="${fn(i)}"></i>`).join('');

function parts(id, lvl) {
  let back = '', surf = '', front = '';
  switch (id) {
    case 'fire': {
      const n = [3, 5, 7][lvl - 1], spread = [64, 120, 176][lvl - 1];
      if (lvl >= 2) back += '<i class="aura"></i>';
      back += around(n, spread).map((a, i) => `<i class="fl" style="--a:${a}deg;--d:${(-i * .23).toFixed(2)}s;--k:${(1 - Math.abs(a) / 260).toFixed(2)}">${FLAME}</i>`).join('');
      surf += '<i class="glow"></i>' + (lvl >= 3 ? '<i class="lava"></i>' : '');
      if (lvl >= 3) front += is('em', 7, i => `--x:${(i - 3) * 13}%;--d:${(-i * .37).toFixed(2)}s;--s:${(.8 + (i % 3) * .25).toFixed(2)}`);
      break;
    }
    case 'water':
      surf += `<i class="wv">${WAVE}</i><i class="wv b">${WAVE}</i><i class="gloss"></i>`;
      if (lvl >= 2) back += '<i class="rp"></i><i class="rp b"></i>';
      if (lvl >= 3) { surf += is('bb', 4, i => `--x:${18 + i * 20}%;--d:${(-i * .6).toFixed(1)}s`); front += `<i class="orb">${[0, 120, 240].map(a => `<i class="drop" style="--a:${a}deg">${DROP}</i>`).join('')}</i>`; }
      break;
    case 'classic':
      front += '<i class="gr"></i>';
      if (lvl >= 2) back += `<i class="laurel">${laurel()}</i>`;
      if (lvl >= 3) { surf += '<i class="shine"></i>'; front += [[-58, -42, 0], [58, -30, .5], [-44, 50, 1], [52, 46, 1.5]].map(([x, y, d]) => `<i class="spk" style="--x:${x}%;--y:${y}%;--d:${-d}s">${SPARK('#FFF4C2')}</i>`).join(''); }
      break;
    case 'wood':
      surf += '<i class="grain"></i>';
      if (lvl >= 2) front += '<i class="wr"></i>';
      if (lvl >= 3) back += `<i class="mill">${WINDMILL}</i>`;
      break;
    case 'prism':
      surf += '<i class="ir"></i>';
      if (lvl >= 2) back += '<i class="halo"></i>';
      if (lvl >= 3) { back += '<i class="aura"></i>'; front += `<i class="orb">${['#FFD1E8', '#CFE3FF', '#C8F5E6', '#FFF1C9'].map((c, i) => `<i class="spk" style="--a:${i * 90}deg">${SPARK(c)}</i>`).join('')}</i>`; }
      break;
    case 'bolt':
      back += '<i class="knob"></i>' + is('sp', 3, i => `--y:${34 + i * 16}%;--d:${(-i * .28).toFixed(2)}s;--w:${[.7, 1, .8][i]}`); // (la corona de un cronómetro y la estela)
      if (lvl >= 2) front += '<i class="ck"></i><i class="orb fast"><i class="tick"></i></i>';
      if (lvl >= 3) { back += '<i class="aura"></i>'; front += `<i class="bz" style="--x:-8%;--y:-12%;--r:-18deg;--d:0s">${BOLT}</i><i class="bz" style="--x:78%;--y:-4%;--r:22deg;--d:-.6s">${BOLT}</i>`; }
      break;
    case 'crown':
      if (lvl >= 2) back += '<i class="aura"></i>';
      if (lvl >= 3) back += '<i class="rays"></i>';
      front += `<i class="cr">${CROWN(lvl - 1)}</i>`;
      if (lvl >= 3) front += [[-60, -8, 0], [62, 4, .7]].map(([x, y, d]) => `<i class="spk" style="--x:${x}%;--y:${y}%;--d:${-d}s">${SPARK('#FFE3B0')}</i>`).join('');
      break;
    case 'puzzle':
      surf += `<i class="jig">${JIGSAW}</i>`;
      if (lvl >= 3) back += '<i class="aura"></i>';
      if (lvl >= 2) front += `<i class="orb">${(lvl >= 3 ? ['#2E8A80', '#E8873A', '#8E6BE0'] : ['#2E8A80']).map((c, i, a) => `<i class="pc" style="--a:${i * 360 / a.length}deg">${PIECE(c)}</i>`).join('')}</i>`;
      break;
  }
  return `<span class="skBack">${back}</span><span class="skSurf">${surf}</span><span class="skFront">${front}</span>`;
}
export const skinClasses = sk => sk ? ` sk-${sk.id} sl${sk.lvl}` : '';
export const skinParts = sk => sk ? parts(sk.id, sk.lvl) : '';
// una pelota suelta (perfil, partida rápida, aviso del final): tamaño en px y color de bola
export const skinBall = (sk, { size = 56, color = '#f26d6d', cls = '' } = {}) =>
  `<span class="skBall${cls ? ' ' + cls : ''}" style="--bs:${size}px"><span class="skCore${skinClasses(sk)}" style="--pc:${color}">${skinParts(sk)}</span></span>`;
