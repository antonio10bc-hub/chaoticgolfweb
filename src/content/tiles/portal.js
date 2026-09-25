export default {
  type: 'portal',
  portal: true,
  maxOnBoard: 2,
  cellClass: 'cement',    // el portal se asienta sobre cemento
  cellArt: 'cell.cement',
  tileArt: 'tile.portal',
  // vórtice plano: disco azul con anillos concéntricos que nacen del centro y crecen hacia el borde
  // sin salirse de la esfera (viewBox 100×140)
  pic: '<svg class="tilePic" viewBox="0 0 100 140" aria-hidden="true"><circle cx="54" cy="74" r="36" fill="rgba(20,40,20,.25)"/><circle cx="50" cy="70" r="40" fill="#A9C3E6" opacity=".45"/><circle cx="50" cy="70" r="35" fill="#2D4F7C"/><circle cx="50" cy="70" r="24" fill="#34598A"/><circle cx="50" cy="70" r="13" fill="#3F6798"/><g class="portalRings"><circle class="portalRing" cx="50" cy="70" r="31" fill="none" stroke="#A9C3E6" stroke-width="2.2"/><circle class="portalRing" cx="50" cy="70" r="31" fill="none" stroke="#A9C3E6" stroke-width="2.2"/><circle class="portalRing" cx="50" cy="70" r="31" fill="none" stroke="#A9C3E6" stroke-width="2.2"/></g><circle cx="50" cy="70" r="35" fill="none" stroke="#A9C3E6" stroke-width="1.4" opacity=".7"/><circle class="portalCore" cx="50" cy="70" r="5" fill="#fff"/></svg>',
  tileClass: 'tile-portal',
  dust: 'cement',
  placeSound: 'portalOpen',
};
