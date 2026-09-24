// Quién es quién en la partida: personas en este dispositivo, bots, quién está mirando
// (en una partida con varias personas se pasan el móvil), nombres visibles y avatares.
import { app } from './app.js';
import { playerTag } from '../engine/game.js';
import { pColor } from '../art.js';
import { t } from '../i18n/index.js';
import { botName, faceSVG } from './persona.js';

// personas que juegan en este dispositivo
export function humansOf(S = app.game?.S) {
  if (!S) return [];
  if (app.mode !== 'pve') return [...Array(S.nPlayers).keys()];
  return S.humans || [S.human];
}
export const isBot = p => app.mode === 'pve' && !humansOf().includes(p);
export const multiHuman = () => app.mode === 'pve' && humansOf().length > 1;

// persona que tiene ahora el dispositivo (su mano es la del dock)
export function viewer() {
  const S = app.game?.S;
  if (!S) return 0;
  if (app.mode !== 'pve') return S.nPlayers === 1 ? 0 : S.turn;
  const hs = humansOf(S);
  return hs.includes(app.viewer) ? app.viewer : hs[0];
}
// ¿se ven ahora sus cartas? (en multijugador local, solo las de quien tiene el dispositivo)
export const handRevealed = p => !multiHuman() || (p === app.viewer && app.passFor == null && app.viewer != null);

// nombre visible: los bots tienen el suyo; las personas, "Jugador N"
export function displayName(p) {
  const own = app.game?.S.playerNames?.[p]; // el nombre que se ha puesto la persona (perfil)
  if (own) return own;
  const b = isBot(p) ? botName(p) : null;
  return b || t('player.name', { n: p + 1 });
}

// avatar: bola plana del color del jugador, con la cara del bot o la etiqueta J1,
// y (accesibilidad) una forma distinta por jugador
export function avatarHTML(p, cls = '') {
  const bot = isBot(p) && botName(p);
  return `<span class="avatar${cls ? ' ' + cls : ''}${bot ? ' hasFace' : ''}" style="--pc:${pColor(p)}"${bot ? ` data-face="${p}"` : ''}>` +
    (bot ? faceSVG(p) : playerTag(p)) + shapeHTML(p) + `</span>`;
}
export const shapeHTML = p => `<svg class="shp" aria-hidden="true"><use href="#shp-${p % 6}"/></svg>`;
