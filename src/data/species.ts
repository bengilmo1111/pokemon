import { TYPES, TypeId } from "./types";

export interface EvolutionData {
  to: string;
  /** Level-up evolution threshold. Omit for item/friendship/trade evolutions. */
  level?: number;
  /** Inventory item id that triggers the evolution when used on the Pokémon. */
  item?: string;
  /** Friendship threshold (0–255) required to evolve on level-up. */
  friendship?: number;
  /** True if this is a trade evolution (emulated via the in-game trader). */
  trade?: boolean;
}

export interface LearnableMove {
  moveId: string;
  level: number;
}

export interface SpeciesData {
  id: string;
  name: string;
  types: TypeId[];
  // spAtk/spDef are optional: when omitted they fall back to atk/def in
  // calculateStats, so any species without canonical values keeps working.
  baseStats: { hp: number; atk: number; def: number; spd: number; spAtk?: number; spDef?: number };
  moves: string[];
  learnableMoves: LearnableMove[];
  catchRate: number;
  evolution?: EvolutionData;
  /** Multiple (branching) evolutions, e.g. Eevee's stone evolutions. */
  evolutions?: EvolutionData[];
  expYield: number;
  /** Canonical primary ability id (see data/abilities.ts). */
  ability?: string;
}

export const SPECIES: Record<string, SpeciesData> = {
  // GRASS STARTERS
  bulbasaur: {
    id: "bulbasaur",
    name: "Bulbasaur",
    types: [TYPES.GRASS, TYPES.POISON],
    baseStats: { hp: 45, atk: 49, def: 49, spd: 45, spAtk: 65, spDef: 65 },
    ability: "overgrow",
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
    baseStats: { hp: 60, atk: 62, def: 63, spd: 60, spAtk: 80, spDef: 80 },
    ability: "overgrow",
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
    baseStats: { hp: 80, atk: 82, def: 83, spd: 80, spAtk: 100, spDef: 100 },
    ability: "overgrow",
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
    baseStats: { hp: 39, atk: 52, def: 43, spd: 65, spAtk: 60, spDef: 50 },
    ability: "blaze",
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
    baseStats: { hp: 58, atk: 64, def: 58, spd: 80, spAtk: 80, spDef: 65 },
    ability: "blaze",
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
    baseStats: { hp: 78, atk: 84, def: 78, spd: 100, spAtk: 109, spDef: 85 },
    ability: "blaze",
    moves: ["flamethrower", "fire-blast", "fly", "slash"],
    learnableMoves: [
      { moveId: "flamethrower", level: 1 },
      { moveId: "fire-blast", level: 1 },
      { moveId: "fly", level: 1 },
      { moveId: "sunny-day", level: 42 },
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
    baseStats: { hp: 44, atk: 48, def: 65, spd: 43, spAtk: 50, spDef: 64 },
    ability: "torrent",
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
    baseStats: { hp: 59, atk: 63, def: 80, spd: 58, spAtk: 65, spDef: 80 },
    ability: "torrent",
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
    baseStats: { hp: 79, atk: 83, def: 100, spd: 78, spAtk: 85, spDef: 105 },
    ability: "torrent",
    moves: ["aqua-tail", "hydro-pump", "water-pulse", "bite"],
    learnableMoves: [
      { moveId: "aqua-tail", level: 1 },
      { moveId: "hydro-pump", level: 1 },
      { moveId: "water-pulse", level: 1 },
      { moveId: "rain-dance", level: 42 },
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
    baseStats: { hp: 20, atk: 40, def: 15, spd: 60, spAtk: 35, spDef: 35 },
    ability: "static",
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
    baseStats: { hp: 35, atk: 55, def: 40, spd: 90, spAtk: 50, spDef: 50 },
    ability: "static",
    moves: ["thunder-shock", "spark", "quick-attack"],
    learnableMoves: [
      { moveId: "thunder-shock", level: 1 },
      { moveId: "spark", level: 1 },
      { moveId: "quick-attack", level: 1 },
      { moveId: "thunderbolt", level: 26 },
      { moveId: "thunder", level: 42 }
    ],
    catchRate: 190,
    evolution: { to: "raichu", item: "thunderstone" },
    expYield: 112
  },
  raichu: {
    id: "raichu",
    name: "Raichu",
    types: [TYPES.ELECTRIC],
    baseStats: { hp: 60, atk: 90, def: 55, spd: 110, spAtk: 90, spDef: 80 },
    ability: "static",
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
    baseStats: { hp: 40, atk: 45, def: 40, spd: 56, spAtk: 35, spDef: 35 },
    ability: "keen",
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
    baseStats: { hp: 63, atk: 60, def: 55, spd: 71, spAtk: 50, spDef: 50 },
    ability: "keen",
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
    baseStats: { hp: 83, atk: 80, def: 75, spd: 101, spAtk: 70, spDef: 70 },
    ability: "keen",
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
    baseStats: { hp: 40, atk: 80, def: 100, spd: 20, spAtk: 30, spDef: 30 },
    ability: "sturdy",
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
    baseStats: { hp: 55, atk: 95, def: 115, spd: 35, spAtk: 45, spDef: 45 },
    ability: "sturdy",
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
    baseStats: { hp: 80, atk: 120, def: 130, spd: 45, spAtk: 55, spDef: 65 },
    ability: "sturdy",
    moves: ["earthquake", "stone-edge", "rock-slide", "magnitude"],
    learnableMoves: [
      { moveId: "earthquake", level: 1 },
      { moveId: "stone-edge", level: 1 },
      { moveId: "rock-slide", level: 1 },
      { moveId: "sandstorm", level: 40 }
    ],
    catchRate: 45,
    expYield: 223
  },

  // BUG TYPES
  caterpie: {
    id: "caterpie",
    name: "Caterpie",
    types: [TYPES.BUG],
    baseStats: { hp: 45, atk: 30, def: 35, spd: 45, spAtk: 20, spDef: 20 },
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
    baseStats: { hp: 50, atk: 20, def: 55, spd: 30, spAtk: 25, spDef: 25 },
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
    baseStats: { hp: 60, atk: 45, def: 50, spd: 70, spAtk: 90, spDef: 80 },
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
    baseStats: { hp: 40, atk: 35, def: 30, spd: 50, spAtk: 20, spDef: 20 },
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
    baseStats: { hp: 45, atk: 25, def: 50, spd: 35, spAtk: 25, spDef: 25 },
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
    baseStats: { hp: 65, atk: 90, def: 40, spd: 75, spAtk: 45, spDef: 80 },
    ability: "swarm",
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
    baseStats: { hp: 30, atk: 56, def: 35, spd: 72, spAtk: 25, spDef: 35 },
    ability: "guts",
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
    baseStats: { hp: 55, atk: 81, def: 60, spd: 97, spAtk: 50, spDef: 70 },
    ability: "guts",
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
    baseStats: { hp: 55, atk: 55, def: 50, spd: 55, spAtk: 45, spDef: 65 },
    moves: ["tackle", "quick-attack", "bite"],
    learnableMoves: [
      { moveId: "tackle", level: 1 },
      { moveId: "quick-attack", level: 1 },
      { moveId: "bite", level: 15 },
      { moveId: "swift", level: 25 }
    ],
    catchRate: 45,
    // Eevee branches by stone — see `evolutions`.
    evolutions: [
      { to: "flareon", item: "firestone" },
      { to: "vaporeon", item: "waterstone" },
      { to: "jolteon", item: "thunderstone" }
    ],
    expYield: 65
  },
  flareon: {
    id: "flareon",
    name: "Flareon",
    types: [TYPES.FIRE],
    baseStats: { hp: 65, atk: 130, def: 60, spd: 65, spAtk: 95, spDef: 110 },
    ability: "flash-fire",
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
    baseStats: { hp: 55, atk: 47, def: 52, spd: 41, spAtk: 40, spDef: 40 },
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
    baseStats: { hp: 70, atk: 62, def: 67, spd: 56, spAtk: 55, spDef: 55 },
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
    baseStats: { hp: 90, atk: 92, def: 87, spd: 76, spAtk: 75, spDef: 85 },
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
    baseStats: { hp: 46, atk: 57, def: 40, spd: 50, spAtk: 40, spDef: 40 },
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
    baseStats: { hp: 61, atk: 72, def: 57, spd: 65, spAtk: 55, spDef: 55 },
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
    baseStats: { hp: 81, atk: 102, def: 77, spd: 85, spAtk: 85, spDef: 75 },
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
    baseStats: { hp: 25, atk: 20, def: 15, spd: 90, spAtk: 105, spDef: 55 },
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
    baseStats: { hp: 40, atk: 35, def: 30, spd: 105, spAtk: 120, spDef: 70 },
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
    baseStats: { hp: 55, atk: 50, def: 45, spd: 120, spAtk: 135, spDef: 95 },
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
    baseStats: { hp: 30, atk: 35, def: 30, spd: 80, spAtk: 100, spDef: 35 },
    ability: "levitate",
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
    baseStats: { hp: 45, atk: 50, def: 45, spd: 95, spAtk: 115, spDef: 55 },
    ability: "levitate",
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
    baseStats: { hp: 60, atk: 65, def: 60, spd: 110, spAtk: 130, spDef: 75 },
    ability: "levitate",
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
    baseStats: { hp: 70, atk: 80, def: 50, spd: 35, spAtk: 35, spDef: 35 },
    ability: "guts",
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
    baseStats: { hp: 80, atk: 100, def: 70, spd: 45, spAtk: 50, spDef: 60 },
    ability: "guts",
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
    baseStats: { hp: 90, atk: 130, def: 80, spd: 55, spAtk: 65, spDef: 85 },
    ability: "guts",
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
    baseStats: { hp: 41, atk: 64, def: 45, spd: 50, spAtk: 50, spDef: 50 },
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
    baseStats: { hp: 61, atk: 84, def: 65, spd: 70, spAtk: 70, spDef: 70 },
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
    baseStats: { hp: 91, atk: 134, def: 95, spd: 80, spAtk: 100, spDef: 100 },
    ability: "intimidate",
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
    baseStats: { hp: 65, atk: 45, def: 55, spd: 45, spAtk: 45, spDef: 70 },
    ability: "thick-fat",
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
    baseStats: { hp: 90, atk: 70, def: 80, spd: 70, spAtk: 70, spDef: 95 },
    ability: "thick-fat",
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
    baseStats: { hp: 90, atk: 85, def: 100, spd: 85, spAtk: 95, spDef: 125 },
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
    baseStats: { hp: 90, atk: 90, def: 85, spd: 100, spAtk: 125, spDef: 90 },
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
    baseStats: { hp: 90, atk: 100, def: 90, spd: 90, spAtk: 125, spDef: 85 },
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
    baseStats: { hp: 70, atk: 45, def: 48, spd: 35, spAtk: 60, spDef: 65 },
    moves: ["pound", "disarming-voice"],
    learnableMoves: [
      { moveId: "pound", level: 1 },
      { moveId: "disarming-voice", level: 1 },
      { moveId: "moonblast", level: 34 },
      { moveId: "dazzling-gleam", level: 40 }
    ],
    catchRate: 150,
    evolution: { to: "clefable", item: "moonstone" },
    expYield: 113
  },
  clefable: {
    id: "clefable",
    name: "Clefable",
    types: [TYPES.FAIRY],
    baseStats: { hp: 95, atk: 70, def: 73, spd: 60, spAtk: 95, spDef: 90 },
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
    baseStats: { hp: 115, atk: 45, def: 20, spd: 20, spAtk: 45, spDef: 25 },
    moves: ["pound", "sing", "disarming-voice"],
    learnableMoves: [
      { moveId: "pound", level: 1 },
      { moveId: "sing", level: 1 },
      { moveId: "disarming-voice", level: 1 },
      { moveId: "dazzling-gleam", level: 32 }
    ],
    catchRate: 170,
    evolution: { to: "wigglytuff", item: "moonstone" },
    expYield: 95
  },
  wigglytuff: {
    id: "wigglytuff",
    name: "Wigglytuff",
    types: [TYPES.NORMAL, TYPES.FAIRY],
    baseStats: { hp: 140, atk: 70, def: 45, spd: 45, spAtk: 85, spDef: 50 },
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
    baseStats: { hp: 10, atk: 55, def: 25, spd: 95, spAtk: 35, spDef: 45 },
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
    baseStats: { hp: 35, atk: 100, def: 50, spd: 120, spAtk: 50, spDef: 70 },
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
    baseStats: { hp: 20, atk: 10, def: 55, spd: 80, spAtk: 15, spDef: 20 },
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
    baseStats: { hp: 95, atk: 125, def: 79, spd: 81, spAtk: 60, spDef: 100 },
    ability: "intimidate",
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
    baseStats: { hp: 130, atk: 85, def: 80, spd: 60, spAtk: 85, spDef: 95 },
    ability: "water-absorb",
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
    baseStats: { hp: 50, atk: 52, def: 48, spd: 55, spAtk: 65, spDef: 50 },
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
    baseStats: { hp: 80, atk: 82, def: 78, spd: 85, spAtk: 95, spDef: 80 },
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
    baseStats: { hp: 25, atk: 35, def: 70, spd: 45, spAtk: 95, spDef: 55 },
    ability: "sturdy",
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
    baseStats: { hp: 50, atk: 60, def: 95, spd: 70, spAtk: 120, spDef: 70 },
    ability: "sturdy",
    moves: ["thunderbolt", "flash-cannon", "spark", "thunder-shock"],
    learnableMoves: [
      { moveId: "thunderbolt", level: 1 },
      { moveId: "flash-cannon", level: 1 },
      { moveId: "thunder", level: 46 }
    ],
    catchRate: 60,
    expYield: 163
  },

  // GEN-1 ADDITIONS
  onix: {
    id: "onix",
    name: "Onix",
    types: [TYPES.ROCK, TYPES.GROUND],
    baseStats: { hp: 35, atk: 45, def: 160, spd: 70, spAtk: 30, spDef: 45 },
    ability: "sturdy",
    moves: ["rock-throw", "tackle", "harden"],
    learnableMoves: [
      { moveId: "rock-throw", level: 1 },
      { moveId: "tackle", level: 1 },
      { moveId: "rock-slide", level: 22 },
      { moveId: "earthquake", level: 36 },
      { moveId: "stone-edge", level: 46 }
    ],
    catchRate: 45,
    expYield: 77
  },
  rhyhorn: {
    id: "rhyhorn",
    name: "Rhyhorn",
    types: [TYPES.GROUND, TYPES.ROCK],
    baseStats: { hp: 80, atk: 85, def: 95, spd: 25, spAtk: 30, spDef: 30 },
    ability: "sturdy",
    moves: ["horn-attack", "tackle", "leer"],
    learnableMoves: [
      { moveId: "horn-attack", level: 1 },
      { moveId: "tackle", level: 1 },
      { moveId: "rock-slide", level: 24 },
      { moveId: "earthquake", level: 38 }
    ],
    catchRate: 120,
    evolution: { to: "rhydon", level: 42 },
    expYield: 69
  },
  rhydon: {
    id: "rhydon",
    name: "Rhydon",
    types: [TYPES.GROUND, TYPES.ROCK],
    baseStats: { hp: 105, atk: 130, def: 120, spd: 40, spAtk: 45, spDef: 45 },
    ability: "sturdy",
    moves: ["horn-attack", "rock-slide", "earthquake", "stone-edge"],
    learnableMoves: [
      { moveId: "horn-attack", level: 1 },
      { moveId: "rock-slide", level: 1 },
      { moveId: "earthquake", level: 40 },
      { moveId: "stone-edge", level: 50 }
    ],
    catchRate: 60,
    expYield: 170
  },
  staryu: {
    id: "staryu",
    name: "Staryu",
    types: [TYPES.WATER],
    baseStats: { hp: 30, atk: 45, def: 55, spd: 85, spAtk: 70, spDef: 55 },
    moves: ["water-gun", "tackle"],
    learnableMoves: [
      { moveId: "water-gun", level: 1 },
      { moveId: "tackle", level: 1 },
      { moveId: "water-pulse", level: 17 },
      { moveId: "surf", level: 35 }
    ],
    catchRate: 225,
    evolution: { to: "starmie", item: "waterstone" },
    expYield: 68
  },
  starmie: {
    id: "starmie",
    name: "Starmie",
    types: [TYPES.WATER, TYPES.PSYCHIC],
    baseStats: { hp: 60, atk: 75, def: 85, spd: 115, spAtk: 100, spDef: 85 },
    moves: ["surf", "psychic", "water-pulse", "confusion"],
    learnableMoves: [
      { moveId: "surf", level: 1 },
      { moveId: "psychic", level: 1 },
      { moveId: "water-pulse", level: 1 },
      { moveId: "ice-beam", level: 40 }
    ],
    catchRate: 60,
    expYield: 182
  },
  shellder: {
    id: "shellder",
    name: "Shellder",
    types: [TYPES.WATER],
    baseStats: { hp: 30, atk: 65, def: 100, spd: 40, spAtk: 45, spDef: 25 },
    moves: ["water-gun", "tackle", "withdraw"],
    learnableMoves: [
      { moveId: "water-gun", level: 1 },
      { moveId: "tackle", level: 1 },
      { moveId: "water-pulse", level: 18 },
      { moveId: "ice-beam", level: 33 }
    ],
    catchRate: 190,
    evolution: { to: "cloyster", item: "waterstone" },
    expYield: 61
  },
  cloyster: {
    id: "cloyster",
    name: "Cloyster",
    types: [TYPES.WATER, TYPES.ICE],
    baseStats: { hp: 50, atk: 95, def: 180, spd: 70, spAtk: 85, spDef: 45 },
    moves: ["surf", "ice-beam", "water-pulse", "withdraw"],
    learnableMoves: [
      { moveId: "surf", level: 1 },
      { moveId: "ice-beam", level: 1 },
      { moveId: "water-pulse", level: 1 },
      { moveId: "blizzard", level: 45 }
    ],
    catchRate: 60,
    expYield: 184
  },
  slowpoke: {
    id: "slowpoke",
    name: "Slowpoke",
    types: [TYPES.WATER, TYPES.PSYCHIC],
    baseStats: { hp: 90, atk: 65, def: 65, spd: 15, spAtk: 40, spDef: 40 },
    moves: ["water-gun", "confusion", "tackle"],
    learnableMoves: [
      { moveId: "water-gun", level: 1 },
      { moveId: "confusion", level: 1 },
      { moveId: "water-pulse", level: 22 },
      { moveId: "psychic", level: 36 }
    ],
    catchRate: 190,
    evolution: { to: "slowbro", level: 37 },
    expYield: 63
  },
  slowbro: {
    id: "slowbro",
    name: "Slowbro",
    types: [TYPES.WATER, TYPES.PSYCHIC],
    baseStats: { hp: 95, atk: 75, def: 110, spd: 30, spAtk: 100, spDef: 80 },
    moves: ["surf", "psychic", "water-pulse", "confusion"],
    learnableMoves: [
      { moveId: "surf", level: 1 },
      { moveId: "psychic", level: 1 },
      { moveId: "water-pulse", level: 1 },
      { moveId: "amnesia", level: 40 }
    ],
    catchRate: 75,
    expYield: 172
  },
  voltorb: {
    id: "voltorb",
    name: "Voltorb",
    types: [TYPES.ELECTRIC],
    baseStats: { hp: 40, atk: 30, def: 50, spd: 100, spAtk: 55, spDef: 55 },
    ability: "static",
    moves: ["thunder-shock", "tackle"],
    learnableMoves: [
      { moveId: "thunder-shock", level: 1 },
      { moveId: "tackle", level: 1 },
      { moveId: "spark", level: 17 },
      { moveId: "thunderbolt", level: 29 }
    ],
    catchRate: 190,
    evolution: { to: "electrode", level: 30 },
    expYield: 66
  },
  electrode: {
    id: "electrode",
    name: "Electrode",
    types: [TYPES.ELECTRIC],
    baseStats: { hp: 60, atk: 50, def: 70, spd: 150, spAtk: 80, spDef: 80 },
    ability: "static",
    moves: ["thunderbolt", "spark", "thunder-shock", "agility"],
    learnableMoves: [
      { moveId: "thunderbolt", level: 1 },
      { moveId: "spark", level: 1 },
      { moveId: "thunder", level: 45 }
    ],
    catchRate: 60,
    expYield: 172
  },
  oddish: {
    id: "oddish",
    name: "Oddish",
    types: [TYPES.GRASS, TYPES.POISON],
    baseStats: { hp: 45, atk: 50, def: 55, spd: 30, spAtk: 75, spDef: 65 },
    ability: "overgrow",
    moves: ["vine-whip", "poison-powder", "growl"],
    learnableMoves: [
      { moveId: "vine-whip", level: 1 },
      { moveId: "poison-powder", level: 1 },
      { moveId: "razor-leaf", level: 14 },
      { moveId: "sleep-powder", level: 18 }
    ],
    catchRate: 255,
    evolution: { to: "gloom", level: 21 },
    expYield: 64
  },
  gloom: {
    id: "gloom",
    name: "Gloom",
    types: [TYPES.GRASS, TYPES.POISON],
    baseStats: { hp: 60, atk: 65, def: 70, spd: 40, spAtk: 85, spDef: 75 },
    ability: "overgrow",
    moves: ["razor-leaf", "poison-powder", "acid"],
    learnableMoves: [
      { moveId: "razor-leaf", level: 1 },
      { moveId: "poison-powder", level: 1 },
      { moveId: "sleep-powder", level: 22 },
      { moveId: "sludge-bomb", level: 30 }
    ],
    catchRate: 120,
    evolution: { to: "vileplume", item: "leafstone" },
    expYield: 138
  },
  vileplume: {
    id: "vileplume",
    name: "Vileplume",
    types: [TYPES.GRASS, TYPES.POISON],
    baseStats: { hp: 75, atk: 80, def: 85, spd: 50, spAtk: 110, spDef: 90 },
    ability: "overgrow",
    moves: ["petal-blizzard", "sludge-bomb", "razor-leaf", "sleep-powder"],
    learnableMoves: [
      { moveId: "petal-blizzard", level: 1 },
      { moveId: "sludge-bomb", level: 1 },
      { moveId: "solar-beam", level: 45 }
    ],
    catchRate: 45,
    expYield: 221
  },
  bellsprout: {
    id: "bellsprout",
    name: "Bellsprout",
    types: [TYPES.GRASS, TYPES.POISON],
    baseStats: { hp: 50, atk: 75, def: 35, spd: 40, spAtk: 70, spDef: 30 },
    ability: "overgrow",
    moves: ["vine-whip", "growth", "poison-powder"],
    learnableMoves: [
      { moveId: "vine-whip", level: 1 },
      { moveId: "growth", level: 1 },
      { moveId: "razor-leaf", level: 15 },
      { moveId: "sleep-powder", level: 19 }
    ],
    catchRate: 255,
    evolution: { to: "weepinbell", level: 21 },
    expYield: 60
  },
  weepinbell: {
    id: "weepinbell",
    name: "Weepinbell",
    types: [TYPES.GRASS, TYPES.POISON],
    baseStats: { hp: 65, atk: 90, def: 50, spd: 55, spAtk: 85, spDef: 45 },
    ability: "overgrow",
    moves: ["razor-leaf", "acid", "poison-powder"],
    learnableMoves: [
      { moveId: "razor-leaf", level: 1 },
      { moveId: "acid", level: 1 },
      { moveId: "sleep-powder", level: 23 },
      { moveId: "sludge-bomb", level: 32 }
    ],
    catchRate: 120,
    evolution: { to: "victreebel", item: "leafstone" },
    expYield: 137
  },
  victreebel: {
    id: "victreebel",
    name: "Victreebel",
    types: [TYPES.GRASS, TYPES.POISON],
    baseStats: { hp: 80, atk: 105, def: 65, spd: 70, spAtk: 100, spDef: 70 },
    ability: "overgrow",
    moves: ["leaf-blade", "sludge-bomb", "razor-leaf", "sleep-powder"],
    learnableMoves: [
      { moveId: "leaf-blade", level: 1 },
      { moveId: "sludge-bomb", level: 1 },
      { moveId: "solar-beam", level: 45 }
    ],
    catchRate: 45,
    expYield: 221
  },
  tangela: {
    id: "tangela",
    name: "Tangela",
    types: [TYPES.GRASS],
    baseStats: { hp: 65, atk: 55, def: 115, spd: 60, spAtk: 100, spDef: 40 },
    ability: "overgrow",
    moves: ["vine-whip", "razor-leaf", "growth"],
    learnableMoves: [
      { moveId: "vine-whip", level: 1 },
      { moveId: "razor-leaf", level: 1 },
      { moveId: "energy-ball", level: 30 },
      { moveId: "solar-beam", level: 45 }
    ],
    catchRate: 45,
    expYield: 87
  },
  exeggcute: {
    id: "exeggcute",
    name: "Exeggcute",
    types: [TYPES.GRASS, TYPES.PSYCHIC],
    baseStats: { hp: 60, atk: 40, def: 80, spd: 40, spAtk: 60, spDef: 45 },
    ability: "overgrow",
    moves: ["confusion", "razor-leaf", "growth"],
    learnableMoves: [
      { moveId: "confusion", level: 1 },
      { moveId: "razor-leaf", level: 1 },
      { moveId: "psybeam", level: 19 },
      { moveId: "sleep-powder", level: 28 }
    ],
    catchRate: 90,
    evolution: { to: "exeggutor", item: "leafstone" },
    expYield: 65
  },
  exeggutor: {
    id: "exeggutor",
    name: "Exeggutor",
    types: [TYPES.GRASS, TYPES.PSYCHIC],
    baseStats: { hp: 95, atk: 95, def: 85, spd: 55, spAtk: 125, spDef: 75 },
    ability: "overgrow",
    moves: ["energy-ball", "psychic", "razor-leaf", "confusion"],
    learnableMoves: [
      { moveId: "energy-ball", level: 1 },
      { moveId: "psychic", level: 1 },
      { moveId: "solar-beam", level: 45 }
    ],
    catchRate: 45,
    expYield: 186
  },
  koffing: {
    id: "koffing",
    name: "Koffing",
    types: [TYPES.POISON],
    baseStats: { hp: 40, atk: 65, def: 95, spd: 35, spAtk: 60, spDef: 45 },
    ability: "levitate",
    moves: ["poison-sting", "tackle", "acid"],
    learnableMoves: [
      { moveId: "poison-sting", level: 1 },
      { moveId: "tackle", level: 1 },
      { moveId: "sludge-bomb", level: 24 },
      { moveId: "toxic", level: 33 }
    ],
    catchRate: 190,
    evolution: { to: "weezing", level: 35 },
    expYield: 68
  },
  weezing: {
    id: "weezing",
    name: "Weezing",
    types: [TYPES.POISON],
    baseStats: { hp: 65, atk: 90, def: 120, spd: 60, spAtk: 85, spDef: 70 },
    ability: "levitate",
    moves: ["sludge-bomb", "poison-jab", "acid", "toxic"],
    learnableMoves: [
      { moveId: "sludge-bomb", level: 1 },
      { moveId: "poison-jab", level: 1 },
      { moveId: "toxic", level: 40 }
    ],
    catchRate: 60,
    expYield: 172
  },
  grimer: {
    id: "grimer",
    name: "Grimer",
    types: [TYPES.POISON],
    baseStats: { hp: 80, atk: 80, def: 50, spd: 25, spAtk: 40, spDef: 50 },
    moves: ["poison-sting", "pound", "acid"],
    learnableMoves: [
      { moveId: "poison-sting", level: 1 },
      { moveId: "pound", level: 1 },
      { moveId: "sludge-bomb", level: 26 },
      { moveId: "toxic", level: 36 }
    ],
    catchRate: 190,
    evolution: { to: "muk", level: 38 },
    expYield: 65
  },
  muk: {
    id: "muk",
    name: "Muk",
    types: [TYPES.POISON],
    baseStats: { hp: 105, atk: 105, def: 75, spd: 50, spAtk: 65, spDef: 100 },
    moves: ["sludge-bomb", "poison-jab", "acid", "toxic"],
    learnableMoves: [
      { moveId: "sludge-bomb", level: 1 },
      { moveId: "poison-jab", level: 1 },
      { moveId: "toxic", level: 42 }
    ],
    catchRate: 75,
    expYield: 175
  },
  zubat: {
    id: "zubat",
    name: "Zubat",
    types: [TYPES.POISON, TYPES.FLYING],
    baseStats: { hp: 40, atk: 45, def: 35, spd: 55, spAtk: 30, spDef: 40 },
    moves: ["wing-attack", "bite", "leer"],
    learnableMoves: [
      { moveId: "wing-attack", level: 1 },
      { moveId: "bite", level: 1 },
      { moveId: "poison-jab", level: 18 },
      { moveId: "air-slash", level: 28 }
    ],
    catchRate: 255,
    evolution: { to: "golbat", level: 22 },
    expYield: 49
  },
  golbat: {
    id: "golbat",
    name: "Golbat",
    types: [TYPES.POISON, TYPES.FLYING],
    baseStats: { hp: 75, atk: 80, def: 70, spd: 90, spAtk: 65, spDef: 75 },
    moves: ["air-slash", "poison-jab", "wing-attack", "bite"],
    learnableMoves: [
      { moveId: "air-slash", level: 1 },
      { moveId: "poison-jab", level: 1 },
      { moveId: "crunch", level: 40 }
    ],
    catchRate: 90,
    expYield: 159
  },
  ekans: {
    id: "ekans",
    name: "Ekans",
    types: [TYPES.POISON],
    baseStats: { hp: 35, atk: 60, def: 44, spd: 55, spAtk: 40, spDef: 54 },
    ability: "intimidate",
    moves: ["poison-sting", "bite", "leer"],
    learnableMoves: [
      { moveId: "poison-sting", level: 1 },
      { moveId: "bite", level: 1 },
      { moveId: "poison-jab", level: 19 },
      { moveId: "crunch", level: 30 }
    ],
    catchRate: 255,
    evolution: { to: "arbok", level: 22 },
    expYield: 58
  },
  arbok: {
    id: "arbok",
    name: "Arbok",
    types: [TYPES.POISON],
    baseStats: { hp: 60, atk: 95, def: 69, spd: 80, spAtk: 65, spDef: 79 },
    ability: "intimidate",
    moves: ["poison-jab", "crunch", "bite", "leer"],
    learnableMoves: [
      { moveId: "poison-jab", level: 1 },
      { moveId: "crunch", level: 1 },
      { moveId: "sludge-bomb", level: 40 }
    ],
    catchRate: 90,
    expYield: 157
  },
  venonat: {
    id: "venonat",
    name: "Venonat",
    types: [TYPES.BUG, TYPES.POISON],
    baseStats: { hp: 60, atk: 55, def: 50, spd: 45, spAtk: 40, spDef: 55 },
    moves: ["tackle", "poison-sting", "confusion"],
    learnableMoves: [
      { moveId: "tackle", level: 1 },
      { moveId: "poison-sting", level: 1 },
      { moveId: "bug-bite", level: 19 },
      { moveId: "psybeam", level: 28 }
    ],
    catchRate: 190,
    evolution: { to: "venomoth", level: 31 },
    expYield: 61
  },
  venomoth: {
    id: "venomoth",
    name: "Venomoth",
    types: [TYPES.BUG, TYPES.POISON],
    baseStats: { hp: 70, atk: 65, def: 60, spd: 90, spAtk: 90, spDef: 75 },
    moves: ["bug-buzz", "sludge-bomb", "psybeam", "confusion"],
    learnableMoves: [
      { moveId: "bug-buzz", level: 1 },
      { moveId: "sludge-bomb", level: 1 },
      { moveId: "psychic", level: 40 }
    ],
    catchRate: 75,
    expYield: 158
  },
  drowzee: {
    id: "drowzee",
    name: "Drowzee",
    types: [TYPES.PSYCHIC],
    baseStats: { hp: 60, atk: 48, def: 45, spd: 42, spAtk: 43, spDef: 90 },
    moves: ["confusion", "pound", "hypnosis"],
    learnableMoves: [
      { moveId: "confusion", level: 1 },
      { moveId: "pound", level: 1 },
      { moveId: "psybeam", level: 18 },
      { moveId: "psychic", level: 33 }
    ],
    catchRate: 190,
    evolution: { to: "hypno", level: 26 },
    expYield: 66
  },
  hypno: {
    id: "hypno",
    name: "Hypno",
    types: [TYPES.PSYCHIC],
    baseStats: { hp: 85, atk: 73, def: 70, spd: 67, spAtk: 73, spDef: 115 },
    moves: ["psychic", "psybeam", "confusion", "hypnosis"],
    learnableMoves: [
      { moveId: "psychic", level: 1 },
      { moveId: "psybeam", level: 1 },
      { moveId: "dream-eater", level: 40 }
    ],
    catchRate: 75,
    expYield: 169
  },
  "mr-mime": {
    id: "mr-mime",
    name: "Mr. Mime",
    types: [TYPES.PSYCHIC, TYPES.FAIRY],
    baseStats: { hp: 40, atk: 45, def: 65, spd: 90, spAtk: 100, spDef: 120 },
    moves: ["confusion", "psybeam", "dazzling-gleam"],
    learnableMoves: [
      { moveId: "confusion", level: 1 },
      { moveId: "psybeam", level: 1 },
      { moveId: "psychic", level: 33 },
      { moveId: "dazzling-gleam", level: 40 }
    ],
    catchRate: 45,
    expYield: 161
  },
  jynx: {
    id: "jynx",
    name: "Jynx",
    types: [TYPES.ICE, TYPES.PSYCHIC],
    baseStats: { hp: 65, atk: 50, def: 35, spd: 95, spAtk: 115, spDef: 95 },
    moves: ["confusion", "icy-wind", "psybeam"],
    learnableMoves: [
      { moveId: "confusion", level: 1 },
      { moveId: "icy-wind", level: 1 },
      { moveId: "ice-beam", level: 33 },
      { moveId: "psychic", level: 40 }
    ],
    catchRate: 45,
    expYield: 159
  },
  growlithe: {
    id: "growlithe",
    name: "Growlithe",
    types: [TYPES.FIRE],
    baseStats: { hp: 55, atk: 70, def: 45, spd: 60, spAtk: 70, spDef: 50 },
    ability: "intimidate",
    moves: ["ember", "bite", "leer"],
    learnableMoves: [
      { moveId: "ember", level: 1 },
      { moveId: "bite", level: 1 },
      { moveId: "fire-fang", level: 18 },
      { moveId: "flamethrower", level: 34 }
    ],
    catchRate: 190,
    evolution: { to: "arcanine", item: "firestone" },
    expYield: 70
  },
  arcanine: {
    id: "arcanine",
    name: "Arcanine",
    types: [TYPES.FIRE],
    baseStats: { hp: 90, atk: 110, def: 80, spd: 95, spAtk: 100, spDef: 80 },
    ability: "intimidate",
    moves: ["flamethrower", "fire-fang", "crunch", "bite"],
    learnableMoves: [
      { moveId: "flamethrower", level: 1 },
      { moveId: "fire-fang", level: 1 },
      { moveId: "fire-blast", level: 45 }
    ],
    catchRate: 75,
    expYield: 194
  },
  vulpix: {
    id: "vulpix",
    name: "Vulpix",
    types: [TYPES.FIRE],
    baseStats: { hp: 38, atk: 41, def: 40, spd: 65, spAtk: 50, spDef: 65 },
    ability: "flash-fire",
    moves: ["ember", "tail-whip", "quick-attack"],
    learnableMoves: [
      { moveId: "ember", level: 1 },
      { moveId: "tail-whip", level: 1 },
      { moveId: "fire-fang", level: 18 },
      { moveId: "flamethrower", level: 34 }
    ],
    catchRate: 190,
    evolution: { to: "ninetales", item: "firestone" },
    expYield: 60
  },
  ninetales: {
    id: "ninetales",
    name: "Ninetales",
    types: [TYPES.FIRE],
    baseStats: { hp: 73, atk: 76, def: 75, spd: 100, spAtk: 81, spDef: 100 },
    ability: "flash-fire",
    moves: ["flamethrower", "fire-fang", "confuse-ray", "ember"],
    learnableMoves: [
      { moveId: "flamethrower", level: 1 },
      { moveId: "fire-fang", level: 1 },
      { moveId: "fire-blast", level: 45 }
    ],
    catchRate: 75,
    expYield: 177
  },
  ponyta: {
    id: "ponyta",
    name: "Ponyta",
    types: [TYPES.FIRE],
    baseStats: { hp: 50, atk: 85, def: 55, spd: 90, spAtk: 65, spDef: 65 },
    ability: "flash-fire",
    moves: ["ember", "tackle", "growl"],
    learnableMoves: [
      { moveId: "ember", level: 1 },
      { moveId: "tackle", level: 1 },
      { moveId: "fire-fang", level: 20 },
      { moveId: "flamethrower", level: 35 }
    ],
    catchRate: 190,
    evolution: { to: "rapidash", level: 40 },
    expYield: 82
  },
  rapidash: {
    id: "rapidash",
    name: "Rapidash",
    types: [TYPES.FIRE],
    baseStats: { hp: 65, atk: 100, def: 70, spd: 105, spAtk: 80, spDef: 80 },
    ability: "flash-fire",
    moves: ["flamethrower", "fire-fang", "horn-attack", "agility"],
    learnableMoves: [
      { moveId: "flamethrower", level: 1 },
      { moveId: "fire-fang", level: 1 },
      { moveId: "fire-blast", level: 45 }
    ],
    catchRate: 60,
    expYield: 175
  },
  magmar: {
    id: "magmar",
    name: "Magmar",
    types: [TYPES.FIRE],
    baseStats: { hp: 65, atk: 95, def: 57, spd: 93, spAtk: 100, spDef: 85 },
    ability: "flash-fire",
    moves: ["ember", "fire-fang", "flamethrower", "leer"],
    learnableMoves: [
      { moveId: "ember", level: 1 },
      { moveId: "flamethrower", level: 1 },
      { moveId: "fire-blast", level: 45 }
    ],
    catchRate: 45,
    expYield: 173
  },
  meowth: {
    id: "meowth",
    name: "Meowth",
    types: [TYPES.NORMAL],
    baseStats: { hp: 40, atk: 45, def: 35, spd: 90, spAtk: 40, spDef: 40 },
    ability: "keen",
    moves: ["scratch", "bite", "growl"],
    learnableMoves: [
      { moveId: "scratch", level: 1 },
      { moveId: "bite", level: 1 },
      { moveId: "slash", level: 20 },
      { moveId: "swift", level: 30 }
    ],
    catchRate: 255,
    evolution: { to: "persian", level: 28 },
    expYield: 58
  },
  persian: {
    id: "persian",
    name: "Persian",
    types: [TYPES.NORMAL],
    baseStats: { hp: 65, atk: 70, def: 60, spd: 115, spAtk: 65, spDef: 65 },
    ability: "keen",
    moves: ["slash", "bite", "swift", "screech"],
    learnableMoves: [
      { moveId: "slash", level: 1 },
      { moveId: "bite", level: 1 },
      { moveId: "hyper-beam", level: 45 }
    ],
    catchRate: 90,
    expYield: 154
  },
  hitmonlee: {
    id: "hitmonlee",
    name: "Hitmonlee",
    types: [TYPES.FIGHTING],
    baseStats: { hp: 50, atk: 120, def: 53, spd: 87, spAtk: 35, spDef: 110 },
    ability: "guts",
    moves: ["low-kick", "karate-chop", "leer"],
    learnableMoves: [
      { moveId: "low-kick", level: 1 },
      { moveId: "karate-chop", level: 1 },
      { moveId: "brick-break", level: 26 },
      { moveId: "cross-chop", level: 40 }
    ],
    catchRate: 45,
    expYield: 159
  },
  hitmonchan: {
    id: "hitmonchan",
    name: "Hitmonchan",
    types: [TYPES.FIGHTING],
    baseStats: { hp: 50, atk: 105, def: 79, spd: 76, spAtk: 35, spDef: 110 },
    ability: "guts",
    moves: ["karate-chop", "thunder-punch", "leer"],
    learnableMoves: [
      { moveId: "karate-chop", level: 1 },
      { moveId: "thunder-punch", level: 1 },
      { moveId: "brick-break", level: 26 },
      { moveId: "dynamic-punch", level: 40 }
    ],
    catchRate: 45,
    expYield: 159
  },
  aerodactyl: {
    id: "aerodactyl",
    name: "Aerodactyl",
    types: [TYPES.ROCK, TYPES.FLYING],
    baseStats: { hp: 80, atk: 105, def: 65, spd: 130, spAtk: 60, spDef: 75 },
    moves: ["wing-attack", "rock-slide", "bite", "ancient-power"],
    learnableMoves: [
      { moveId: "wing-attack", level: 1 },
      { moveId: "rock-slide", level: 1 },
      { moveId: "crunch", level: 33 },
      { moveId: "stone-edge", level: 45 }
    ],
    catchRate: 45,
    expYield: 180
  },
  vaporeon: {
    id: "vaporeon",
    name: "Vaporeon",
    types: [TYPES.WATER],
    baseStats: { hp: 130, atk: 65, def: 60, spd: 65, spAtk: 110, spDef: 95 },
    ability: "water-absorb",
    moves: ["water-gun", "water-pulse", "quick-attack"],
    learnableMoves: [
      { moveId: "water-gun", level: 1 },
      { moveId: "water-pulse", level: 1 },
      { moveId: "surf", level: 36 },
      { moveId: "hydro-pump", level: 45 }
    ],
    catchRate: 45,
    expYield: 184
  },
  jolteon: {
    id: "jolteon",
    name: "Jolteon",
    types: [TYPES.ELECTRIC],
    baseStats: { hp: 65, atk: 65, def: 60, spd: 130, spAtk: 110, spDef: 95 },
    ability: "volt-absorb",
    moves: ["thunder-shock", "spark", "quick-attack"],
    learnableMoves: [
      { moveId: "thunder-shock", level: 1 },
      { moveId: "spark", level: 1 },
      { moveId: "thunderbolt", level: 36 },
      { moveId: "thunder", level: 45 }
    ],
    catchRate: 45,
    expYield: 184
  }
};

export function getSpecies(id: string): SpeciesData | undefined {
  return SPECIES[id];
}

export function canEvolve(speciesId: string, level: number): boolean {
  const evo = SPECIES[speciesId]?.evolution;
  // Only level-up evolutions trigger automatically on level gain. Item/trade/
  // friendship evolutions are handled separately.
  return !!(evo && evo.level !== undefined && level >= evo.level);
}

export function getEvolution(speciesId: string): string | undefined {
  return SPECIES[speciesId]?.evolution?.to;
}
