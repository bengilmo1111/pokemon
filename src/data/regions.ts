import { BIOMES } from "./biomes";
import { TypeId } from "./types";

export interface ZoneData {
  id: string;
  name: string;
  biome: keyof typeof BIOMES;
  x: number;
  y: number;
  r: number;
  shape?: "circle" | "ellipse" | "blob" | "rounded";
  rotation?: number; // For ellipses - rotation in degrees
}

export interface GymData {
  id: string;
  name: string;
  x: number;
  y: number;
  color: number;
  leader: string;
  badge: string;
  team: { speciesId: string; level: number }[];
  /** Specialist type, for flavor/UI. */
  type?: TypeId;
  /** Leader title shown before the name, e.g. "the Rock-Solid". */
  title?: string;
  /** Trainer sprite key (assets/trainers) for the leader. */
  sprite?: string;
}

export interface TownData {
  id: string;
  name: string;
  x: number;
  y: number;
  services: string[];
}

export interface LandmarkData {
  id: string;
  name: string;
  x: number;
  y: number;
  color: number;
}

export interface RouteData {
  id: string;
  name: string;
  from: string;
  to: string;
  color: number;
}

export interface PowerSpotData {
  id: string;
  name: string;
  x: number;
  y: number;
  color: number;
  effect: "heal" | "xpboost" | "rarepokemon";
}

export interface PortalData {
  id: string;
  name: string;
  x: number;
  y: number;
  targetRegionIndex: number;
  targetX: number;
  targetY: number;
  color: number;
}

export interface RegionData {
  id: string;
  name: string;
  zones: ZoneData[];
  towns: TownData[];
  landmarks: LandmarkData[];
  routes: RouteData[];
  gyms: GymData[];
  powerSpots: PowerSpotData[];
  portals: PortalData[];
}

export const REGIONS: RegionData[] = [
  {
    id: "kanto",
    name: "Kanto",
    zones: [
      { id: "route-1", name: "Route 1", biome: "plains", x: -40, y: 20, r: 18, shape: "ellipse", rotation: 30 },
      { id: "viridian-forest", name: "Viridian Forest", biome: "forest", x: -38, y: -2, r: 18, shape: "blob" },
      { id: "mt-moon", name: "Mt. Moon", biome: "cave", x: -14, y: -22, r: 16, shape: "rounded" },
      { id: "cerulean-cape", name: "Cerulean Cape", biome: "lake", x: 6, y: -26, r: 16, shape: "ellipse", rotation: -20 },
      { id: "rock-tunnel", name: "Rock Tunnel", biome: "cave", x: 22, y: -16, r: 14, shape: "rounded" },
      { id: "power-plant", name: "Power Plant", biome: "powerplant", x: 30, y: -4, r: 14, shape: "rounded" },
      { id: "pokemon-tower", name: "Pokémon Tower", biome: "ruins", x: 26, y: 6, r: 13, shape: "rounded" },
      { id: "safari-zone", name: "Safari Zone", biome: "marsh", x: -4, y: 30, r: 18, shape: "blob" },
      { id: "seafoam", name: "Seafoam Islands", biome: "tundra", x: -16, y: 40, r: 14, shape: "blob" },
      { id: "cinnabar-volcano", name: "Cinnabar Volcano", biome: "volcano", x: 2, y: 46, r: 14, shape: "rounded" },
      { id: "victory-road", name: "Victory Road", biome: "mountain", x: 40, y: 28, r: 16, shape: "rounded" }
    ],
    towns: [
      { id: "pallet", name: "Pallet Town", x: -44, y: 30, services: ["center", "mart"] },
      { id: "viridian", name: "Viridian City", x: -42, y: 10, services: ["center", "mart"] },
      { id: "pewter", name: "Pewter City", x: -26, y: -14, services: ["center", "mart"] },
      { id: "cerulean", name: "Cerulean City", x: 0, y: -20, services: ["center", "mart"] },
      { id: "vermilion", name: "Vermilion City", x: 6, y: -2, services: ["center", "mart", "school"] },
      { id: "lavender", name: "Lavender Town", x: 30, y: 2, services: ["center"] },
      { id: "celadon", name: "Celadon City", x: 14, y: 8, services: ["center", "mart", "school"] },
      { id: "saffron", name: "Saffron City", x: 16, y: -6, services: ["center", "mart"] },
      { id: "fuchsia", name: "Fuchsia City", x: 4, y: 22, services: ["center", "mart"] },
      { id: "cinnabar", name: "Cinnabar Island", x: -6, y: 44, services: ["center", "mart"] }
    ],
    landmarks: [
      { id: "indigo-plateau", name: "Indigo Plateau", x: 46, y: 34, color: 0xffd700 },
      { id: "silph-co", name: "Silph Co.", x: 18, y: -8, color: 0x60a5fa },
      { id: "game-corner", name: "Celadon Game Corner", x: 12, y: 10, color: 0xff5277 },
      { id: "pokemon-mansion", name: "Pokémon Mansion", x: -8, y: 46, color: 0xa3a3a3 }
    ],
    routes: [
      { id: "route-1r", name: "Route 1", from: "pallet", to: "viridian", color: 0xf9fafb },
      { id: "route-2r", name: "Route 2", from: "viridian", to: "pewter", color: 0xf9fafb },
      { id: "route-4r", name: "Route 4", from: "pewter", to: "cerulean", color: 0xf9fafb },
      { id: "route-6r", name: "Route 6", from: "saffron", to: "vermilion", color: 0xf9fafb },
      { id: "route-7r", name: "Route 7", from: "celadon", to: "saffron", color: 0xf9fafb }
    ],
    gyms: [
      {
        id: "pewter-gym",
        name: "Pewter Gym",
        x: -24, y: -16,
        color: 0xb8a038,
        leader: "Brock",
        title: "the Rock-Solid",
        type: "rock",
        sprite: "trainer-brock",
        badge: "Boulder Badge",
        team: [
          { speciesId: "geodude", level: 11 },
          { speciesId: "graveler", level: 13 }
        ]
      },
      {
        id: "cerulean-gym",
        name: "Cerulean Gym",
        x: 2, y: -22,
        color: 0x6890f0,
        leader: "Misty",
        title: "the Tomboyish Mermaid",
        type: "water",
        sprite: "trainer-misty",
        badge: "Cascade Badge",
        team: [
          { speciesId: "psyduck", level: 18 },
          { speciesId: "golduck", level: 21 }
        ]
      },
      {
        id: "vermilion-gym",
        name: "Vermilion Gym",
        x: 8, y: 0,
        color: 0xf8d030,
        leader: "Lt. Surge",
        title: "the Lightning American",
        type: "electric",
        sprite: "trainer-ace",
        badge: "Thunder Badge",
        team: [
          { speciesId: "magnemite", level: 21 },
          { speciesId: "pikachu", level: 18 },
          { speciesId: "raichu", level: 24 }
        ]
      },
      {
        id: "celadon-gym",
        name: "Celadon Gym",
        x: 16, y: 10,
        color: 0x78c850,
        leader: "Erika",
        title: "the Nature-Loving Princess",
        type: "grass",
        sprite: "trainer-erika",
        badge: "Rainbow Badge",
        team: [
          { speciesId: "bulbasaur", level: 27 },
          { speciesId: "ivysaur", level: 29 },
          { speciesId: "venusaur", level: 31 }
        ]
      },
      {
        id: "fuchsia-gym",
        name: "Fuchsia Gym",
        x: 6, y: 24,
        color: 0xa040a0,
        leader: "Koga",
        title: "the Poisonous Ninja Master",
        type: "poison",
        sprite: "trainer-koga",
        badge: "Soul Badge",
        team: [
          { speciesId: "beedrill", level: 37 },
          { speciesId: "nidoqueen", level: 39 },
          { speciesId: "nidoking", level: 43 }
        ]
      },
      {
        id: "saffron-gym",
        name: "Saffron Gym",
        x: 18, y: -4,
        color: 0xf85888,
        leader: "Sabrina",
        title: "the Master of Psychic",
        type: "psychic",
        sprite: "trainer-sabrina",
        badge: "Marsh Badge",
        team: [
          { speciesId: "kadabra", level: 41 },
          { speciesId: "alakazam", level: 46 }
        ]
      },
      {
        id: "cinnabar-gym",
        name: "Cinnabar Gym",
        x: -6, y: 46,
        color: 0xf08030,
        leader: "Blaine",
        title: "the Hotheaded Quiz Master",
        type: "fire",
        sprite: "trainer-ace",
        badge: "Volcano Badge",
        team: [
          { speciesId: "charmeleon", level: 45 },
          { speciesId: "flareon", level: 47 },
          { speciesId: "charizard", level: 50 }
        ]
      },
      {
        id: "viridian-gym",
        name: "Viridian Gym",
        x: -44, y: 6,
        color: 0xe0c068,
        leader: "Giovanni",
        title: "the Boss of Team Rocket",
        type: "ground",
        sprite: "trainer-giovanni",
        badge: "Earth Badge",
        team: [
          { speciesId: "dugtrio", level: 50 },
          { speciesId: "golem", level: 52 },
          { speciesId: "nidoqueen", level: 53 },
          { speciesId: "nidoking", level: 55 }
        ]
      }
    ],
    powerSpots: [
      { id: "spot-alpha", name: "Pallet Spring", x: -46, y: 36, color: 0x9f5bff, effect: "heal" },
      { id: "spot-beta", name: "Celadon Tower", x: 12, y: 12, color: 0xffcc00, effect: "xpboost" },
      { id: "spot-gamma", name: "Cerulean Cave", x: 10, y: -28, color: 0x4ade80, effect: "rarepokemon" }
    ],
    portals: [
      { id: "portal-sevii", name: "Ferry to the Sevii Islands", x: -10, y: 50, targetRegionIndex: 1, targetX: -20, targetY: 0, color: 0x9f5bff }
    ]
  },
  {
    id: "shadow",
    name: "Shadow Archipelago",
    zones: [
      { id: "dark-forest", name: "Dark Forest", biome: "forest", x: 0, y: 0, r: 20, shape: "blob" },
      { id: "volcanic", name: "Volcanic Crater", biome: "cave", x: 25, y: 15, r: 18, shape: "rounded" },
      { id: "mystic-lake", name: "Mystic Lake", biome: "lake", x: -20, y: 25, r: 16, shape: "ellipse", rotation: 15 },
      { id: "shadow-peaks", name: "Shadow Peaks", biome: "mountain", x: 10, y: -20, r: 16, shape: "rounded" }
    ],
    towns: [
      { id: "shadow-port", name: "Shadow Port", x: -25, y: -5, services: ["center", "mart"] },
      { id: "ember-village", name: "Ember Village", x: 20, y: 25, services: ["center"] }
    ],
    landmarks: [
      { id: "ancient-temple", name: "Ancient Temple", x: 30, y: -15, color: 0x6b21a8 },
      { id: "ghost-tower", name: "Ghost Tower", x: -15, y: 30, color: 0x4c1d95 }
    ],
    routes: [
      { id: "route-d", name: "Route D", from: "shadow-port", to: "ember-village", color: 0xc4b5fd }
    ],
    gyms: [
      {
        id: "shadow-gym",
        name: "Shadow Gym",
        x: 5,
        y: 10,
        color: 0x6b21a8,
        leader: "Shade",
        badge: "Shadow Badge",
        team: [
          { speciesId: "gastly", level: 22 },
          { speciesId: "haunter", level: 25 },
          { speciesId: "gengar", level: 28 }
        ]
      },
      {
        id: "dragon-gym",
        name: "Dragon Gym",
        x: 28,
        y: -18,
        color: 0xf97316,
        leader: "Drake",
        badge: "Dragon Badge",
        team: [
          { speciesId: "dratini", level: 30 },
          { speciesId: "dragonair", level: 35 },
          { speciesId: "dragonite", level: 40 }
        ]
      }
    ],
    powerSpots: [
      { id: "spot-delta", name: "Shadow Spring", x: -30, y: 15, color: 0x7c3aed, effect: "heal" },
      { id: "spot-epsilon", name: "Dragon Shrine", x: 35, y: 5, color: 0xf59e0b, effect: "xpboost" }
    ],
    portals: [
      { id: "portal-aurora", name: "Portal to Aurora Vale", x: -25, y: 0, targetRegionIndex: 0, targetX: 55, targetY: -15, color: 0x9f5bff },
      { id: "portal-shadow-to-verdania", name: "To Verdania", x: -25, y: -20, targetRegionIndex: 2, targetX: -35, targetY: -30, color: 0x9f5bff }
    ]
  },
  {
    id: "verdania",
    name: "Verdania",
    zones: [
      { id: "ancient-forest", name: "Ancient Forest", biome: "jungle", x: -5, y: -25, r: 22, shape: "blob" },
      { id: "mystic-shrine", name: "Mystic Shrine", biome: "ruins", x: 15, y: -10, r: 16, shape: "rounded" },
      { id: "bell-tower-zone", name: "Bell Tower", biome: "mountain", x: 25, y: 5, r: 14, shape: "rounded" },
      { id: "whispering-marsh", name: "Whispering Marsh", biome: "marsh", x: -20, y: 15, r: 18, shape: "blob" },
      { id: "moonlight-lake", name: "Moonlight Lake", biome: "lake", x: 0, y: 30, r: 16, shape: "ellipse", rotation: 15 },
      { id: "sacred-woods", name: "Sacred Woods", biome: "forest", x: -30, y: 5, r: 20, shape: "blob" },
      { id: "ghost-graveyard", name: "Ghost Graveyard", biome: "ruins", x: 35, y: 20, r: 15, shape: "rounded" },
      { id: "honey-grove", name: "Honey Grove", biome: "jungle", x: 10, y: 40, r: 14, shape: "blob" },
    ],
    towns: [
      { id: "bloom-town", name: "Bloom Town", x: -32, y: -8, services: ["center", "mart"] },
      { id: "shrine-village", name: "Shrine Village", x: 20, y: 0, services: ["center", "mart", "school"] },
      { id: "twilight-pier", name: "Twilight Pier", x: -15, y: 45, services: ["center", "mart"] },
    ],
    landmarks: [
      { id: "old-shrine", name: "Old Shrine Entrance", x: 18, y: -18, color: 0x9370db },
      { id: "honey-tree", name: "Golden Honey Tree", x: 12, y: 45, color: 0xffc700 },
      { id: "burial-ground", name: "Ancient Burial Ground", x: 40, y: 25, color: 0x4a4a4a },
    ],
    routes: [
      { id: "route-1v", name: "Shrine Path", from: "bloom-town", to: "shrine-village", color: 0xf9fafb },
      { id: "route-2v", name: "Marsh Road", from: "shrine-village", to: "twilight-pier", color: 0xf9fafb },
    ],
    gyms: [
      {
        id: "forest-gym-v",
        name: "Forest Gym",
        x: -28, y: 8,
        color: 0x2ecc71,
        leader: "Aria",
        badge: "Grove Badge",
        team: [
          { speciesId: "bulbasaur", level: 18 },
          { speciesId: "butterfree", level: 19 },
          { speciesId: "ivysaur", level: 21 },
        ],
      },
      {
        id: "shrine-gym-v",
        name: "Shrine Gym",
        x: 22, y: 3,
        color: 0xd4af37,
        leader: "Hikari",
        badge: "Soul Badge",
        team: [
          { speciesId: "abra", level: 24 },
          { speciesId: "haunter", level: 25 },
          { speciesId: "alakazam", level: 27 },
        ],
      },
      {
        id: "storm-gym-v",
        name: "Storm Gym",
        x: -18, y: 40,
        color: 0x3498db,
        leader: "Kai",
        badge: "Squall Badge",
        team: [
          { speciesId: "seel", level: 28 },
          { speciesId: "lapras", level: 30 },
          { speciesId: "dewgong", level: 32 },
        ],
      },
    ],
    powerSpots: [
      { id: "spot-shrine-v", name: "Blessed Shrine", x: 20, y: -12, color: 0x9f5bff, effect: "xpboost" },
      { id: "spot-grove-v", name: "Ancient Grove Spring", x: -30, y: 8, color: 0x4ade80, effect: "heal" },
      { id: "spot-moon-v", name: "Moonlight Pool", x: 2, y: 32, color: 0xc0c0ff, effect: "rarepokemon" },
    ],
    portals: [
      { id: "portal-v-to-aurora", name: "To Aurora Vale", x: -35, y: -30, targetRegionIndex: 0, targetX: 40, targetY: 35, color: 0x9f5bff },
      { id: "portal-v-to-solstice", name: "To Solstice Isles", x: 40, y: 45, targetRegionIndex: 3, targetX: -35, targetY: -30, color: 0x9f5bff },
    ],
  },
  {
    id: "solstice",
    name: "Solstice Isles",
    zones: [
      { id: "tropical-beach", name: "Tropical Beach", biome: "plains", x: -30, y: 5, r: 20, shape: "blob" },
      { id: "coral-reef", name: "Coral Reef", biome: "lake", x: 10, y: -15, r: 18, shape: "ellipse", rotation: 45 },
      { id: "volcano-island", name: "Volcano Island", biome: "volcano", x: 25, y: 10, r: 20, shape: "rounded" },
      { id: "jungle-canopy", name: "Jungle Canopy", biome: "jungle", x: -15, y: 25, r: 22, shape: "blob" },
      { id: "ocean-cave", name: "Deep Ocean Cave", biome: "cave", x: 15, y: 35, r: 16, shape: "rounded" },
      { id: "mystical-isle", name: "Mystical Isle", biome: "ruins", x: -5, y: 45, r: 14, shape: "blob" },
      { id: "fissure-valley", name: "Fissure Valley", biome: "volcano", x: 35, y: 25, r: 15, shape: "rounded" },
    ],
    towns: [
      { id: "coral-cove", name: "Coral Cove", x: -35, y: 0, services: ["center", "mart"] },
      { id: "lava-harbor", name: "Lava Harbor", x: 28, y: 15, services: ["center", "mart", "school"] },
      { id: "isle-sanctuary", name: "Island Sanctuary", x: -10, y: 50, services: ["center", "mart"] },
    ],
    landmarks: [
      { id: "volcano-peak-s", name: "Mount Solstice", x: 26, y: 12, color: 0xff4500 },
      { id: "jungle-temple-s", name: "Jungle Temple", x: -18, y: 28, color: 0x8b4513 },
      { id: "deep-trench", name: "Mariana Deep", x: 20, y: 38, color: 0x1a3a5c },
    ],
    routes: [
      { id: "route-1s", name: "Surf Route", from: "coral-cove", to: "lava-harbor", color: 0xf9fafb },
      { id: "route-2s", name: "Jungle Route", from: "lava-harbor", to: "isle-sanctuary", color: 0xf9fafb },
    ],
    gyms: [
      {
        id: "water-gym-s",
        name: "Tide Gym",
        x: -32, y: 5,
        color: 0x0ea5e9,
        leader: "Coral",
        badge: "Wave Badge",
        team: [
          { speciesId: "squirtle", level: 30 },
          { speciesId: "seel", level: 31 },
          { speciesId: "lapras", level: 33 },
        ],
      },
      {
        id: "fire-gym-s",
        name: "Blaze Gym",
        x: 30, y: 18,
        color: 0xf97316,
        leader: "Blaze",
        badge: "Magma Badge",
        team: [
          { speciesId: "charmander", level: 33 },
          { speciesId: "charmeleon", level: 35 },
          { speciesId: "charizard", level: 37 },
        ],
      },
      {
        id: "grass-gym-s",
        name: "Canopy Gym",
        x: -15, y: 32,
        color: 0x84cc16,
        leader: "Fern",
        badge: "Canopy Badge",
        team: [
          { speciesId: "bulbasaur", level: 35 },
          { speciesId: "ivysaur", level: 36 },
          { speciesId: "venusaur", level: 38 },
        ],
      },
    ],
    powerSpots: [
      { id: "spot-volcano-s", name: "Volcanic Vent", x: 25, y: 10, color: 0xff6b6b, effect: "xpboost" },
      { id: "spot-reef-s", name: "Crystal Reef", x: 12, y: -16, color: 0x4fc3f7, effect: "rarepokemon" },
      { id: "spot-temple-s", name: "Temple Spring", x: -8, y: 48, color: 0xb7d4e8, effect: "heal" },
    ],
    portals: [
      { id: "portal-s-to-verdania", name: "To Verdania", x: -38, y: -30, targetRegionIndex: 2, targetX: 40, targetY: 45, color: 0x9f5bff },
      { id: "portal-s-to-frostholm", name: "To Frostholm", x: 45, y: 5, targetRegionIndex: 4, targetX: -35, targetY: 10, color: 0x9f5bff },
    ],
  },
  {
    id: "frostholm",
    name: "Frostholm",
    zones: [
      { id: "snowy-peak", name: "Snowy Peak", biome: "tundra", x: -10, y: -20, r: 22, shape: "blob" },
      { id: "ancient-ruin-f", name: "Ancient Ruin", biome: "ruins", x: 15, y: -5, r: 16, shape: "rounded" },
      { id: "crystal-mine", name: "Crystal Mine", biome: "cave", x: 25, y: 15, r: 16, shape: "rounded" },
      { id: "misty-lake-f", name: "Misty Lake", biome: "lake", x: -5, y: 20, r: 18, shape: "ellipse", rotation: 30 },
      { id: "frosted-marsh", name: "Frosted Marsh", biome: "marsh", x: -25, y: 30, r: 18, shape: "blob" },
      { id: "sacred-mountain-f", name: "Sacred Mountain", biome: "mountain", x: 20, y: 35, r: 20, shape: "rounded" },
      { id: "glacier-cavern", name: "Glacier Cavern", biome: "tundra", x: 35, y: 20, r: 15, shape: "rounded" },
    ],
    towns: [
      { id: "snowdrift-city", name: "Snowdrift City", x: -30, y: -5, services: ["center", "mart"] },
      { id: "ruin-base", name: "Ruin Base Camp", x: 18, y: 0, services: ["center", "mart", "school"] },
      { id: "glacier-lodge", name: "Glacier Lodge", x: 35, y: 10, services: ["center", "mart"] },
    ],
    landmarks: [
      { id: "mt-eternal", name: "Mt. Eternal", x: 22, y: 36, color: 0xd4e3ff },
      { id: "ancient-statue", name: "Ancient Statue", x: 16, y: -8, color: 0x808080 },
      { id: "hot-spring", name: "Geothermal Spring", x: -16, y: 45, color: 0xff8c00 },
    ],
    routes: [
      { id: "route-1f", name: "Frost Path", from: "snowdrift-city", to: "ruin-base", color: 0xf9fafb },
      { id: "route-2f", name: "Mountain Trail", from: "ruin-base", to: "glacier-lodge", color: 0xf9fafb },
    ],
    gyms: [
      {
        id: "ice-gym-f",
        name: "Frost Gym",
        x: -28, y: -8,
        color: 0x0dd9ff,
        leader: "Frost",
        badge: "Icicle Badge",
        team: [
          { speciesId: "seel", level: 40 },
          { speciesId: "dewgong", level: 42 },
          { speciesId: "lapras", level: 44 },
        ],
      },
      {
        id: "rock-gym-f",
        name: "Boulder Gym",
        x: 20, y: 2,
        color: 0x8f97a6,
        leader: "Brix",
        badge: "Stone Badge",
        team: [
          { speciesId: "geodude", level: 41 },
          { speciesId: "graveler", level: 42 },
          { speciesId: "golem", level: 44 },
        ],
      },
      {
        id: "psychic-gym-f",
        name: "Oracle Gym",
        x: 36, y: 12,
        color: 0x9f5bff,
        leader: "Oracle",
        badge: "Spiritual Badge",
        team: [
          { speciesId: "abra", level: 44 },
          { speciesId: "alakazam", level: 45 },
          { speciesId: "gengar", level: 47 },
        ],
      },
    ],
    powerSpots: [
      { id: "spot-spring-f", name: "Geothermal Spring", x: -16, y: 45, color: 0xff6347, effect: "heal" },
      { id: "spot-ruin-f", name: "Ruin Power Nexus", x: 16, y: -6, color: 0xd4af37, effect: "xpboost" },
      { id: "spot-glacier-f", name: "Eternal Glacier", x: 36, y: 20, color: 0x00d1ff, effect: "rarepokemon" },
    ],
    portals: [
      { id: "portal-f-to-solstice", name: "To Solstice Isles", x: -38, y: 15, targetRegionIndex: 3, targetX: 45, targetY: 5, color: 0x9f5bff },
      { id: "portal-f-to-urbania", name: "To Urbania", x: 40, y: 55, targetRegionIndex: 5, targetX: -40, targetY: -35, color: 0x9f5bff },
    ],
  },
  {
    id: "urbania",
    name: "Urbania",
    zones: [
      { id: "downtown", name: "Downtown District", biome: "city", x: -20, y: -25, r: 20, shape: "blob" },
      { id: "industrial-zone", name: "Industrial Zone", biome: "city", x: 10, y: -15, r: 18, shape: "rounded" },
      { id: "badlands", name: "Badlands Desert", biome: "desert", x: 30, y: 0, r: 20, shape: "ellipse", rotation: 45 },
      { id: "dark-forest-u", name: "Dark Forest", biome: "jungle", x: -35, y: 5, r: 22, shape: "blob" },
      { id: "seaside-cliffs", name: "Seaside Cliffs", biome: "mountain", x: 0, y: 30, r: 18, shape: "rounded" },
      { id: "subway-tunnel", name: "Subway Tunnels", biome: "cave", x: -10, y: 15, r: 16, shape: "rounded" },
      { id: "harbor-pier", name: "Harbor Pier", biome: "lake", x: 15, y: 45, r: 14, shape: "ellipse" },
    ],
    towns: [
      { id: "metro-city", name: "Metro City", x: -22, y: -20, services: ["center", "mart", "school"] },
      { id: "cliff-town", name: "Cliff Town", x: 2, y: 32, services: ["center", "mart"] },
      { id: "industrial-port", name: "Industrial Port", x: 18, y: 48, services: ["center", "mart"] },
    ],
    landmarks: [
      { id: "urbania-tower", name: "Urbania Tower", x: -18, y: -28, color: 0x606060 },
      { id: "steel-factory", name: "Steel Factory", x: 12, y: -18, color: 0x808080 },
      { id: "beach-resort-u", name: "Beach Resort", x: 10, y: 50, color: 0xffc700 },
    ],
    routes: [
      { id: "route-1u", name: "Metro Boulevard", from: "metro-city", to: "cliff-town", color: 0xf9fafb },
      { id: "route-2u", name: "Harbour Road", from: "cliff-town", to: "industrial-port", color: 0xf9fafb },
    ],
    gyms: [
      {
        id: "electric-gym-u",
        name: "Circuit Gym",
        x: -20, y: -24,
        color: 0xfbbf24,
        leader: "Volta",
        badge: "Tech Badge",
        team: [
          { speciesId: "pikachu", level: 50 },
          { speciesId: "magnemite", level: 51 },
          { speciesId: "raichu", level: 53 },
        ],
      },
      {
        id: "ground-gym-u",
        name: "Badlands Gym",
        x: 32, y: 2,
        color: 0xe5c87a,
        leader: "Mirage",
        badge: "Dune Badge",
        team: [
          { speciesId: "geodude", level: 52 },
          { speciesId: "graveler", level: 53 },
          { speciesId: "golem", level: 55 },
        ],
      },
      {
        id: "ghost-gym-u",
        name: "Phantom Gym",
        x: -38, y: 8,
        color: 0x4c1d95,
        leader: "Wraith",
        badge: "Spectre Badge",
        team: [
          { speciesId: "gastly", level: 52 },
          { speciesId: "haunter", level: 54 },
          { speciesId: "gengar", level: 56 },
        ],
      },
    ],
    powerSpots: [
      { id: "spot-tower-u", name: "Tower Beacon", x: -18, y: -28, color: 0xfbbf24, effect: "xpboost" },
      { id: "spot-factory-u", name: "Power Nexus", x: 12, y: -18, color: 0xffaa00, effect: "xpboost" },
      { id: "spot-beach-u", name: "Tropical Beach Power", x: 12, y: 50, color: 0x4ade80, effect: "rarepokemon" },
    ],
    portals: [
      { id: "portal-u-to-frostholm", name: "To Frostholm", x: -42, y: -38, targetRegionIndex: 4, targetX: 40, targetY: 55, color: 0x9f5bff },
      { id: "portal-u-to-shadow", name: "To Shadow Archipelago", x: 45, y: 20, targetRegionIndex: 1, targetX: -25, targetY: 0, color: 0x9f5bff },
    ],
  },
];
