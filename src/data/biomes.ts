export interface BiomeSpawn {
  id: string;
  weight: number;
  min: number;
  max: number;
}

export interface BiomeData {
  id: string;
  name: string;
  color: number;
  spawns: BiomeSpawn[];
  props: string[];
}

export const BIOMES: Record<string, BiomeData> = {
  plains: {
    id: "plains",
    name: "Bright Plains",
    color: 0x9ad96f,
    spawns: [
      { id: "pidgey", weight: 5, min: 3, max: 6 },
      { id: "rattata", weight: 4, min: 2, max: 5 },
      { id: "pichu", weight: 2, min: 3, max: 5 },
      { id: "nidoran_f", weight: 2, min: 3, max: 6 },
      { id: "nidoran_m", weight: 2, min: 3, max: 6 },
      { id: "meowth", weight: 2, min: 3, max: 6 },
      { id: "jigglypuff", weight: 1, min: 5, max: 8 }
    ],
    props: ["tree", "tree", "bush", "flower", "flower"]
  },
  forest: {
    id: "forest",
    name: "Verdant Forest",
    color: 0x4ea362,
    spawns: [
      { id: "caterpie", weight: 4, min: 3, max: 6 },
      { id: "weedle", weight: 4, min: 3, max: 6 },
      { id: "oddish", weight: 3, min: 4, max: 7 },
      { id: "bellsprout", weight: 3, min: 4, max: 7 },
      { id: "venonat", weight: 2, min: 4, max: 7 },
      { id: "pidgey", weight: 3, min: 4, max: 7 },
      { id: "pikachu", weight: 1, min: 6, max: 9 },
      { id: "eevee", weight: 1, min: 8, max: 12 }
    ],
    props: ["tree", "tree", "tree", "bush", "flower"]
  },
  cave: {
    id: "cave",
    name: "Crystal Cavern",
    color: 0x6f7f9c,
    spawns: [
      { id: "zubat", weight: 5, min: 6, max: 10 },
      { id: "geodude", weight: 5, min: 6, max: 10 },
      { id: "diglett", weight: 3, min: 5, max: 8 },
      { id: "machop", weight: 2, min: 7, max: 10 },
      { id: "onix", weight: 2, min: 8, max: 12 },
      { id: "gastly", weight: 2, min: 8, max: 12 },
      { id: "abra", weight: 1, min: 8, max: 11 }
    ],
    props: ["crystal", "crystal", "rock", "rock"]
  },
  lake: {
    id: "lake",
    name: "Mirror Lake",
    color: 0x4f7fc9,
    spawns: [
      { id: "magikarp", weight: 6, min: 3, max: 8 },
      { id: "staryu", weight: 3, min: 5, max: 9 },
      { id: "slowpoke", weight: 3, min: 6, max: 10 },
      { id: "psyduck", weight: 3, min: 6, max: 10 },
      { id: "seel", weight: 2, min: 7, max: 11 },
      { id: "lapras", weight: 1, min: 15, max: 20 }
    ],
    props: ["waterlily", "waterlily", "reed", "reed"]
  },
  tundra: {
    id: "tundra",
    name: "Frost Tundra",
    color: 0xb7d3e8,
    spawns: [
      { id: "seel", weight: 3, min: 8, max: 12 },
      { id: "shellder", weight: 3, min: 8, max: 12 },
      { id: "jynx", weight: 2, min: 10, max: 14 },
      { id: "clefairy", weight: 2, min: 8, max: 12 },
      { id: "jigglypuff", weight: 2, min: 7, max: 11 },
      { id: "articuno", weight: 0.05, min: 50, max: 50 }
    ],
    props: ["glacier", "glacier", "rock", "snowdrift", "snowdrift"]
  },
  desert: {
    id: "desert",
    name: "Sunbaked Dunes",
    color: 0xe5c87a,
    spawns: [
      { id: "geodude", weight: 4, min: 6, max: 10 },
      { id: "diglett", weight: 3, min: 5, max: 9 },
      { id: "pidgey", weight: 2, min: 5, max: 8 },
      { id: "charmander", weight: 1, min: 8, max: 12 },
      { id: "moltres", weight: 0.05, min: 50, max: 50 }
    ],
    props: ["cactus", "rock", "rock", "boulder"]
  },
  mountain: {
    id: "mountain",
    name: "Highridge Peaks",
    color: 0x8f97a6,
    spawns: [
      { id: "geodude", weight: 4, min: 8, max: 12 },
      { id: "machop", weight: 3, min: 8, max: 12 },
      { id: "rhyhorn", weight: 3, min: 10, max: 14 },
      { id: "onix", weight: 2, min: 10, max: 14 },
      { id: "golbat", weight: 2, min: 10, max: 14 },
      { id: "pidgeotto", weight: 2, min: 10, max: 14 },
      { id: "dratini", weight: 1, min: 12, max: 16 },
      { id: "zapdos", weight: 0.05, min: 50, max: 50 }
    ],
    props: ["rockspire", "rock", "rock", "pine"]
  },
  powerplant: {
    id: "powerplant",
    name: "Spark Plant",
    color: 0xffd700,
    spawns: [
      { id: "magnemite", weight: 5, min: 8, max: 12 },
      { id: "voltorb", weight: 4, min: 8, max: 12 },
      { id: "pikachu", weight: 3, min: 8, max: 12 },
      { id: "pichu", weight: 2, min: 5, max: 8 },
      { id: "zapdos", weight: 0.1, min: 50, max: 50 }
    ],
    props: ["rock", "rock", "crystal"]
  },
  jungle: {
    id: "jungle",
    name: "Tropical Jungle",
    color: 0x2d5016,
    spawns: [
      { id: "caterpie", weight: 4, min: 15, max: 22 },
      { id: "weedle", weight: 3, min: 14, max: 20 },
      { id: "pikachu", weight: 2, min: 18, max: 26 },
      { id: "eevee", weight: 2, min: 20, max: 28 },
      { id: "nidoran_m", weight: 2, min: 19, max: 25 },
      { id: "pidgey", weight: 2, min: 15, max: 20 },
    ],
    props: ["tree", "tree", "tree", "bush", "flower", "bush"],
  },
  ruins: {
    id: "ruins",
    name: "Ancient Ruins",
    color: 0x9a8b72,
    spawns: [
      { id: "gastly", weight: 4, min: 18, max: 28 },
      { id: "drowzee", weight: 3, min: 20, max: 30 },
      { id: "abra", weight: 2, min: 22, max: 32 },
      { id: "geodude", weight: 2, min: 20, max: 28 },
      { id: "haunter", weight: 2, min: 25, max: 35 },
      { id: "hypno", weight: 1, min: 28, max: 36 },
    ],
    props: ["rockspire", "rock", "rock", "boulder", "rockspire", "rock"],
  },
  marsh: {
    id: "marsh",
    name: "Misty Marsh",
    color: 0x4a6741,
    spawns: [
      { id: "psyduck", weight: 4, min: 16, max: 24 },
      { id: "exeggcute", weight: 3, min: 18, max: 26 },
      { id: "tangela", weight: 2, min: 18, max: 26 },
      { id: "venonat", weight: 2, min: 16, max: 24 },
      { id: "nidoran_m", weight: 2, min: 17, max: 25 },
      { id: "nidoran_f", weight: 2, min: 17, max: 25 },
      { id: "lapras", weight: 1, min: 28, max: 36 },
    ],
    props: ["reed", "reed", "waterlily", "reed", "bush", "waterlily"],
  },
  city: {
    id: "city",
    name: "Urban District",
    color: 0x607080,
    spawns: [
      { id: "pikachu", weight: 3, min: 40, max: 52 },
      { id: "magnemite", weight: 4, min: 38, max: 48 },
      { id: "rattata", weight: 3, min: 35, max: 45 },
      { id: "machop", weight: 2, min: 40, max: 50 },
      { id: "abra", weight: 1, min: 42, max: 52 },
    ],
    props: ["rockspire", "rock", "boulder", "rock", "rockspire", "boulder"],
  },
  volcano: {
    id: "volcano",
    name: "Volcanic Crater",
    color: 0x8b1a00,
    spawns: [
      { id: "growlithe", weight: 4, min: 20, max: 30 },
      { id: "vulpix", weight: 3, min: 20, max: 30 },
      { id: "ponyta", weight: 3, min: 22, max: 32 },
      { id: "magmar", weight: 2, min: 24, max: 34 },
      { id: "geodude", weight: 2, min: 22, max: 32 },
      { id: "moltres", weight: 0.05, min: 50, max: 50 },
    ],
    props: ["rock", "rock", "boulder", "rockspire", "boulder"],
  },
};
