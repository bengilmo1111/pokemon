import { TYPES, TypeId } from "./types";

export interface EvolutionData {
  to: string;
  level: number;
}

export interface LearnableMove {
  moveId: string;
  level: number;
}

export interface SpeciesData {
  id: string;
  name: string;
  types: TypeId[];
  baseStats: { hp: number; atk: number; def: number; spd: number };
  moves: string[];
  learnableMoves: LearnableMove[];
  catchRate: number;
  evolution?: EvolutionData;
  expYield: number;
}

export const SPECIES: Record<string, SpeciesData> = {
  // GRASS STARTERS
  bulbasaur: {
    id: "bulbasaur",
    name: "Bulbasaur",
    types: [TYPES.GRASS, TYPES.POISON],
    baseStats: { hp: 45, atk: 49, def: 49, spd: 45 },
    moves: ["tackle", "vine-whip"],
    learnableMoves: [
      { moveId: "tackle", level: 1 },
      { moveId: "vine-whip", level: 1 },
      { moveId: "poison-powder", level: 13 },
      { moveId: "razor-leaf", level: 19 },
      { moveId: "energy-ball", level: 25 }
    ],
    catchRate: 45,
    evolution: { to: "ivysaur", level: 16 },
    expYield: 64
  },
  ivysaur: {
    id: "ivysaur",
    name: "Ivysaur",
    types: [TYPES.GRASS, TYPES.POISON],
    baseStats: { hp: 60, atk: 62, def: 63, spd: 60 },
    moves: ["vine-whip", "razor-leaf", "poison-powder"],
    learnableMoves: [
      { moveId: "vine-whip", level: 1 },
      { moveId: "razor-leaf", level: 1 },
      { moveId: "poison-powder", level: 1 },
      { moveId: "energy-ball", level: 28 },
      { moveId: "petal-blizzard", level: 32 }
    ],
    catchRate: 45,
    evolution: { to: "venusaur", level: 32 },
    expYield: 142
  },
  venusaur: {
    id: "venusaur",
    name: "Venusaur",
    types: [TYPES.GRASS, TYPES.POISON],
    baseStats: { hp: 80, atk: 82, def: 83, spd: 80 },
    moves: ["energy-ball", "petal-blizzard", "razor-leaf", "poison-powder"],
    learnableMoves: [
      { moveId: "energy-ball", level: 1 },
      { moveId: "petal-blizzard", level: 1 },
      { moveId: "razor-leaf", level: 1 },
      { moveId: "solar-beam", level: 45 }
    ],
    catchRate: 45,
    expYield: 236
  },

  // FIRE STARTERS
  charmander: {
    id: "charmander",
    name: "Charmander",
    types: [TYPES.FIRE],
    baseStats: { hp: 39, atk: 52, def: 43, spd: 65 },
    moves: ["scratch", "ember"],
    learnableMoves: [
      { moveId: "scratch", level: 1 },
      { moveId: "ember", level: 1 },
      { moveId: "fire-fang", level: 12 },
      { moveId: "flamethrower", level: 24 },
      { moveId: "fire-blast", level: 36 }
    ],
    catchRate: 45,
    evolution: { to: "charmeleon", level: 16 },
    expYield: 62
  },
  charmeleon: {
    id: "charmeleon",
    name: "Charmeleon",
    types: [TYPES.FIRE],
    baseStats: { hp: 58, atk: 64, def: 58, spd: 80 },
    moves: ["ember", "fire-fang", "slash"],
    learnableMoves: [
      { moveId: "ember", level: 1 },
      { moveId: "fire-fang", level: 1 },
      { moveId: "slash", level: 1 },
      { moveId: "flamethrower", level: 24 },
      { moveId: "fire-blast", level: 36 }
    ],
    catchRate: 45,
    evolution: { to: "charizard", level: 36 },
    expYield: 142
  },
  charizard: {
    id: "charizard",
    name: "Charizard",
    types: [TYPES.FIRE, TYPES.FLYING],
    baseStats: { hp: 78, atk: 84, def: 78, spd: 100 },
    moves: ["flamethrower", "fire-blast", "fly", "slash"],
    learnableMoves: [
      { moveId: "flamethrower", level: 1 },
      { moveId: "fire-blast", level: 1 },
      { moveId: "fly", level: 1 },
      { moveId: "dragon-claw", level: 50 }
    ],
    catchRate: 45,
    expYield: 240
  },

  // WATER STARTERS
  squirtle: {
    id: "squirtle",
    name: "Squirtle",
    types: [TYPES.WATER],
    baseStats: { hp: 44, atk: 48, def: 65, spd: 43 },
    moves: ["tackle", "water-gun"],
    learnableMoves: [
      { moveId: "tackle", level: 1 },
      { moveId: "water-gun", level: 1 },
      { moveId: "bite", level: 12 },
      { moveId: "water-pulse", level: 18 },
      { moveId: "aqua-tail", level: 25 }
    ],
    catchRate: 45,
    evolution: { to: "wartortle", level: 16 },
    expYield: 63
  },
  wartortle: {
    id: "wartortle",
    name: "Wartortle",
    types: [TYPES.WATER],
    baseStats: { hp: 59, atk: 63, def: 80, spd: 58 },
    moves: ["water-gun", "water-pulse", "bite"],
    learnableMoves: [
      { moveId: "water-gun", level: 1 },
      { moveId: "water-pulse", level: 1 },
      { moveId: "bite", level: 1 },
      { moveId: "aqua-tail", level: 25 },
      { moveId: "hydro-pump", level: 40 }
    ],
    catchRate: 45,
    evolution: { to: "blastoise", level: 36 },
    expYield: 142
  },
  blastoise: {
    id: "blastoise",
    name: "Blastoise",
    types: [TYPES.WATER],
    baseStats: { hp: 79, atk: 83, def: 100, spd: 78 },
    moves: ["aqua-tail", "hydro-pump", "water-pulse", "bite"],
    learnableMoves: [
      { moveId: "aqua-tail", level: 1 },
      { moveId: "hydro-pump", level: 1 },
      { moveId: "water-pulse", level: 1 },
      { moveId: "ice-beam", level: 50 }
    ],
    catchRate: 45,
    expYield: 239
  },

  // ELECTRIC TYPES
  pichu: {
    id: "pichu",
    name: "Pichu",
    types: [TYPES.ELECTRIC],
    baseStats: { hp: 20, atk: 40, def: 15, spd: 60 },
    moves: ["thunder-shock", "tail-whip"],
    learnableMoves: [
      { moveId: "thunder-shock", level: 1 },
      { moveId: "tail-whip", level: 1 },
      { moveId: "spark", level: 10 }
    ],
    catchRate: 190,
    evolution: { to: "pikachu", level: 12 },
    expYield: 41
  },
  pikachu: {
    id: "pikachu",
    name: "Pikachu",
    types: [TYPES.ELECTRIC],
    baseStats: { hp: 35, atk: 55, def: 40, spd: 90 },
    moves: ["thunder-shock", "spark", "quick-attack"],
    learnableMoves: [
      { moveId: "thunder-shock", level: 1 },
      { moveId: "spark", level: 1 },
      { moveId: "quick-attack", level: 1 },
      { moveId: "thunderbolt", level: 26 },
      { moveId: "thunder", level: 42 }
    ],
    catchRate: 190,
    evolution: { to: "raichu", level: 28 },
    expYield: 112
  },
  raichu: {
    id: "raichu",
    name: "Raichu",
    types: [TYPES.ELECTRIC],
    baseStats: { hp: 60, atk: 90, def: 55, spd: 110 },
    moves: ["thunderbolt", "thunder", "quick-attack", "spark"],
    learnableMoves: [
      { moveId: "thunderbolt", level: 1 },
      { moveId: "thunder", level: 1 },
      { moveId: "quick-attack", level: 1 }
    ],
    catchRate: 75,
    expYield: 218
  },

  // NORMAL/FLYING
  pidgey: {
    id: "pidgey",
    name: "Pidgey",
    types: [TYPES.NORMAL, TYPES.FLYING],
    baseStats: { hp: 40, atk: 45, def: 40, spd: 56 },
    moves: ["tackle", "gust"],
    learnableMoves: [
      { moveId: "tackle", level: 1 },
      { moveId: "gust", level: 1 },
      { moveId: "quick-attack", level: 9 },
      { moveId: "wing-attack", level: 17 },
      { moveId: "fly", level: 33 }
    ],
    catchRate: 255,
    evolution: { to: "pidgeotto", level: 18 },
    expYield: 50
  },
  pidgeotto: {
    id: "pidgeotto",
    name: "Pidgeotto",
    types: [TYPES.NORMAL, TYPES.FLYING],
    baseStats: { hp: 63, atk: 60, def: 55, spd: 71 },
    moves: ["gust", "quick-attack", "wing-attack"],
    learnableMoves: [
      { moveId: "gust", level: 1 },
      { moveId: "quick-attack", level: 1 },
      { moveId: "wing-attack", level: 1 },
      { moveId: "fly", level: 33 },
      { moveId: "air-slash", level: 42 }
    ],
    catchRate: 120,
    evolution: { to: "pidgeot", level: 36 },
    expYield: 122
  },
  pidgeot: {
    id: "pidgeot",
    name: "Pidgeot",
    types: [TYPES.NORMAL, TYPES.FLYING],
    baseStats: { hp: 83, atk: 80, def: 75, spd: 101 },
    moves: ["fly", "air-slash", "wing-attack", "quick-attack"],
    learnableMoves: [
      { moveId: "fly", level: 1 },
      { moveId: "air-slash", level: 1 },
      { moveId: "wing-attack", level: 1 },
      { moveId: "hurricane", level: 50 }
    ],
    catchRate: 45,
    expYield: 216
  },

  // ROCK/GROUND
  geodude: {
    id: "geodude",
    name: "Geodude",
    types: [TYPES.ROCK, TYPES.GROUND],
    baseStats: { hp: 40, atk: 80, def: 100, spd: 20 },
    moves: ["tackle", "rock-throw"],
    learnableMoves: [
      { moveId: "tackle", level: 1 },
      { moveId: "rock-throw", level: 1 },
      { moveId: "rock-slide", level: 18 },
      { moveId: "earthquake", level: 30 }
    ],
    catchRate: 255,
    evolution: { to: "graveler", level: 25 },
    expYield: 60
  },
  graveler: {
    id: "graveler",
    name: "Graveler",
    types: [TYPES.ROCK, TYPES.GROUND],
    baseStats: { hp: 55, atk: 95, def: 115, spd: 35 },
    moves: ["rock-throw", "rock-slide", "magnitude"],
    learnableMoves: [
      { moveId: "rock-throw", level: 1 },
      { moveId: "rock-slide", level: 1 },
      { moveId: "magnitude", level: 1 },
      { moveId: "earthquake", level: 30 },
      { moveId: "stone-edge", level: 40 }
    ],
    catchRate: 120,
    evolution: { to: "golem", level: 40 },
    expYield: 137
  },
  golem: {
    id: "golem",
    name: "Golem",
    types: [TYPES.ROCK, TYPES.GROUND],
    baseStats: { hp: 80, atk: 120, def: 130, spd: 45 },
    moves: ["earthquake", "stone-edge", "rock-slide", "magnitude"],
    learnableMoves: [
      { moveId: "earthquake", level: 1 },
      { moveId: "stone-edge", level: 1 },
      { moveId: "rock-slide", level: 1 }
    ],
    catchRate: 45,
    expYield: 223
  },

  // BUG TYPES
  caterpie: {
    id: "caterpie",
    name: "Caterpie",
    types: [TYPES.BUG],
    baseStats: { hp: 45, atk: 30, def: 35, spd: 45 },
    moves: ["tackle", "string-shot"],
    learnableMoves: [
      { moveId: "tackle", level: 1 },
      { moveId: "string-shot", level: 1 },
      { moveId: "bug-bite", level: 9 }
    ],
    catchRate: 255,
    evolution: { to: "metapod", level: 7 },
    expYield: 39
  },
  metapod: {
    id: "metapod",
    name: "Metapod",
    types: [TYPES.BUG],
    baseStats: { hp: 50, atk: 20, def: 55, spd: 30 },
    moves: ["tackle", "harden"],
    learnableMoves: [
      { moveId: "tackle", level: 1 },
      { moveId: "harden", level: 1 }
    ],
    catchRate: 120,
    evolution: { to: "butterfree", level: 10 },
    expYield: 72
  },
  butterfree: {
    id: "butterfree",
    name: "Butterfree",
    types: [TYPES.BUG, TYPES.FLYING],
    baseStats: { hp: 60, atk: 45, def: 50, spd: 70 },
    moves: ["gust", "confusion", "sleep-powder", "psybeam"],
    learnableMoves: [
      { moveId: "gust", level: 1 },
      { moveId: "confusion", level: 1 },
      { moveId: "sleep-powder", level: 12 },
      { moveId: "psybeam", level: 17 },
      { moveId: "bug-buzz", level: 34 }
    ],
    catchRate: 45,
    expYield: 178
  },
  weedle: {
    id: "weedle",
    name: "Weedle",
    types: [TYPES.BUG, TYPES.POISON],
    baseStats: { hp: 40, atk: 35, def: 30, spd: 50 },
    moves: ["poison-sting", "string-shot"],
    learnableMoves: [
      { moveId: "poison-sting", level: 1 },
      { moveId: "string-shot", level: 1 },
      { moveId: "bug-bite", level: 9 }
    ],
    catchRate: 255,
    evolution: { to: "kakuna", level: 7 },
    expYield: 39
  },
  kakuna: {
    id: "kakuna",
    name: "Kakuna",
    types: [TYPES.BUG, TYPES.POISON],
    baseStats: { hp: 45, atk: 25, def: 50, spd: 35 },
    moves: ["poison-sting", "harden"],
    learnableMoves: [
      { moveId: "poison-sting", level: 1 },
      { moveId: "harden", level: 1 }
    ],
    catchRate: 120,
    evolution: { to: "beedrill", level: 10 },
    expYield: 72
  },
  beedrill: {
    id: "beedrill",
    name: "Beedrill",
    types: [TYPES.BUG, TYPES.POISON],
    baseStats: { hp: 65, atk: 90, def: 40, spd: 75 },
    moves: ["poison-jab", "x-scissor", "fury-attack", "twineedle"],
    learnableMoves: [
      { moveId: "poison-jab", level: 1 },
      { moveId: "x-scissor", level: 1 },
      { moveId: "fury-attack", level: 1 },
      { moveId: "twineedle", level: 1 }
    ],
    catchRate: 45,
    expYield: 178
  },

  // NORMAL TYPES
  rattata: {
    id: "rattata",
    name: "Rattata",
    types: [TYPES.NORMAL],
    baseStats: { hp: 30, atk: 56, def: 35, spd: 72 },
    moves: ["tackle", "quick-attack"],
    learnableMoves: [
      { moveId: "tackle", level: 1 },
      { moveId: "quick-attack", level: 1 },
      { moveId: "bite", level: 10 },
      { moveId: "hyper-fang", level: 16 }
    ],
    catchRate: 255,
    evolution: { to: "raticate", level: 20 },
    expYield: 51
  },
  raticate: {
    id: "raticate",
    name: "Raticate",
    types: [TYPES.NORMAL],
    baseStats: { hp: 55, atk: 81, def: 60, spd: 97 },
    moves: ["quick-attack", "bite", "hyper-fang", "crunch"],
    learnableMoves: [
      { moveId: "quick-attack", level: 1 },
      { moveId: "bite", level: 1 },
      { moveId: "hyper-fang", level: 1 },
      { moveId: "crunch", level: 24 }
    ],
    catchRate: 127,
    expYield: 145
  },
  eevee: {
    id: "eevee",
    name: "Eevee",
    types: [TYPES.NORMAL],
    baseStats: { hp: 55, atk: 55, def: 50, spd: 55 },
    moves: ["tackle", "quick-attack", "bite"],
    learnableMoves: [
      { moveId: "tackle", level: 1 },
      { moveId: "quick-attack", level: 1 },
      { moveId: "bite", level: 15 },
      { moveId: "swift", level: 25 }
    ],
    catchRate: 45,
    evolution: { to: "flareon", level: 25 },
    expYield: 65
  },
  flareon: {
    id: "flareon",
    name: "Flareon",
    types: [TYPES.FIRE],
    baseStats: { hp: 65, atk: 130, def: 60, spd: 65 },
    moves: ["flamethrower", "fire-fang", "quick-attack", "bite"],
    learnableMoves: [
      { moveId: "flamethrower", level: 1 },
      { moveId: "fire-fang", level: 1 },
      { moveId: "fire-blast", level: 45 }
    ],
    catchRate: 45,
    expYield: 184
  },

  // POISON TYPES
  nidoran_f: {
    id: "nidoran_f",
    name: "Nidoran F",
    types: [TYPES.POISON],
    baseStats: { hp: 55, atk: 47, def: 52, spd: 41 },
    moves: ["scratch", "poison-sting"],
    learnableMoves: [
      { moveId: "scratch", level: 1 },
      { moveId: "poison-sting", level: 1 },
      { moveId: "bite", level: 13 },
      { moveId: "poison-jab", level: 23 }
    ],
    catchRate: 235,
    evolution: { to: "nidorina", level: 16 },
    expYield: 55
  },
  nidorina: {
    id: "nidorina",
    name: "Nidorina",
    types: [TYPES.POISON],
    baseStats: { hp: 70, atk: 62, def: 67, spd: 56 },
    moves: ["poison-sting", "bite", "poison-jab"],
    learnableMoves: [
      { moveId: "poison-sting", level: 1 },
      { moveId: "bite", level: 1 },
      { moveId: "poison-jab", level: 1 },
      { moveId: "crunch", level: 35 }
    ],
    catchRate: 120,
    evolution: { to: "nidoqueen", level: 36 },
    expYield: 128
  },
  nidoqueen: {
    id: "nidoqueen",
    name: "Nidoqueen",
    types: [TYPES.POISON, TYPES.GROUND],
    baseStats: { hp: 90, atk: 92, def: 87, spd: 76 },
    moves: ["poison-jab", "earthquake", "crunch", "body-slam"],
    learnableMoves: [
      { moveId: "poison-jab", level: 1 },
      { moveId: "earthquake", level: 1 },
      { moveId: "crunch", level: 1 }
    ],
    catchRate: 45,
    expYield: 227
  },
  nidoran_m: {
    id: "nidoran_m",
    name: "Nidoran M",
    types: [TYPES.POISON],
    baseStats: { hp: 46, atk: 57, def: 40, spd: 50 },
    moves: ["peck", "poison-sting"],
    learnableMoves: [
      { moveId: "peck", level: 1 },
      { moveId: "poison-sting", level: 1 },
      { moveId: "horn-attack", level: 13 },
      { moveId: "poison-jab", level: 23 }
    ],
    catchRate: 235,
    evolution: { to: "nidorino", level: 16 },
    expYield: 55
  },
  nidorino: {
    id: "nidorino",
    name: "Nidorino",
    types: [TYPES.POISON],
    baseStats: { hp: 61, atk: 72, def: 57, spd: 65 },
    moves: ["poison-sting", "horn-attack", "poison-jab"],
    learnableMoves: [
      { moveId: "poison-sting", level: 1 },
      { moveId: "horn-attack", level: 1 },
      { moveId: "poison-jab", level: 1 },
      { moveId: "megahorn", level: 35 }
    ],
    catchRate: 120,
    evolution: { to: "nidoking", level: 36 },
    expYield: 128
  },
  nidoking: {
    id: "nidoking",
    name: "Nidoking",
    types: [TYPES.POISON, TYPES.GROUND],
    baseStats: { hp: 81, atk: 102, def: 77, spd: 85 },
    moves: ["poison-jab", "earthquake", "megahorn", "thrash"],
    learnableMoves: [
      { moveId: "poison-jab", level: 1 },
      { moveId: "earthquake", level: 1 },
      { moveId: "megahorn", level: 1 }
    ],
    catchRate: 45,
    expYield: 227
  },

  // PSYCHIC TYPES
  abra: {
    id: "abra",
    name: "Abra",
    types: [TYPES.PSYCHIC],
    baseStats: { hp: 25, atk: 20, def: 15, spd: 90 },
    moves: ["confusion"],
    learnableMoves: [
      { moveId: "confusion", level: 1 },
      { moveId: "psybeam", level: 16 }
    ],
    catchRate: 200,
    evolution: { to: "kadabra", level: 16 },
    expYield: 62
  },
  kadabra: {
    id: "kadabra",
    name: "Kadabra",
    types: [TYPES.PSYCHIC],
    baseStats: { hp: 40, atk: 35, def: 30, spd: 105 },
    moves: ["confusion", "psybeam", "psychic"],
    learnableMoves: [
      { moveId: "confusion", level: 1 },
      { moveId: "psybeam", level: 1 },
      { moveId: "psychic", level: 36 }
    ],
    catchRate: 100,
    evolution: { to: "alakazam", level: 38 },
    expYield: 140
  },
  alakazam: {
    id: "alakazam",
    name: "Alakazam",
    types: [TYPES.PSYCHIC],
    baseStats: { hp: 55, atk: 50, def: 45, spd: 120 },
    moves: ["psychic", "psybeam", "shadow-ball", "dazzling-gleam"],
    learnableMoves: [
      { moveId: "psychic", level: 1 },
      { moveId: "psybeam", level: 1 },
      { moveId: "shadow-ball", level: 45 }
    ],
    catchRate: 50,
    expYield: 225
  },

  // GHOST TYPES
  gastly: {
    id: "gastly",
    name: "Gastly",
    types: [TYPES.GHOST, TYPES.POISON],
    baseStats: { hp: 30, atk: 35, def: 30, spd: 80 },
    moves: ["lick", "confuse-ray"],
    learnableMoves: [
      { moveId: "lick", level: 1 },
      { moveId: "confuse-ray", level: 1 },
      { moveId: "shadow-ball", level: 25 }
    ],
    catchRate: 190,
    evolution: { to: "haunter", level: 25 },
    expYield: 62
  },
  haunter: {
    id: "haunter",
    name: "Haunter",
    types: [TYPES.GHOST, TYPES.POISON],
    baseStats: { hp: 45, atk: 50, def: 45, spd: 95 },
    moves: ["lick", "shadow-ball", "confuse-ray"],
    learnableMoves: [
      { moveId: "lick", level: 1 },
      { moveId: "shadow-ball", level: 1 },
      { moveId: "confuse-ray", level: 1 },
      { moveId: "dream-eater", level: 40 }
    ],
    catchRate: 90,
    evolution: { to: "gengar", level: 38 },
    expYield: 142
  },
  gengar: {
    id: "gengar",
    name: "Gengar",
    types: [TYPES.GHOST, TYPES.POISON],
    baseStats: { hp: 60, atk: 65, def: 60, spd: 110 },
    moves: ["shadow-ball", "sludge-bomb", "dream-eater", "confuse-ray"],
    learnableMoves: [
      { moveId: "shadow-ball", level: 1 },
      { moveId: "sludge-bomb", level: 1 },
      { moveId: "dream-eater", level: 1 }
    ],
    catchRate: 45,
    expYield: 225
  },

  // FIGHTING TYPES
  machop: {
    id: "machop",
    name: "Machop",
    types: [TYPES.FIGHTING],
    baseStats: { hp: 70, atk: 80, def: 50, spd: 35 },
    moves: ["karate-chop", "low-kick"],
    learnableMoves: [
      { moveId: "karate-chop", level: 1 },
      { moveId: "low-kick", level: 1 },
      { moveId: "brick-break", level: 19 },
      { moveId: "cross-chop", level: 33 }
    ],
    catchRate: 180,
    evolution: { to: "machoke", level: 28 },
    expYield: 61
  },
  machoke: {
    id: "machoke",
    name: "Machoke",
    types: [TYPES.FIGHTING],
    baseStats: { hp: 80, atk: 100, def: 70, spd: 45 },
    moves: ["karate-chop", "brick-break", "cross-chop"],
    learnableMoves: [
      { moveId: "karate-chop", level: 1 },
      { moveId: "brick-break", level: 1 },
      { moveId: "cross-chop", level: 1 },
      { moveId: "dynamic-punch", level: 45 }
    ],
    catchRate: 90,
    evolution: { to: "machamp", level: 40 },
    expYield: 142
  },
  machamp: {
    id: "machamp",
    name: "Machamp",
    types: [TYPES.FIGHTING],
    baseStats: { hp: 90, atk: 130, def: 80, spd: 55 },
    moves: ["cross-chop", "dynamic-punch", "brick-break", "earthquake"],
    learnableMoves: [
      { moveId: "cross-chop", level: 1 },
      { moveId: "dynamic-punch", level: 1 },
      { moveId: "earthquake", level: 50 }
    ],
    catchRate: 45,
    expYield: 227
  },

  // DRAGON TYPE
  dratini: {
    id: "dratini",
    name: "Dratini",
    types: [TYPES.DRAGON],
    baseStats: { hp: 41, atk: 64, def: 45, spd: 50 },
    moves: ["twister", "dragon-rage"],
    learnableMoves: [
      { moveId: "twister", level: 1 },
      { moveId: "dragon-rage", level: 1 },
      { moveId: "dragon-breath", level: 15 },
      { moveId: "dragon-claw", level: 35 }
    ],
    catchRate: 45,
    evolution: { to: "dragonair", level: 30 },
    expYield: 60
  },
  dragonair: {
    id: "dragonair",
    name: "Dragonair",
    types: [TYPES.DRAGON],
    baseStats: { hp: 61, atk: 84, def: 65, spd: 70 },
    moves: ["dragon-rage", "dragon-breath", "dragon-claw"],
    learnableMoves: [
      { moveId: "dragon-rage", level: 1 },
      { moveId: "dragon-breath", level: 1 },
      { moveId: "dragon-claw", level: 1 },
      { moveId: "outrage", level: 50 }
    ],
    catchRate: 45,
    evolution: { to: "dragonite", level: 55 },
    expYield: 147
  },
  dragonite: {
    id: "dragonite",
    name: "Dragonite",
    types: [TYPES.DRAGON, TYPES.FLYING],
    baseStats: { hp: 91, atk: 134, def: 95, spd: 80 },
    moves: ["outrage", "dragon-claw", "fly", "thunder-punch"],
    learnableMoves: [
      { moveId: "outrage", level: 1 },
      { moveId: "dragon-claw", level: 1 },
      { moveId: "fly", level: 1 },
      { moveId: "hyper-beam", level: 60 }
    ],
    catchRate: 45,
    expYield: 270
  },

  // ICE TYPES
  seel: {
    id: "seel",
    name: "Seel",
    types: [TYPES.WATER],
    baseStats: { hp: 65, atk: 45, def: 55, spd: 45 },
    moves: ["water-gun", "icy-wind"],
    learnableMoves: [
      { moveId: "water-gun", level: 1 },
      { moveId: "icy-wind", level: 1 },
      { moveId: "aurora-beam", level: 21 },
      { moveId: "ice-beam", level: 37 }
    ],
    catchRate: 190,
    evolution: { to: "dewgong", level: 34 },
    expYield: 65
  },
  dewgong: {
    id: "dewgong",
    name: "Dewgong",
    types: [TYPES.WATER, TYPES.ICE],
    baseStats: { hp: 90, atk: 70, def: 80, spd: 70 },
    moves: ["ice-beam", "aurora-beam", "aqua-tail", "icy-wind"],
    learnableMoves: [
      { moveId: "ice-beam", level: 1 },
      { moveId: "aurora-beam", level: 1 },
      { moveId: "aqua-tail", level: 1 },
      { moveId: "blizzard", level: 50 }
    ],
    catchRate: 75,
    expYield: 166
  },

  // LEGENDARY (rare encounters)
  articuno: {
    id: "articuno",
    name: "Articuno",
    types: [TYPES.ICE, TYPES.FLYING],
    baseStats: { hp: 90, atk: 85, def: 100, spd: 85 },
    moves: ["ice-beam", "blizzard", "fly", "ancient-power"],
    learnableMoves: [
      { moveId: "ice-beam", level: 1 },
      { moveId: "blizzard", level: 1 },
      { moveId: "fly", level: 1 }
    ],
    catchRate: 3,
    expYield: 261
  },
  zapdos: {
    id: "zapdos",
    name: "Zapdos",
    types: [TYPES.ELECTRIC, TYPES.FLYING],
    baseStats: { hp: 90, atk: 90, def: 85, spd: 100 },
    moves: ["thunderbolt", "thunder", "fly", "ancient-power"],
    learnableMoves: [
      { moveId: "thunderbolt", level: 1 },
      { moveId: "thunder", level: 1 },
      { moveId: "fly", level: 1 }
    ],
    catchRate: 3,
    expYield: 261
  },
  moltres: {
    id: "moltres",
    name: "Moltres",
    types: [TYPES.FIRE, TYPES.FLYING],
    baseStats: { hp: 90, atk: 100, def: 90, spd: 90 },
    moves: ["flamethrower", "fire-blast", "fly", "ancient-power"],
    learnableMoves: [
      { moveId: "flamethrower", level: 1 },
      { moveId: "fire-blast", level: 1 },
      { moveId: "fly", level: 1 }
    ],
    catchRate: 3,
    expYield: 261
  },

  // FAIRY TYPE
  clefairy: {
    id: "clefairy",
    name: "Clefairy",
    types: [TYPES.FAIRY],
    baseStats: { hp: 70, atk: 45, def: 48, spd: 35 },
    moves: ["pound", "disarming-voice"],
    learnableMoves: [
      { moveId: "pound", level: 1 },
      { moveId: "disarming-voice", level: 1 },
      { moveId: "moonblast", level: 34 },
      { moveId: "dazzling-gleam", level: 40 }
    ],
    catchRate: 150,
    evolution: { to: "clefable", level: 30 },
    expYield: 113
  },
  clefable: {
    id: "clefable",
    name: "Clefable",
    types: [TYPES.FAIRY],
    baseStats: { hp: 95, atk: 70, def: 73, spd: 60 },
    moves: ["moonblast", "dazzling-gleam", "disarming-voice", "pound"],
    learnableMoves: [
      { moveId: "moonblast", level: 1 },
      { moveId: "dazzling-gleam", level: 1 }
    ],
    catchRate: 25,
    expYield: 217
  },
  jigglypuff: {
    id: "jigglypuff",
    name: "Jigglypuff",
    types: [TYPES.NORMAL, TYPES.FAIRY],
    baseStats: { hp: 115, atk: 45, def: 20, spd: 20 },
    moves: ["pound", "sing", "disarming-voice"],
    learnableMoves: [
      { moveId: "pound", level: 1 },
      { moveId: "sing", level: 1 },
      { moveId: "disarming-voice", level: 1 },
      { moveId: "dazzling-gleam", level: 32 }
    ],
    catchRate: 170,
    evolution: { to: "wigglytuff", level: 25 },
    expYield: 95
  },
  wigglytuff: {
    id: "wigglytuff",
    name: "Wigglytuff",
    types: [TYPES.NORMAL, TYPES.FAIRY],
    baseStats: { hp: 140, atk: 70, def: 45, spd: 45 },
    moves: ["dazzling-gleam", "disarming-voice", "body-slam", "sing"],
    learnableMoves: [
      { moveId: "dazzling-gleam", level: 1 },
      { moveId: "disarming-voice", level: 1 },
      { moveId: "body-slam", level: 1 }
    ],
    catchRate: 50,
    expYield: 196
  },

  // GROUND TYPE
  diglett: {
    id: "diglett",
    name: "Diglett",
    types: [TYPES.GROUND],
    baseStats: { hp: 10, atk: 55, def: 25, spd: 95 },
    moves: ["scratch", "mud-slap"],
    learnableMoves: [
      { moveId: "scratch", level: 1 },
      { moveId: "mud-slap", level: 1 },
      { moveId: "dig", level: 18 },
      { moveId: "earthquake", level: 35 }
    ],
    catchRate: 255,
    evolution: { to: "dugtrio", level: 26 },
    expYield: 53
  },
  dugtrio: {
    id: "dugtrio",
    name: "Dugtrio",
    types: [TYPES.GROUND],
    baseStats: { hp: 35, atk: 100, def: 50, spd: 120 },
    moves: ["earthquake", "dig", "slash", "mud-slap"],
    learnableMoves: [
      { moveId: "earthquake", level: 1 },
      { moveId: "dig", level: 1 },
      { moveId: "slash", level: 1 }
    ],
    catchRate: 50,
    expYield: 149
  },

  // WATER TYPES
  magikarp: {
    id: "magikarp",
    name: "Magikarp",
    types: [TYPES.WATER],
    baseStats: { hp: 20, atk: 10, def: 55, spd: 80 },
    moves: ["splash", "tackle"],
    learnableMoves: [
      { moveId: "splash", level: 1 },
      { moveId: "tackle", level: 15 }
    ],
    catchRate: 255,
    evolution: { to: "gyarados", level: 20 },
    expYield: 40
  },
  gyarados: {
    id: "gyarados",
    name: "Gyarados",
    types: [TYPES.WATER, TYPES.FLYING],
    baseStats: { hp: 95, atk: 125, def: 79, spd: 81 },
    moves: ["hydro-pump", "dragon-rage", "bite", "thrash"],
    learnableMoves: [
      { moveId: "hydro-pump", level: 1 },
      { moveId: "dragon-rage", level: 1 },
      { moveId: "bite", level: 1 },
      { moveId: "hyper-beam", level: 50 }
    ],
    catchRate: 45,
    expYield: 189
  },
  lapras: {
    id: "lapras",
    name: "Lapras",
    types: [TYPES.WATER, TYPES.ICE],
    baseStats: { hp: 130, atk: 85, def: 80, spd: 60 },
    moves: ["ice-beam", "hydro-pump", "body-slam", "sing"],
    learnableMoves: [
      { moveId: "ice-beam", level: 1 },
      { moveId: "hydro-pump", level: 1 },
      { moveId: "body-slam", level: 1 },
      { moveId: "blizzard", level: 50 }
    ],
    catchRate: 45,
    expYield: 187
  },
  psyduck: {
    id: "psyduck",
    name: "Psyduck",
    types: [TYPES.WATER],
    baseStats: { hp: 50, atk: 52, def: 48, spd: 55 },
    moves: ["water-gun", "confusion", "scratch"],
    learnableMoves: [
      { moveId: "water-gun", level: 1 },
      { moveId: "confusion", level: 1 },
      { moveId: "scratch", level: 1 },
      { moveId: "psychic", level: 33 }
    ],
    catchRate: 190,
    evolution: { to: "golduck", level: 33 },
    expYield: 64
  },
  golduck: {
    id: "golduck",
    name: "Golduck",
    types: [TYPES.WATER],
    baseStats: { hp: 80, atk: 82, def: 78, spd: 85 },
    moves: ["hydro-pump", "psychic", "confusion", "water-gun"],
    learnableMoves: [
      { moveId: "hydro-pump", level: 1 },
      { moveId: "psychic", level: 1 },
      { moveId: "ice-beam", level: 45 }
    ],
    catchRate: 75,
    expYield: 175
  },

  // STEEL TYPE
  magnemite: {
    id: "magnemite",
    name: "Magnemite",
    types: [TYPES.ELECTRIC, TYPES.STEEL],
    baseStats: { hp: 25, atk: 35, def: 70, spd: 45 },
    moves: ["thunder-shock", "tackle"],
    learnableMoves: [
      { moveId: "thunder-shock", level: 1 },
      { moveId: "tackle", level: 1 },
      { moveId: "spark", level: 17 },
      { moveId: "thunderbolt", level: 30 }
    ],
    catchRate: 190,
    evolution: { to: "magneton", level: 30 },
    expYield: 65
  },
  magneton: {
    id: "magneton",
    name: "Magneton",
    types: [TYPES.ELECTRIC, TYPES.STEEL],
    baseStats: { hp: 50, atk: 60, def: 95, spd: 70 },
    moves: ["thunderbolt", "flash-cannon", "spark", "thunder-shock"],
    learnableMoves: [
      { moveId: "thunderbolt", level: 1 },
      { moveId: "flash-cannon", level: 1 },
      { moveId: "thunder", level: 46 }
    ],
    catchRate: 60,
    expYield: 163
  }
};

export function getSpecies(id: string): SpeciesData | undefined {
  return SPECIES[id];
}

export function canEvolve(speciesId: string, level: number): boolean {
  const species = SPECIES[speciesId];
  return !!(species?.evolution && level >= species.evolution.level);
}

export function getEvolution(speciesId: string): string | undefined {
  return SPECIES[speciesId]?.evolution?.to;
}
