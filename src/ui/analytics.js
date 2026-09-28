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
import { app } from './app.js';
import { isPhone } from './device.js';
import { getLang } from '../i18n/index.js';

export const UMAMI_ID = '4f7cca22-af83-4f80-8281-18d28a54259a';
let queue = [];

const clean = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ''));
// envía (o deja en cola): args son los de umami.track, un evento (nombre, datos) o una página (función)
function send(...args) {
  if (window.umami?.track) { try { window.umami.track(...args); } catch (e) { /* nunca rompe el juego */ } }
  else if (queue && queue.length < 40) queue.push(args);
}
export function track(name, data = {}) {
  if (typeof window === 'undefined') return; // (tests de node)
  send(name, clean({ ...data, interfaz: isPhone() ? 'táctil' : 'ordenador', idioma: getLang() }));
}
// cuando el script de Umami ha cargado: lo que estaba en cola
export function flushQueue() {
  const q = queue || []; queue = null;
  for (const args of q) { try { window.umami?.track(...args); } catch (e) { /* nada */ } }
}

// cada pantalla, como una página (showScreen, solo al cambiar: la del arranque ya la cuenta el script de Umami)
const PAGE = { menu: '/', story: '/lo-basico', modes: '/modos', pve: '/partida-rapida', editor: '/creador' };
const SLUG = { pve: 'partida-rapida', local: 'multijugador-local', daily: 'reto-diario', rush: 'contrarreloj', challenge: 'desafio',
  weekly: 'desafio-semanal', story: 'lo-basico', puzzle: 'puzle', own: 'tus-niveles', test: 'prueba-creador' };
export function trackScreen(screen) {
  if (typeof window === 'undefined') return;
  const k = screen === 'game' ? currentKind() : null;
  const url = screen === 'game' ? '/partida/' + (SLUG[k === 'story' && ownLevel() ? 'own' : k] || 'otra') : PAGE[screen];
  if (url) send(props => ({ ...props, url, title: 'Chaotic Golf' }));
}

// nombre legible de cada modo (las claves son las de records.js)
const MODE = { pve: 'partida rápida', local: 'multijugador local', daily: 'reto diario', rush: 'contrarreloj',
  challenge: 'desafío', weekly: 'desafío semanal', story: 'lo básico', puzzle: 'puzle' };
const ownLevel = () => app.levelIndex != null && app.levelIndex >= app.storyLevels.length;
export function modeData(kind) {
  const d = { modo: kind === 'story' && ownLevel() ? 'tus niveles' : MODE[kind] || kind };
  if (kind === 'pve' || kind === 'local') {
    const c = app.lastPveCfg || {};
    Object.assign(d, { baraja: c.deck || 'classic', dificultad: c.diff, tablero: c.size, bots: c.opps, personas: c.humans });
  }
  if (kind === 'story' && !ownLevel() && app.levelIndex != null) d.nivel = app.levelIndex + 1;
  if (kind === 'puzzle' && app.levelIndex != null) d.nivel = app.levelIndex + 1;
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
