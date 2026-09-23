// Botón de silencio + panel de volumen (SFX / música) + debug "ver cartas rivales".
import { app } from './app.js';
import { $ } from './dom.js';
import { SFX, MUSIC, sfx, sfxEnsure, sfxApplyVolumes, musicStart, musicStop, sndLoad, sndSave } from '../audio/sfx.js';
import { render } from './controller.js';
import { t } from '../i18n/index.js';

function paintMute() {
  $('sfxBtn').innerHTML = `<svg class="i" aria-hidden="true"><use href="#${SFX.muted ? 'i-mute' : 'i-sound'}"/></svg>`;
  $('sfxBtn').setAttribute('aria-pressed', SFX.muted);
  $('sfxBtn').setAttribute('aria-label', SFX.muted ? t('sound.unmute') : t('sound.mute'));
}

export function bindSoundPanel() {
  sndLoad();
  paintMute();
  $('sfxVol').value = Math.round(SFX.sfxVol * 100);
  $('musVol').value = Math.round(SFX.musVol * 100);
  $('musOn').checked = MUSIC.on;

  // el audio solo puede arrancar tras un gesto del usuario
  window.addEventListener('pointerdown', () => { sfxEnsure(); if (MUSIC.on) musicStart(); });
  window.addEventListener('keydown', () => { sfxEnsure(); if (MUSIC.on) musicStart(); }, { once: true });

  $('sfxBtn').addEventListener('click', () => {
    SFX.muted = !SFX.muted;
    paintMute();
    sfxApplyVolumes();
    if (!SFX.muted) { sfxEnsure(); sfx('pop'); }
    sndSave();
  });
  $('sndCfgBtn').addEventListener('click', () => {
    const open = $('sndPanel').classList.toggle('open');
    $('sndCfgBtn').setAttribute('aria-expanded', open);
  });
  $('sfxVol').addEventListener('input', () => { SFX.sfxVol = $('sfxVol').value / 100; sfxApplyVolumes(); sndSave(); });
  $('musVol').addEventListener('input', () => { SFX.musVol = $('musVol').value / 100; sfxApplyVolumes(); sndSave(); });
  $('musOn').addEventListener('change', () => { MUSIC.on = $('musOn').checked; if (MUSIC.on) musicStart(); else musicStop(); sndSave(); });
  $('peekHands').addEventListener('change', () => { app.pveShowHands = $('peekHands').checked; if (app.game) render(); });
}
