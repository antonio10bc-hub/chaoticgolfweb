// "¡Nueva baraja!": cuando el juego estrena una baraja, quien ya jugaba lo ve una vez al llegar al menú principal.
// Una ventana pequeña: la ilustración con lo nuevo (aquí, el campo ajedrezado del casino con la ruleta que gira, una moneda
// que da vueltas y un dado),
// el anuncio, una frase y "Jugar ahora" (Partida rápida con esa baraja) o "Luego".
// Para la próxima baraja: ANNOUNCE = su id y su ilustración en ART. A quien llega por primera vez no se le
// anuncia nada (para esa persona todo es nuevo): se apunta como vista.
import { app } from './app.js';
import { $, esc } from './dom.js';
import { t } from '../i18n/index.js';
import { deckById } from '../content/decks.js';
import { trackSVG, railPath, LOCO, WAGON } from './train-view.js';
import { newQuick } from './screen-modes.js';
import { track } from './analytics.js';
import { REDUCED } from '../fx/juice.js';
import { tilePic } from '../content/tiles/index.js';
import { SEASON_ICON, SNOWBALL } from './season-art.js';
import { wheelSVG, COIN_SVG, GOLD_ICON } from './gambling-view.js';
import { dicePic } from '../content/tiles/dice.js';

const ANNOUNCE = 'gambling';
const KEY = 'chaoticgolf_newDeckSeen';
// ¿ya jugaba? (algo de antes guardado en este dispositivo; se mira al cargar, antes de que el arranque escriba nada)
const returning = (() => { try { return ['chaoticgolf_stats', 'chaoticgolf_tutorial', 'chaoticgolf_deckIntros', 'chaoticgolf_achievements', 'chaoticgolf_lastpve', 'chaoticgolf_intros']
  .some(k => localStorage.getItem(k) != null) || Object.keys(localStorage).some(k => k.startsWith('chaoticgolf_save_')); } catch (e) { return false; } })();
const seen = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } };
const markSeen = () => { try { localStorage.setItem(KEY, JSON.stringify(ANNOUNCE)); } catch (e) { /* sin storage */ } };

// ilustración: un circuito pequeño (como un reloj, con sus 4 paradas) por el que da vueltas el tren
function trainArt() {
  const C = 7, R = 4, CW = 40, CH = 46, W = C * CW, H = R * CH;
  const path = [];
  for (let x = 0; x < C; x++) path.push([x, 0]);
  for (let y = 1; y < R; y++) path.push([C - 1, y]);
  for (let x = C - 2; x >= 0; x--) path.push([x, R - 1]);
  for (let y = R - 2; y > 0; y--) path.push([0, y]);
  const tr = { path, stations: [3, 8, 13, 17] }, center = (x, y) => [x * CW + CW / 2, y * CH + CH / 2];
  let cells = '';
  for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) cells += `<rect x="${x * CW + 2}" y="${y * CH + 2}" width="${CW - 4}" height="${CH - 4}" rx="5" fill="${((x + y) >> 1) & 1 ? '#5C9854' : '#4F8A4B'}"/>`;
  const d = railPath(path.map(([x, y]) => center(x, y))), dur = 9;
  // la locomotora y el vagón siguen la vía (rotate auto: el dibujo mira hacia arriba, de ahí el giro de 90°)
  const sprite = (svg, begin) => `<g>${REDUCED ? '' : `<animateMotion dur="${dur}s" begin="${begin}s" repeatCount="indefinite" rotate="auto" path="${d}"/>`}` +
    `<g transform="rotate(90)">${svg.replace(/<svg class="trainSvg" viewBox="0 0 70 100" preserveAspectRatio="none"/, `<svg x="${-CW * .45}" y="${-CH * .52}" width="${CW * .9}" height="${CH * 1.04}" viewBox="0 0 70 100" preserveAspectRatio="none"`)}</g></g>`;
  const perimeter = 2 * ((C - 1) * CW + (R - 1) * CH), lag = dur * CH / perimeter;
  const hole = `<g transform="translate(${3 * CW + CW / 2} ${1.5 * CH + CH / 2})"><circle r="8" fill="#242424"/><path d="M1 0v-19l10 4-10 4" fill="#E8873A" stroke="#F1F1DC" stroke-width="1.2"/></g>`;
  const ball = `<circle cx="${5 * CW + CW / 2 - 6}" cy="${2 * CH}" r="8" fill="#f26d6d" stroke="#F1F1DC" stroke-width="2"/>`;
  return `<svg class="ndArt" viewBox="-8 -8 ${W + 16} ${H + 16}" role="img" aria-label="${esc(t('newDeck.alt'))}">` +
    `<rect x="-8" y="-8" width="${W + 16}" height="${H + 16}" rx="14" fill="#D8CDB4"/><rect x="0" y="0" width="${W}" height="${H}" rx="8" fill="#3F7440"/>` +
    cells + trackSVG(tr, center, W, H, Math.min(CW, CH), { w: CW - 4, h: CH - 4 }) + hole + ball + sprite(WAGON, -(dur - lag)) + sprite(LOCO, 0) + '</svg>'; // (el vagón, una casilla por detrás)
}
// las estaciones: el campo partido en cuatro franjas (primavera, verano, otoño, invierno), cada una con lo suyo (la planta
// carnívora y el viento, el fuego, las hojas y el charco, la bola de nieve), y una pelota que las cruza
function seasonsArt() {
  const C = 8, R = 4, CW = 34, CH = 44, W = C * CW, H = R * CH;
  const GRASS = [['#59A757', '#4C9A4C'], ['#98A84D', '#8C9D45'], ['#7C8B41', '#6F7F3B'], ['#B7CBD5', '#A9C0CB']];
  let cells = '';
  for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) cells += `<rect x="${x * CW + 2}" y="${y * CH + 2}" width="${CW - 4}" height="${CH - 4}" rx="5" fill="${GRASS[x >> 1][((x + y) >> 1) & 1]}"/>`;
  const put = (type, x, y) => tilePic({ type }).replace('<svg ', `<svg x="${x * CW + 1}" y="${y * CH + 1}" width="${CW - 2}" height="${CH - 2}" `);
  const icon = (s, i) => `<g transform="translate(${i * 2 * CW + CW - 12} ${H - 6})"><circle cx="12" cy="12" r="13" fill="#F1F1DC"/>${SEASON_ICON[s]}</g>`;
  const snow = SNOWBALL.replace('<svg class="snowSvg" viewBox="0 0 100 100" aria-hidden="true">', `<svg x="${7 * CW + 2}" y="${2 * CH + 6}" width="${CW - 4}" height="${CW - 4}" viewBox="0 0 100 100">`);
  const wind = `<path d="M${CW * .5} ${CH * 1.5}C${CW * 1.2} ${CH * .9} ${CW * 1.6} ${CH * 2.1} ${CW * 2.2} ${CH * 1.4}" fill="none" stroke="rgba(255,255,255,.75)" stroke-width="3" stroke-linecap="round" stroke-dasharray="6 7"/>`;
  const ballPath = `M${CW * .5} ${CH * 3.5}H${CW * 7.5}`;
  const ball = `<circle r="8" fill="#f26d6d" stroke="#F1F1DC" stroke-width="2">${REDUCED ? '' : `<animateMotion dur="7s" repeatCount="indefinite" path="${ballPath}"/>`}</circle>`;
  const hole = `<g transform="translate(${6.5 * CW} ${.5 * CH})"><circle r="7" fill="#242424"/><path d="M1 0v-17l9 3.5-9 3.5" fill="#E8873A" stroke="#F1F1DC" stroke-width="1.2"/></g>`;
  return `<svg class="ndArt" viewBox="-8 -8 ${W + 16} ${H + 34}" role="img" aria-label="${esc(t('newDeck.alt'))}">` +
    `<rect x="-8" y="-8" width="${W + 16}" height="${H + 16}" rx="14" fill="#F6CADB"/><rect x="0" y="0" width="${W}" height="${H}" rx="8" fill="#3F7440"/>` +
    cells + wind + put('plant', 1, 0) + put('fire', 2, 1) + put('fire', 3, 1) + put('leaf', 4, 2) + put('puddle', 5, 0) + put('leaf', 5, 3) + put('ice', 6, 3) + snow + hole +
    (REDUCED ? `<circle cx="${CW * .5}" cy="${CH * 3.5}" r="8" fill="#f26d6d" stroke="#F1F1DC" stroke-width="2"/>` : `<g transform="translate(0 0)">${ball}</g>`) +
    ['spring', 'summer', 'autumn', 'winter'].map(icon).join('') + '</svg>';
}
// el multiverso: el campo en el espacio con un agujero negro en medio; la pelota llega, entra y salen cuatro (la
// original y tres copias, con borde discontinuo) cada una por un lado; un meteorito cruza el cielo
function multiverseArt() {
  const C = 7, R = 4, CW = 38, CH = 44, W = C * CW, H = R * CH, bx = 3, by = 2, cx = x => x * CW + CW / 2, cy = y => y * CH + CH / 2;
  let cells = '';
  for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) cells += `<rect x="${x * CW + 2}" y="${y * CH + 2}" width="${CW - 4}" height="${CH - 4}" rx="5" fill="${((x + y) >> 1) & 1 ? '#5C9854' : '#4F8A4B'}"/>`;
  const bh = tilePic({ type: 'blackhole' }).replace('<svg ', `<svg x="${bx * CW + 1}" y="${by * CH + 1}" width="${CW - 2}" height="${CH - 2}" `);
  const dur = 4, X = cx(bx), Y = cy(by);
  // la pelota llega por la izquierda y entra; después salen las cuatro (en bucle)
  const ball = (to, copy) => `<circle cx="${X}" cy="${Y}" r="8" fill="#f26d6d"${copy ? ' fill-opacity=".8" stroke-dasharray="3 2"' : ''} stroke="#F1F1DC" stroke-width="2" opacity="0">` +
    (REDUCED ? `<set attributeName="opacity" to="1"/><set attributeName="cx" to="${to[0]}"/><set attributeName="cy" to="${to[1]}"/>`
      : `<animate attributeName="opacity" dur="${dur}s" repeatCount="indefinite" keyTimes="0;.42;.45;.9;1" values="0;0;1;1;0"/>` +
        `<animate attributeName="cx" dur="${dur}s" repeatCount="indefinite" keyTimes="0;.45;.7;1" values="${X};${X};${to[0]};${to[0]}"/>` +
        `<animate attributeName="cy" dur="${dur}s" repeatCount="indefinite" keyTimes="0;.45;.7;1" values="${Y};${Y};${to[1]};${to[1]}"/>`) + '</circle>';
  const incoming = REDUCED ? '' : `<circle cx="${cx(0)}" cy="${Y}" r="8" fill="#f26d6d" stroke="#F1F1DC" stroke-width="2">` +
    `<animate attributeName="cx" dur="${dur}s" repeatCount="indefinite" keyTimes="0;.4;1" values="${cx(0)};${X};${X}"/>` +
    `<animate attributeName="r" dur="${dur}s" repeatCount="indefinite" keyTimes="0;.32;.42;1" values="8;8;0;0"/></circle>`;
  const meteor = REDUCED ? '' : `<g opacity="0"><animate attributeName="opacity" dur="${dur * 1.5}s" repeatCount="indefinite" keyTimes="0;.7;.74;.86;1" values="0;0;1;0;0"/>` +
    `<path d="M${W * .78} ${-4}L${W * .6} ${H * .32}" stroke="#FFE1A8" stroke-width="3" stroke-linecap="round"/><circle cx="${W * .6}" cy="${H * .32}" r="4" fill="#FFD58A"/></g>`;
  const hole = `<g transform="translate(${cx(6)} ${cy(0)})"><circle r="7" fill="#242424"/><path d="M1 0v-17l9 3.5-9 3.5" fill="#E8873A" stroke="#F1F1DC" stroke-width="1.2"/></g>`;
  return `<svg class="ndArt" viewBox="-8 -8 ${W + 16} ${H + 16}" role="img" aria-label="${esc(t('newDeck.alt'))}">` +
    `<rect x="-8" y="-8" width="${W + 16}" height="${H + 16}" rx="14" fill="#1B1440"/><rect x="0" y="0" width="${W}" height="${H}" rx="8" fill="#3F7440"/>` +
    cells + bh + hole + incoming + ball([cx(5), Y], false) + ball([X, cy(0)], true) + ball([X, cy(3)], true) + ball([cx(1), Y], true) + meteor + '</svg>';
}
// el casino: el campo ajedrezado (rojo y negro, con la casilla dorada) y, encima, la ruleta que gira; una moneda da
// vueltas sobre una casilla y un dado espera en otra
function gamblingArt() {
  const C = 7, R = 4, CW = 38, CH = 44, W = C * CW, H = R * CH, gold = [5, 2];
  let cells = '';
  for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) cells += `<rect x="${x * CW + 2}" y="${y * CH + 2}" width="${CW - 4}" height="${CH - 4}" rx="5" fill="${x === gold[0] && y === gold[1] ? '#C9962E' : (x + y) % 2 === 0 ? '#8E1F2E' : '#26262D'}"/>`;
  cells += GOLD_ICON.replace('<svg class="gGoldSvg" viewBox="-12 -12 24 24" aria-hidden="true">', `<svg x="${gold[0] * CW + CW / 2 - 13}" y="${gold[1] * CH + CH / 2 - 13}" width="26" height="26" viewBox="-12 -12 24 24">`);
  const S = 150, wheel = wheelSVG(200).replace(/<svg[^>]*>/, `<svg x="${(W - S) / 2 - 40}" y="${(H - S) / 2}" width="${S}" height="${S}" viewBox="0 0 200 200">`)
    .replace('<g class="rlRot">', `<g>${REDUCED ? '' : '<animateTransform attributeName="transform" type="rotate" dur="5s" repeatCount="indefinite" calcMode="spline" keyTimes="0;.7;1" keySplines=".1 .6 .2 1;0 0 1 1" values="0 100 100;1060 100 100;1060 100 100"/>'}`);
  const coin = COIN_SVG.replace('<svg class="gCoinSvg" viewBox="0 0 40 40" aria-hidden="true">', `<svg x="${6 * CW + 6}" y="${0 * CH + 8}" width="${CW - 12}" height="${CW - 12}" viewBox="0 0 40 40">`);
  const coinG = REDUCED ? coin : `<g>${coin}<animateTransform attributeName="transform" type="translate" dur="1.6s" repeatCount="indefinite" values="0 0;0 -5;0 0"/></g>`;
  const dice = dicePic({ t: 4, n: 2, e: 1 }).replace('<svg class="tilePic dicePic" viewBox="0 0 100 140" aria-hidden="true">', `<svg x="${0 * CW + 3}" y="${3 * CH + 2}" width="${CW - 6}" height="${CH - 4}" viewBox="0 0 100 140">`);
  return `<svg class="ndArt" viewBox="-8 -8 ${W + 16} ${H + 16}" role="img" aria-label="${esc(t('newDeck.alt'))}">` +
    `<rect x="-8" y="-8" width="${W + 16}" height="${H + 16}" rx="14" fill="#5A2E1A"/><rect x="-4" y="-4" width="${W + 8}" height="${H + 8}" rx="11" fill="none" stroke="#C9962E" stroke-width="2"/>` +
    `<rect x="0" y="0" width="${W}" height="${H}" rx="8" fill="#145C3E"/>` + cells + dice + coinG + wheel + '</svg>';
}
const ART = { train: trainArt, seasons: seasonsArt, multiverse: multiverseArt, gambling: gamblingArt };

// al llegar al menú principal (una vez): true si se ha enseñado
export function maybeAnnounceDeck() {
  if (seen() === ANNOUNCE) return false;
  if (!returning) { markSeen(); return false; }
  if (app.screen !== 'menu' || $('dialog').open) return false;
  markSeen();
  const dk = deckById(ANNOUNCE), dlg = $('dialog');
  dlg.innerHTML = `<form method="dialog" class="dlgBox newDeck" style="--dk:${dk.color}">` +
    `<div class="ndPic">${ART[ANNOUNCE]?.() || ''}<span class="ndBadge">${esc(t('newDeck.badge'))}</span></div>` +
    `<h3>${esc(t('newDeck.title'))}</h3><p>${esc(t('newDeck.text'))}</p>` +
    `<div class="dlgBtns"><button value="later" class="btn-light">${esc(t('newDeck.later'))}</button><button value="play" class="btn-primary">${esc(t('newDeck.play'))}</button></div></form>`;
  const done = () => {
    dlg.removeEventListener('close', done);
    const play = dlg.returnValue === 'play';
    track('baraja_nueva', { baraja: ANNOUNCE, jugar: play });
    if (play) newQuick(ANNOUNCE);
  };
  dlg.addEventListener('close', done);
  dlg.returnValue = '';
  dlg.showModal();
  dlg.querySelector('button[value="play"]').focus();
  return true;
}
