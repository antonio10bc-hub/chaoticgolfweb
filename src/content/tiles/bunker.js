export default {
  type: 'bunker',
  trap: true,
  cellClass: 'sand',      // la arena tiñe la casilla
  cellArt: 'cell.sand',
  tileArt: 'tile.bunker',
  // ilustración cenital sobre la casilla (viewBox 100×140): arena orgánica con collar de césped y brillo
  pic: '<svg class="tilePic" viewBox="0 0 100 140" aria-hidden="true"><path d="M7 80C4 60 20 47 39 49c13 1 17 9 28 7 15-3 27 5 26 21-1 21-22 33-45 32C24 108 9 98 7 80z" fill="#6FA052"/><path d="M13 80c-2-16 11-26 26-24 11 1 15 8 26 6 12-2 22 4 21 17-1 17-18 27-38 26-18-1-33-9-35-25z" fill="#ECE6CC"/><path d="M13 80c-2-16 11-26 26-24 11 1 15 8 26 6 12-2 22 4 21 17-6-9-15-11-23-9-11 2-17-4-27-5-11-1-20 5-23 15z" fill="#DDD5B4"/><path d="M22 92c10 8 30 10 46 5 8-2 13-7 15-12-5 11-26 18-45 15-8-1-13-4-16-8z" fill="#F6F2E0"/><path d="M26 78c10-4 22-3 32 1M24 86c12-4 26-3 38 2M34 94c9-2 18-1 26 2" fill="none" stroke="#D4CBA6" stroke-width="1.3" stroke-linecap="round"/></svg>',
  tileClass: 'tile-bunker',
  dust: 'sand',           // color del polvo al colocarla
};
