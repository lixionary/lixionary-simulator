// All time and resource units are abstract teaching-model units.
export const RULES = {
  width: 32, height: 20, cellCapacity: 100, reserveCapacity: 100,
  populationLimit: 500, historyLimit: 500,
  foodUse: 2, waterUse: 3, foodHarvest: 8, waterHarvest: 10,
  starvationTicks: 5, dehydrationTicks: 3,
  birthMinimum: 60, twinMinimum: 80, parentCost: 15, newbornReserve: 30,
} as const;

export type Config = {
  population: number; foodFullness: number; waterFullness: number;
  foodGrowth: number; waterGrowth: number; lifespan: number; maturity: number;
  birthChance: number; cooldown: number; initialSickness: number;
  transmission: number; recovery: number; sicknessSeverity: number; immunity: number;
};
export const DEFAULT_CONFIG: Config = {
  population: 60, foodFullness: 80, waterFullness: 80,
  foodGrowth: 0.2, waterGrowth: 0.3, lifespan: 300, maturity: 40,
  birthChance: 0.12, cooldown: 20, initialSickness: 0.05,
  transmission: 0.08, recovery: 0.025, sicknessSeverity: 3, immunity: 0,
};
export const CONFIG_LIMITS: Record<keyof Config, readonly [number, number, number]> = {
  population: [0, 500, 1], foodFullness: [0, 100, 1], waterFullness: [0, 100, 1],
  foodGrowth: [0, 2, 0.05], waterGrowth: [0, 2, 0.05],
  lifespan: [100, 1000, 10], maturity: [5, 100, 1], birthChance: [0, 1, 0.01],
  cooldown: [1, 100, 1], initialSickness: [0, 1, 0.01], transmission: [0, 1, 0.01],
  recovery: [0, 1, 0.005], sicknessSeverity: [1, 10, 0.5], immunity: [0, 500, 1],
};
export const PRESETS = [
  { name: 'Balanced habitat', hint: 'A little room to grow. Watch births, needs, and regrowth find their rhythm.', config: DEFAULT_CONFIG },
  { name: 'Resource scarcity', hint: 'Small stocks, slow renewal. A brief boom, then a bottleneck. Can a handful hold on?', config: { ...DEFAULT_CONFIG, population: 40, foodFullness: 10, waterFullness: 10, foodGrowth: 0.1, waterGrowth: 0.15, initialSickness: 0 } },
  { name: 'Disease outbreak', hint: 'A crowded habitat and a contagious illness. Recovery brings a spell of immunity. Will enough outlast the wave to rebuild?', config: { ...DEFAULT_CONFIG, population: 150, initialSickness: 0.2, transmission: 0.3, recovery: 0.03, sicknessSeverity: 5, immunity: 60 } },
] satisfies { name: string; hint: string; config: Config }[];

export type Individual = {
  id: number; x: number; y: number; age: number; lifeUsed: number; lifespan: number;
  food: number; water: number; sick: boolean; cooldown: number;
  hungryTicks: number; thirstyTicks: number; immuneTicks: number; parents: [number, number] | null;
};
export type Cell = { food: number; water: number };
export type DeathCause = 'age' | 'sickness' | 'starvation' | 'dehydration';
export type Sample = {
  tick: number; population: number; sick: number; immune: number; food: number; water: number;
  births: number; deaths: number; causes: Record<DeathCause, number>;
};
export type World = {
  config: Config; seed: number; rng: number; tick: number; nextId: number;
  cells: Cell[]; individuals: Individual[]; births: number; deaths: Record<DeathCause, number>;
  blockedBirths: number; blockedThisTick: number; history: Sample[];
};

// State belongs to the world: rendering and React replays never consume randomness.
function random(world: World): number {
  world.rng = (world.rng + 0x6D2B79F5) >>> 0;
  let n = world.rng;
  n = Math.imul(n ^ (n >>> 15), n | 1);
  n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
  return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
}
function shuffled<T>(world: World, values: T[]): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random(world) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function cellIndex(x: number, y: number): number {
  return ((y + RULES.height) % RULES.height) * RULES.width + ((x + RULES.width) % RULES.width);
}
function neighborhood(x: number, y: number): number[] {
  const cells: number[] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) cells.push(cellIndex(x + dx, y + dy));
  return cells;
}
function occupants(individuals: Individual[]): Map<number, Individual[]> {
  const map = new Map<number, Individual[]>();
  for (const p of individuals) {
    const index = cellIndex(p.x, p.y), group = map.get(index) ?? [];
    group.push(p); map.set(index, group);
  }
  return map;
}
export function offspringCount(a: Individual, b: Individual): number {
  const reserves = Math.min(a.food, a.water, b.food, b.water);
  return reserves >= RULES.twinMinimum ? 2 : reserves >= RULES.birthMinimum ? 1 : 0;
}
export function reproductionReadiness(p: Individual, config: Config): string {
  if (p.sick) return 'Recovering from sickness';
  if (p.age < config.maturity) return `Matures in ${config.maturity - p.age} ticks`;
  if (p.cooldown > 0) return `Cooldown: ${p.cooldown} ticks`;
  if (Math.min(p.food, p.water) < RULES.birthMinimum) return 'Needs more food or water';
  return Math.min(p.food, p.water) >= RULES.twinMinimum ? 'Ready · up to 2 offspring' : 'Ready · up to 1 offspring';
}
function eligible(p: Individual, config: Config): boolean {
  return !p.sick && p.age >= config.maturity && p.cooldown === 0 && Math.min(p.food, p.water) >= RULES.birthMinimum;
}
export function summarize(world: World): Sample {
  return {
    tick: world.tick, population: world.individuals.length,
    sick: world.individuals.filter(p => p.sick).length,
    immune: world.individuals.filter(p => !p.sick && p.immuneTicks > 0).length,
    food: world.cells.reduce((n, cell) => n + cell.food, 0),
    water: world.cells.reduce((n, cell) => n + cell.water, 0),
    births: world.births, deaths: Object.values(world.deaths).reduce((a, b) => a + b, 0), causes: { ...world.deaths },
  };
}
function lifespan(world: World): number { return Math.round(world.config.lifespan * (0.8 + random(world) * 0.4)); }
export function initialState(config: Config = DEFAULT_CONFIG, seed = 42): World {
  for (const key of Object.keys(CONFIG_LIMITS) as (keyof Config)[]) {
    const [min, max] = CONFIG_LIMITS[key], value = config[key];
    if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${key} must be between ${min} and ${max}.`);
  }
  for (const key of ['population', 'maturity', 'cooldown', 'lifespan', 'immunity'] as const) {
    if (!Number.isInteger(config[key])) throw new Error(`${key} must be a whole number.`);
  }
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xFFFFFFFF) throw new Error('Seed must be a whole number from 0 to 4294967295.');
  const world: World = { config: { ...config }, seed, rng: seed, tick: 0, nextId: 1, cells: [], individuals: [], births: 0,
    deaths: { age: 0, sickness: 0, starvation: 0, dehydration: 0 }, blockedBirths: 0, blockedThisTick: 0, history: [] };
  for (let i = 0; i < RULES.width * RULES.height; i++) {
    // Patchiness is multiplicative so an empty habitat is truly empty.
    const patch = 0.5 + random(world);
    world.cells.push({ food: Math.min(100, config.foodFullness * patch), water: Math.min(100, config.waterFullness * (0.5 + random(world))) });
  }
  for (let i = 0; i < config.population; i++) {
    const life = lifespan(world), age = Math.floor(random(world) * Math.min(config.maturity * 3, life * 0.5));
    world.individuals.push({ id: world.nextId++, x: Math.floor(random(world) * RULES.width), y: Math.floor(random(world) * RULES.height),
      age, lifeUsed: age, lifespan: life, food: 70 + random(world) * 25, water: 70 + random(world) * 25,
      sick: false, cooldown: 0, hungryTicks: 0, thirstyTicks: 0, immuneTicks: 0, parents: null });
  }
  const infected = Math.round(config.population * config.initialSickness);
  shuffled(world, world.individuals).slice(0, infected).forEach(p => { p.sick = true; });
  world.history.push(summarize(world));
  return world;
}

export function step(previous: World): World {
  const world: World = { ...previous, tick: previous.tick + 1, blockedThisTick: 0,
    cells: previous.cells.map(cell => ({ food: Math.min(RULES.cellCapacity, cell.food + previous.config.foodGrowth),
      water: Math.min(RULES.cellCapacity, cell.water + previous.config.waterGrowth) })),
    individuals: previous.individuals.map(p => ({ ...p })), deaths: { ...previous.deaths } };
  const config = world.config;
  const survivors: Individual[] = [];
  for (const p of shuffled(world, world.individuals)) {
    // Compare harvestable resources, weighted by relative hunger/thirst.
    const candidates = shuffled(world, neighborhood(p.x, p.y));
    const score = (index: number) => {
      const cell = world.cells[index];
      return Math.min(cell.food, RULES.foodHarvest, 100 - p.food) * (101 - p.food) / RULES.foodUse
        + Math.min(cell.water, RULES.waterHarvest, 100 - p.water) * (101 - p.water) / RULES.waterUse;
    };
    let destination = candidates[0];
    for (const index of candidates) if (score(index) > score(destination)) destination = index;
    p.x = destination % RULES.width; p.y = Math.floor(destination / RULES.width);
    const cell = world.cells[destination];
    const food = Math.min(cell.food, RULES.foodHarvest, 100 - p.food), water = Math.min(cell.water, RULES.waterHarvest, 100 - p.water);
    cell.food -= food; cell.water -= water;
    p.food = Math.max(0, p.food + food - RULES.foodUse); p.water = Math.max(0, p.water + water - RULES.waterUse);
    p.hungryTicks = p.food === 0 ? p.hungryTicks + 1 : 0;
    p.thirstyTicks = p.water === 0 ? p.thirstyTicks + 1 : 0;
    p.age++; p.lifeUsed += p.sick ? config.sicknessSeverity : 1;
    p.cooldown = Math.max(0, p.cooldown - 1);
    p.immuneTicks = Math.max(0, p.immuneTicks - 1);
    const cause: DeathCause | null = p.thirstyTicks >= RULES.dehydrationTicks ? 'dehydration'
      : p.hungryTicks >= RULES.starvationTicks ? 'starvation'
      : p.lifeUsed >= p.lifespan ? (p.lifeUsed > p.age ? 'sickness' : 'age') : null;
    if (cause) world.deaths[cause]++; else survivors.push(p);
  }
  // Snapshot contagious individuals: new infections cannot cascade within this tick.
  const sickIds = new Set(survivors.filter(p => p.sick).map(p => p.id));
  const nearby = occupants(survivors);
  for (const p of survivors) {
    if (sickIds.has(p.id)) {
      if (random(world) < config.recovery) { p.sick = false; p.immuneTicks = config.immunity; }
    } else if (p.immuneTicks === 0) {
      let contacts = 0;
      for (const index of neighborhood(p.x, p.y)) for (const other of nearby.get(index) ?? []) if (sickIds.has(other.id)) contacts++;
      if (contacts && random(world) < 1 - (1 - config.transmission) ** contacts) p.sick = true;
    }
  }
  const paired = new Set<number>(), newborns: Individual[] = [];
  for (const a of survivors) {
    if (paired.has(a.id) || !eligible(a, config)) continue;
    const candidates = neighborhood(a.x, a.y).flatMap(index => nearby.get(index) ?? [])
      .filter(b => b.id !== a.id && !paired.has(b.id) && eligible(b, config));
    if (!candidates.length) continue;
    const b = candidates[Math.floor(random(world) * candidates.length)];
    paired.add(a.id); paired.add(b.id);
    if (random(world) >= config.birthChance) continue;
    const desired = offspringCount(a, b), count = Math.min(desired, RULES.populationLimit - survivors.length - newborns.length);
    world.blockedThisTick += desired - count;
    if (!count) continue;
    for (const parent of [a, b]) {
      parent.food -= RULES.parentCost * count; parent.water -= RULES.parentCost * count; parent.cooldown = config.cooldown;
    }
    for (let i = 0; i < count; i++) newborns.push({ id: world.nextId++, x: a.x, y: a.y, age: 0, lifeUsed: 0, lifespan: lifespan(world),
      food: RULES.newbornReserve, water: RULES.newbornReserve, sick: false, cooldown: 0, hungryTicks: 0, thirstyTicks: 0, immuneTicks: 0, parents: [a.id, b.id] });
  }
  world.individuals = [...survivors, ...newborns].sort((a, b) => a.id - b.id);
  world.births += newborns.length;
  world.blockedBirths += world.blockedThisTick;
  world.history = [...previous.history.slice(-(RULES.historyLimit - 1)), summarize(world)];
  return world;
}

// Shareable runs: the seed plus every setting that differs from the defaults.
export function configToQuery(config: Config, seed: number): string {
  const params = new URLSearchParams({ seed: String(seed) });
  for (const key of Object.keys(DEFAULT_CONFIG) as (keyof Config)[]) {
    if (config[key] !== DEFAULT_CONFIG[key]) params.set(key, String(config[key]));
  }
  return params.toString();
}
// Returns null when the query names no run; throws when it names an invalid one.
export function configFromQuery(search: string): { config: Config; seed: number } | null {
  const params = new URLSearchParams(search), config = { ...DEFAULT_CONFIG };
  let found = params.has('seed');
  for (const key of Object.keys(DEFAULT_CONFIG) as (keyof Config)[]) {
    const value = params.get(key);
    if (value === null) continue;
    if (value.trim() === '') throw new Error(`${key} must be a number.`);
    config[key] = Number(value); found = true;
  }
  if (!found) return null;
  const seedText = params.get('seed'), seed = seedText === null ? 42 : seedText.trim() === '' ? NaN : Number(seedText);
  initialState(config, seed);
  return { config, seed };
}
