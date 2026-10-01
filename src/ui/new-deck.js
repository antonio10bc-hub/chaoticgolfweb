// "¡Nueva baraja!": cuando el juego estrena una baraja, quien ya jugaba lo ve una vez al llegar al menú principal.
// Una ventana pequeña: la ilustración con lo nuevo (aquí, el circuito con la locomotora y su vagón dando vueltas),
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

const ANNOUNCE = 'train';
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
const ART = { train: trainArt };

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
