export default {
  type: 'portal',
  portal: true,
  maxOnBoard: 2,
  cellClass: 'cement',    // el portal se asienta sobre cemento
  cellArt: 'cell.cement',
  tileArt: 'tile.portal',
  // vórtice plano: discos concéntricos lisos y brazos en espiral que giran (viewBox 100×140)
  pic: '<svg class="tilePic" viewBox="0 0 100 140" aria-hidden="true"><circle cx="54" cy="74" r="36" fill="rgba(20,40,20,.25)"/><circle cx="50" cy="70" r="40" fill="#A9C3E6" opacity=".45"/><circle cx="50" cy="70" r="35" fill="#2D4F7C"/><circle cx="50" cy="70" r="23" fill="#3F6798"/><circle cx="50" cy="70" r="11" fill="#7FA0CF"/><g class="portalSwirl"><path d="M50 70C58 67 63 58 61 49C59 41 51 37 43 38" fill="none" stroke="#F1F1DC" stroke-width="3" stroke-linecap="round" opacity=".9"/><path d="M50 70C58 67 63 58 61 49C59 41 51 37 43 38" fill="none" stroke="#F1F1DC" stroke-width="3" stroke-linecap="round" opacity=".7" transform="rotate(120 50 70)"/><path d="M50 70C58 67 63 58 61 49C59 41 51 37 43 38" fill="none" stroke="#F1F1DC" stroke-width="3" stroke-linecap="round" opacity=".55" transform="rotate(240 50 70)"/></g><circle cx="50" cy="70" r="35" fill="none" stroke="#A9C3E6" stroke-width="1.6" stroke-dasharray="3 5" opacity=".8"/><circle cx="50" cy="70" r="5" fill="#fff"/></svg>',
  tileClass: 'tile-portal',
  dust: 'cement',
  placeSound: 'portalOpen',
};
