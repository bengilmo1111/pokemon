import { MOVES } from "../data/moves";
import { REGIONS } from "../data/regions";
import { SPECIES, canEvolve, getEvolution } from "../data/species";
import { TypeId } from "../data/types";
import { randRange } from "./utils";

export type StatusEffect = "none" | "poison" | "burn" | "paralysis" | "sleep" | "freeze";

export interface PokemonInstance {
  id: string;
  speciesId: string;
  name: string;
  nickname?: string;
  types: TypeId[];
  level: number;
  exp: number;
  expToNext: number;
  moves: string[];
  maxHp: number;
  hp: number;
  stats: { hp: number; atk: number; def: number; spd: number };
  catchRate: number;
  status: StatusEffect;
}

export interface WildPokemon {
  id: string;
  speciesId: string;
  level: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  zoneId: string;
}

export interface Inventory {
  pokeball: number;
  greatball: number;
  ultraball: number;
  potion: number;
  superpotion: number;
  revive: number;
}

export interface PokedexEntry {
  seen: boolean;
  caught: boolean;
}

export interface NpcTrainer {
  id: string;
  name: string;
  sprite: string;
  x: number;
  y: number;
  team: { speciesId: string; level: number }[];
  defeated: boolean;
  dialogue: string;
}

export interface HiddenItem {
  id: string;
  x: number;
  y: number;
  item: keyof Inventory;
  amount: number;
  found: boolean;
  lastCollectedTime?: number;
  respawnTime?: number;  // Time in ms until respawn (undefined = no respawn)
}

export interface RivalEncounter {
  id: string;
  x: number;
  y: number;
  battleNumber: number;  // 1, 2, 3, etc.
  dialogue: string;
  defeatDialogue: string;
}

export interface GameState {
  regionIndex: number;
  team: PokemonInstance[];
  box: PokemonInstance[];
  wildMons: WildPokemon[];
  inventory: Inventory;
  badges: string[];
  defeatedGyms: Record<string, boolean>;
  pokedex: Record<string, PokedexEntry>;
  npcTrainers: NpcTrainer[];
  defeatedTrainers: Record<string, boolean>;
  hiddenItems: HiddenItem[];
  foundItems: Record<string, boolean>;
  totalPlayTime: number;
  rivalBattles: number;
  rivalDefeated: Record<number, boolean>;  // Track which rival encounters are done
  playerStarter: string;  // Player's chosen starter
  eliteFourDefeated: boolean;
  isChampion: boolean;
  xpMultiplier: number;  // For power spot XP boosts
  portalTargetX?: number;  // Target X position after portal transition
  portalTargetY?: number;  // Target Y position after portal transition
  tutorialSeen: boolean;  // Whether the tutorial overlay has been shown
  money: number;  // Player's current money (Pokedollars)
}

export const WORLD_SCALE = 32;

export function calculateExpToNext(level: number): number {
  // Simple exponential formula for leveling
  return Math.floor(Math.pow(level, 2.5) * 4);
}

export function calculateExpGain(defeatedSpeciesId: string, defeatedLevel: number, isTrainer: boolean, xpMultiplier = 1): number {
  const species = SPECIES[defeatedSpeciesId];
  const baseExp = species?.expYield ?? 50;
  const trainerBonus = isTrainer ? 1.5 : 1;
  return Math.floor((baseExp * defeatedLevel / 7) * trainerBonus * xpMultiplier);
}

export function calculateStats(speciesId: string, level: number) {
  const species = SPECIES[speciesId];
  const scale = 1 + (level - 1) * 0.08;
  return {
    hp: Math.floor(species.baseStats.hp * scale + 10 + level),
    atk: Math.floor(species.baseStats.atk * scale),
    def: Math.floor(species.baseStats.def * scale),
    spd: Math.floor(species.baseStats.spd * scale)
  };
}

export function makePokemon(speciesId: string, level: number): PokemonInstance {
  const species = SPECIES[speciesId];
  const stats = calculateStats(speciesId, level);

  // Get starting moves (up to 4 moves the Pokemon can learn at or below current level)
  const availableMoves = species.learnableMoves
    .filter(m => m.level <= level)
    .sort((a, b) => b.level - a.level)
    .slice(0, 4)
    .map(m => m.moveId);

  // If no moves available from learnableMoves, use default moves
  const moves = availableMoves.length > 0 ? availableMoves : species.moves.slice(0, 4);

  return {
    id: `${speciesId}-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    speciesId,
    name: species.name,
    types: species.types,
    level,
    exp: 0,
    expToNext: calculateExpToNext(level),
    moves,
    maxHp: stats.hp,
    hp: stats.hp,
    stats,
    catchRate: species.catchRate,
    status: "none"
  };
}

export function makeWildPokemon(speciesId: string, level: number, zoneId: string): WildPokemon {
  return {
    id: `${speciesId}-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    speciesId,
    level,
    x: 0,
    y: 0,
    vx: (Math.random() - 0.5) * 0.6,
    vy: (Math.random() - 0.5) * 0.6,
    zoneId
  };
}

export interface LevelUpResult {
  levelsGained: number;
  newMoves: string[];
  evolved: boolean;
  newSpeciesId?: string;
  oldName?: string;
  newName?: string;
}

export function gainExp(mon: PokemonInstance, amount: number): LevelUpResult {
  const result: LevelUpResult = {
    levelsGained: 0,
    newMoves: [],
    evolved: false
  };

  mon.exp += amount;

  while (mon.exp >= mon.expToNext && mon.level < 100) {
    mon.exp -= mon.expToNext;
    mon.level += 1;
    result.levelsGained += 1;
    mon.expToNext = calculateExpToNext(mon.level);

    // Update stats
    const newStats = calculateStats(mon.speciesId, mon.level);
    const hpIncrease = newStats.hp - mon.maxHp;
    mon.maxHp = newStats.hp;
    mon.hp = Math.min(mon.maxHp, mon.hp + hpIncrease);
    mon.stats = newStats;

    // Check for new moves
    const species = SPECIES[mon.speciesId];
    const newMove = species.learnableMoves.find(m => m.level === mon.level);
    if (newMove && !mon.moves.includes(newMove.moveId)) {
      if (mon.moves.length < 4) {
        mon.moves.push(newMove.moveId);
      } else {
        // Replace oldest move
        mon.moves.shift();
        mon.moves.push(newMove.moveId);
      }
      result.newMoves.push(newMove.moveId);
    }

    // Check for evolution
    if (canEvolve(mon.speciesId, mon.level)) {
      const newSpeciesId = getEvolution(mon.speciesId);
      if (newSpeciesId) {
        result.evolved = true;
        result.oldName = mon.name;
        result.newSpeciesId = newSpeciesId;

        // Evolve the Pokemon
        const newSpecies = SPECIES[newSpeciesId];
        mon.speciesId = newSpeciesId;
        mon.name = newSpecies.name;
        mon.types = newSpecies.types;
        result.newName = newSpecies.name;

        // Recalculate stats with new species
        const evolvedStats = calculateStats(newSpeciesId, mon.level);
        const hpRatio = mon.hp / mon.maxHp;
        mon.maxHp = evolvedStats.hp;
        mon.hp = Math.floor(mon.maxHp * hpRatio);
        mon.stats = evolvedStats;
        mon.catchRate = newSpecies.catchRate;
      }
    }
  }

  return result;
}

export function createInitialState(): GameState {
  return {
    regionIndex: 0,
    team: [],
    box: [],
    wildMons: [],
    inventory: {
      pokeball: 10,
      greatball: 0,
      ultraball: 0,
      potion: 5,
      superpotion: 0,
      revive: 1
    },
    badges: [],
    defeatedGyms: {},
    pokedex: {},
    npcTrainers: [],
    defeatedTrainers: {},
    hiddenItems: [],
    foundItems: {},
    totalPlayTime: 0,
    rivalBattles: 0,
    rivalDefeated: {},
    playerStarter: "",
    eliteFourDefeated: false,
    isChampion: false,
    xpMultiplier: 1,
    tutorialSeen: false,
    money: 500
  };
}

export function getRegion(state: GameState) {
  return REGIONS[state.regionIndex];
}

export function getMoveName(moveId: string) {
  return MOVES[moveId]?.name ?? moveId;
}

export function addToTeam(state: GameState, mon: PokemonInstance): boolean {
  if (state.team.length >= 6) return false;
  state.team.push(mon);
  markCaught(state, mon.speciesId);
  return true;
}

export function addToBox(state: GameState, mon: PokemonInstance): void {
  state.box.push(mon);
  markCaught(state, mon.speciesId);
}

export function healTeam(state: GameState): void {
  state.team.forEach((mon) => {
    mon.hp = mon.maxHp;
    mon.status = "none";
  });
}

export function usePotion(state: GameState, type: "potion" | "superpotion" = "potion"): boolean {
  const amount = type === "superpotion" ? 50 : 20;
  if (state.inventory[type] <= 0) return false;
  const target = state.team.find((mon) => mon.hp > 0 && mon.hp < mon.maxHp);
  if (!target) return false;
  state.inventory[type] -= 1;
  target.hp = Math.min(target.maxHp, target.hp + amount);
  return true;
}

export function useRevive(state: GameState): boolean {
  if (state.inventory.revive <= 0) return false;
  const target = state.team.find((mon) => mon.hp <= 0);
  if (!target) return false;
  state.inventory.revive -= 1;
  target.hp = Math.floor(target.maxHp / 2);
  target.status = "none";
  return true;
}

export function randomLevel(min: number, max: number) {
  return randRange(min, max);
}

export function markSeen(state: GameState, speciesId: string): void {
  if (!state.pokedex[speciesId]) {
    state.pokedex[speciesId] = { seen: true, caught: false };
  } else {
    state.pokedex[speciesId].seen = true;
  }
}

export function markCaught(state: GameState, speciesId: string): void {
  if (!state.pokedex[speciesId]) {
    state.pokedex[speciesId] = { seen: true, caught: true };
  } else {
    state.pokedex[speciesId].seen = true;
    state.pokedex[speciesId].caught = true;
  }
}

export function getPokedexCount(state: GameState): { seen: number; caught: number } {
  let seen = 0;
  let caught = 0;
  for (const entry of Object.values(state.pokedex)) {
    if (entry.seen) seen++;
    if (entry.caught) caught++;
  }
  return { seen, caught };
}

export function generateNpcTrainers(): NpcTrainer[] {
  return [
    {
      id: "trainer-1",
      name: "Youngster Joey",
      sprite: "trainer-youngster",
      x: -30,
      y: 12,
      team: [
        { speciesId: "rattata", level: 6 },
        { speciesId: "pidgey", level: 5 }
      ],
      defeated: false,
      dialogue: "My Rattata is in the top percentage!"
    },
    {
      id: "trainer-2",
      name: "Bug Catcher Ben",
      sprite: "trainer-bugcatcher",
      x: -18,
      y: 30,
      team: [
        { speciesId: "caterpie", level: 5 },
        { speciesId: "weedle", level: 5 },
        { speciesId: "caterpie", level: 6 }
      ],
      defeated: false,
      dialogue: "I love Bug Pokemon!"
    },
    {
      id: "trainer-3",
      name: "Lass Sara",
      sprite: "trainer-lass",
      x: 5,
      y: 15,
      team: [
        { speciesId: "jigglypuff", level: 8 },
        { speciesId: "clefairy", level: 8 }
      ],
      defeated: false,
      dialogue: "Fairy types are the cutest!"
    },
    {
      id: "trainer-4",
      name: "Hiker Mike",
      sprite: "trainer-hiker",
      x: 25,
      y: 25,
      team: [
        { speciesId: "geodude", level: 10 },
        { speciesId: "machop", level: 10 },
        { speciesId: "geodude", level: 11 }
      ],
      defeated: false,
      dialogue: "Mountain Pokemon are the strongest!"
    },
    {
      id: "trainer-5",
      name: "Swimmer Lisa",
      sprite: "trainer-swimmer",
      x: 15,
      y: -8,
      team: [
        { speciesId: "psyduck", level: 12 },
        { speciesId: "seel", level: 13 }
      ],
      defeated: false,
      dialogue: "Water Pokemon rule the waves!"
    },
    {
      id: "trainer-6",
      name: "Ace Trainer Jake",
      sprite: "trainer-ace",
      x: 40,
      y: 30,
      team: [
        { speciesId: "pidgeotto", level: 15 },
        { speciesId: "kadabra", level: 15 },
        { speciesId: "graveler", level: 16 }
      ],
      defeated: false,
      dialogue: "Think you can beat an Ace Trainer?"
    }
  ];
}

export function generateHiddenItems(): HiddenItem[] {
  // Ball items respawn after 5 minutes (300000ms) of play time
  const BALL_RESPAWN_TIME = 300000;
  return [
    { id: "item-1", x: -40, y: 0, item: "pokeball", amount: 3, found: false, respawnTime: BALL_RESPAWN_TIME },
    { id: "item-2", x: -20, y: 20, item: "potion", amount: 2, found: false },
    { id: "item-3", x: 10, y: 5, item: "greatball", amount: 2, found: false, respawnTime: BALL_RESPAWN_TIME },
    { id: "item-4", x: 20, y: -15, item: "superpotion", amount: 1, found: false },
    { id: "item-5", x: -5, y: 40, item: "revive", amount: 1, found: false },
    { id: "item-6", x: 35, y: 25, item: "ultraball", amount: 1, found: false, respawnTime: BALL_RESPAWN_TIME },
    { id: "item-7", x: 45, y: 5, item: "potion", amount: 3, found: false },
    { id: "item-8", x: 30, y: -10, item: "greatball", amount: 3, found: false, respawnTime: BALL_RESPAWN_TIME },
    // Additional pokeball spawns across the map
    { id: "item-9", x: -30, y: -10, item: "pokeball", amount: 2, found: false, respawnTime: BALL_RESPAWN_TIME },
    { id: "item-10", x: 15, y: 30, item: "pokeball", amount: 2, found: false, respawnTime: BALL_RESPAWN_TIME },
    { id: "item-11", x: -10, y: 15, item: "pokeball", amount: 3, found: false, respawnTime: BALL_RESPAWN_TIME },
    { id: "item-12", x: 40, y: 15, item: "pokeball", amount: 2, found: false, respawnTime: BALL_RESPAWN_TIME },
    { id: "item-13", x: 5, y: -20, item: "pokeball", amount: 2, found: false, respawnTime: BALL_RESPAWN_TIME },
    { id: "item-14", x: 25, y: 40, item: "greatball", amount: 1, found: false, respawnTime: BALL_RESPAWN_TIME }
  ];
}

export function collectItem(state: GameState, itemId: string): { item: string; amount: number } | null {
  const hiddenItem = state.hiddenItems.find(i => i.id === itemId && !i.found);
  if (!hiddenItem) return null;

  hiddenItem.found = true;
  hiddenItem.lastCollectedTime = state.totalPlayTime;
  state.foundItems[itemId] = true;
  state.inventory[hiddenItem.item] += hiddenItem.amount;

  return { item: hiddenItem.item, amount: hiddenItem.amount };
}

export function checkItemRespawns(state: GameState): string[] {
  const respawnedItems: string[] = [];
  for (const item of state.hiddenItems) {
    if (item.found && item.respawnTime && item.lastCollectedTime !== undefined) {
      const elapsed = state.totalPlayTime - item.lastCollectedTime;
      if (elapsed >= item.respawnTime) {
        item.found = false;
        item.lastCollectedTime = undefined;
        delete state.foundItems[item.id];
        respawnedItems.push(item.id);
      }
    }
  }
  return respawnedItems;
}

// Rival system
export function getRivalStarter(playerStarter: string): string {
  // Rival picks the starter that beats the player's choice
  const counterPicks: Record<string, string> = {
    "bulbasaur": "charmander",  // Fire beats Grass
    "charmander": "squirtle",   // Water beats Fire
    "squirtle": "bulbasaur",    // Grass beats Water
    "pikachu": "geodude"        // Ground beats Electric
  };
  return counterPicks[playerStarter] || "charmander";
}

export function generateRivalEncounters(): RivalEncounter[] {
  return [
    {
      id: "rival-1",
      x: -35,
      y: 5,
      battleNumber: 1,
      dialogue: "Hey! I've been looking for you! Let's see how strong you've gotten!",
      defeatDialogue: "Not bad... but I'll beat you next time!"
    },
    {
      id: "rival-2",
      x: 0,
      y: 25,
      battleNumber: 2,
      dialogue: "We meet again! My Pokemon have gotten way stronger!",
      defeatDialogue: "Tch... You got lucky! I'll train harder!"
    },
    {
      id: "rival-3",
      x: 30,
      y: 15,
      battleNumber: 3,
      dialogue: "This time I won't lose! Prepare yourself!",
      defeatDialogue: "How can this be?! I trained so hard..."
    },
    {
      id: "rival-4",
      x: 42,
      y: 38,
      battleNumber: 4,
      dialogue: "You've made it far... But this is where your journey ends!",
      defeatDialogue: "You've become a true Pokemon Master... I respect that."
    }
  ];
}

export function getRivalTeam(state: GameState, battleNumber: number): { speciesId: string; level: number }[] {
  const rivalStarter = getRivalStarter(state.playerStarter);

  // Get the evolved forms based on battle number
  const starterEvolutions: Record<string, string[]> = {
    "bulbasaur": ["bulbasaur", "ivysaur", "ivysaur", "venusaur"],
    "charmander": ["charmander", "charmeleon", "charmeleon", "charizard"],
    "squirtle": ["squirtle", "wartortle", "wartortle", "blastoise"],
    "geodude": ["geodude", "graveler", "graveler", "golem"]
  };

  const starterLine = starterEvolutions[rivalStarter] || ["charmander", "charmeleon", "charmeleon", "charizard"];
  const starterForm = starterLine[Math.min(battleNumber - 1, 3)];

  switch (battleNumber) {
    case 1:
      return [
        { speciesId: starterForm, level: 8 },
        { speciesId: "pidgey", level: 6 }
      ];
    case 2:
      return [
        { speciesId: starterForm, level: 18 },
        { speciesId: "pidgeotto", level: 16 },
        { speciesId: "rattata", level: 15 }
      ];
    case 3:
      return [
        { speciesId: starterForm, level: 28 },
        { speciesId: "pidgeotto", level: 25 },
        { speciesId: "raticate", level: 24 },
        { speciesId: "alakazam", level: 25 }
      ];
    case 4:
      return [
        { speciesId: starterForm, level: 40 },
        { speciesId: "pidgeot", level: 38 },
        { speciesId: "alakazam", level: 37 },
        { speciesId: "arcanine", level: 38 },
        { speciesId: "gyarados", level: 39 }
      ];
    default:
      return [{ speciesId: starterForm, level: 10 }];
  }
}
