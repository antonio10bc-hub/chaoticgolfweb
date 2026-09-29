// "Tu pelota" (botón de la camiseta en el menú): tu pelota en grande sobre un green, con la que llevas puesta y tu
// color, y debajo las pelotas que se ganan (src/ui/skins.js), cada una con sus 3 niveles y lo que falta para el
// siguiente. Tocar una pelota o un nivel la enseña en grande (aunque aún no se tenga: así se ve el premio); las
// ganadas se ponen con un toque. También en Partida rápida, bajo el color (pveSkinsHTML).
import { $, esc } from './dom.js';
import { t } from '../i18n/index.js';
import { PLAYER_COLORS } from '../engine/game.js';
import { SKINS, GROUPS, ROMAN, skinById, skinProgress, unlockedLevels, equippedSkin, equipSkin, unseenSkins, markSkinsSeen, skinBall } from './skins.js';
import { loadRecords } from './records.js';
import { loadProfile, saveProfile } from './profile.js';
import { sfx } from '../audio/sfx.js';
import { ensureGuard } from './back.js';
import { track } from './analytics.js';

const COLORS = [...PLAYER_COLORS, '#e8833a']; // (los mismos que en Partida rápida)
export const myColor = () => COLORS[loadProfile().color % COLORS.length];
let view = null, lastFocus = null; // pelota a la vista en grande: { id, lvl } o null (la normal)

// lo que pide cada nivel ("7 días", "15 victorias", "Intermedio")
export function goalLabel(s, lvl) {
  if (s.kind === 'groups') return t('modes.groups.' + GROUPS[lvl - 1]);
  const n = s.at[lvl - 1];
  return t((s.kind === 'streak' ? 'skins.unit.days' : s.kind === 'rush' ? 'skins.unit.series' : 'skins.unit.wins') + (n === 1 ? '1' : ''), { n });
}
const skinName = sk => sk ? `${t('skins.' + sk.id + '.name')} ${ROMAN[sk.lvl]}` : t('profile.basic');
export { skinName };

const icon = id => `<svg class="i" aria-hidden="true"><use href="#${id}"/></svg>`;
const FLAG = '<svg class="pfFlag" viewBox="0 0 30 58" aria-hidden="true"><path d="M5 56V5" stroke="#F1F1DC" stroke-width="2.6" stroke-linecap="round"/><path d="M6 6 27 13 6 20Z" fill="#E8873A"/><ellipse cx="5" cy="56" rx="5" ry="2.2" fill="#242424"/></svg>';

function heroHTML(levels, eq, pop) {
  const s = view && skinById(view.id), have = s ? levels[s.id] || 0 : 0, color = myColor();
  const got = !s || view.lvl <= have;
  const worn = s ? eq && eq.id === s.id && eq.lvl === view.lvl : !eq;
  let sub, acts;
  if (!s) sub = esc(t('profile.basicSub'));
  else {
    const p = skinProgress(s);
    sub = `${esc(t('skins.' + s.id + '.goal'))} · <b>${esc(goalLabel(s, view.lvl))}</b>`;
    if (!got) sub += `<br>${esc(t('profile.missing', { n: s.kind === 'groups' ? `${p.value}/${p.target}` : `${p.value}/${s.at[view.lvl - 1]}` }))}`;
  }
  if (worn) acts = `<span class="pfWorn">${icon('i-check')}${esc(t('profile.worn'))}</span>`;
  else if (got) acts = `<button class="btn-primary btn-sm" data-pf="equip">${esc(t(s ? 'profile.equip' : 'profile.useBasic'))}</button>`;
  else acts = `<span class="pfLockNote">${icon('i-lock')}${esc(t('profile.locked'))}</span>`;
  const colors = COLORS.map((c, i) => `<button class="pveColor${loadProfile().color % COLORS.length === i ? ' sel' : ''}" style="background:${c}" data-pfcolor="${i}" aria-label="${esc(t('pve.colorAria', { n: i + 1 }))}"></button>`).join('');
  const burst = pop === 'equip' ? `<span class="pfBurst">${Array.from({ length: 10 }, (_, i) => `<i style="--a:${i * 36}deg;--d:${(i % 2) * .05}s"></i>`).join('')}</span>` : '';
  return `<div class="pfStage">${FLAG}${skinBall(view, { size: 96, color, cls: pop ? 'pop' : '' })}${burst}</div>` +
    `<div class="pfInfo"><div class="pfName">${esc(s ? t('skins.' + s.id + '.name') : t('profile.basic'))}${s ? `<span class="lv">${ROMAN[view.lvl]}</span>` : ''}</div>` +
    `<div class="pfSub">${sub}</div><div class="pfActs">${acts}${eq && worn && s ? `<button class="btn-text btn-sm" data-pf="none">${esc(t('profile.takeOff'))}</button>` : ''}</div>` +
    `<div class="pfColors" role="group" aria-label="${esc(t('profile.color'))}">${colors}</div></div>`;
}

function cardHTML(s, i, R, levels, eq, unseen) {
  const p = skinProgress(s, R), have = p.lvl, color = myColor();
  const mini = { id: s.id, lvl: Math.max(1, have) };
  const worn = eq && eq.id === s.id, sel = view && view.id === s.id;
  const lv = [1, 2, 3].map(l => {
    const cls = (l <= have ? ' got' : l === have + 1 ? ' next' : '') + (sel && view.lvl === l ? ' cur' : '');
    return `<button class="pfLv${cls}" data-pfv="${s.id}:${l}" aria-label="${esc(skinName({ id: s.id, lvl: l }) + ' · ' + goalLabel(s, l))}">${ROMAN[l]}<small>${esc(goalLabel(s, l))}</small></button>`;
  }).join('');
  const bar = p.target == null
    ? `<div class="pfBar done">${icon('i-check')}${esc(t('profile.complete'))}</div>`
    : `<div class="pfBar"><span class="tr"><i style="width:0" data-w="${Math.round(p.pct * 100)}"></i></span><span><b>${p.value}</b> / ${p.target}</span></div>`;
  return `<div class="pfCard${have ? '' : ' locked'}${worn ? ' worn' : ''}${sel ? ' sel' : ''}" style="--sk:${s.accent};--i:${i}" data-pfcard="${s.id}" role="button" tabindex="0">` +
    `<span class="pfMini">${skinBall(mini, { size: 40, color })}${have ? '' : `<span class="pfLock">${icon('i-lock')}</span>`}</span>` +
    `<b class="nm">${esc(t('skins.' + s.id + '.name'))}${unseen.has(s.id) ? `<span class="pfNew">${esc(t('profile.new'))}</span>` : ''}</b>` +
    `<span class="goal">${esc(t('skins.' + s.id + '.goal'))}</span><span class="pfLvls">${lv}</span>${bar}</div>`;
}

function paint(pop = '', intro = false) {
  const R = loadRecords(), levels = unlockedLevels(R), eq = equippedSkin(levels);
  const unseen = new Set(unseenSkins(levels).map(x => x.id));
  const total = SKINS.length * 3, got = Object.values(levels).reduce((a, b) => a + b, 0);
  const box = $('profBox');
  const hero = box.querySelector('.pfHero');
  const accent = view ? skinById(view.id).accent : 'var(--grass-dark)';
  if (!hero) {
    box.innerHTML = `<header><h2 id="pfTitle">${esc(t('profile.title'))}</h2>` +
      `<button class="btn-ghost btn-sm btn-icon setClose" data-pf="close" aria-label="${esc(t('common.close'))}">${icon('i-x')}</button></header>` +
      `<div class="pfLayout"><div class="pfHero"></div><div class="setBody"><div class="pfListHead"><h4>${esc(t('profile.listH'))}</h4><span class="pfCount"></span></div><div class="pfGrid"></div></div></div>`;
  }
  const h = box.querySelector('.pfHero');
  h.style.setProperty('--sk', accent);
  h.innerHTML = heroHTML(levels, eq, pop);
  box.querySelector('.pfCount').textContent = t('profile.count', { n: got, total });
  const grid = box.querySelector('.pfGrid');
  grid.innerHTML = SKINS.map((s, i) => cardHTML(s, i, R, levels, eq, unseen)).join('');
  grid.classList.toggle('intro', intro); // (las tarjetas llegan escalonadas y las barras se llenan solo al abrir)
  const fill = () => grid.querySelectorAll('.pfBar .tr i').forEach(el => { el.style.width = el.dataset.w + '%'; });
  if (intro) requestAnimationFrame(() => requestAnimationFrame(fill)); else fill();
}

export function openMyBall() {
  lastFocus = document.activeElement;
  view = equippedSkin();
  $('profBox').innerHTML = '';
  paint('pop', true);
  $('profileOverlay').classList.add('visible');
  $('profBox').querySelector('.setClose')?.focus({ preventScroll: true });
  markSkinsSeen(); // (las "¡Nueva!" se ven esta vez)
  const pf = loadProfile(); if (pf.myBallOpened !== MYBALL_CTA) { pf.myBallOpened = MYBALL_CTA; saveProfile(pf); } // (ya la has visto: sin aviso)
  paintProfileDot();
  track('perfil', { accion: 'abrir' });
  ensureGuard();
  sfx('select');
}
export function closeMyBall() {
  $('profileOverlay').classList.remove('visible');
  document.dispatchEvent(new CustomEvent('myball:close')); // (Partida rápida repinta tu pelota)
  lastFocus?.focus?.({ preventScroll: true });
}
export const myBallOpen = () => $('profileOverlay').classList.contains('visible');
// el punto del botón del menú: hay pelotas o niveles nuevos sin ver
// y, hasta que abres "Tu pelota" por primera vez, el botón pide atención (punto que late y la camiseta que se balancea).
// MYBALL_CTA: subirlo vuelve a enseñar el aviso a todo el mundo (también a quien ya había entrado)
const MYBALL_CTA = 1;
export function paintProfileDot() {
  const b = $('profileBtn'), d = b?.querySelector('.pfDot');
  if (!d) return;
  const cta = loadProfile().myBallOpened !== MYBALL_CTA;
  d.hidden = !cta && !unseenSkins().length;
  b.classList.toggle('cta', cta);
}

// Partida rápida: tu pelota, bajo el color (las ganadas, en su nivel más alto, y un acceso a "Tu pelota")
export function pveSkinsHTML() {
  const levels = unlockedLevels(), eq = equippedSkin(levels), color = myColor();
  const owned = SKINS.filter(s => levels[s.id]).map(s => ({ id: s.id, lvl: eq?.id === s.id ? eq.lvl : levels[s.id] }));
  const chip = (sk, on) => `<button class="pveSkin${on ? ' sel' : ''}" data-pskin="${sk ? sk.id + ':' + sk.lvl : 'none'}" aria-pressed="${on}" title="${esc(skinName(sk))}" aria-label="${esc(skinName(sk))}">${skinBall(sk, { size: 26, color })}</button>`;
  return chip(null, !eq) + owned.map(sk => chip(sk, eq?.id === sk.id)).join('') +
    `<button class="pveSkin more" data-pskin="more" title="${esc(t('profile.title'))}" aria-label="${esc(t('profile.title'))}">${icon('i-shirt')}</button>`;
}
export function pickPveSkin(v) {
  if (v === 'more') { openMyBall(); return false; }
  const [id, lvl] = v.split(':');
  equipSkin(v === 'none' ? null : { id, lvl: +lvl });
  track('pelota', { accion: 'poner', skin: v === 'none' ? 'normal' : id, nivel: +lvl || 0, desde: 'partida rápida' });
  sfx('select');
  return true;
}

export function bindMyBall() {
  $('profileBtn').addEventListener('click', openMyBall);
  const ov = $('profileOverlay');
  ov.addEventListener('click', e => {
    if (e.target === ov) { closeMyBall(); return; }
    const a = e.target.closest('[data-pf]');
    if (a?.dataset.pf === 'close') { closeMyBall(); return; }
    if (a?.dataset.pf === 'none') { // quitarse la pelota: vuelve la normal
      equipSkin(null); view = null;
      track('pelota', { accion: 'quitar', desde: 'perfil' });
      sfx('select'); paint('pop');
      return;
    }
    if (a?.dataset.pf === 'equip') {
      equipSkin(view);
      track('pelota', { accion: 'poner', skin: view ? view.id : 'normal', nivel: view?.lvl || 0, desde: 'perfil' });
      sfx(view ? 'win' : 'select');
      paint('equip');
      return;
    }
    const c = e.target.closest('[data-pfcolor]');
    if (c) { const p = loadProfile(); p.color = +c.dataset.pfcolor; saveProfile(p); sfx('select'); paint(); return; }
    const v = e.target.closest('[data-pfv]'), card = e.target.closest('[data-pfcard]');
    if (v || card) {
      const s = skinById(v ? v.dataset.pfv.split(':')[0] : card.dataset.pfcard);
      const lvl = v ? +v.dataset.pfv.split(':')[1] : Math.max(1, skinProgress(s).lvl);
      if (view && view.id === s.id && view.lvl === lvl && !v) { view = null; } // (tocar otra vez la tarjeta: la normal)
      else view = { id: s.id, lvl };
      sfx('select');
      paint('pop');
    }
  });
  ov.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-pfcard]')) { e.preventDefault(); e.target.click(); }
  });
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && myBallOpen() && !document.querySelector('dialog[open]')) { e.stopImmediatePropagation(); closeMyBall(); }
  }, true);
}
