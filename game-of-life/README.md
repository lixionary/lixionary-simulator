# Population Lab

Open `/game-of-life/` for a browser-only population ecosystem. Individuals move through a wrapping habitat, consume local food and water, reproduce, age, become sick, recover, and die. The collection links to the lab; Vite, TypeScript, Vitest, Playwright, Docker, and deployment page checks include it.

## Explore

Start paused in **Balanced habitat**, or choose **Resource scarcity** (a brief boom, then a bottleneck of a few survivors) or **Disease outbreak** (a crowded start, a fast wave of sickness, and 60 ticks of immunity after recovery). Presets and settings are drafts until **Apply & restart**. Playback speed and resource overlays apply immediately. **Step** advances one tick and **Skip 100** advances a hundred at once; playback pauses itself when the last individual dies. **Reset** restarts the applied configuration with the same seed; **New seed** restarts the applied configuration with a different seed and keeps pending population/rule edits.

The address bar carries the applied seed and every setting that differs from the defaults (for example `?seed=7&population=20`), so reloading or sharing the URL, or using **Copy link**, replays the same run. A link with invalid settings opens the default run and says so. Pending drafts, the selection, and playback position are not stored.

Select an individual on the map or through the keyboard-accessible inspector. Adults are circles, juveniles diamonds, sick individuals have a plus mark, and immune individuals a blue ring. Selecting an individual rings its living parents and children in amber. The inspector shows age, food/water reserves, health or remaining immunity, lifespan budget, parent IDs, living children, and reproduction readiness. A selected individual that dies is identified as no longer alive.

Four charts retain the latest 500 samples: population with sick and immune counts, food and water stocks, births and deaths over the trailing 10 ticks, and cumulative deaths by cause. Cumulative counters cover the entire run.

## Engine interface

`src/model.ts` exports `Config`, `World`, `Individual`, `Cell`, `Sample`, `DeathCause`, `RULES`, `CONFIG_LIMITS`, `DEFAULT_CONFIG`, and `PRESETS`.

- `initialState(config?, seed?)` validates settings and creates a world; default seed is `42` and unsigned integer seeds including `0` are supported.
- `step(world)` returns a new world without mutating its input. The world includes configuration and random-generator state, so a reset produces the same simulation and rendering never consumes randomness.
- `summarize(world)` provides current counts and habitat stocks; stocks exclude personal reserves.
- `offspringCount(a, b)` evaluates reserves; `reproductionReadiness(individual, config)` provides inspector text.
- `configToQuery(config, seed)` writes the seed and non-default settings as a query string; `configFromQuery(search)` returns the run it names, `null` when it names none, and throws on invalid values.

## Rules and defaults

All time and resource units are abstract teaching-model units. Constants live in `RULES`; user settings and bounds live in `DEFAULT_CONFIG` and `CONFIG_LIMITS`.

| Setting | Default |
| --- | --- |
| Habitat | 32 × 20 cells, wrapping both axes |
| Population | 60; maximum 500 |
| Initial food / water fullness | 80% / 80% |
| Food / water regeneration | 0.2 / 0.3 per cell per tick |
| Lifespan | 300 ticks, seeded ±20% individual variation |
| Maturity / reproductive cooldown | 40 / 20 ticks |
| Birth chance per eligible pair | 12% per tick |
| Initially sick | 5%, rounded to a whole individual |
| Transmission | 8% per infectious neighbor per tick |
| Recovery | 2.5% per sick individual per tick |
| Sick aging multiplier | 3× |
| Immunity after recovery | 0 ticks (off); maximum 500 |

Each tick:

1. Regenerate each cell's food and water, capped at 100 each. Initial patchiness multiplies the chosen fullness by a seeded value in `[0.5, 1.5)`, capped at capacity; zero fullness stays empty.
2. Visit individuals in seeded shuffled order. Choose among the current cell and eight neighbors using the amount they can harvest, weighted by hunger and thirst; break ties randomly. Sharing cells is allowed. Harvest up to 8 food and 10 water, capped at personal reserves of 100 each, then consume 2 food and 3 water.
3. Advance chronological age by one tick and used lifespan by one, or by the sickness multiplier when sick. Five consecutive ticks at zero food cause starvation, three at zero water cause dehydration. Exhausted lifespan causes death. A simultaneous death is counted once: dehydration, then starvation, then exhausted lifespan. Lifespan deaths with any accumulated accelerated aging are attributed to sickness, including after recovery.
4. Snapshot surviving infectious individuals and positions. Healthy individuals have infection probability `1 - (1 - transmission)^contacts`, counting infectious individuals in their cell and eight neighbors. Sick individuals may recover; the snapshot still contributes exposure that tick. New infections do not spread or accelerate aging until the next tick. A recovered individual cannot be infected for the configured immunity period, counted down each tick; at the default of zero, reinfection is possible immediately and the run is identical to one without immunity. Recovery never restores lifespan already lost. Without initial sickness, illness cannot appear.
5. Pair healthy, mature neighbors with no cooldown and adequate reserves. Each individual can attempt one pair per tick. Both parents need at least 60 food **and** water for one child, or 80 each for two. The pair then uses the configured birth probability. Each parent pays 15 food and water per child; each newborn receives 30 each, starts healthy at age zero, and records parent IDs. Parents remain alive and enter cooldown. Newborns first act next tick. Births are reduced or prevented at the population limit, with prevented offspring counted visibly.

Founders start with 70–95 reserves and ages from zero up to the smaller of three maturity periods and half their lifespan. Maturity uses chronological age. “Lifespan budget left” is remaining biological budget; while sick, the inspector also divides that budget by the aging multiplier to show the conditional time remaining. Regeneration continues after extinction; playback pauses, and stepping still advances the habitat.

This model omits sexes, genetics, seasons, inherited sickness, and population reintroduction.

## Verification

From the repository root:

```sh
npm test
npm run build
BROWSER_PRODUCTION=1 npm run test:browser
```

Unit tests cover seeded replay, independent snapshots, local feeding, shared-stock conservation, birth eligibility and costs, cooldown, newborn timing, disease transmission/recovery, immunity, mortality by cause, population limits, bounded history, shareable-query round trips, preset survival across seeds, and long-run accounting across all presets. Browser tests cover navigation, playback, skipping, auto-pause, settings, resets, shared links, inspection, family rings, overlays, extinction/regrowth, limits, and responsive layouts.
