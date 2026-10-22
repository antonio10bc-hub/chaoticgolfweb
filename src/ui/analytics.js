// Analíticas del juego con Umami (cloud.umami.is): sin cookies, anónimas. Cada pantalla cuenta como una página
// (/modos, /lo-basico, /partida/reto-diario…: recorridos y tiempo en cada una) y estos eventos:
//   · "partida"    una partida nueva: modo y lo que la define (baraja, dificultad…) y si se juega en la app instalada
//   · "continua"   se retoma una partida guardada
//   · "final"      cómo acaba: victoria o derrota, turnos y segundos
//   · "abandona"   se sale o se reinicia con la partida a medias (turnos y segundos)
//   · "tutorial"   la presentación de Lo básico, terminada o saltada
//   · "ayuda"      consejo del caddie o deshacer · "compartir" resultado, jugada o nivel
//   · "creador"    abrir el creador o probar un nivel · "instalar" la app instalada
// Solo en la web publicada (main.js carga el script fuera de localhost): en desarrollo y en los tests no se envía
// nada. Nunca datos personales (ni nombres ni códigos de niveles). Si el script aún no ha cargado, los eventos
// esperan en una cola; si no carga (sin red, bloqueador), se pierden sin más.
// Los mismos eventos van también a PostHog (región EU, el proyecto compartido con los otros juegos: llevan
// app=chaoticgolf), con nombres en inglés para cruzarlos con ellos (POSTHOG_NAMES), y solo allí:
//   · card_played    cada carta que juega una persona (no los bots): carta, modo y si es una reacción al JAQUE
//   · card_blocked   una carta que se intenta jugar y no se puede (¿qué reglas no se entienden?)
import { app } from './app.js';
import { isPhone } from './device.js';
import { getLang } from '../i18n/index.js';

export const UMAMI_ID = '4f7cca22-af83-4f80-8281-18d28a54259a';
let queue = [];

// --- PostHog ---
const PH_KEY = 'phc_xnbbVrZbqhjzk6GfeLxopJHkhtxFFXAxM96symjc2snN'; // clave pública (va en la web por diseño)
const PH_HOST = '/ingest'; // por la propia web (rewrite en vercel.json → PostHog EU): los bloqueadores no lo cortan
const POSTHOG_NAMES = { partida: 'match_started', final: 'match_ended', abandona: 'match_quit', continua: 'match_resumed',
  tutorial: 'tutorial_finished', ayuda: 'help_used', compartir: 'shared', creador: 'editor_used', baraja_nueva: 'new_deck_shown',
  instalar: 'app_installed', coronas: 'crowns_notice', estadisticas: 'stats_opened', regalo: 'gift_claimed', perfil: 'profile_opened',
  pelota: 'ball_skin' };
// las claves comunes a todos los juegos, en inglés (el resto se queda como está)
const POSTHOG_KEYS = { modo: 'mode', resultado: 'result', turnos: 'turns', segundos: 'seconds', app: 'install', interfaz: 'pointer', idioma: 'lang' };
const POSTHOG_VALUES = { victoria: 'win', derrota: 'lose' };
let ph = null;
// main.js lo arranca junto a Umami, solo en la web publicada. El stub guarda las llamadas hasta que llega la librería
export function startPostHog() {
  if (ph) return;
  const stub = [];
  for (const m of ['capture', 'register']) stub[m] = (...args) => stub.push([m, ...args]);
  stub.people = [];
  stub._i = [[PH_KEY, { api_host: PH_HOST, ui_host: 'https://eu.posthog.com', autocapture: false, capture_pageview: true,
    capture_pageleave: true, disable_session_recording: true, person_profiles: 'identified_only' }]];
  window.posthog = ph = stub;
  ph.register({ app: 'chaoticgolf' });
  const sc = document.createElement('script');
  sc.async = true; sc.crossOrigin = 'anonymous'; sc.src = PH_HOST + '/static/array.js';
  document.head.append(sc);
}
function capture(name, data) {
  if (!ph) return;
  const lib = window.posthog || ph;
  if (lib === ph && ph.length > 300) return; // (la librería no llega: la cola no crece sin límite)
  const props = {};
  for (const [k, v] of Object.entries(data)) props[POSTHOG_KEYS[k] || k] = POSTHOG_VALUES[v] || v;
  try { lib.capture(POSTHOG_NAMES[name] || name, props); } catch (e) { /* nunca rompe el juego */ }
}

const clean = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ''));
// envía (o deja en cola): args son los de umami.track, un evento (nombre, datos) o una página (función)
function send(...args) {
  if (window.umami?.track) { try { window.umami.track(...args); } catch (e) { /* nunca rompe el juego */ } }
  else if (queue && queue.length < 40) queue.push(args);
}
export function track(name, data = {}, { onlyPostHog = false } = {}) {
  if (typeof window === 'undefined') return; // (tests de node)
  const d = clean({ ...data, interfaz: isPhone() ? 'touch' : 'mouse', idioma: getLang() });
  capture(name, d);
  if (!onlyPostHog) send(name, { ...d, interfaz: isPhone() ? 'táctil' : 'ordenador' });
}
// cuando el script de Umami ha cargado: lo que estaba en cola
export function flushQueue() {
  const q = queue || []; queue = null;
  for (const args of q) { try { window.umami?.track(...args); } catch (e) { /* nada */ } }
}

// cada pantalla, como una página (showScreen, solo al cambiar: la del arranque ya la cuenta el script de Umami)
const PAGE = { menu: '/', story: '/lo-basico', modes: '/modos', pve: '/partida-rapida', editor: '/creador' };
const SLUG = { pve: 'partida-rapida', local: 'multijugador-local', daily: 'reto-diario', rush: 'contrarreloj', challenge: 'desafio',
  weekly: 'desafio-semanal', story: 'tus-niveles', puzzle: 'lo-basico', own: 'tus-niveles', test: 'prueba-creador' };
export function trackScreen(screen) {
  if (typeof window === 'undefined') return;
  const k = screen === 'game' ? currentKind() : null;
  const url = screen === 'game' ? '/partida/' + (SLUG[k === 'story' && ownLevel() ? 'own' : k] || 'otra') : PAGE[screen];
  if (url) send(props => ({ ...props, url, title: 'Chaotic Golf' }));
  if (url) capture('screen_viewed', { screen: k ? 'game' : screen, path: url, ...(k ? modeData(k) : {}) });
}

// cada carta que juega una persona (controller.js), solo a PostHog: son muchas por partida
export function trackCard(key, reaction) {
  const k = currentKind();
  if (k && k !== 'test') track('card_played', { card: key, modo: modeData(k).modo, reaction }, { onlyPostHog: true });
}
export function trackBlockedCard(key) {
  const k = currentKind();
  if (k && k !== 'test') track('card_blocked', { card: key, modo: modeData(k).modo }, { onlyPostHog: true });
}

// nombre legible de cada modo (las claves son las de records.js)
const MODE = { pve: 'partida rápida', local: 'multijugador local', daily: 'reto diario', rush: 'contrarreloj',
  challenge: 'desafío', weekly: 'desafío semanal', story: 'tus niveles', puzzle: 'lo básico' }; // (story: los niveles del creador; puzzle: Lo básico, de un turno)
const ownLevel = () => app.mode === 'story' && !app.variant && app.levelIndex != null;
export function modeData(kind) {
  const d = { modo: kind === 'story' && ownLevel() ? 'tus niveles' : MODE[kind] || kind };
  if (kind === 'pve' || kind === 'local') {
    const c = app.lastPveCfg || {};
    Object.assign(d, { baraja: c.deck || 'classic', dificultad: c.diff, tablero: c.size, bots: c.opps, personas: c.humans });
  }
  if (kind === 'puzzle' && app.level?.id) d.nivel = app.level.id; // (Lo básico: el id del nivel, que no cambia al añadir filas)
  if (kind === 'challenge') d.desafio = app.run?.id;
  if (kind === 'weekly') d.regla = app.run?.id;
  if (kind === 'daily') d.dificultad = app.game?.S?.aiLevel;
  if (kind === 'rush' && app.run) d.hoyo = (app.run.hole ?? 0) + 1;
  return d;
}

// el modo de la partida en marcha, con las claves de records.js (null: la partida de fondo del menú)
export function currentKind() {
  const v = app.variant, multi = (app.game?.S?.humans || []).length > 1;
  if (app.mode === 'pve') return v || (multi ? 'local' : 'pve');
  if (app.mode === 'story') return v === 'puzzle' || v === 'rush' ? v : 'story';
  if (app.mode === 'test') return 'test';
  return null;
}
let startedAt = 0; // (duración de la partida: desde que empieza o se retoma)
const secs = () => startedAt ? Math.round((Date.now() - startedAt) / 1000) : null;
const standalone = () => typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches;

// partida nueva (records.recordStart): a veces se apunta antes de crear la partida (reto diario), así que los
// detalles se leen justo después, cuando ya está en marcha
export function trackStart(kind) {
  if (typeof window === 'undefined') return;
  startedAt = Date.now();
  setTimeout(() => track('partida', { ...modeData(kind), app: standalone() ? 'instalada' : 'navegador' }), 0);
}
// partida guardada que se retoma (resume.js)
export function trackResume() {
  const k = currentKind();
  startedAt = Date.now();
  if (k) track('continua', modeData(k));
}
// final (records.recordEnd y los finales sin récord: puzle fallado, contrarreloj sin tiempo)
export function trackEnd(kind, { won, turns = null, reason = null } = {}) {
  track('final', { ...modeData(kind), resultado: won ? 'victoria' : 'derrota', turnos: turns, segundos: secs(), motivo: reason });
}
// salir o reiniciar con la partida a medias (screens.js)
export function trackLeave(how, turns = null) {
  const k = currentKind();
  if (k && k !== 'test') track('abandona', { ...modeData(k), como: how, turnos: turns, segundos: secs() });
}
