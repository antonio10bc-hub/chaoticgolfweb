// TEMPORAL: niveles "vitrina" para grabar los vídeos de cada baraja (TikTok). Un nivel por baraja (y Ultimate) que en un
// solo tiro enseña lo más vistoso: reacciones en cadena, todos sus elementos a la vista. Se guardan en Tus niveles abriendo
// el juego con #vitrina (main.js). Excepciones solo para ellos: la semilla (el bote sale siempre igual) y el viento ya
// soplando, que el código de compartir guarda en "v" (share.js). Borrar este archivo, su enlace en main.js y "v" en
// share.js cuando estén grabados.
export const VITRINA = [
 {
  "version": 1,
  "vitrina": "classic",
  "name": "Clásica: Salto de portales",
  "cols": 9,
  "rows": 9,
  "hole": {
   "x": 3,
   "y": 8
  },
  "ball": {
   "x": 0,
   "y": 6
  },
  "parCells": [],
  "tiles": [
   {
    "type": "portal",
    "x": 2,
    "y": 1,
    "pair": 1
   },
   {
    "type": "portal",
    "x": 4,
    "y": 1,
    "pair": 2
   },
   {
    "type": "bunker",
    "x": 8,
    "y": 2
   },
   {
    "type": "portal",
    "x": 1,
    "y": 3,
    "pair": 2
   },
   {
    "type": "portal",
    "x": 2,
    "y": 3,
    "pair": 3
   },
   {
    "type": "bunker",
    "x": 1,
    "y": 5
   },
   {
    "type": "portal",
    "x": 5,
    "y": 5,
    "pair": 3
   },
   {
    "type": "portal",
    "x": 7,
    "y": 5,
    "pair": 4
   },
   {
    "type": "portal",
    "x": 1,
    "y": 6,
    "pair": 1
   },
   {
    "type": "bunker",
    "x": 7,
    "y": 7
   },
   {
    "type": "portal",
    "x": 2,
    "y": 8,
    "pair": 4
   },
   {
    "type": "bunker",
    "x": 3,
    "y": 8
   }
  ],
  "deckCounts": {
   "palo1": 2,
   "palo2": 2,
   "palo3": 2
  },
  "hand": [
   "palo3"
  ],
  "extraBalls": [
   {
    "x": 7,
    "y": 1
   },
   {
    "x": 6,
    "y": 4
   },
   {
    "x": 4,
    "y": 6
   }
  ]
 },
 {
  "version": 1,
  "vitrina": "water",
  "name": "Agua: Rápidos",
  "cols": 7,
  "rows": 8,
  "hole": {
   "x": 1,
   "y": 7
  },
  "ball": {
   "x": 1,
   "y": 1
  },
  "parCells": [],
  "tiles": [
   {
    "type": "lake",
    "x": 4,
    "y": 1
   },
   {
    "type": "lake",
    "x": 5,
    "y": 1
   },
   {
    "type": "lake",
    "x": 5,
    "y": 2
   },
   {
    "type": "river",
    "x": 1,
    "y": 3
   },
   {
    "type": "river",
    "x": 1,
    "y": 4
   },
   {
    "type": "river",
    "x": 3,
    "y": 4
   },
   {
    "type": "river",
    "x": 1,
    "y": 5
   },
   {
    "type": "river",
    "x": 3,
    "y": 5
   },
   {
    "type": "river",
    "x": 1,
    "y": 6
   },
   {
    "type": "lake",
    "x": 5,
    "y": 6
   }
  ],
  "deckCounts": {
   "palo1": 2,
   "palo2": 2,
   "palo3": 2
  },
  "hand": [
   "dedo"
  ],
  "extraBalls": [
   {
    "x": 2,
    "y": 1
   },
   {
    "x": 3,
    "y": 1
   }
  ]
 },
 {
  "version": 1,
  "vitrina": "minigolf",
  "name": "Minigolf: Pinball",
  "cols": 9,
  "rows": 8,
  "hole": {
   "x": 5,
   "y": 4
  },
  "ball": {
   "x": 3,
   "y": 7
  },
  "parCells": [],
  "tiles": [
   {
    "type": "launcher",
    "x": 2,
    "y": 1,
    "rot": 1
   },
   {
    "type": "launcher",
    "x": 5,
    "y": 1,
    "rot": 2
   },
   {
    "type": "tunnel",
    "x": 7,
    "y": 2
   },
   {
    "type": "launcher",
    "x": 2,
    "y": 4
   },
   {
    "type": "block",
    "x": 7,
    "y": 6
   },
   {
    "type": "corner",
    "x": 2,
    "y": 7,
    "rot": 3
   },
   {
    "type": "block",
    "x": 5,
    "y": 7
   }
  ],
  "deckCounts": {
   "palo1": 2,
   "palo2": 2,
   "palo3": 2
  },
  "hand": [
   "palo5"
  ]
 },
 {
  "version": 1,
  "vitrina": "train",
  "name": "Tren: Último vagón",
  "cols": 8,
  "rows": 8,
  "hole": {
   "x": 7,
   "y": 1
  },
  "ball": {
   "x": 4,
   "y": 1
  },
  "parCells": [],
  "tiles": [],
  "deckCounts": {
   "palo1": 2,
   "palo2": 2,
   "palo3": 2
  },
  "hand": [
   "trenVuelta"
  ],
  "extraBalls": [
   {
    "x": 3,
    "y": 1
   },
   {
    "x": 2,
    "y": 6
   },
   {
    "x": 5,
    "y": 6
   }
  ],
  "train": {
   "path": [
    [
     1,
     1
    ],
    [
     2,
     1
    ],
    [
     3,
     1
    ],
    [
     4,
     1
    ],
    [
     5,
     1
    ],
    [
     6,
     1
    ],
    [
     6,
     2
    ],
    [
     6,
     3
    ],
    [
     6,
     4
    ],
    [
     6,
     5
    ],
    [
     6,
     6
    ],
    [
     5,
     6
    ],
    [
     4,
     6
    ],
    [
     3,
     6
    ],
    [
     2,
     6
    ],
    [
     1,
     6
    ],
    [
     1,
     5
    ],
    [
     1,
     4
    ],
    [
     1,
     3
    ],
    [
     1,
     2
    ]
   ],
   "stations": [
    2,
    7,
    12,
    17
   ],
   "pos": 12,
   "cars": 3
  }
 },
 {
  "version": 1,
  "vitrina": "seasons",
  "name": "Estaciones: Avalancha",
  "cols": 8,
  "rows": 8,
  "hole": {
   "x": 4,
   "y": 3
  },
  "ball": {
   "x": 2,
   "y": 3
  },
  "parCells": [],
  "tiles": [
   {
    "type": "fire",
    "x": 1,
    "y": 1
   },
   {
    "type": "leaf",
    "x": 3,
    "y": 1
   },
   {
    "type": "puddle",
    "x": 5,
    "y": 1
   },
   {
    "type": "plant",
    "x": 7,
    "y": 2
   },
   {
    "type": "ice",
    "x": 2,
    "y": 4
   },
   {
    "type": "leaf",
    "x": 4,
    "y": 4
   },
   {
    "type": "ice",
    "x": 1,
    "y": 5
   },
   {
    "type": "plant",
    "x": 6,
    "y": 5
   },
   {
    "type": "fire",
    "x": 5,
    "y": 6
   }
  ],
  "deckCounts": {
   "palo1": 2,
   "palo2": 2,
   "palo3": 2
  },
  "hand": [
   "oNieve"
  ],
  "extraBalls": [
   {
    "x": 1,
    "y": 3
   },
   {
    "x": 3,
    "y": 3
   }
  ],
  "season": {
   "now": "winter",
   "wind": {
    "path": [
     [
      0,
      6
     ],
     [
      1,
      6
     ],
     [
      2,
      6
     ],
     [
      2,
      7
     ],
     [
      3,
      7
     ],
     [
      4,
      7
     ],
     [
      5,
      7
     ],
     [
      6,
      7
     ],
     [
      7,
      7
     ]
    ],
    "on": true
   },
   "snow": {
    "x": 0,
    "y": 3
   }
  }
 },
 {
  "version": 1,
  "vitrina": "multiverse",
  "name": "Multiverso: Big bang",
  "cols": 8,
  "rows": 8,
  "hole": {
   "x": 4,
   "y": 4
  },
  "ball": {
   "x": 2,
   "y": 6
  },
  "parCells": [],
  "tiles": [
   {
    "type": "meteorite",
    "x": 6,
    "y": 1
   },
   {
    "type": "blackhole",
    "x": 3,
    "y": 4
   },
   {
    "type": "blackhole",
    "x": 1,
    "y": 5
   },
   {
    "type": "meteorite",
    "x": 6,
    "y": 6
   }
  ],
  "deckCounts": {
   "palo1": 2,
   "palo2": 2,
   "palo3": 2
  },
  "hand": [
   "palo3"
  ]
 },
 {
  "version": 1,
  "vitrina": "gambling",
  "name": "Casino: Bote",
  "cols": 8,
  "rows": 8,
  "hole": {
   "x": 5,
   "y": 6
  },
  "ball": {
   "x": 2,
   "y": 3
  },
  "parCells": [],
  "tiles": [
   {
    "type": "dice",
    "x": 0,
    "y": 3,
    "t": 5
   },
   {
    "type": "dice",
    "x": 6,
    "y": 3,
    "t": 1
   }
  ],
  "deckCounts": {
   "palo1": 2,
   "palo2": 2,
   "palo3": 2
  },
  "hand": [
   "palo3"
  ],
  "gamble": {
   "gold": {
    "x": 4,
    "y": 3
   },
   "coins": [
    {
     "x": 1,
     "y": 1
    },
    {
     "x": 6,
     "y": 1
    },
    {
     "x": 1,
     "y": 5
    }
   ]
  },
  "seed": 12
 },
 {
  "version": 1,
  "vitrina": "ultimate",
  "name": "Ultimate: Arcoíris",
  "cols": 9,
  "rows": 9,
  "hole": {
   "x": 5,
   "y": 1
  },
  "ball": {
   "x": 0,
   "y": 8
  },
  "parCells": [],
  "tiles": [
   {
    "type": "portal",
    "x": 2,
    "y": 0
   },
   {
    "type": "meteorite",
    "x": 8,
    "y": 0
   },
   {
    "type": "block",
    "x": 1,
    "y": 1
   },
   {
    "type": "blackhole",
    "x": 7,
    "y": 1
   },
   {
    "type": "river",
    "x": 1,
    "y": 3
   },
   {
    "type": "tunnel",
    "x": 8,
    "y": 3
   },
   {
    "type": "river",
    "x": 1,
    "y": 4
   },
   {
    "type": "bunker",
    "x": 4,
    "y": 4
   },
   {
    "type": "portal",
    "x": 6,
    "y": 4
   },
   {
    "type": "river",
    "x": 1,
    "y": 5
   },
   {
    "type": "dice",
    "x": 3,
    "y": 6,
    "t": 4
   },
   {
    "type": "launcher",
    "x": 5,
    "y": 6
   },
   {
    "type": "fire",
    "x": 7,
    "y": 6
   },
   {
    "type": "corner",
    "x": 5,
    "y": 8,
    "rot": 2
   },
   {
    "type": "ice",
    "x": 7,
    "y": 8
   },
   {
    "type": "lake",
    "x": 8,
    "y": 8
   }
  ],
  "deckCounts": {
   "palo1": 2,
   "palo2": 2,
   "palo3": 2
  },
  "hand": [
   "paloIri"
  ],
  "extraBalls": [
   {
    "x": 5,
    "y": 0
   }
  ],
  "season": {
   "now": "summer"
  }
 }
];
