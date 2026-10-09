// Estadísticas (pestaña de Ajustes), lo que no son gráficas: cada baraja, el reto diario, tu progreso en Lo básico (por
// bloques) y los desafíos, el contrarreloj y las coronas, tus pelotas y los totales de la mesa.
// Todo sale de las listas del juego (DECKS, CHALLENGES y sus grupos, los niveles y puzles cargados, SKINS, TOTALS de
// records.js): una baraja, un desafío, un puzle, una pelota o una mecánica nueva aparece aquí sola (y
// tests/stats.test.mjs comprueba que tenga sus textos).
import { esc } from './dom.js';
import { t } from '../i18n/index.js';
import { app } from './app.js';
import { TOTALS, dailyStats, rushMedalCounts } from './records.js';
import { DECKS } from '../content/decks.js';
import { CHALLENGES, CH_GROUPS } from '../content/challenges.js';
import { SKINS, skinProgress, skinBall, ROMAN } from './skins.js';
import { myColor } from './my-ball.js';
import { comboHistory } from './ultimate.js';
import { deckArt } from './screen-modes.js';
import { blockName } from './screen-story.js';
import { dateKey } from '../content/levels/generate.js';

const icon = id => `<svg class="i" aria-hidden="true"><use href="#${id}"/></svg>`;
const chip = (ic, label, value) => `<div class="st">${icon(ic)}${esc(label)} <b>${esc(String(value))}</b></div>`;
const pct = (w, p) => p ? Math.round(100 * Math.min(w, p) / p) : 0;
const sec = (h, body, extra = '') => `<section><h4>${esc(h)}${extra}</h4>${body}</section>`;

// cada baraja de Partida rápida: % de victorias y, en Ultimate, las combinaciones jugadas
function byDeck(R) {
  const rows = DECKS.filter(dk => !dk.locked).map(dk => {
    const s = R.decks[dk.id] || { p: 0, w: 0 }, p = s.p || 0, w = Math.min(s.w || 0, p), v = pct(w, p);
    const name = t('decks.' + dk.id + '.name'), short = dk.ultimate ? 'Ultimate' : t('ult.short.' + dk.id); // (corto: cabe también en el móvil)
    return `<div class="hbRow${p ? '' : ' zero'}" title="${esc(name + ' · ' + t('stats.ch.modeTip', { w, p }))}"><span class="hbLbl dk"><i style="--dk:${dk.color}">${deckArt(dk)}</i>${esc(short)}</span>` +
      `<span class="hbTrack"><i class="win" style="width:${v}%"></i></span><span class="hbVal">${p ? `${v}% <small>${w}/${p}</small>` : '–'}</span></div>`;
  }).join('');
  const combos = comboHistory().length;
  return `<div class="hbars decks">${rows}</div>` + (combos ? `<p class="muted stNote">${esc(t('stats.combos', { n: combos }))}</p>` : '');
}

// el reto diario: jugados, % ganados, racha actual y máxima (y la ventana con todo, para compartir)
function daily() {
  const s = dailyStats(dateKey());
  const nums = [[s.played, 'dstats.played'], [s.pct + '%', 'dstats.pct'], [s.streak, 'dstats.streak'], [s.best, 'dstats.best']]
    .map(([v, k]) => `<div class="stNum"><b>${v}</b><small>${esc(t(k))}</small></div>`).join('');
  return `<div class="stNums">${nums}</div>`;
}

// progreso: Lo básico (por bloques: palos y hoyo, cada baraja… y Lo no tan básico) y desafíos (por grupo), con su barra
function progress(R) {
  const bar = (label, done, total, cls = '') => `<div class="pgRow${cls}"><span class="pgLbl">${esc(label)}</span>` +
    `<span class="pgTrack"><i style="width:${total ? 100 * done / total : 0}%"></i></span><span class="pgVal"><b>${done}</b>/${total}</span></div>`;
  const basics = app.basics || [], blocks = [];
  for (const L of basics) { let b = blocks.find(x => x.deck === L.deck && x.section === L.section); if (!b) blocks.push(b = { deck: L.deck, section: L.section, n: 0, done: 0 }); b.n++; if (R.basics[L.id]) b.done++; }
  const groups = (items, isDone) => CH_GROUPS.map(g => { const of = items.filter(x => x.g === g); return { g, n: of.length, done: of.filter(isDone).length }; }).filter(x => x.n);
  const ch = groups(CHALLENGES.map(c => ({ g: c.group, id: c.id })), x => !!R.challenges[x.id]);
  const sub = list => list.map(x => bar(t('modes.groups.' + x.g), x.done, x.n, ' sub')).join('');
  const sum = list => list.reduce((a, x) => [a[0] + x.done, a[1] + x.n], [0, 0]);
  const [cd, cn] = sum(ch);
  const sec = id => { const of = blocks.filter(b => b.section === id), [d, n] = sum(of); return n ? bar(t('story.sections.' + id), d, n) + of.map(b => bar(blockName(b.deck), b.done, b.n, ' sub')).join('') : ''; };
  return `<div class="pgList">${sec('basics')}${sec('advanced')}${bar(t('stats.mode_challenge'), cd, cn)}${sub(ch)}</div>`;
}

// contrarreloj (récord, series y medallas) y desafíos de la semana (coronas)
function special(R) {
  const rush = R.rush || {}, full = Object.values(R.crowns?.weeks || {}).filter(w => w.length >= 5).length, medals = rushMedalCounts(R);
  return `<div class="stTotals">` +
    chip('i-timer', t('stats.rushBest'), t('modes.rush.pts', { n: rush.best || 0 })) +
    chip('i-check', t('stats.rushDone'), rush.done ?? Math.floor((R.won.rush || 0) / 6)) +
    chip('i-reset', t('stats.rushRuns'), rush.runs || 0) +
    ['gold', 'silver', 'bronze'].map(m => chip('i-trophy', t('stats.rush' + m[0].toUpperCase() + m.slice(1)), medals[m])).join('') +
    chip('i-crown', t('stats.crowns'), R.crowns?.n || 0) +
    chip('i-calendar', t('stats.crownWeeks'), full) + `</div>`;
}

// tus pelotas: cada una con el nivel que tienes (apagada si aún no), y cuántos niveles llevas de todos
function balls(R) {
  const color = myColor();
  const cells = SKINS.map(s => {
    const lvl = skinProgress(s, R).lvl;
    return `<div class="sbItem${lvl ? '' : ' off'}" title="${esc(t('skins.' + s.id + '.name') + (lvl ? ' ' + ROMAN[lvl] : ''))}">` +
      `${skinBall({ id: s.id, lvl: Math.max(1, lvl) }, { size: 30, color })}<small>${lvl ? ROMAN[lvl] : '–'}</small></div>`;
  }).join('');
  const got = SKINS.reduce((a, s) => a + skinProgress(s, R).lvl, 0);
  const cols = Math.ceil(SKINS.length / Math.ceil(SKINS.length / 8)); // (filas iguales, sin huérfanas: 11 → 6 + 5)
  return `<p class="muted achCount">${esc(t('profile.count', { n: got, total: SKINS.length * 3 }))}</p><div class="sbGrid" style="--cols:${cols}">${cells}</div>`;
}

// los totales de la mesa: los de siempre y los de cada mecánica (TOTALS en records.js)
const totals = R => `<div class="stTotals">` + TOTALS.filter(x => !x.hidden).map(x =>
  `<div class="st">${icon(x.icon)}<b>${R.totals[x.k] || 0}</b>${esc(t('stats.tot.' + x.k))}</div>`).join('') + `</div>`;

export const statsSections = {
  decks: R => sec(t('stats.decksH'), byDeck(R)),
  daily: () => sec(t('modes.daily.title'), daily(), `<button type="button" class="btn-text btn-sm stMore" data-set-act="dailyStats">${icon('i-stats')}${esc(t('stats.more'))}</button>`),
  progress: R => sec(t('stats.progressH'), progress(R)),
  special: R => sec(t('stats.specialH'), special(R)),
  balls: R => sec(t('stats.ballsH'), balls(R)),
  totals: R => sec(t('stats.totals'), totals(R)),
};
