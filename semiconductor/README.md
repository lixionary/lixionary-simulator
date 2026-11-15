# Silicon Lab

Open `/semiconductor/` for a browser-only lab that follows silicon from a PN junction to a transistor to a logic gate. Each stage reuses the one before: the transistor's leak is the diode's exponential, and the gate is built from the transistor you designed. The collection links to the lab; Vite, TypeScript, Vitest, Playwright, Docker, and deployment page checks include it.

## Explore

| Stage | Experiment | What it shows |
| --- | --- | --- |
| 1 Junction | A junction at rest | Depleted strip, built-in voltage 0.775 V, no current. |
| | Forward: a diode conducts | 0.65 V gives 4.03 mA; ten times the current per 60 mV. |
| | Reverse: a diode blocks | 5 V reverse: a 906 nm strip and 56.7 fA of leakage. |
| | A hot diode | At 400 K leakage is 20.8 nA and turn-on is about 0.2 V lower. |
| | Breakdown: a Zener diode | 10¹⁸ doping on both sides breaks down at 5.5 V. |
| 2 Transistor | Gate low: switched off | Subthreshold leak, 76.7 mV per decade. |
| | Gate high: a current source | Saturation: 735 µA, set by the gate. |
| | A closed switch | Triode: a gate-controlled resistor. |
| 3 Logic gate | An inverter | Rail-to-rail output, picoamperes of idle current. |
| | Halfway: both conduct | 160 µA straight through at the switching point. |
| | NAND | Series pull-down, parallel pull-up, and the truth table. |
| | Running on 0.4 V | A twentieth of the energy, about 66 times the delay. |

`?preset=<key>` opens an experiment directly (`rest`, `diode`, `reverse`, `hot`, `zener`, `off`, `saturation`, `triode`, `inverter`, `threshold`, `nand`, `low-voltage`). An unknown key opens the diode and says so. Edits are not stored in the address.

Controls by stage. Junction: applied voltage (−12 to +0.9 V), acceptor and donor doping (10¹⁴ to 10¹⁹ per cm³), temperature (250 to 400 K). Transistor: gate and drain voltage (0 to 3 V), body doping, oxide thickness (2 to 40 nm), width over length. Gate: NOT, NAND, or NOR; input A as a voltage; input B as a level; supply voltage (0.2 to 3.3 V); p-channel width. The gate stage uses the transistor from stage 2.

Views: a band diagram with the silicon, band edges, both Fermi levels, and the field on one axis; diode current on linear and logarithmic axes; a transistor cross-section with its channel; output and transfer curves; a transistor-level schematic with a truth table; and the gate's voltage transfer curve.

## Engine interface

`src/model.ts` is pure TypeScript in SI units, with doping per cm³.

- Material: `thermalVoltage`, `bandGap` (Varshni), `intrinsic` (Misiakos and Tsamakis), `mobilityN`, `mobilityP` (Caughey–Thomas).
- Junction: `solveJunction(junction)` returns built-in voltage, voltage across the junction after 1 Ω of series resistance, current, depletion width and its two sides, peak field, capacitance, saturation current, breakdown voltage, and state. `bandsAt(junction, state, x)` gives band edges in eV. `saturationCurrent`, `breakdownVoltage`.
- Transistor: `designMos(na, toxNm)` returns threshold, oxide capacitance, body factor, subthreshold slope factor and swing, and gain factor. `drainCurrent(design, strength, vgs, vds)` is the EKV equation. `mosRegion`, `pinchOff`, `transconductance`.
- Gate: `gateCurrents`, `gateOutput` (bisection on pull-up equals pull-down), `transferCurve` (curve, switching threshold, peak gain, noise margins from the unity-gain points), `switching` (energy, delay, leakage power for a 10 fF load).

`src/format.ts` formats SI quantities, doping, and voltages. `src/presets.ts` holds the experiments.

## Limits of the model

The junction is abrupt and uses the depletion approximation; the diode is 1 mm² with a 1 µs lifetime and 1 Ω in series. Recombination in the depleted strip, high-level injection, and tunnelling are left out; breakdown is a steep branch placed where the peak field reaches the critical field, not a physical avalanche model. Mobility does not vary with temperature.

The transistor is a long-channel n-MOS at 300 K with an n+ polysilicon gate, no oxide charge, surface mobility at half the bulk value, and 5% per volt of channel-length modulation. Short-channel effects, velocity saturation, gate leakage, and the body effect are left out. The p-channel device is the n-channel one mirrored with 0.4 times the mobility. Series transistors count as one of half the strength. Delay is `C·V/(2·I_on)`, an estimate.

## Verification

From the repository root:

```sh
npm test
npm run build
BROWSER_PRODUCTION=1 npm run test:browser
```

Unit tests cover silicon's constants, built-in voltage and charge balance, the 60 mV per decade slope, series resistance, reverse bias scaling, temperature behaviour (leakage doubling per 4 K and −2 mV/K), breakdown, band edges, threshold and swing against doping and oxide, subthreshold slope, the square law and saturation, inverter levels and switching threshold, NAND and NOR truth tables, low-voltage operation, presets, and formatting. Browser tests cover navigation, each stage's controls and readouts, presets and preset links, stage switching, the link to CPU Lab, and responsive layouts.
