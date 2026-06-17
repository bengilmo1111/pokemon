import { BIOMES } from "./biomes";

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
    id: "aurora",
    name: "Aurora Vale",
    zones: [
      { id: "route-1", name: "Route 1", biome: "plains", x: -42, y: 6, r: 22, shape: "ellipse", rotation: 30 },
      { id: "verdant", name: "Verdant Forest", biome: "forest", x: -26, y: 26, r: 18, shape: "blob" },
      { id: "crystal", name: "Crystal Cavern", biome: "cave", x: 8, y: 10, r: 16, shape: "rounded" },
      { id: "mirror", name: "Mirror Lake", biome: "lake", x: 12, y: -10, r: 16, shape: "ellipse", rotation: -20 },
      { id: "frost", name: "Frost Tundra", biome: "tundra", x: -8, y: 44, r: 18, shape: "blob" },
      { id: "dunes", name: "Sunbaked Dunes", biome: "desert", x: 42, y: -6, r: 20, shape: "ellipse", rotation: 45 },
      { id: "peaks", name: "Highridge Peaks", biome: "mountain", x: 30, y: 30, r: 18, shape: "rounded" }
    ],
    towns: [
      { id: "sprout", name: "Sprout Town", x: -46, y: -2, services: ["center", "mart"] },
      { id: "lumen", name: "Lumen City", x: 2, y: 2, services: ["center", "mart", "school"] },
      { id: "ridge", name: "Ridgepost", x: 36, y: 22, services: ["center", "mart"] }
    ],
    landmarks: [
      { id: "ember-ruins", name: "Ember Ruins", x: 24, y: -20, color: 0xff9248 },
      { id: "old-tower", name: "Old Watchtower", x: -20, y: 38, color: 0xa3a3a3 },
      { id: "spark-plant", name: "Spark Plant", x: 50, y: 10, color: 0x60a5fa }
    ],
    routes: [
      { id: "route-a", name: "Route A", from: "sprout", to: "lumen", color: 0xf9fafb },
      { id: "route-b", name: "Route B", from: "lumen", to: "ridge", color: 0xf9fafb },
      { id: "route-c", name: "Route C", from: "lumen", to: "old-tower", color: 0xf9fafb }
    ],
    gyms: [
      {
        id: "ember-gym",
        name: "Ember Gym",
        x: 26,
        y: -14,
        color: 0xff0055,
        leader: "Kai",
        badge: "Ember Badge",
        team: [
          { speciesId: "charmander", level: 8 },
          { speciesId: "geodude", level: 10 }
        ]
      },
      {
        id: "glacier-gym",
        name: "Glacier Gym",
        x: -10,
        y: 36,
        color: 0x00d1ff,
        leader: "Nari",
        badge: "Frost Badge",
        team: [
          { speciesId: "squirtle", level: 10 },
          { speciesId: "pikachu", level: 12 }
        ]
      },
      {
        id: "summit-gym",
        name: "Summit Gym",
        x: 34,
        y: 34,
        color: 0xffaa00,
        leader: "Rook",
        badge: "Summit Badge",
        team: [
          { speciesId: "geodude", level: 12 },
          { speciesId: "pidgey", level: 14 }
        ]
      }
    ],
    powerSpots: [
      { id: "spot-alpha", name: "Healing Spring", x: -48, y: -14, color: 0x9f5bff, effect: "heal" },
      { id: "spot-beta", name: "Ancient Shrine", x: 18, y: 20, color: 0xffcc00, effect: "xpboost" },
      { id: "spot-gamma", name: "Pokemon Sanctuary", x: 50, y: 6, color: 0x4ade80, effect: "rarepokemon" }
    ],
    portals: [
      { id: "portal-shadow", name: "Portal to Shadow Isles", x: 55, y: -15, targetRegionIndex: 1, targetX: -20, targetY: 0, color: 0x9f5bff }
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
      { id: "portal-aurora", name: "Portal to Aurora Vale", x: -25, y: 0, targetRegionIndex: 0, targetX: 55, targetY: -15, color: 0x9f5bff }
    ]
  }
];
