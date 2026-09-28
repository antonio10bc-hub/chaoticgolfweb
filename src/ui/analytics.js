// Analíticas del juego con Umami (cloud.umami.is): sin cookies, anónimas. Las visitas las cuenta el propio
// script; aquí van los eventos del juego para saber qué se juega:
//   · "partida"   una partida nueva (no al continuar una guardada): modo y lo que la define (baraja, dificultad…)
//   · "final"     cómo acaba: modo, victoria o no y turnos
//   · "tutorial"  la presentación de Lo básico, terminada o saltada
// Solo en la web publicada (main.js carga el script fuera de localhost): en desarrollo y en los tests no se envía
// nada. Nunca datos personales (ni nombres ni códigos de niveles). Si el script aún no ha cargado, los eventos
// esperan en una cola; si no carga (sin red, bloqueador), se pierden sin más.
import { app } from './app.js';
import { isPhone } from './device.js';
import { getLang } from '../i18n/index.js';

export const UMAMI_ID = '4f7cca22-af83-4f80-8281-18d28a54259a';
let queue = [];

const clean = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ''));
export function track(name, data = {}) {
  if (typeof window === 'undefined') return; // (tests de node)
  const d = clean({ ...data, interfaz: isPhone() ? 'táctil' : 'ordenador', idioma: getLang() });
  if (window.umami?.track) { try { window.umami.track(name, d); } catch (e) { /* nunca rompe el juego */ } }
  else if (queue && queue.length < 30) queue.push([name, d]);
}
// cuando el script de Umami ha cargado: lo que estaba en cola
export function flushQueue() {
  const q = queue || []; queue = null;
  for (const [n, d] of q) { try { window.umami?.track(n, d); } catch (e) { /* nada */ } }
}

// nombre legible de cada modo (las claves son las de records.js)
const MODE = { pve: 'partida rápida', local: 'multijugador local', daily: 'reto diario', rush: 'contrarreloj',
  challenge: 'desafío', weekly: 'desafío semanal', story: 'lo básico', puzzle: 'puzle' };
const ownLevel = () => app.levelIndex != null && app.levelIndex >= app.storyLevels.length;
function modeData(kind) {
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

// partida nueva (records.recordStart): a veces se apunta antes de crear la partida (reto diario), así que los
// detalles se leen justo después, cuando ya está en marcha
export function trackStart(kind) {
  if (typeof window === 'undefined') return;
  setTimeout(() => track('partida', modeData(kind)), 0);
}
// final (records.recordEnd y los finales sin récord: puzle fallado, contrarreloj sin tiempo)
export function trackEnd(kind, { won, turns = null, reason = null } = {}) {
  track('final', { ...modeData(kind), resultado: won ? 'victoria' : 'derrota', turnos: turns, motivo: reason });
}
