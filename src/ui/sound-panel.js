// Botón de silencio y botón redondo de Ajustes.
// Volúmenes y música se ajustan en Ajustes.
import { $ } from './dom.js';
import { SFX, MUSIC, sfx, sfxEnsure, sfxApplyVolumes, musicStart, sndLoad, sndSave } from '../audio/sfx.js';
import { openSettings } from './settings.js';
import { t } from '../i18n/index.js';

function paintMute() {
  $('sfxBtn').innerHTML = `<svg class="i" aria-hidden="true"><use href="#${SFX.muted ? 'i-mute' : 'i-sound'}"/></svg>`;
  $('sfxBtn').setAttribute('aria-pressed', SFX.muted);
  $('sfxBtn').setAttribute('aria-label', SFX.muted ? t('sound.unmute') : t('sound.mute'));
}

export function bindSoundPanel() {
  sndLoad();
  paintMute();

  // el audio solo puede arrancar tras un gesto del usuario
  window.addEventListener('pointerdown', () => { sfxEnsure(); if (MUSIC.on) musicStart(); });
  window.addEventListener('keydown', () => { sfxEnsure(); if (MUSIC.on) musicStart(); }, { once: true });

  const toggleMute = () => {
    SFX.muted = !SFX.muted;
    paintMute();
    sfxApplyVolumes();
    if (!SFX.muted) { sfxEnsure(); sfx('pop'); }
    sndSave();
  };
  $('sfxBtn').addEventListener('click', toggleMute);
  $('sndCfgBtn').addEventListener('click', () => openSettings('settings')); // ajustes y estadísticas, en pestañas
}
