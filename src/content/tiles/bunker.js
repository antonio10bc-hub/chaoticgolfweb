export default {
  type: 'bunker',
  trap: true,
  cellClass: 'sand',      // la arena tiñe la casilla
  cellArt: 'cell.sand',
  tileArt: 'tile.bunker',
  // ilustración cenital sobre la casilla (viewBox 100×140): arena orgánica con collar de césped y brillo
  pic: '<svg class="tilePic" viewBox="0 0 100 140" aria-hidden="true"><path d="M6 76C4 54 24 40 46 44c16 3 22 13 36 11 12-2 16 14 10 28-7 17-28 27-50 26C20 108 8 96 6 76z" fill="#6FA052"/><path d="M13 76c-1-17 15-28 33-25 14 2 19 11 32 9 8-1 11 11 6 22-6 13-23 20-41 19-18-1-29-9-30-25z" fill="#ECE6CC"/><path d="M20 70c3-10 14-15 26-13 11 2 16 9 26 8-10 6-32 1-52 5z" fill="#F6F2E0"/></svg>',
  tileClass: 'tile-bunker',
  dust: 'sand',           // color del polvo al colocarla
};
