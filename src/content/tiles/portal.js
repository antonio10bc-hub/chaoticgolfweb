export default {
  type: 'portal',
  portal: true,
  maxOnBoard: 2,
  cellClass: 'cement',    // el portal se asienta sobre cemento
  cellArt: 'cell.cement',
  tileArt: 'tile.portal',
  // disco marino con anillos concéntricos (viewBox 100×140)
  pic: '<svg class="tilePic" viewBox="0 0 100 140" aria-hidden="true"><circle cx="56" cy="76" r="34" fill="rgba(20,40,20,.28)"/><circle cx="50" cy="70" r="34" fill="#2D4F7C"/><circle cx="50" cy="70" r="24" fill="none" stroke="#F1F1DC" stroke-width="3" opacity=".85"/><circle cx="50" cy="70" r="14" fill="none" stroke="#F1F1DC" stroke-width="3" opacity=".6"/><circle cx="50" cy="70" r="5" fill="#E8873A"/></svg>',
  tileClass: 'tile-portal',
  dust: 'cement',
};
