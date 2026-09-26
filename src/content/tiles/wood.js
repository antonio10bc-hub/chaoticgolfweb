// Paleta y dibujo común de las piezas de madera del minigolf (bloque, esquina, túnel y lanzadera).
export const WOOD = { hi: '#E2B77E', mid: '#C99257', side: '#A8743F', dark: '#7A5230', grain: 'rgba(122,82,48,.35)' };
// vetas finas de la madera dentro de un rectángulo
export const grain = (x, y, w, h, n = 3) => Array.from({ length: n }, (_, i) => {
  const yy = y + h * (i + 1) / (n + 1);
  return `<path d="M${x + w * .12} ${yy}q${w * .2} -3 ${w * .38} 0t${w * .38} 0" fill="none" stroke="${WOOD.grain}" stroke-width="1.4" stroke-linecap="round"/>`;
}).join('');
