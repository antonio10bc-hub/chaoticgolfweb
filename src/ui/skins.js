// Pelotas personalizadas ("skins"): cada una se gana con un objetivo del juego y tiene 3 niveles, la misma idea
// cada vez más espectacular, siempre con el mismo molde (el de la de agua): I, la bola cambia por dentro; II, algo por
// fuera, sutil pero claro; III, lo de dentro más intenso y piezas que giran alrededor. Decoran la pelota sin cambiar
// su color (el color es quien juega).
//   fuego      racha del reto diario (7 · 30 · 365 días): fuego dentro · llamas alrededor de toda la bola · lava, llamas más altas y bolas de fuego en órbita
//   clásica    victorias con la baraja clásica: bañada en oro · laurel · destello y destellos en órbita
//   agua       victorias con la baraja de agua: agua dentro · ondas · más agua, burbujas y gotas en órbita
//   madera     victorias con la de minigolf: vetas · marco de madera · barnizada, con nudo, y el molino que gira detrás
//   vapor      victorias con la del tren: cinturón de hierro con remaches · bocanadas de vapor · caldera encendida y el tren en su vía
//   estaciones victorias con la de las estaciones: cuatro colores · pétalos, hojas y copos · colores vivos que giran y las cuatro en órbita
//   cosmos     victorias con la del multiverso: el espacio dentro · el disco de Gargantua · más estrellas y copias en órbita
//   fortuna    victorias con la del casino: una ficha de casino (el canto a rayas) · el aro de la ruleta girando detrás ·
//              bañada en oro, con su destello, y dos monedas y un dado en órbita
//   prisma     victorias con Ultimate: brillo iridiscente · halo arcoíris · iris más vivo y destellos en órbita
//   rayo       medallas de oro del contrarreloj de la semana (1 · 5 · 15): esfera de cronómetro · su corona y la estela · cargada de electricidad y rayos en órbita
//   corona     coronas de los desafíos de la semana (10 · 50 · 150): orbe real · la corona · gemas en sus bandas y en órbita
//   puzle      Lo básico por partes (las barajas de siempre · las nuevas · Lo no tan básico): piezas dibujadas · el marco del puzle · piezas de colores y tres en órbita
// Lo ganado se calcula siempre desde las estadísticas (records.js): no hay nada más que guardar que la
// pelota puesta y qué niveles se han visto (para el aviso de "¡Nueva!"), en el perfil.
import { app } from './app.js';
import { loadRecords } from './records.js';
import { CH_GROUPS } from '../content/challenges.js';
import { loadProfile, saveProfile } from './profile.js';
import { SEASON_ICON } from './season-art.js';
import { basicTier } from '../content/levels/index.js';
const SEASON_SVG = s => `<svg viewBox="0 0 24 24" aria-hidden="true">${SEASON_ICON[s]}</svg>`;

export const GROUPS = CH_GROUPS; // (los tres niveles de la pelota Puzle: las partes de Lo básico)
export const SKINS = [
  { id: 'fire', kind: 'streak', at: [7, 30, 365], accent: '#E8733A' },
  { id: 'classic', kind: 'deck', deck: 'classic', at: [10, 50, 100], accent: '#C9962E' },
  { id: 'water', kind: 'deck', deck: 'water', at: [10, 50, 100], accent: '#2F9CC4' },
  { id: 'wood', kind: 'deck', deck: 'minigolf', at: [10, 50, 100], accent: '#A8743F' },
  { id: 'steam', kind: 'deck', deck: 'train', at: [10, 50, 100], accent: '#B5483B' },
  { id: 'seasons', kind: 'deck', deck: 'seasons', at: [10, 50, 100], accent: '#C2618B' },
  { id: 'cosmos', kind: 'deck', deck: 'multiverse', at: [10, 50, 100], accent: '#5B3FB8' },
  { id: 'fortune', kind: 'deck', deck: 'gambling', at: [10, 50, 100], accent: '#B8892B' },
  { id: 'prism', kind: 'deck', deck: 'ultimate', at: [10, 50, 100], accent: '#8E6BE0' },
  { id: 'bolt', kind: 'golds', at: [1, 5, 15], accent: '#3F6FA8' },
  { id: 'crown', kind: 'crowns', at: [10, 50, 150], accent: '#B5473F' },
  { id: 'puzzle', kind: 'groups', of: 'basics', accent: '#2E8A80' },
];
export const skinById = id => SKINS.find(s => s.id === id) || null;
export const ROMAN = ['', 'I', 'II', 'III'];

// medallas de oro del contrarreloj (una por semana)
const rushGolds = R => Object.values(R.rush?.weeks || {}).filter(w => w?.medal === 'gold').length;
// partes de Lo básico: cuántos niveles hay en cada una y cuántos superados
function groupCounts(R, basics) {
  const items = (basics || []).map(L => ({ g: basicTier(L), done: !!R.basics?.[L.id] }));
  return GROUPS.map(g => ({ g, n: items.filter(x => x.g === g).length, done: items.filter(x => x.g === g && x.done).length }));
}

// progreso de una pelota: nivel ganado (0-3) y lo que falta para el siguiente
//   { lvl, value, target, pct, group? } (target null: ya tiene los 3)
export function skinProgress(s, R = loadRecords(), basics = app.basics) {
  if (s.kind === 'groups') {
    const gs = groupCounts(R, basics);
    let lvl = 0;
    while (lvl < 3 && gs[lvl].n > 0 && gs[lvl].done >= gs[lvl].n) lvl++;
    const next = gs[lvl];
    return { lvl, value: next ? next.done : gs[2].n, target: next ? next.n : null, pct: next ? next.done / Math.max(1, next.n) : 1, group: next?.g || null };
  }
  const value = s.kind === 'streak' ? R.daily.bestStreak || 0 : s.kind === 'deck' ? R.decks[s.deck]?.w || 0 : s.kind === 'crowns' ? R.crowns?.n || 0 : rushGolds(R);
  const lvl = s.at.filter(n => value >= n).length;
  const target = s.at[lvl] ?? null, prev = s.at[lvl - 1] ?? 0;
  return { lvl, value, target, pct: target ? Math.min(1, (value - prev) / (target - prev)) : 1 };
}
export const unlockedLevels = (R = loadRecords(), basics = app.basics) =>
  Object.fromEntries(SKINS.map(s => [s.id, skinProgress(s, R, basics).lvl]));

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
// una sola (al tocar su nivel nuevo en "Tu pelota"): deja de ser nueva
export function markSkinSeen(id, lvl) { const p = loadProfile(); p.skinSeen = { ...p.skinSeen, [id]: Math.max(lvl, p.skinSeen?.[id] || 0) }; saveProfile(p); }
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
// una bola de fuego redonda (la que gira alrededor de la de fuego III): núcleo y lenguas de fuego en todas
// direcciones, así se ve bien la mire como la mire la órbita
const FIREBALL = '<svg viewBox="-20 -20 40 40" aria-hidden="true"><g class="fbRing">' +
  Array.from({ length: 10 }, (_, i) => { const t = i % 2 ? 15.5 : 19.6, m = i % 2 ? 11.5 : 14;
    return `<path d="M0-${t}C3.4-${m} 6.4-10.5 6-6.6A6 6 0 0 1-6-6.6C-6.4-10.5-3.4-${m} 0-${t}Z" fill="url(#skFlame)" transform="rotate(${i * 36})"/>`; }).join('') +
  '</g><circle r="10.2" fill="#F27A2E"/><circle r="8" fill="#FFB23E"/><circle r="5.6" fill="#FFE066"/><circle cx="-1.8" cy="-2" r="2.6" fill="#FFF8DC"/></svg>';
// (fortuna) una moneda y un dado pequeños, para la órbita
const COIN_MINI = '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="11" r="8.4" fill="#9C6A1E"/><circle cx="10" cy="10" r="8.4" fill="#F2C14E" stroke="#9C6A1E" stroke-width="1"/>' +
  '<circle cx="10" cy="10" r="5.6" fill="none" stroke="#C8962E" stroke-width="1"/><path d="M10 6l1.2 2.5 2.7.3-2 1.9.5 2.7L10 12l-2.4 1.4.5-2.7-2-1.9 2.7-.3z" fill="#FFE38A"/></svg>';
const DIE_MINI = '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2" y="3" width="16" height="16" rx="4" fill="#CFC3AE"/><rect x="2" y="1.5" width="16" height="15" rx="4" fill="#F6F0E2" stroke="#4A3F3A" stroke-width="1"/>' +
  '<circle cx="6.5" cy="5.5" r="1.5" fill="#2A2226"/><circle cx="10" cy="9" r="1.5" fill="#C8243A"/><circle cx="13.5" cy="12.5" r="1.5" fill="#2A2226"/></svg>';
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
// una locomotora de vapor de perfil, pequeñita (la que da vueltas a la pelota de vapor III)
const LOCO_MINI = '<svg viewBox="0 0 32 24" aria-hidden="true"><path d="M6 3h4l-.5 5h-3z" fill="#242424"/><rect x="3" y="8" width="17" height="9" rx="4.5" fill="#242424"/>' +
  '<path d="M9 8v9M14 8v9" stroke="#D9A441" stroke-width="1.1"/><rect x="18" y="4" width="10" height="14" rx="1.6" fill="#B5483B"/><rect x="20.5" y="6.5" width="5" height="4.5" rx="1" fill="#FFE38A"/>' +
  '<rect x="17" y="2.6" width="12" height="2.4" rx="1.2" fill="#242424"/><path d="M3 14 L0 19 H4Z" fill="#D9A441"/>' +
  '<circle cx="8" cy="19.5" r="3" fill="#242424"/><circle cx="15" cy="19.5" r="3" fill="#242424"/><circle cx="24" cy="19" r="3.6" fill="#242424"/>' +
  '<circle cx="8" cy="19.5" r="1" fill="#B5483B"/><circle cx="15" cy="19.5" r="1" fill="#B5483B"/><circle cx="24" cy="19" r="1.2" fill="#B5483B"/></svg>';
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
const is = (cls, n, fn) => Array.from({ length: n }, (_, i) => `<i class="${cls}" style="${fn(i)}"></i>`).join('');

// una gema tallada (la corona: en sus bandas y, en el nivel III, en órbita)
const GEM = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 3h10l4 5-9 11L1 8Z" fill="#D9453A" stroke="#fff" stroke-width="1.1" stroke-linejoin="round"/>' +
  '<path d="M1 8h18M7 3 5.5 8 10 19M13 3l1.5 5L10 19" fill="none" stroke="rgba(255,255,255,.55)" stroke-width=".9"/></svg>';
// el marco del puzle: un aro con pestañas (hacia fuera y hacia dentro, alternas)
const FRAME = '<svg viewBox="-50 -50 100 100" aria-hidden="true"><circle r="40" fill="none" stroke="#3FA79A" stroke-width="2"/>' +
  Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4, r = 40 + (i % 2 ? -3.6 : 3.6); return `<circle cx="${(Math.sin(a) * r).toFixed(1)}" cy="${(-Math.cos(a) * r).toFixed(1)}" r="3.6" fill="#3FA79A"/>`; }).join('') + '</svg>';
const orbit = (cls, items) => `<i class="orb">${items.map((html, i, all) => `<i class="${cls}" style="--a:${(i * 360 / all.length).toFixed(0)}deg">${html}</i>`).join('')}</i>`;

// Las tres capas de cada pelota. Todas siguen el mismo molde (el de la de agua):
//   I   la bola cambia por dentro (agua, fuego, oro, vetas, el cinturón, las estaciones, el espacio, el iris, la esfera
//       del reloj, el orbe real, las piezas)
//   II  algo por fuera, sutil pero claro (ondas, llamas, laurel, marco, vapor, pétalos, disco, halo, estela, corona, aro)
//   III lo de dentro, más intenso, y piezas que giran alrededor de la bola
function parts(id, lvl) {
  let back = '', surf = '', front = '';
  const l3 = lvl >= 3;
  switch (id) {
    case 'fire': // fuego dentro · llamas pequeñas alrededor de toda la bola · más fuego (con lava), llamas más altas y bolas de fuego en órbita
      surf += '<i class="glow"></i>' + (l3 ? '<i class="lava"></i>' : '') + [[-6, .9], [20, 1.15], [46, .95], [70, 1.1]].map(([x, k], i) =>
        `<i class="fi" style="--x:${x}%;--k:${k};--d:${(-i * .19).toFixed(2)}s">${FLAME}</i>`).join('');
      if (lvl >= 2) { const n = l3 ? 16 : 12; // (la corona de llamas, alrededor de toda la bola: una grande y una pequeña)
        back += Array.from({ length: n }, (_, i) => `<i class="fl" style="--a:${(i * 360 / n).toFixed(1)}deg;--d:${(-i * .17).toFixed(2)}s;--k:${i % 2 ? .74 : 1}">${FLAME}</i>`).join(''); }
      if (l3) front += orbit('fb', Array(3).fill('<i class="tr"></i>' + FIREBALL)); // (con su estela, siempre detrás al girar)
      break;
    case 'water': // agua dentro · ondas · más agua (con burbujas) y gotas en órbita
      surf += `<i class="wv">${WAVE}</i><i class="wv b">${WAVE}</i><i class="gloss"></i>`;
      if (lvl >= 2) back += '<i class="rp"></i><i class="rp b"></i>';
      if (l3) { surf += is('bb', 4, i => `--x:${18 + i * 20}%;--d:${(-i * .6).toFixed(1)}s`); front += orbit('drop', [DROP, DROP, DROP]); }
      break;
    case 'classic': // bañada en oro · laurel · más brillo (un destello que la cruza) y destellos en órbita
      surf += '<i class="gd"></i>' + (l3 ? '<i class="shine"></i>' : '');
      front += '<i class="gr"></i>';
      if (lvl >= 2) back += `<i class="laurel">${laurel()}</i>`;
      if (l3) front += orbit('spk', [SPARK('#FFF4C2'), SPARK('#FFE38A'), SPARK('#FFF4C2'), SPARK('#FFE38A')]);
      break;
    case 'wood': // vetas · marco de madera · madera barnizada (nudo y brillo) y el molino que gira detrás
      surf += '<i class="grain"></i>' + (l3 ? '<i class="knot"></i><i class="varnish"></i>' : '');
      if (lvl >= 2) front += '<i class="wr"></i>';
      if (l3) back += `<i class="mill">${WINDMILL}</i>`;
      break;
    case 'steam': // cinturón de hierro · bocanadas de vapor · la caldera encendida y el tren dando vueltas en su vía
      surf += (l3 ? '<i class="fire"></i>' : '') + '<i class="band"></i>';
      if (lvl >= 2) back += is('puff', 3, i => `--x:${22 + i * 16}%;--d:${(-i * .8).toFixed(1)}s;--s:${[.9, 1.15, 1][i]}`);
      if (l3) { back += '<i class="rails"></i><i class="rails in"></i>'; front += `<i class="orb"><i class="lc">${LOCO_MINI}</i></i>`; }
      break;
    case 'seasons': // la bola en cuatro colores · pétalos, hojas y copos · los colores, vivos y girando, y las cuatro en órbita
      surf += '<i class="qd"></i>';
      if (lvl >= 2) back += is('fl', 3, i => `--x:${18 + i * 26}%;--d:${(-i * 1.1).toFixed(1)}s;--c:${['#F8C3D6', '#D9703A', '#FFFFFF'][i]}`);
      if (l3) front += orbit('se', ['spring', 'summer', 'autumn', 'winter'].map(SEASON_SVG));
      break;
    case 'cosmos': // el espacio dentro · el disco de Gargantua (la mitad de arriba por detrás, la de abajo delante) · más estrellas y copias en órbita
      surf += '<i class="nb"></i>' + (l3 ? is('st', 4, i => `--x:${[24, 62, 44, 72][i]}%;--y:${[30, 22, 66, 54][i]}%;--d:${(-i * .45).toFixed(2)}s`) : '');
      if (lvl >= 2) { back += '<i class="dk"></i>'; front += '<i class="dk fr"></i>'; }
      if (l3) front += orbit('cp', ['', '', '']);
      break;
    case 'fortune': // una ficha de casino · el aro de la ruleta detrás · bañada en oro (con destello) y monedas y un dado en órbita
      surf += (l3 ? '<i class="gd"></i><i class="shine"></i>' : '') + '<i class="ch"></i><i class="ci"></i>';
      if (lvl >= 2) back += '<i class="rw"></i>';
      if (l3) front += orbit('fo', [COIN_MINI, DIE_MINI, COIN_MINI]);
      break;
    case 'prism': // brillo iridiscente · halo arcoíris · iris más vivo (y su destello) y destellos en órbita
      surf += '<i class="ir"></i>' + (l3 ? '<i class="shine"></i>' : '');
      if (lvl >= 2) back += '<i class="halo"></i>';
      if (l3) front += orbit('spk', ['#FFD1E8', '#CFE3FF', '#C8F5E6', '#FFF1C9'].map(SPARK));
      break;
    case 'bolt': // esfera de cronómetro con su aguja · la corona del cronómetro y la estela · cargada de electricidad (aguja loca) y rayos en órbita
      surf += (l3 ? `<i class="zap"></i><i class="zz">${BOLT}</i>` : '') + '<i class="dial"></i><i class="hand"></i><i class="pin"></i>';
      if (lvl >= 2) back += '<i class="knob"></i>' + is('sp', 3, i => `--y:${34 + i * 16}%;--d:${(-i * .28).toFixed(2)}s;--w:${[.7, 1, .8][i]}`);
      if (l3) front += orbit('bz', [BOLT, BOLT, BOLT]);
      break;
    case 'crown': // orbe real (bandas de oro) · la corona encima · bandas con gemas y brillo, y gemas en órbita
      surf += '<i class="rb v"></i><i class="rb"></i>' + (l3 ? is('gm', 3, i => `--x:${[22, 50, 78][i]}%`) + '<i class="shine"></i>' : '');
      if (lvl >= 2) front += `<i class="cr">${CROWN(l3 ? 2 : 0)}</i>`;
      if (l3) front += orbit('gem', [GEM, GEM, GEM]);
      break;
    case 'puzzle': // piezas dibujadas · el marco del puzle alrededor · las piezas de colores y tres piezas en órbita
      surf += (l3 ? '<i class="qp"></i>' : '') + `<i class="jig">${JIGSAW}</i>`;
      if (lvl >= 2) back += `<i class="frame">${FRAME}</i>`;
      if (l3) front += orbit('pc', ['#2E8A80', '#E8873A', '#8E6BE0'].map(PIECE));
      break;
  }
  return `<span class="skBack">${back}</span><span class="skSurf">${surf}</span><span class="skFront">${front}</span>`;
}
export const skinClasses = sk => sk ? ` sk-${sk.id} sl${sk.lvl}` : '';
export const skinParts = sk => sk ? parts(sk.id, sk.lvl) : '';
// una pelota suelta (perfil, partida rápida, aviso del final): tamaño en px y color de bola
// (las piezas dibujadas, también para la imagen de compartir: skin-canvas.js)
export const SKIN_ART = { FLAME, FIREBALL, DROP, SPARK, BOLT, PIECE, CROWN, GEM, FRAME, WAVE, JIGSAW, WINDMILL, LOCO_MINI, SEASON_SVG, laurel, COIN_MINI, DIE_MINI };
export const skinBall = (sk, { size = 56, color = '#f26d6d', cls = '' } = {}) =>
  `<span class="skBall${cls ? ' ' + cls : ''}" style="--bs:${size}px"><span class="skCore${skinClasses(sk)}" style="--pc:${color}">${skinParts(sk)}</span></span>`;
