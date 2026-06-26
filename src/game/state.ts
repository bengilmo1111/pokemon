import { rng } from "./rng";
import { MOVES } from "../data/moves";
import { REGIONS } from "../data/regions";
import { SPECIES, canEvolve, getEvolution } from "../data/species";
import { TypeId } from "../data/types";
import { NATURES, randomNature } from "../data/natures";
import { randRange } from "./utils";

function randomIvs(): NonNullable<PokemonInstance["ivs"]> {
  const r = () => Math.floor(rng() * 32);
  return { hp: r(), atk: r(), def: r(), spd: r(), spAtk: r(), spDef: r() };
}

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
  stats: { hp: number; atk: number; def: number; spd: number; spAtk: number; spDef: number };
  catchRate: number;
  status: StatusEffect;
  heldItem?: string;
  /** Nature id (see data/natures.ts); affects stat calculation. */
  nature?: string;
  /** Ability id (see data/abilities.ts). */
  ability?: string;
  /** Individual values 0–31 per stat, added into calculateStats. */
  ivs?: { hp: number; atk: number; def: number; spd: number; spAtk: number; spDef: number };
  /** Friendship 0–255, for friendship-based evolution and flavor. */
  friendship?: number;
  /** Current PP per move id (max comes from MOVES[id].pp). Lazy-initialized. */
  pp?: Record<string, number>;
}

const DEFAULT_PP = 20;

/** Max PP for a move (from the move DB, with a sane fallback). */
export function getMaxPp(moveId: string): number {
  return MOVES[moveId]?.pp ?? DEFAULT_PP;
}

/** Current PP for a move, lazily initialized to its max. */
export function getMovePp(mon: PokemonInstance, moveId: string): number {
  if (!mon.pp) mon.pp = {};
  if (mon.pp[moveId] === undefined) mon.pp[moveId] = getMaxPp(moveId);
  return mon.pp[moveId];
}

/** Spend one PP for a move (floored at 0). */
export function usePp(mon: PokemonInstance, moveId: string): void {
  const cur = getMovePp(mon, moveId);
  mon.pp![moveId] = Math.max(0, cur - 1);
}

/** Whether the Pokémon has any move with PP left. */
export function hasUsableMove(mon: PokemonInstance): boolean {
  return mon.moves.some((id) => getMovePp(mon, id) > 0);
}

/** Restore all PP (clearing the map re-lazy-inits each move to its max). */
export function restoreAllPp(mon: PokemonInstance): void {
  mon.pp = {};
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
  oranberry: number;
  luckyegg: number;
  shellbell: number;
  // Evolution stones (consumed when used on a Pokémon)
  firestone: number;
  waterstone: number;
  thunderstone: number;
  leafstone: number;
  moonstone: number;
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
  lastPlayerX?: number;  // Player world position (px) at last save; resume spawns at the nearest town
  lastPlayerY?: number;
  tutorialSeen: boolean;  // Whether the tutorial overlay has been shown
  money: number;  // Player's current money (Pokedollars)
  e4Progress: number;  // 0–4: how many E4 trainers have been defeated
  e4Trainers: NpcTrainer[];  // The four Elite Four trainers
  storyFlags: Record<string, boolean>;  // One-off scripted story beats (e.g. Team Rocket)
  legendariesCompleted: Record<string, boolean>;  // Sanctum id -> caught/defeated the legendary there
  visitedRegions: number[];  // Region indices the player has set foot in (unlocks paid town travel)
}

// ---------- Held Items ----------

export const HELD_ITEMS: Record<string, { name: string; desc: string; icon: string }> = {
  oranberry: { name: "Oran Berry",  desc: "Restores 10 HP when HP drops below 50%", icon: "O" },
  luckyegg:  { name: "Lucky Egg",   desc: "Holder earns 1.5x EXP from battles",     icon: "E" },
  shellbell: { name: "Shell Bell",  desc: "Restores 1/8 of damage dealt",            icon: "B" },
};

// ---------- Evolution Stones ----------
// Used on a Pokémon to trigger an item-based evolution (see SpeciesData.evolution.item).
export const EVO_STONES: Record<string, { name: string; desc: string; price: number }> = {
  firestone:    { name: "Fire Stone",    desc: "Evolves certain Pokémon (e.g. Eevee → Flareon).", price: 2100 },
  waterstone:   { name: "Water Stone",   desc: "A stone that radiates cool energy.",                price: 2100 },
  thunderstone: { name: "Thunder Stone", desc: "Evolves certain Pokémon (e.g. Pikachu → Raichu).",  price: 2100 },
  leafstone:    { name: "Leaf Stone",    desc: "A stone with a leaf pattern.",                       price: 2100 },
  moonstone:    { name: "Moon Stone",    desc: "Evolves Clefairy and Jigglypuff.",                   price: 2100 },
};

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

export function calculateStats(
  speciesId: string,
  level: number,
  ivs?: PokemonInstance["ivs"],
  nature?: string
) {
  const species = SPECIES[speciesId];
  const bs = species.baseStats;
  const scale = 1 + (level - 1) * 0.08;
  // spAtk/spDef fall back to physical atk/def for species without canonical values.
  const baseSpAtk = bs.spAtk ?? bs.atk;
  const baseSpDef = bs.spDef ?? bs.def;
  const nat = nature ? NATURES[nature] : undefined;
  const natMod = (stat: keyof typeof bs): number => {
    if (!nat) return 1;
    if (nat.up === stat) return 1.1;
    if (nat.down === stat) return 0.9;
    return 1;
  };
  // IVs add a small flat bonus per stat (0–31), scaled gently to fit the
  // existing balance curve rather than the canonical level/100 formula.
  const iv = (stat: keyof NonNullable<PokemonInstance["ivs"]>): number =>
    Math.floor(((ivs?.[stat] ?? 0) / 31) * (level / 8));
  return {
    hp: Math.floor(bs.hp * scale + 10 + level) + iv("hp"),
    atk: Math.floor(bs.atk * scale * natMod("atk")) + iv("atk"),
    def: Math.floor(bs.def * scale * natMod("def")) + iv("def"),
    spd: Math.floor(bs.spd * scale * natMod("spd")) + iv("spd"),
    spAtk: Math.floor(baseSpAtk * scale * natMod("spAtk")) + iv("spAtk"),
    spDef: Math.floor(baseSpDef * scale * natMod("spDef")) + iv("spDef")
  };
}

export function makePokemon(speciesId: string, level: number): PokemonInstance {
  const species = SPECIES[speciesId];
  const nature = randomNature();
  const ivs = randomIvs();
  const stats = calculateStats(speciesId, level, ivs, nature);

  // Get starting moves (up to 4 moves the Pokemon can learn at or below current level)
  const availableMoves = species.learnableMoves
    .filter(m => m.level <= level)
    .sort((a, b) => b.level - a.level)
    .slice(0, 4)
    .map(m => m.moveId);

  // If no moves available from learnableMoves, use default moves
  const moves = availableMoves.length > 0 ? availableMoves : species.moves.slice(0, 4);

  return {
    id: `${speciesId}-${Date.now()}-${Math.floor(rng() * 10000)}`,
    speciesId,
    name: species.name,
    types: species.types,
    nature,
    ivs,
    ability: species.ability,
    friendship: 70,
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
    id: `${speciesId}-${Date.now()}-${Math.floor(rng() * 10000)}`,
    speciesId,
    level,
    x: 0,
    y: 0,
    vx: (rng() - 0.5) * 0.6,
    vy: (rng() - 0.5) * 0.6,
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
  /** Moves learned at full capacity (4 moves) — the player chooses what to forget. */
  pendingMoves: string[];
}

export function gainExp(mon: PokemonInstance, amount: number): LevelUpResult {
  // Lucky Egg: 1.5× EXP
  const finalAmount = mon.heldItem === "luckyegg" ? Math.floor(amount * 1.5) : amount;

  const result: LevelUpResult = {
    levelsGained: 0,
    newMoves: [],
    pendingMoves: [],
    evolved: false
  };

  mon.exp += finalAmount;

  while (mon.exp >= mon.expToNext && mon.level < 100) {
    mon.exp -= mon.expToNext;
    mon.level += 1;
    result.levelsGained += 1;
    mon.expToNext = calculateExpToNext(mon.level);

    // Update stats
    const newStats = calculateStats(mon.speciesId, mon.level, mon.ivs, mon.nature);
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
        result.newMoves.push(newMove.moveId);
      } else {
        // Moveset is full: defer to the player to choose what to forget.
        result.pendingMoves.push(newMove.moveId);
      }
    }

    // Check for evolution
    if (canEvolve(mon.speciesId, mon.level)) {
      const newSpeciesId = getEvolution(mon.speciesId);
      if (newSpeciesId) {
        result.oldName = mon.name;
        result.newSpeciesId = newSpeciesId;
        evolveMon(mon, newSpeciesId);
        result.evolved = true;
        result.newName = mon.name;
      }
    }
  }

  return result;
}

/**
 * Mutate a Pokémon into its evolved species: update id/name/types/ability and
 * recalculate stats (preserving the current HP ratio). Shared by level-up and
 * item-based evolution.
 */
export function evolveMon(mon: PokemonInstance, newSpeciesId: string): void {
  const newSpecies = SPECIES[newSpeciesId];
  if (!newSpecies) return;
  mon.speciesId = newSpeciesId;
  mon.name = newSpecies.name;
  mon.types = newSpecies.types;
  if (newSpecies.ability) mon.ability = newSpecies.ability;
  const hpRatio = mon.maxHp > 0 ? mon.hp / mon.maxHp : 1;
  const evolvedStats = calculateStats(newSpeciesId, mon.level, mon.ivs, mon.nature);
  mon.maxHp = evolvedStats.hp;
  mon.hp = Math.max(1, Math.floor(mon.maxHp * hpRatio));
  mon.stats = evolvedStats;
  mon.catchRate = newSpecies.catchRate;
}

/**
 * Attempt to evolve a Pokémon using a held/used item (evolution stone).
 * Returns the old/new names on success, or null if the item doesn't apply.
 */
export function tryItemEvolution(mon: PokemonInstance, itemKey: string): { oldName: string; newName: string } | null {
  const species = SPECIES[mon.speciesId];
  if (!species) return null;
  // Check the single evolution plus any branching evolutions (e.g. Eevee).
  const candidates = [species.evolution, ...(species.evolutions ?? [])];
  const match = candidates.find((e) => e && e.item === itemKey);
  if (!match) return null;
  const oldName = mon.name;
  evolveMon(mon, match.to);
  return { oldName, newName: mon.name };
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
      revive: 1,
      oranberry: 0,
      luckyegg: 0,
      shellbell: 0,
      firestone: 0,
      waterstone: 0,
      thunderstone: 0,
      leafstone: 0,
      moonstone: 0
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
    money: 500,
    e4Progress: 0,
    e4Trainers: [],
    storyFlags: {},
    legendariesCompleted: {},
    visitedRegions: [0]
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
    restoreAllPp(mon);
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
    // ---- Original 6 ----
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
    },
    // ---- 6 New Trainers ----
    {
      id: "fisherman-finn",
      name: "Fisherman Finn",
      sprite: "trainer-fisherman",
      x: 18,
      y: -18,
      team: [
        { speciesId: "magikarp", level: 8 },
        { speciesId: "psyduck", level: 9 }
      ],
      defeated: false,
      dialogue: "The sea holds many secrets!"
    },
    {
      id: "psychic-vera",
      name: "Psychic Vera",
      sprite: "trainer-psychic",
      x: -15,
      y: 35,
      team: [
        { speciesId: "abra", level: 14 },
        { speciesId: "kadabra", level: 15 }
      ],
      defeated: false,
      dialogue: "I sensed you coming from a mile away."
    },
    {
      id: "hiker-derek",
      name: "Hiker Derek",
      sprite: "trainer-hiker",
      x: 22,
      y: 38,
      team: [
        { speciesId: "geodude", level: 12 },
        { speciesId: "graveler", level: 14 },
        { speciesId: "machop", level: 13 }
      ],
      defeated: false,
      dialogue: "My muscles are my greatest weapon!"
    },
    {
      id: "ace-trainer-zara",
      name: "Ace Trainer Zara",
      sprite: "trainer-ace",
      x: -30,
      y: 40,
      team: [
        { speciesId: "raichu", level: 18 },
        { speciesId: "clefable", level: 19 },
        { speciesId: "alakazam", level: 20 }
      ],
      defeated: false,
      dialogue: "I trained every single day to get here."
    },
    {
      id: "lass-mia",
      name: "Lass Mia",
      sprite: "trainer-lass",
      x: 5,
      y: -15,
      team: [
        { speciesId: "clefairy", level: 10 },
        { speciesId: "jigglypuff", level: 11 }
      ],
      defeated: false,
      dialogue: "Let's have a friendly battle!"
    },
    {
      id: "youngster-tim",
      name: "Youngster Tim",
      sprite: "trainer-youngster",
      x: -20,
      y: 15,
      team: [
        { speciesId: "pidgey", level: 7 },
        { speciesId: "rattata", level: 8 }
      ],
      defeated: false,
      dialogue: "I want to be the very best!"
    },

    // ---- Team Rocket ----
    // Grunts stationed at canon Rocket hotspots; Giovanni (Viridian Gym) is the
    // arc's boss payoff.
    {
      id: "rocket-mtmoon",
      name: "Team Rocket Grunt",
      sprite: "trainer-ace",
      x: -14, y: -22,
      team: [
        { speciesId: "rattata", level: 13 },
        { speciesId: "gastly", level: 14 }
      ],
      defeated: false,
      dialogue: "Team Rocket's after the Moon Stones! Beat it, kid — or battle me!"
    },
    {
      id: "rocket-hideout",
      name: "Team Rocket Grunt",
      sprite: "trainer-ace",
      x: 12, y: 10,
      team: [
        { speciesId: "raticate", level: 28 },
        { speciesId: "machop", level: 28 },
        { speciesId: "haunter", level: 29 }
      ],
      defeated: false,
      dialogue: "This is the Rocket Hideout! The boss won't like you snooping around."
    },
    {
      id: "rocket-silph",
      name: "Team Rocket Grunt",
      sprite: "trainer-psychic",
      x: 18, y: -8,
      team: [
        { speciesId: "raticate", level: 40 },
        { speciesId: "haunter", level: 41 },
        { speciesId: "nidoking", level: 42 }
      ],
      defeated: false,
      dialogue: "Silph Co. belongs to Team Rocket now! Giovanni's orders!"
    }
  ];
}

export function generateEliteFourTrainers(): NpcTrainer[] {
  return [
    {
      id: "e4-1",
      name: "Elite Lorelei",
      sprite: "trainer-psychic",
      x: 0, y: 0,
      team: [
        { speciesId: "dewgong",  level: 52 },
        { speciesId: "cloyster", level: 54 },
        { speciesId: "slowbro",  level: 54 },
        { speciesId: "jynx",     level: 54 },
        { speciesId: "lapras",   level: 56 }
      ],
      dialogue: "No one can get past my Pokemon!",
      defeated: false
    },
    {
      id: "e4-2",
      name: "Elite Bruno",
      sprite: "trainer-hiker",
      x: 0, y: 0,
      team: [
        { speciesId: "onix",       level: 53 },
        { speciesId: "hitmonchan", level: 55 },
        { speciesId: "hitmonlee",  level: 55 },
        { speciesId: "onix",       level: 56 },
        { speciesId: "machamp",    level: 58 }
      ],
      dialogue: "I have trained here for years!",
      defeated: false
    },
    {
      id: "e4-3",
      name: "Elite Agatha",
      sprite: "trainer-psychic",
      x: 0, y: 0,
      team: [
        { speciesId: "gengar",  level: 54 },
        { speciesId: "golbat",  level: 56 },
        { speciesId: "haunter", level: 56 },
        { speciesId: "arbok",   level: 58 },
        { speciesId: "gengar",  level: 60 }
      ],
      dialogue: "Hehehe... you have some spirit!",
      defeated: false
    },
    {
      id: "e4-4",
      name: "Champion Lance",
      sprite: "trainer-lance",
      x: 0, y: 0,
      team: [
        { speciesId: "gyarados",   level: 58 },
        { speciesId: "dragonair",  level: 60 },
        { speciesId: "dragonair",  level: 60 },
        { speciesId: "aerodactyl", level: 62 },
        { speciesId: "dragonite",  level: 65 }
      ],
      dialogue: "I am the most powerful trainer alive!",
      defeated: false
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
      x: -42,
      y: 8,
      battleNumber: 1,
      dialogue: "Yo! I'm Blue — your rival! Smell ya later? Not before I crush you!",
      defeatDialogue: "What?! I picked the better starter... Whatever. Smell ya later!"
    },
    {
      id: "rival-2",
      x: 2,
      y: -20,
      battleNumber: 2,
      dialogue: "Heh, you again. My Pokémon are way tougher now. Try to keep up!",
      defeatDialogue: "Tch... lucky win. I'm still gonna be the Champion!"
    },
    {
      id: "rival-3",
      x: 8,
      y: 0,
      battleNumber: 3,
      dialogue: "You're slowing me down. Time to remind you who's boss!",
      defeatDialogue: "No way! How are you this strong already?!"
    },
    {
      id: "rival-4",
      x: 42,
      y: 32,
      battleNumber: 4,
      dialogue: "So you made it to the Plateau too. This is the end of the road for you!",
      defeatDialogue: "...You really are something. Fine — you've earned it. Go be Champion."
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
        { speciesId: "exeggcute", level: 24 },
        { speciesId: "alakazam", level: 25 }
      ];
    case 4:
      return [
        { speciesId: "pidgeot", level: 37 },
        { speciesId: "rhydon", level: 38 },
        { speciesId: "exeggutor", level: 38 },
        { speciesId: "alakazam", level: 39 },
        { speciesId: "gyarados", level: 39 },
        { speciesId: starterForm, level: 40 }
      ];
    default:
      return [{ speciesId: starterForm, level: 10 }];
  }
}
