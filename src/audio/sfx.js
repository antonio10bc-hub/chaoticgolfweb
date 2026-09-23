/* ---------- SFX + música generativa (WebAudio, sin archivos) ---------- */
import { JUICE } from '../fx/juice.js';
import { fxRand } from '../fx/particles.js';
import { loadSound, saveSound } from '../storage.js';

export const SFX = { ctx: null, sfxGain: null, musicGain: null, muted: false, sfxVol: 0.45, musVol: 0.55 };
export const MUSIC = { on: true, timer: null, step: 0 };
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
    case 'holeMove': noiseHit(.09, 320, .3, 'lowpass'); break;                    // arrastre del hoyo
    case 'knock':  tone(190, 70, .1, 'sine', .9, 0, r); noiseHit(.06, 2600, .5, 'highpass', 0, 1, r); chain += 2; break; // colisión
    case 'portal': tone(300, 980, .12, 'sine', .5, 0, r); tone(980, 240, .14, 'sine', .45, .1, r); chain++; break;
    case 'sand':   noiseHit(.16, 420, .7, 'lowpass'); chain++; break;             // plof búnker
    case 'fall':   tone(520, 130, .22, 'sine', .4); break;
    case 'pop':    tone(340, 640, .09, 'triangle', .55, 0, r); chain++; break;    // reaparecer / colocar
    case 'sink':   tone(760, 160, .24, 'sine', .55); tone(1200, 1900, .1, 'triangle', .3, .18); break;
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

/* música ambiental generativa: pads de acordes + plucks pentatónicos */
const MUS_CHORDS = [[261.63, 329.63, 392.0, 493.88], [220.0, 261.63, 329.63, 392.0],
                    [174.61, 220.0, 261.63, 349.23], [196.0, 246.94, 293.66, 392.0]];
const MUS_PENTA = [523.25, 587.33, 659.25, 783.99, 880.0];
function musPad(f, dur) {
  const t = SFX.ctx.currentTime;
  const o = SFX.ctx.createOscillator(), g = SFX.ctx.createGain();
  o.type = 'triangle'; o.frequency.value = f; o.detune.value = (fxRand() - .5) * 7;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(.16, t + .9);
  g.gain.linearRampToValueAtTime(0, t + dur);
  o.connect(g); g.connect(SFX.musicGain);
  o.start(t); o.stop(t + dur + .05);
}
function musPluck(f) {
  const t = SFX.ctx.currentTime + .02;
  const o = SFX.ctx.createOscillator(), g = SFX.ctx.createGain();
  o.type = 'sine'; o.frequency.value = f;
  g.gain.setValueAtTime(.12, t);
  g.gain.exponentialRampToValueAtTime(.001, t + .7);
  o.connect(g); g.connect(SFX.musicGain);
  o.start(t); o.stop(t + .75);
}
export function musicStart() {
  if (MUSIC.timer || !MUSIC.on) return;
  sfxEnsure(); if (!SFX.ctx) return;
  MUSIC.timer = setInterval(() => {
    if (!MUSIC.on || !SFX.ctx) return;
    const chord = MUS_CHORDS[MUSIC.step % MUS_CHORDS.length]; MUSIC.step++;
    chord.forEach(f => musPad(f, JUICE.music.chordMs / 1000 + .4));
    if (fxRand() < .5) musPluck(MUS_PENTA[(fxRand() * MUS_PENTA.length) | 0]);
  }, JUICE.music.chordMs);
}
export function musicStop() { clearInterval(MUSIC.timer); MUSIC.timer = null; }

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
