import { describe, expect, it } from 'vitest';
import { cellIndex, DEFAULT_CONFIG, initialState, offspringCount, PRESETS, RULES, step, summarize, type Config, type World } from './model';

function fixture(count = 2, overrides: Partial<Config> = {}): World {
  const w = initialState({ ...DEFAULT_CONFIG, population: count, initialSickness: 0, transmission: 0, recovery: 0,
    foodGrowth: 0, waterGrowth: 0, birthChance: 0, ...overrides });
  w.cells.forEach(c => { c.food = 0; c.water = 0; });
  w.individuals.forEach(p => Object.assign(p, { x: 10, y: 10, age: 50, lifeUsed: 50, lifespan: 300, food: 70, water: 70 }));
  return w;
}
function fertile(food: number, water = food): World {
  const w = fixture(2, { birthChance: 1 });
  w.cells[cellIndex(10, 10)] = { food: 100, water: 100 };
  w.individuals.forEach(p => { p.food = food; p.water = water; });
  return w;
}
function advance(w: World, ticks: number): World {
  for (let i = 0; i < ticks; i++) w = step(w);
  return w;
}
function total(w: World, resource: 'food' | 'water'): number {
  return w.cells.reduce((n, c) => n + c[resource], 0) + w.individuals.reduce((n, p) => n + p[resource], 0);
}

describe('repeatable worlds and bounded resources', () => {
  it('replays the same seed and leaves earlier snapshots untouched', () => {
    const initial = initialState(), snapshot = structuredClone(initial);
    expect(advance(initial, 100)).toEqual(advance(initialState(DEFAULT_CONFIG, 42), 100));
    expect(initial).toEqual(snapshot);
    expect(initialState(DEFAULT_CONFIG, 43).cells).not.toEqual(initial.cells);
    expect(initialState(DEFAULT_CONFIG, 0).seed).toBe(0);
  });
  it('rejects invalid inputs rather than creating nonfinite worlds', () => {
    expect(() => initialState({ ...DEFAULT_CONFIG, population: 501 })).toThrow();
    expect(() => initialState({ ...DEFAULT_CONFIG, population: 0.5 })).toThrow();
    expect(() => initialState({ ...DEFAULT_CONFIG, transmission: NaN })).toThrow();
    expect(() => initialState(DEFAULT_CONFIG, -1)).toThrow();
    expect(() => initialState(DEFAULT_CONFIG, 1.5)).toThrow();
  });
  it('regrows empty cells without a population and caps full stocks', () => {
    const w = initialState({ ...DEFAULT_CONFIG, population: 0, foodFullness: 0, waterFullness: 0, foodGrowth: 2, waterGrowth: 1 });
    const next = advance(w, 120);
    expect(next.individuals).toHaveLength(0);
    expect(next.cells.every(c => c.food === 100 && c.water === 100)).toBe(true);
    expect(next.tick).toBe(120);
  });
  it('moves toward local supplies and transfers harvested stocks into reserves', () => {
    const w = fixture(1), p = w.individuals[0];
    p.x = 0; p.y = 0; p.food = 10; p.water = 10;
    w.cells[cellIndex(-1, -1)] = { food: 40, water: 40 };
    const next = step(w), moved = next.individuals[0];
    expect([moved.x, moved.y]).toEqual([31, 19]);
    expect([moved.food, moved.water]).toEqual([16, 17]);
    expect(next.cells[cellIndex(31, 19)]).toEqual({ food: 32, water: 30 });
  });
  it('resolves competition fairly without overdrawing a shared cell', () => {
    const w = fixture(100);
    w.cells[cellIndex(10, 10)] = { food: 3, water: 4 };
    const next = step(w);
    expect(total(next, 'food')).toBeCloseTo(total(w, 'food') - 100 * RULES.foodUse);
    expect(total(next, 'water')).toBeCloseTo(total(w, 'water') - 100 * RULES.waterUse);
    expect(next.cells.every(c => c.food >= 0 && c.water >= 0)).toBe(true);
  });
  it('keeps only 500 chart samples while preserving tick and lifetime counters', () => {
    const next = advance(initialState({ ...DEFAULT_CONFIG, population: 0 }), 600);
    expect(next.history).toHaveLength(500);
    expect(next.history[0].tick).toBe(101);
    expect(next.history.at(-1)?.tick).toBe(600);
  });
});

describe('offspring and parental costs', () => {
  it.each([[53, 52, 0], [54, 53, 1], [74, 73, 2]])('reserves %i / %i produce %i offspring after feeding', (food, water, children) => {
    const w = fertile(food, water), next = step(w);
    expect(next.births).toBe(children);
    expect(next.individuals.length).toBe(2 + children);
    expect(next.individuals.slice(0, 2).every(p => p.age === 51)).toBe(true);
    expect(total(next, 'food')).toBeCloseTo(total(w, 'food') - 4);
    expect(total(next, 'water')).toBeCloseTo(total(w, 'water') - 6);
    for (const child of next.individuals.slice(2)) {
      expect(child.age).toBe(0); expect(child.lifeUsed).toBe(0); expect(child.food).toBe(30);
      expect(child.water).toBe(30); expect(child.sick).toBe(false);
      expect(new Set(child.parents)).toEqual(new Set([1, 2]));
    }
  });
  it('uses the least supplied parent and resource when deciding litter size', () => {
    const w = fertile(90), [a, b] = w.individuals;
    b.water = 59; expect(offspringCount(a, b)).toBe(0);
    b.water = 60; expect(offspringCount(a, b)).toBe(1);
    b.water = 80; expect(offspringCount(a, b)).toBe(2);
  });
  it.each(['sickness', 'immaturity', 'cooldown', 'distance', 'probability'])('prevents births for %s', condition => {
    const w = fertile(90);
    const p = w.individuals[0];
    if (condition === 'sickness') p.sick = true;
    if (condition === 'immaturity') p.age = 0;
    if (condition === 'cooldown') p.cooldown = 10;
    if (condition === 'distance') { p.x = 25; p.y = 18; }
    if (condition === 'probability') w.config.birthChance = 0;
    expect(step(w).births).toBe(0);
  });
  it('charges both parents and respects cooldown on the next tick', () => {
    const next = step(fertile(90));
    expect(next.individuals[0].food).toBe(66); expect(next.individuals[0].water).toBe(67);
    expect(next.individuals[1].food).toBe(66); expect(next.individuals[1].water).toBe(67);
    expect(next.individuals[0].cooldown).toBe(20);
    expect(step(next).births).toBe(2);
    expect(step(next).individuals.find(p => p.id === 3)?.age).toBe(1);
  });
  it('allows each parent only one pair even with many neighbors and zero random failures', () => {
    const w = fixture(20, { birthChance: 1 });
    w.cells.forEach(c => { c.food = 100; c.water = 100; });
    const next = step(w), parentIds = next.individuals.filter(p => p.parents).flatMap(p => p.parents!);
    // Twins share a pair; no founder appears in more than one distinct pair.
    const pairs = new Map<number, Set<number>>();
    next.individuals.filter(p => p.parents).forEach(p => {
      const [a, b] = p.parents!;
      pairs.set(a, (pairs.get(a) ?? new Set()).add(b)); pairs.set(b, (pairs.get(b) ?? new Set()).add(a));
    });
    expect(parentIds.length).toBeGreaterThan(0);
    expect([...pairs.values()].every(partners => partners.size === 1)).toBe(true);
  });
  it.each([499, 500])('honors the population cap starting at %i', population => {
    const w = fixture(population, { birthChance: 1 });
    w.individuals.forEach(p => { p.food = 90; p.water = 90; });
    const next = step(w);
    expect(next.individuals).toHaveLength(500);
    expect(next.births).toBe(500 - population);
    expect(next.blockedThisTick).toBeGreaterThan(0);
    expect(next.blockedBirths).toBe(next.blockedThisTick);
    expect(total(next, 'food')).toBeCloseTo(total(w, 'food') - population * RULES.foodUse);
  });
});

describe('health, mortality, and accounting', () => {
  it('kills after three ticks of empty water, without duplicate death causes', () => {
    const w = fixture(1), p = w.individuals[0];
    p.food = 0; p.water = 0;
    expect(advance(w, 2).individuals).toHaveLength(1);
    const next = advance(w, 3);
    expect(next.individuals).toHaveLength(0);
    expect(next.deaths).toEqual({ age: 0, sickness: 0, starvation: 0, dehydration: 1 });
    expect(advance(next, 10).deaths.dehydration).toBe(1);
  });
  it('kills after five empty-food ticks while water remains', () => {
    const w = fixture(1); w.individuals[0].food = 0;
    expect(advance(w, 4).individuals).toHaveLength(1);
    expect(advance(w, 5).deaths.starvation).toBe(1);
  });
  it('records old age independently of hunger and disease', () => {
    const w = fixture(1); w.individuals[0].lifespan = 51;
    expect(step(w).deaths.age).toBe(1);
  });
  it('accelerates aging while sick; recovery never restores lifespan', () => {
    const w = fixture(1, { recovery: 1, sicknessSeverity: 5 });
    w.individuals[0].sick = true;
    const recovered = step(w), p = recovered.individuals[0];
    expect(p.sick).toBe(false); expect(p.age).toBe(51); expect(p.lifeUsed).toBe(55);
    expect(step(recovered).individuals[0].lifeUsed).toBe(56);
    p.lifespan = 56;
    expect(step(recovered).deaths.sickness).toBe(1);
  });
  it('infects nearby contacts but leaves a distant individual healthy', () => {
    const w = fixture(3, { transmission: 1, recovery: 1 });
    w.cells[cellIndex(10, 10)] = { food: 100, water: 100 };
    w.individuals[0].sick = true;
    w.individuals[2].x = 25;
    const next = step(w);
    expect(next.individuals.map(p => p.sick)).toEqual([false, true, false]);
    // The new infection has not accelerated aging on its infection tick.
    expect(next.individuals[1].lifeUsed).toBe(51);
  });
  it('cannot introduce illness without an infectious individual', () => {
    const next = advance(initialState({ ...DEFAULT_CONFIG, initialSickness: 0, transmission: 1 }), 200);
    expect(next.history.every(s => s.sick === 0)).toBe(true);
    expect(next.deaths.sickness).toBe(0);
  });
  it('does not cascade new infections through a chain within one tick', () => {
    const w = fixture(3, { transmission: 1 });
    // Different needs anchor a chain at three adjacent cells. The first and
    // third individuals cannot contact each other, even across wrapped edges.
    w.individuals.forEach((p, i) => {
      p.x = i; p.y = 0; p.food = i === 1 ? 90 : 1; p.water = i === 1 ? 1 : 90;
      w.cells[cellIndex(i, 0)] = i === 1 ? { food: 0, water: 100 } : { food: 100, water: 0 };
    });
    w.individuals[0].sick = true;
    const next = step(w);
    expect(next.individuals.map(p => [p.x, p.y])).toEqual([[0, 0], [1, 0], [2, 0]]);
    expect(next.individuals.map(p => p.sick)).toEqual([true, true, false]);
    expect(step(next).individuals[2].sick).toBe(true);
  });
  it.each(PRESETS.map(p => [p.name, p.config] as const))('maintains invariants through a long %s run', (_name, config) => {
    let w = initialState(config);
    for (let i = 0; i < 600; i++) {
      w = step(w);
      const s = summarize(w);
      expect(s.population).toBe(config.population + s.births - s.deaths);
      expect(s.population).toBeLessThanOrEqual(500);
      expect(new Set(w.individuals.map(p => p.id)).size).toBe(s.population);
      expect(w.individuals.every(p => p.x >= 0 && p.x < 32 && p.y >= 0 && p.y < 20 && p.food >= 0 && p.water >= 0 && p.food <= 100 && p.water <= 100)).toBe(true);
      expect(w.cells.every(c => Number.isFinite(c.food) && Number.isFinite(c.water) && c.food >= 0 && c.water >= 0 && c.food <= 100 && c.water <= 100)).toBe(true);
    }
  });
});
