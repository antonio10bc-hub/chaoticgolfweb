/* ---------- SFX + música generativa (WebAudio, sin archivos) ---------- */
import { fxRand } from '../fx/particles.js';
import { loadSound, saveSound } from '../storage.js';
import { prefs, currentTheme } from '../ui/prefs.js';

export const SFX = { ctx: null, sfxGain: null, musicGain: null, muted: false, sfxVol: 0.45, musVol: 0.55 };
export const MUSIC = { on: true, scene: 'menu', track: null, games: 0, mood: 'calm' };
let chain = 0;   // semitonos acumulados en la jugada en curso (pitch progresivo)
export const resetChain = () => { chain = 0; };

export function sfxEnsure() {
  try {
    if (!SFX.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      SFX.ctx = new AC();
      SFX.sfxGain = SFX.ctx.createGain();
      SFX.sfxGain.connect(SFX.ctx.destination);
      SFX.musicGain = SFX.ctx.createGain();
      // la música pasa por un filtro que le quita brillo y un eco corto: suena más suave y redonda
      const soft = SFX.ctx.createBiquadFilter();
      soft.type = 'lowpass'; soft.frequency.value = 2300; soft.Q.value = .4;
      const echo = SFX.ctx.createDelay(1), fb = SFX.ctx.createGain(), wet = SFX.ctx.createGain();
      echo.delayTime.value = .34; fb.gain.value = .22; wet.gain.value = .2;
      SFX.musicGain.connect(soft);
      soft.connect(SFX.ctx.destination);
      soft.connect(echo); echo.connect(fb); fb.connect(echo); echo.connect(wet); wet.connect(SFX.ctx.destination);
      sfxApplyVolumes();
    }
    if (SFX.ctx.state === 'suspended') SFX.ctx.resume();
  } catch (e) { /* sin audio */ }
}
export function sfxApplyVolumes() {
  if (!SFX.ctx) return;
  SFX.sfxGain.gain.value = SFX.muted ? 0 : SFX.sfxVol * 0.29;   // ~JUICE.sfx.volume al 45%
  SFX.musicGain.gain.value = SFX.muted ? 0 : SFX.musVol * 0.1;  // ~JUICE.music.volume al 55%
}
function tone(f0, f1, dur, type = 'sine', vol = 1, delay = 0, rate = 1) {
  const t = SFX.ctx.currentTime + delay;
  const o = SFX.ctx.createOscillator(), g = SFX.ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(Math.max(30, f0 * rate), t);
  o.frequency.exponentialRampToValueAtTime(Math.max(30, f1 * rate), t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + Math.min(.012, dur * .2));
  g.gain.exponentialRampToValueAtTime(.001, t + dur);
  o.connect(g); g.connect(SFX.sfxGain);
  o.start(t); o.stop(t + dur + .02);
}
function noiseHit(dur, freq, vol = 1, type = 'lowpass', delay = 0, q = 1, rate = 1) {
  const t = SFX.ctx.currentTime + delay;
  const len = Math.max(1, (dur * SFX.ctx.sampleRate) | 0);
  const buf = SFX.ctx.createBuffer(1, len, SFX.ctx.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = (fxRand() * 2 - 1) * (1 - i / len);
  const src = SFX.ctx.createBufferSource(); src.buffer = buf;
  const f = SFX.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq * rate; f.Q.value = q;
  const g = SFX.ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(.001, t + dur);
  src.connect(f); f.connect(g); g.connect(SFX.sfxGain);
  src.start(t);
}
export function sfx(name) {
  if (SFX.muted) return;
  sfxEnsure();
  if (!SFX.ctx || !SFX.sfxGain) return;
  const r = Math.pow(2, Math.min(chain, 8) / 12);  // pitch progresivo de la cadena
  switch (name) {
    case 'roll':   noiseHit(.05, 1400, .12, 'bandpass', 0, 2, r); chain++; break; // paso de pelota (sutil)
    case 'holeMove': noiseHit(.09, 320, .3, 'lowpass'); noiseHit(.05, 160, .25, 'lowpass', .04); break; // arrastre del hoyo (tierra)
    case 'knock':  tone(190, 70, .1, 'sine', .9, 0, r); noiseHit(.06, 2600, .5, 'highpass', 0, 1, r); chain += 2; break; // colisión
    case 'portal': // portal: succión aguda con trémolo + expulsión grave y un brillo
      tone(300, 1200, .14, 'sine', .45, 0, r); tone(310, 1180, .14, 'triangle', .2, .012, r);
      noiseHit(.18, 1800, .18, 'bandpass', 0, 3);
      tone(1100, 220, .16, 'sine', .4, .12, r); tone(1760, 2640, .08, 'triangle', .12, .2);
      chain++; break;
    case 'sand':   noiseHit(.16, 420, .7, 'lowpass'); noiseHit(.1, 1200, .18, 'bandpass', .03, 1.5); chain++; break; // plof búnker
    case 'sandStep': noiseHit(.07, 900, .32, 'bandpass', 0, 1.2); noiseHit(.05, 1500, .18, 'bandpass', .045, 1.4); break; // pisar arena
    case 'sandPour': noiseHit(.34, 700, .42, 'lowpass', 0, .7); noiseHit(.22, 1600, .14, 'bandpass', .08, 1); break;     // colocar búnker
    case 'portalOpen': [392, 587, 784, 1175].forEach((f, i) => tone(f, f * 1.5, .22, 'sine', .22, i * .045)); noiseHit(.25, 2200, .12, 'bandpass', 0, 2); break;
    case 'chainBreak': tone(1320, 440, .18, 'triangle', .35); tone(990, 330, .22, 'sine', .25, .06); break; // cadena cortada
    case 'wood':   tone(210, 150, .09, 'triangle', .7); noiseHit(.06, 1800, .25, 'bandpass', 0, 3); break; // golpe en madera
    case 'woodTick': tone(520, 420, .05, 'triangle', .35); break;
    case 'tunnel': [0, .09, .2, .34].forEach((d, i) => tone(300 + i * 60, 300 + i * 60, .05, 'triangle', .22, d)); break; // redoble de tensión
    case 'launch': tone(260, 900, .28, 'sine', .45); noiseHit(.22, 1400, .2, 'bandpass', 0, 1.2); break; // ¡fiuuu!
    case 'splash': noiseHit(.28, 900, .5, 'lowpass'); tone(420, 140, .2, 'sine', .35); noiseHit(.12, 2600, .18, 'highpass', .08); break; // chapuzón
    case 'water':  noiseHit(.5, 700, .16, 'bandpass', 0, 1.4); tone(620, 700, .12, 'sine', .08, .1); break; // corriente del río (suave)
    case 'fall':   tone(520, 130, .22, 'sine', .4); break;
    case 'pop':    tone(340, 640, .09, 'triangle', .55, 0, r); chain++; break;    // reaparecer / colocar
    case 'sink':   // traqueteo en el borde de la taza, caída y "clonc" al fondo
      tone(2400, 2100, .025, 'square', .12); tone(2200, 1900, .025, 'square', .1, .07); tone(2000, 1700, .025, 'square', .08, .13);
      tone(760, 160, .24, 'sine', .5, .16); tone(120, 70, .12, 'sine', .7, .34); tone(1200, 1900, .1, 'triangle', .28, .42); break;
    case 'card':   tone(880, 660, .05, 'square', .16); noiseHit(.03, 3200, .12, 'highpass'); break;
    case 'bad':    tone(150, 90, .12, 'square', .25); break;                      // carta no jugable
    case 'turn':   tone(520, 780, .08, 'triangle', .3); break;
    case 'jaque':  tone(95, 55, .3, 'sawtooth', .8); noiseHit(.18, 700, .5); break;
    case 'tension': // sting de "casi ganas": graves pulsantes + par disonante agudo
      tone(58, 55, 1.1, 'sawtooth', .45); tone(62, 60, 1.1, 'sawtooth', .38);
      tone(659, 659, .9, 'sine', .16, .08); tone(698, 698, .9, 'sine', .14, .16);
      break;
    case 'rewind': tone(700, 220, .1, 'triangle', .4); tone(220, 760, .13, 'triangle', .4, .08); break;
    case 'whoosh': noiseHit(.16, 900, .22, 'bandpass', 0, .8); tone(420, 620, .08, 'sine', .12, .05); break; // carta al aire
    case 'deal':   noiseHit(.04, 2400, .16, 'highpass'); tone(1200, 900, .03, 'triangle', .08); break;    // carta robada
    case 'click':  tone(660, 520, .035, 'triangle', .14); break;                    // botón de interfaz
    case 'tick':   tone(1320, 1320, .04, 'sine', .22); break;                       // cuenta atrás (últimos segundos)
    case 'select': tone(560, 840, .06, 'triangle', .22); break;                          // carta elegida
    case 'win':    [523, 659, 784, 1047].forEach((f, i) => tone(f, f, .16, 'triangle', .5, i * .09)); break;
    case 'lose':   [392, 349, 311, 262].forEach((f, i) => tone(f, f * .98, .2, 'triangle', .35, i * .13)); break; // "uooh" descendente
  }
}

/* ---------- música: minimalista y con toque cartoon ----------
   Secuenciador por semicorcheas con instrumentos muy simples (pizzicato, bajo saltarín,
   campanita, "boop" y un tic de percusión). Cada pista es un patrón de 4 compases.
   Capas: la base y la de tensión (JAQUE); musicMood() las mezcla:
     'calm'  solo la base · 'tense' la base se aparta y entra la tensión · 'win' fanfarria y calma.
   Al cambiar de escena (menú ↔ partida) la pista nueva entra con fundido cruzado. */
const N = m => 440 * Math.pow(2, (m - 69) / 12); // nota MIDI -> Hz
const TRACK_DEFS = {
  // menú: sosegado y luminoso (acordes con séptima mayor, arpegio lento y una cajita de música de vez en cuando)
  menu: { bpm: 78, chords: [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 69]],
    bass: [0], pluck: [0, 4, 8, 12], pluckVol: .09, lead: [76, 79, 81, 84], leadAt: [6, 14], leadChance: .3, bell: true },
  // campo: saltarín (bajo en 1 y 3, acordes a contratiempo)
  fairway: { bpm: 100, chords: [[55, 59, 62], [60, 64, 67], [62, 66, 69], [55, 59, 62]],
    bass: [0, 8], stab: [4, 12], pluck: [], lead: [67, 69, 71, 74, 76], leadAt: [2, 6, 10, 14], leadChance: .35, boop: true, tick: [4, 12] },
  // brisa: bossa ligera, bajo sincopado y pizzicatos a contratiempo
  breeze: { bpm: 94, chords: [[53, 57, 60, 64], [50, 53, 57, 60], [55, 58, 62, 65], [48, 52, 55, 58]],
    bass: [0, 6, 8, 14], stab: [3, 7, 11, 15], pluck: [], lead: [72, 74, 77, 79, 81], leadAt: [1, 9], leadChance: .3, tick: [6, 14] },
  // salón (noche): lento y cálido, bajada de acordes con séptima
  lounge: { bpm: 74, chords: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]],
    bass: [0, 10], pluck: [4, 12], pluckVol: .1, lead: [69, 72, 74, 76], leadAt: [6, 14], leadChance: .3, bell: true },
};

function env(dest, t0, vol, attack, decay) {
  const g = SFX.ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(.0008, t0 + attack + decay);
  g.connect(dest);
  return g;
}
function osc(dest, type, f, t0, dur, f1) {
  const o = SFX.ctx.createOscillator();
  o.type = type; o.frequency.setValueAtTime(f, t0);
  if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur * .6);
  o.connect(dest); o.start(t0); o.stop(t0 + dur + .05);
}
// instrumentos redondos: ataque suave, sin armónicos metálicos
const INSTR = {
  pluck: (d, f, t, v = .14) => { osc(env(d, t, v, .012, .42), 'sine', f, t, .46); osc(env(d, t, v * .3, .01, .2), 'triangle', f, t, .24); },
  stab: (d, fs, t) => fs.forEach(f => INSTR.pluck(d, f, t, .055)),
  bass: (d, f, t) => { osc(env(d, t, .22, .014, .3), 'sine', f, t, .34); },
  bell: (d, f, t) => { osc(env(d, t, .05, .012, 1.1), 'sine', f, t, 1.2); osc(env(d, t, .012, .01, .5), 'sine', f * 2, t, .6); },
  boop: (d, t) => osc(env(d, t, .04, .01, .14), 'sine', 520, t, .16, 760),
  tick: (d, t) => {
    const len = (.02 * SFX.ctx.sampleRate) | 0, buf = SFX.ctx.createBuffer(1, len, SFX.ctx.sampleRate), ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = (fxRand() * 2 - 1) * (1 - i / len);
    const src = SFX.ctx.createBufferSource(), f = SFX.ctx.createBiquadFilter();
    src.buffer = buf; f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = .8;
    src.connect(f); f.connect(env(d, t, .025, .002, .025)); src.start(t);
  },
};

function makeTrack(name) {
  const def = TRACK_DEFS[name];
  const gain = SFX.ctx.createGain(), base = SFX.ctx.createGain(), tense = SFX.ctx.createGain();
  gain.gain.value = 0; base.gain.value = 1; tense.gain.value = 0;
  base.connect(gain); tense.connect(gain); gain.connect(SFX.musicGain);
  const stepDur = 60 / def.bpm / 4; // semicorchea
  let step = 0, next = SFX.ctx.currentTime + .08;
  const tick = () => {
    if (!SFX.ctx) return;
    while (next < SFX.ctx.currentTime + .15) { // programa un poco por delante (sin tirones)
      const bar = Math.floor(step / 16) % def.chords.length, st = step % 16, chord = def.chords[bar], t0 = next;
      if (def.bass.includes(st)) INSTR.bass(base, N(chord[st >= 8 && chord.length > 2 ? 2 : 0] - 12), t0);
      if (def.stab?.includes(st)) INSTR.stab(base, chord.map(N), t0);
      if (def.pluck.includes(st)) INSTR.pluck(base, N(chord[(def.pluck.indexOf(st) + bar) % chord.length] + 12), t0, def.pluckVol);
      if (def.leadAt.includes(st) && fxRand() < def.leadChance) INSTR.pluck(base, N(def.lead[(fxRand() * def.lead.length) | 0]), t0, .09);
      if (def.bell && st === 0 && bar % 2 === 0) INSTR.bell(base, N(chord[chord.length - 1] + 12), t0);
      if (def.boop && st === 15 && bar === def.chords.length - 1) INSTR.boop(base, t0);
      if (def.tick?.includes(st)) INSTR.tick(base, t0);
      // capa de tensión (JAQUE): latido grave "tum-tum", tic en cada tiempo y una nota que sube al empezar el compás
      if (st % 4 === 0) INSTR.tick(tense, t0);
      if (st % 8 === 0) { INSTR.bass(tense, N(chord[0] - 12), t0); INSTR.bass(tense, N(chord[0] - 12), t0 + stepDur); }
      if (st === 0) INSTR.pluck(tense, N(chord[0] + 7), t0, .08);
      if (st === 8) INSTR.pluck(tense, N(chord[0] + 12), t0, .08);
      step++; next += stepDur;
    }
  };
  tick();
  const timer = setInterval(tick, 40);
  return { name, gain, base, tense, timer };
}

// pista de partida según el ajuste (auto: noche → salón; si no, alterna campo / brisa)
function gameTrack() {
  if (prefs.track !== 'auto') return prefs.track;
  if (currentTheme() === 'night') return 'lounge';
  return MUSIC.games % 2 ? 'breeze' : 'fairway';
}
const FADE = 1.6;
function ramp(param, to, secs) {
  const now = SFX.ctx.currentTime;
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  param.linearRampToValueAtTime(to, now + secs);
}
function crossfadeTo(name) {
  if (!SFX.ctx || MUSIC.track?.name === name) return;
  const old = MUSIC.track;
  if (old) { ramp(old.gain.gain, 0, FADE); setTimeout(() => { clearInterval(old.timer); old.gain.disconnect(); }, FADE * 1000 + 300); }
  const tr = makeTrack(name);
  ramp(tr.gain.gain, 1, FADE);
  MUSIC.track = tr;
  applyMood(.1);
}
// humor de la música: 'calm' | 'tense' (JAQUE) | 'win' (fanfarria y vuelta a la calma)
export function musicMood(m) {
  if (MUSIC.mood === m && m !== 'win') return;
  MUSIC.mood = m === 'win' ? 'calm' : m;
  if (!SFX.ctx || !MUSIC.track) return;
  if (m === 'win') fanfare();
  applyMood(m === 'tense' ? .4 : 1.2);
}
function applyMood(secs) {
  const tr = MUSIC.track; if (!tr) return;
  const tense = MUSIC.mood === 'tense';
  ramp(tr.base.gain, tense ? .45 : 1, secs);
  ramp(tr.tense.gain, tense ? 1 : 0, secs);
}
// fanfarria corta de victoria sobre la música (arpegio subiendo, "boop" y acorde)
function fanfare() {
  const t0 = SFX.ctx.currentTime + .05, d = SFX.musicGain;
  [60, 64, 67, 72].forEach((m, i) => INSTR.pluck(d, N(m + 12), t0 + i * .11, .2));
  INSTR.boop(d, t0 + .46);
  [72, 76, 79].forEach(m => INSTR.bell(d, N(m), t0 + .56));
  const tr = MUSIC.track; if (tr) { ramp(tr.base.gain, .25, .2); setTimeout(() => applyMood(1.5), 1400); }
}
// escena actual: 'menu' | 'game' (newGame: una partida nueva puede cambiar de pista)
export function musicScene(scene, { newGame = false } = {}) {
  if (newGame) MUSIC.games++;
  MUSIC.scene = scene;
  if (scene !== 'game' && MUSIC.mood !== 'calm') { MUSIC.mood = 'calm'; applyMood(.6); } // fuera de la partida, nada de tensión
  if (MUSIC.on && SFX.ctx && MUSIC.track) crossfadeTo(scene === 'game' ? gameTrack() : 'menu');
}
export function musicStart() {
  if (!MUSIC.on) return;
  sfxEnsure(); if (!SFX.ctx || MUSIC.track) return;
  crossfadeTo(MUSIC.scene === 'game' ? gameTrack() : 'menu');
}
export function musicStop() {
  const tr = MUSIC.track; MUSIC.track = null;
  if (!tr || !SFX.ctx) return;
  ramp(tr.gain.gain, 0, .5);
  setTimeout(() => { clearInterval(tr.timer); tr.gain.disconnect(); }, 800);
}
// al cambiar la pista elegida en ajustes
export function musicRefresh() { if (MUSIC.on && MUSIC.track) crossfadeTo(MUSIC.scene === 'game' ? gameTrack() : 'menu'); }

/* persistencia de los ajustes de sonido */
export const sndSave = () => saveSound({ muted: SFX.muted, sfx: SFX.sfxVol, mus: SFX.musVol, on: MUSIC.on });
export function sndLoad() {
  const d = loadSound();
  if (!d) return;
  SFX.muted = !!d.muted;
  if (typeof d.sfx === 'number') SFX.sfxVol = Math.min(1, Math.max(0, d.sfx));
  if (typeof d.mus === 'number') SFX.musVol = Math.min(1, Math.max(0, d.mus));
  MUSIC.on = d.on !== false;
}
