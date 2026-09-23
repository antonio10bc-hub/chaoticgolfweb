/* ---------- SFX + música generativa (WebAudio, sin archivos) ---------- */
import { fxRand } from '../fx/particles.js';
import { loadSound, saveSound } from '../storage.js';
import { prefs } from '../ui/prefs.js';

export const SFX = { ctx: null, sfxGain: null, musicGain: null, muted: false, sfxVol: 0.45, musVol: 0.55 };
export const MUSIC = { on: true, scene: 'menu', track: null, games: 0 };
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
      SFX.musicGain.connect(SFX.ctx.destination);
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
    case 'click':  tone(660, 520, .035, 'triangle', .14); break;                           // botón de interfaz
    case 'select': tone(560, 840, .06, 'triangle', .22); break;                          // carta elegida
    case 'win':    [523, 659, 784, 1047].forEach((f, i) => tone(f, f, .16, 'triangle', .5, i * .09)); break;
  }
}

/* ---------- música generativa por pistas, con fundido cruzado ----------
   Cada pista es un patrón de acordes + melodía sobre su propio GainNode; al cambiar
   de escena (menú ↔ partida) la nueva entra y la anterior se apaga en ~1,6 s. */
const N = (m) => 440 * Math.pow(2, (m - 69) / 12); // nota MIDI -> Hz
const TRACK_DEFS = {
  // menú: pads lentos y campanitas, muy tranquilo
  menu: { chordMs: 3600, pad: 'sine', padVol: .15, attack: 1.4,
    chords: [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 69]],
    lead: [79, 81, 84, 86, 88], leadType: 'sine', leadChance: .55, leadVol: .09, leadHits: [0, .5] },
  // campo: la de siempre (pads de triángulo + plucks pentatónicos)
  fairway: { chordMs: 2600, pad: 'triangle', padVol: .16, attack: .9,
    chords: [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 65], [55, 59, 62, 67]],
    lead: [72, 74, 76, 79, 81], leadType: 'sine', leadChance: .5, leadVol: .12, leadHits: [0] },
  // brisa: aire de bossa, bajo en 1 y 3 y plucks a contratiempo
  breeze: { chordMs: 2200, pad: 'triangle', padVol: .1, attack: .5,
    chords: [[62, 65, 69, 72], [55, 59, 65, 69], [60, 64, 67, 71], [57, 61, 64, 67]],
    bass: [.0, .5], lead: [74, 76, 79, 81, 83], leadType: 'triangle', leadChance: .8, leadVol: .1, leadHits: [.1875, .4375, .8125] },
  // salón nocturno: menores con novena, graves suaves y pocas notas
  lounge: { chordMs: 3000, pad: 'sine', padVol: .17, attack: 1.1,
    chords: [[57, 60, 64, 71], [53, 57, 60, 64], [50, 53, 57, 64], [52, 56, 59, 62]],
    bass: [0], lead: [69, 72, 74, 76, 79], leadType: 'sine', leadChance: .4, leadVol: .08, leadHits: [.25, .75] },
};

function note(dest, f, t0, dur, type, vol, attack = .01) {
  const o = SFX.ctx.createOscillator(), g = SFX.ctx.createGain();
  o.type = type; o.frequency.value = f; o.detune.value = (fxRand() - .5) * 7;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + attack);
  g.gain.linearRampToValueAtTime(0, t0 + dur);
  o.connect(g); g.connect(dest);
  o.start(t0); o.stop(t0 + dur + .05);
}

function makeTrack(name) {
  const def = TRACK_DEFS[name];
  const gain = SFX.ctx.createGain();
  gain.gain.value = 0;
  gain.connect(SFX.musicGain);
  let step = 0;
  const tick = () => {
    if (!SFX.ctx) return;
    const t0 = SFX.ctx.currentTime + .05, bar = def.chordMs / 1000;
    const chord = def.chords[step % def.chords.length]; step++;
    chord.forEach(m => note(gain, N(m), t0, bar + .4, def.pad, def.padVol, def.attack));
    for (const at of def.bass || []) note(gain, N(chord[0] - 12), t0 + at * bar, .5, 'sine', .22, .015);
    for (const at of def.leadHits) {
      if (fxRand() < def.leadChance) {
        const m = def.lead[(fxRand() * def.lead.length) | 0];
        note(gain, N(m), t0 + at * bar, .7, def.leadType, def.leadVol, .01);
      }
    }
  };
  tick();
  const timer = setInterval(tick, def.chordMs);
  return { name, gain, timer };
}

// pista de partida según el ajuste (auto: noche → salón; si no, alterna campo / brisa)
function gameTrack() {
  if (prefs.track !== 'auto') return prefs.track;
  if (prefs.theme === 'night') return 'lounge';
  return MUSIC.games % 2 ? 'breeze' : 'fairway';
}
const FADE = 1.6;
function crossfadeTo(name) {
  if (!SFX.ctx || MUSIC.track?.name === name) return;
  const now = SFX.ctx.currentTime;
  const old = MUSIC.track;
  if (old) {
    old.gain.gain.cancelScheduledValues(now);
    old.gain.gain.setValueAtTime(old.gain.gain.value, now);
    old.gain.gain.linearRampToValueAtTime(0, now + FADE);
    setTimeout(() => { clearInterval(old.timer); old.gain.disconnect(); }, FADE * 1000 + 300);
  }
  const tr = makeTrack(name);
  tr.gain.gain.setValueAtTime(0, now);
  tr.gain.gain.linearRampToValueAtTime(1, now + FADE);
  MUSIC.track = tr;
}
// escena actual: 'menu' | 'game' (newGame: una partida nueva puede cambiar de pista)
export function musicScene(scene, { newGame = false } = {}) {
  if (newGame) MUSIC.games++;
  MUSIC.scene = scene;
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
  const now = SFX.ctx.currentTime;
  tr.gain.gain.cancelScheduledValues(now);
  tr.gain.gain.setValueAtTime(tr.gain.gain.value, now);
  tr.gain.gain.linearRampToValueAtTime(0, now + .5);
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
