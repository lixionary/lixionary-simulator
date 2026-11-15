# Heat Lab

Open `/thermodynamics/` for a browser-only lab that follows one machine from the Carnot cycle, to a real engine that has to run at a finite speed, to the same cycle reversed as a refrigerator, air conditioner, or heat pump. The real engine uses the cycle you set up in the first stage. The collection links to the lab; Vite, TypeScript, Vitest, Playwright, Docker, and deployment page checks include it.

## Explore

| Stage | Experiment | What it shows |
| --- | --- | --- |
| 1 The cycle | The Carnot cycle | 500 K to 300 K: 288 J in, 173 J out, 115 J of work, 40%. |
| | Power station temperatures | 840 K to 300 K allows 64.3%. |
| | A small temperature difference | 320 K to 300 K allows 6.3%. |
| | A different gas | Air expands further, the loop changes shape, and the efficiency is still 40%. |
| 2 A real engine | Nearly ideal, nearly useless | 0.2 cycles per second: 39.3% and 22.5 W. |
| | Running for the most power | 4.41 cycles per second: 254 W at 22.5%. |
| | With friction | A fifth of the work lost: 203 W at 18.0%. |
| | Driven too fast | Past 8.68 cycles per second the engine stalls. |
| 3 Run it backwards | A kitchen refrigerator | 4 °C in a 22 °C kitchen: COP 3.52, 7.68 W. |
| | A freezer | −18 °C: COP 2.04, 29.4 W. |
| | A heat pump on a mild day | 7 °C outside: COP 4.97, 563 W for 2.8 kW of heat. |
| | A heat pump at −20 °C | COP 2.99, 2.74 kW for 8.2 kW of heat. |
| | An air conditioner in a heatwave | 42 °C outside: 953 W, twice the 475 W needed at 35 °C. |

`?preset=<key>` opens an experiment directly (`carnot`, `steam`, `small-gap`, `diatomic`, `slow`, `max-power`, `friction`, `stalled`, `fridge`, `freezer`, `heat-pump`, `heat-pump-cold`, `heatwave`). An unknown key opens the Carnot cycle and says so. Edits are not stored in the address.

Controls by stage. Cycle: position in the cycle (slider, stroke buttons, run and pause), hot reservoir (320 to 1000 K), cold reservoir (200 to 400 K, kept at least 10 K below the hot one), helium or air, expansion ratio (1.2 to 5), amount of gas. Real engine: cycles per second (0 to 12), heat exchanger conductance (5 to 60 W/K), friction (0 to 50% of the work). Backwards: refrigerator, air conditioner, or heat pump; inside and outside temperature; coil temperature gap (0 to 20 K); compressor quality (20 to 100% of ideal); wall leak; and a button for a perfect machine.

Views: a piston between two reservoirs that shows which one the gas is touching; the cycle on pressure–volume axes (linear or logarithmic) and temperature–entropy axes with a moving dot; energy-flow diagrams whose band widths are the heat and work flows; power and efficiency against speed; coefficient of performance and electricity against the weather.

## Engine interface

`src/model.ts` is pure TypeScript in SI units, with temperatures in kelvin.

- Cycle: `carnotCycle(cycle)` returns the four corner states (pressure, volume, temperature, entropy), heat in and out, work, efficiency, and entropy carried. `stateAt(cycle, phase)` gives the gas at a phase from 0 to 1, a quarter per stroke. `cyclePath` samples the loop for plotting.
- Real engine: `realEngine(cycle, engine)` returns the gas temperatures on the two isothermal strokes, heat flows, power, efficiency, entropy generation rate, the stall rate, and the rate, power, and efficiency at maximum power.
- Backwards: `heatPump(pump)` returns coil temperatures, cooling and heating coefficients of performance, the Carnot limit, the heat demand, electricity, both heat flows, and entropy generation rate. `outsideOf` and `withOutside` read and set whichever temperature is the weather for that machine.

`src/format.ts` formats SI quantities, temperatures, percentages, volumes, and coefficients of performance. `src/presets.ts` holds the experiments and each machine's defaults.

## Limits of the model

The gas is ideal with a constant heat capacity ratio (5/3 or 7/5), starting at 10 litres per mole. The animation gives each stroke the same time; the model assigns the strokes no duration.

The real engine is the Curzon–Ahlborn endoreversible model with equal conductance on both sides: all loss is in heat transfer, plus friction as a fixed share of the work. The adiabatic strokes take no time, and no heat leaks past the engine except when it stalls.

The reversed machine is a Carnot cycle between coils offset from each side by a fixed gap, with the work scaled by 1/quality. Real refrigerators and heat pumps use vapour compression, and their performance depends on the refrigerant, on defrosting, and on fans and pumps, none of which are modelled. The heat load is a single conductance times the temperature difference.

## Verification

From the repository root:

```sh
npm test
npm run build
BROWSER_PRODUCTION=1 npm run test:browser
```

Unit tests cover the cycle's energy and entropy balance, independence of efficiency from gas, ratio, and amount, the gas and adiabatic laws at each corner, loop area against work on both charts, the four strokes, the zero-speed limit, maximum power at the Curzon–Ahlborn efficiency, energy conservation, friction, stalling, the reversed cycle against the Carnot limit, heating and cooling performance differing by exactly one, presets, and formatting. Browser tests cover navigation, the strokes, running and pausing, each stage's controls and readouts, the chain, preset links, and 390 px and 1280 px layouts.
