// Perfil del jugador en este dispositivo: tu nombre y tu color, que se recuerdan en todas
// las partidas, y los de cada persona del multijugador local (hasta 4).
// Es solo presentación: el motor sigue identificando a cada jugador por su asiento.
const KEY = 'chaoticgolf_profile';
const MAX_NAME = 14;

const blank = () => ({ name: '', color: 0, people: [
  { name: '', color: 0 }, { name: '', color: 1 }, { name: '', color: 2 }, { name: '', color: 3 },
] });

export function loadProfile() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && typeof d === 'object') {
      const b = blank();
      return { ...b, ...d, people: b.people.map((p, i) => ({ ...p, ...(d.people?.[i] || {}) })) };
    }
  } catch (e) { /* sin storage */ }
  return blank();
}
export function saveProfile(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* sin storage */ } }

export const cleanName = s => String(s || '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
export { MAX_NAME };
