// Reacciones de los bots a lo que pasa en la mesa: cambian de cara y, a veces, lo dicen.
// Se llama desde la reproducción de animaciones (en el momento exacto del golpe, la caída…)
// y desde el controlador (al jugar una carta y al terminar la partida).
import { app } from './app.js';
import { isBot, humansOf } from './players.js';
import { setMood, say } from './persona.js';

const pidOf = id => (id && id[0] === 'b') ? +id.slice(1) : -1;
const bots = () => { const S = app.game?.S; return S ? [...Array(S.nPlayers).keys()].filter(isBot) : []; };

export function botReact(ev) {
  if (app.mode !== 'pve' || !app.game) return;
  const p = pidOf(ev.p);
  switch (ev.t) {
    case 'impact': {
      const tgt = pidOf(ev.target);
      if (tgt >= 0 && tgt !== p && isBot(tgt) && !app.game.S.balls[tgt]?.decoy) { setMood(tgt, 'angry'); say(tgt, 'hit', { force: true }); }
      if (p >= 0 && isBot(p) && tgt !== p) { setMood(p, 'smug'); say(p, 'bump', { chance: .35 }); }
      break;
    }
    case 'fall':
      if (p >= 0 && isBot(p)) { setMood(p, 'sad'); say(p, 'fall', { force: true }); }
      break;
    case 'sink':
      if (p >= 0 && isBot(p)) { setMood(p, 'happy', 3200); say(p, 'sink', { force: true }); }
      else if (p >= 0) for (const b of bots()) setMood(b, 'sad', 2600); // emboca otro: los bots se preocupan
      break;
    case 'chainStop':
      for (const b of bots()) setMood(b, 'think', 1600);
      break;
  }
}

// un bot juega una carta: en pleno JAQUE ajeno, "¡ni hablar!"; si no, a veces presume
export function botPlayed(p, { savingJaque = false } = {}) {
  if (app.mode !== 'pve' || !isBot(p)) return;
  if (savingJaque) { setMood(p, 'smug'); say(p, 'save', { force: true }); return; }
  say(p, 'play', { chance: .3 });
}

// final de la partida: los ganadores celebran y el resto se lamenta
export function botsGameOver(winners) {
  if (app.mode !== 'pve') return;
  for (const b of bots()) setMood(b, winners.includes(b) ? 'happy' : 'sad', 60000);
  const w = winners.find(isBot);
  if (w !== undefined) say(w, 'win', { force: true });
  else { const l = bots()[0]; if (l !== undefined && humansOf().some(h => winners.includes(h))) say(l, 'lose', { force: true }); }
}
