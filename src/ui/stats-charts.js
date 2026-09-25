// Gráficas de la pestaña de estadísticas (HTML + CSS, sin librerías):
//   · evolución — partidas de los últimos 14 días, ganadas y perdidas apiladas
//   · % de victorias por modo — una barra por modo jugado
//   · contra cada rival — tu balance (ganadas / perdidas) y tu némesis
//   · cartas más usadas
// Color por significado, igual en todas: victorias azul, derrotas naranja (par validado para
// daltonismo; las cifras van siempre escritas junto a las barras).
import { esc } from './dom.js';
import { t, getLang } from '../i18n/index.js';
import { REC_MODES, nemesisId } from './records.js';
import { dateKey } from '../content/levels/generate.js';
import { personaById, faceSVG } from './persona.js';
import { STYLE_COLOR } from './screen-pve.js';
import { CARDS } from '../content/cards/index.js';

const locale = () => getLang() === 'es' ? 'es-ES' : 'en-GB';
const legend = () => `<div class="chLegend"><span class="lg win">${esc(t('stats.ch.won'))}</span><span class="lg loss">${esc(t('stats.ch.lost'))}</span></div>`;
const empty = key => `<p class="muted chEmpty">${esc(t(key))}</p>`;

// últimos 14 días: columnas apiladas (ganadas abajo, perdidas encima)
function evolution(R) {
  const days = [];
  for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(d); }
  const rows = days.map(d => ({ d, ...(R.history[dateKey(d)] || { p: 0, w: 0 }) }));
  const max = Math.max(...rows.map(r => r.p));
  if (!max) return empty('stats.ch.noHistory');
  const peak = rows.findIndex(r => r.p === max);
  const cols = rows.map((r, i) => {
    const lbl = r.d.toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
    const tip = t('stats.ch.dayTip', { day: lbl, p: r.p, w: r.w });
    const w = 100 * r.w / max, l = 100 * (r.p - r.w) / max;
    const today = i === rows.length - 1;
    return `<div class="evCol${today ? ' today' : ''}" title="${esc(tip)}" aria-label="${esc(tip)}">` +
      `<div class="evBar">${r.p && (i === peak || today) ? `<span class="evVal">${r.p}</span>` : ''}` +
      (r.p - r.w ? `<i class="loss" style="height:${l}%"></i>` : '') + (r.w ? `<i class="win" style="height:${w}%"></i>` : '') + `</div>` +
      `<span class="evDay">${r.d.getDate()}</span></div>`;
  }).join('');
  return legend() + `<div class="evChart" role="img" aria-label="${esc(t('stats.ch.evolutionAria'))}">${cols}</div>`;
}

// % de victorias (o de completados) por modo jugado
function byMode(R) {
  const rows = REC_MODES.filter(m => R.played[m] > 0).map(m => ({ m, p: R.played[m], w: Math.min(R.won[m], R.played[m]) }));
  if (!rows.length) return empty('stats.ch.noGames');
  return `<div class="hbars">` + rows.map(r => {
    const pct = Math.round(100 * r.w / r.p);
    return `<div class="hbRow" title="${esc(t('stats.ch.modeTip', { w: r.w, p: r.p }))}"><span class="hbLbl">${esc(t('stats.mode_' + r.m))}</span>` +
      `<span class="hbTrack"><i class="win" style="width:${pct}%"></i></span><span class="hbVal">${pct}% <small>${r.w}/${r.p}</small></span></div>`;
  }).join('') + `</div>`;
}

// balance contra cada personaje: barra de ganadas + perdidas, escalada a quien más partidas tiene
function byRival(R) {
  const nem = nemesisId(R);
  const rows = Object.entries(R.rivals).map(([id, r]) => ({ id, pr: personaById(id), ...r })).filter(r => r.pr && r.w + r.l > 0)
    .sort((a, b) => (b.w + b.l) - (a.w + a.l)).slice(0, 8);
  if (!rows.length) return empty('stats.ch.noRivals');
  const max = Math.max(...rows.map(r => r.w + r.l));
  return legend() + `<div class="hbars rivals">` + rows.map(r => {
    const tip = t('pve.rivalRecordTitle', { w: r.w, l: r.l });
    return `<div class="hbRow" title="${esc(tip)}"><span class="hbLbl rv"><span class="avatar hasFace xs" style="--pc:${STYLE_COLOR[r.pr.style]}">${faceSVG(-1, r.pr.style, 'idle')}</span>${esc(r.pr.name)}` +
      (r.id === nem ? `<span class="rvNemesis">${esc(t('pve.nemesis'))}</span>` : '') + `</span>` +
      `<span class="hbTrack"><i class="win" style="width:${100 * r.w / max}%"></i><i class="loss" style="width:${100 * r.l / max}%"></i></span>` +
      `<span class="hbVal">${r.w} – ${r.l}</span></div>`;
  }).join('') + `</div>`;
}

// tus cartas más jugadas (las 6 primeras)
function byCard(R) {
  const rows = Object.entries(R.cards).filter(([k, n]) => CARDS[k] && n > 0).sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (!rows.length) return empty('stats.ch.noCards');
  const max = rows[0][1];
  return `<div class="hbars">` + rows.map(([k, n]) =>
    `<div class="hbRow"><span class="hbLbl">${esc(CARDS[k].short || CARDS[k].name)}</span>` +
    `<span class="hbTrack"><i class="win" style="width:${100 * n / max}%"></i></span><span class="hbVal">${n}</span></div>`).join('') + `</div>`;
}

export function chartsHTML(R) {
  return `<section><h4>${esc(t('stats.ch.evolution'))}</h4>${evolution(R)}</section>
  <section><h4>${esc(t('stats.ch.byMode'))}</h4>${byMode(R)}</section>
  <section><h4>${esc(t('stats.ch.byRival'))}</h4>${byRival(R)}</section>
  <section><h4>${esc(t('stats.ch.byCard'))}</h4>${byCard(R)}</section>`;
}
