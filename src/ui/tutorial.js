// Tutorial interactivo del Modo Historia.
//   · Nivel 1: presentación guiada (tu pelota, el hoyo, tus cartas, elegir destino, terminar turno)
//   · Cualquier nivel: la primera vez que usas cada carta, un bocadillo explica qué hace
// Lo ya visto se recuerda en este dispositivo (Ajustes → "Repetir el tutorial" lo reinicia).
// Nunca bloquea la partida: el bocadillo se puede cerrar y avanza solo al jugar.
import { app } from './app.js';
import { $, esc } from './dom.js';
import { t } from '../i18n/index.js';
import { CARDS } from '../content/cards/index.js';
import { cardArtHTML } from './card-art.js';
import { sfx } from '../audio/sfx.js';

const KEY = 'chaoticgolf_tutorial';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
const save = d => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* sin storage */ } };
export const resetTutorial = () => save({});

// las cuatro direcciones de una carta de hoyo se explican una sola vez
const groupOf = key => key.startsWith('oHoyo') ? 'oHoyo' : key.startsWith('hoyo') ? 'hoyo' : key;

let step = null;   // paso de la presentación del nivel 1 (null = sin presentación)
let timer = null;

const active = () => app.mode === 'story' && app.screen === 'game' && app.game;

export function tutorialStart() {
  hideCoach();
  step = null;
  if (app.mode !== 'story' || app.levelIndex !== 0 || load().intro) return;
  step = 'ball';
  clearTimeout(timer);
  timer = setTimeout(() => { if (active() && step === 'ball') showStep(); }, 900);
}
export function tutorialStop() { step = null; clearTimeout(timer); hideCoach(); }

function finishIntro() {
  step = null;
  const d = load(); d.intro = true; save(d);
}

// pasos de la presentación: [objetivo, texto, ¿botón?]
const STEPS = {
  ball: ['#pieces .piece[data-id="b0"]', 'tutorial.ball', 'next'],
  hole: ['#pieces .piece[data-id="hole"]', 'tutorial.hole', 'next'],
  hand: ['#hands', 'tutorial.hand', null],
  target: ['#board', 'tutorial.target', null],
  end: ['#endTurnBtn', 'tutorial.end', 'ok'],
};
function showStep(extraCard) {
  const [sel, key, btn] = STEPS[step];
  showCoach({ target: sel, text: t(key), btn, card: extraCard });
}

// eventos de la partida (los manda el controlador)
export function tutorialEvent(kind, data = {}) {
  if (!active()) return;
  const S = app.game.S;
  const firstCard = data.key && firstTime(data.key);
  if (step === 'hand' && (kind === 'selected' || kind === 'played')) {
    if (kind === 'selected') { step = 'target'; showStep(firstCard ? data.key : null); return; }
    step = 'end'; showStep(firstCard ? data.key : null); return; // carta de efecto inmediato (hoyo…)
  }
  if (step === 'target' && kind === 'resolved') { step = 'end'; showStep(); return; }
  if (step === 'end' && kind === 'turnEnded') { finishIntro(); hideCoach(); return; }
  if (step) return;
  // fuera de la presentación: explicación de cada carta la primera vez que se usa
  if ((kind === 'selected' || kind === 'played') && firstCard && data.p === 0 && S.winner === null) {
    showCoach({ target: kind === 'selected' ? '#actionBar' : '#discardPile', card: data.key, btn: 'ok' });
  }
}

// ¿primera vez que se usa esta carta? (y la marca como vista)
function firstTime(key) {
  if (!CARDS[key]) return false;
  const d = load(), g = groupOf(key);
  d.cards = d.cards || {};
  if (d.cards[g]) return false;
  d.cards[g] = true; save(d);
  return true;
}

/* ---------- bocadillo del tutor ---------- */
function showCoach({ target, text = '', btn = null, card = null }) {
  const el = $('coach');
  const def = card && CARDS[card];
  const cardHtml = def ? `<div class="coachCard"><span class="hintCard ${def.color}">${cardArtHTML(def)}</span>` +
    `<span><b>${esc(t(groupOf(card) === 'hoyo' || groupOf(card) === 'oHoyo' ? 'tutorial.holeCards' : `cards.${card}.name`, { card: def.short || def.name }))}</b>` +
    `<small>${esc(t('cardKind.' + def.color))}</small></span></div><p>${esc(t(`tutorial.card.${groupOf(card)}`, { card: def.name }))}</p>` : '';
  el.innerHTML = `<div class="coachBody">${cardHtml}${text ? `<p>${esc(text)}</p>` : ''}</div>` +
    `<div class="coachBtns">${btn ? `<button class="btn-primary btn-sm" data-coach="${btn}">${esc(t(btn === 'next' ? 'tutorial.next' : 'tutorial.ok'))}</button>` : ''}` +
    `<button class="btn-text btn-sm" data-coach="skip">${esc(t(step ? 'tutorial.skip' : 'common.close'))}</button></div>`;
  el.classList.add('visible');
  el.dataset.target = target || '';
  place();
  sfx('select');
}
function hideCoach() {
  $('coach')?.classList.remove('visible');
  $('coachRing')?.classList.remove('visible');
}

// coloca el bocadillo junto a su objetivo (encima si cabe) y un aro que lo señala
function place() {
  const el = $('coach');
  if (!el.classList.contains('visible')) return;
  const tg = el.dataset.target && document.querySelector(el.dataset.target);
  const r = tg?.getBoundingClientRect();
  let ring = $('coachRing');
  if (!ring) { ring = document.createElement('div'); ring.id = 'coachRing'; document.body.appendChild(ring); }
  if (!r || !r.width) { ring.classList.remove('visible'); el.style.transform = `translate(${(innerWidth - el.offsetWidth) / 2}px, ${innerHeight * .3}px)`; return; }
  const pad = 6;
  ring.style.transform = `translate(${r.left - pad}px, ${r.top - pad}px)`;
  ring.style.width = r.width + pad * 2 + 'px'; ring.style.height = r.height + pad * 2 + 'px';
  ring.classList.toggle('big', r.width > 200);
  ring.classList.add('visible');
  const w = el.offsetWidth, h = el.offsetHeight;
  // objetivo grande (el tablero): al lado, para no tapar las casillas
  if (r.height > innerHeight * .45) {
    const right = r.right + 18, left = r.left - w - 18;
    const x = right + w < innerWidth - 10 ? right : left > 10 ? left : null;
    if (x !== null) {
      el.dataset.side = x === right ? 'left' : 'right';
      el.style.setProperty('--ay', Math.min(h - 20, 40) + 'px');
      el.style.transform = `translate(${Math.round(x)}px, ${Math.round(Math.max(10, r.top + r.height * .35 - h / 2))}px)`;
      return;
    }
  }
  let x = r.left + r.width / 2 - w / 2, y = r.top - h - 16, side = 'top';
  if (y < 10) { y = r.bottom + 16; side = 'bottom'; }
  if (y + h > innerHeight - 10) { y = Math.max(10, r.top + r.height / 2 - h / 2); side = 'mid'; }
  x = Math.max(10, Math.min(innerWidth - w - 10, x));
  el.dataset.side = side;
  el.style.setProperty('--ax', Math.max(18, Math.min(w - 18, r.left + r.width / 2 - x)) + 'px');
  el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
}

export function bindTutorial() {
  $('coach').addEventListener('click', e => {
    const b = e.target.closest('[data-coach]');
    if (!b) return;
    const a = b.dataset.coach;
    if (a === 'skip') { if (step) finishIntro(); hideCoach(); return; }
    if (a === 'next' && step === 'ball') { step = 'hole'; showStep(); return; }
    if (a === 'next' && step === 'hole') { step = 'hand'; showStep(); return; }
    if (a === 'ok' && step === 'end') { finishIntro(); }
    hideCoach();
  });
  window.addEventListener('resize', place);
}
