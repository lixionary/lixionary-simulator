# Relativity Lab

Open `/gps-relativity/` for a browser-only lab on the relativity inside GPS. Put an atomic clock in orbit, see how weaker gravity and orbital speed pull it away from a ground clock, then switch on the corrections that keep a position fix exact. The collection links to the lab; Vite, TypeScript, Vitest, Playwright, Docker, and deployment page checks include it.

## Explore

| Experiment | What it shows |
| --- | --- |
| GPS as it flies | Every correction on. After a day the clocks agree to the nanosecond and the fix is exact. |
| Forget relativity | Clocks built at exactly 10.23 MHz gain 38.6 µs a day in orbit: 11.6 km of distance error, and a fix about 18 km off. |
| Only special relativity | Correcting for speed alone leaves 45.8 µs a day, worse than no correction. |
| A fourth satellite | A receiver that solves for its own clock absorbs an error shared by all satellites. Position survives; its time is 38.6 µs a day off. |
| The oval orbit | With eccentricity 0.02 each clock swings ±45.8 ns per lap at its own phase. The fix circles the true position by metres until the receiver corrects it. |
| Space station height | At 420 km speed wins: the clock loses 24.3 µs a day. |
| The balance point | At 3,167 km the two effects cancel. |

`?preset=<key>` opens an experiment directly (`built`, `ignored`, `speed-only`, `fourth`, `oval`, `station`, `balance`). An unknown key opens the first experiment and says so. Edits are not stored in the address.

Controls: elapsed time since the clocks were set (0 to 7 days, with playback at 10 minutes, 1 hour, or 6 hours per second), altitude (300 to 40,000 km, with buttons for well-known orbits), how oval the orbit is (eccentricity up to 0.05, less where the lowest point would dip below 200 km), three corrections (gravity and speed as a factory clock offset, orbit shape in the receiver), and whether the receiver solves for its own clock error.

Readouts: the gravity, speed, and net clock rates in µs per day; the frequency the clock is built to; satellite A's clock error and the distance error it causes; the position error split into sideways and height; and the receiver's time error. Two clock faces read to the nanosecond. Views: the orbit to scale, a top-down map of the fix with its path, the sky with each satellite's distance error, clock rate against altitude, and each satellite's clock error over time.

## Engine interface

`src/model.ts` is pure TypeScript in SI units. Rates are fractions (seconds gained per second).

- Types: `Orbit` (`altitudeKm`, `eccentricity`), `Corrections` (`gravity`, `speed`, `orbitShape`), `Settings`, `Satellite`, `Fix`.
- `rates(a)`: average rate of a clock on an orbit of semi-major axis `a` against a sea-level clock. Gravity is `L_G − GM/(ac²)`, speed is `−GM/(2ac²)`.
- `BALANCE_ALTITUDE_KM`, `maxEccentricity(altitudeKm)`, `period(a)`, `meanSpeed(a)`.
- `eccentricAnomaly(mean, e)` and `wobble(orbit, mean)`: the periodic term `F·e·√a·sin E` with `F = −2√GM/c²`. `wobbleAmplitude(orbit)`.
- `factoryOffset(orbit, corrections)`: the rate offset built into the clock.
- `clockError(settings, satellite, t)`: seconds a satellite clock is ahead of system time after the chosen corrections.
- `skyPositions(a)`: the six satellites in east, north, up coordinates around the receiver.
- `solveFix(settings, t)`: Gauss–Newton least squares for position, or position and receiver clock. `fixTrail(settings, t)` samples it from zero to `t`.
- `orbitPoint(orbit, t, phase)`: position, radius, and speed on the ellipse.

`src/format.ts` formats intervals, lengths, rates, and nanosecond clock faces. `src/presets.ts` holds the experiments and the named orbits.

## Limits of the model

Constants: `GM = 3.986004418 × 10¹⁴ m³/s²`, `c = 299,792,458 m/s`, `L_G = 6.969290134 × 10⁻¹⁰`, equatorial radius 6,378.137 km. The sea-level rate `L_G` already includes Earth's rotation and oblateness, so the ground clock stands for any clock at sea level.

The six satellites are fixed in the sky at the chosen orbit radius; only their clocks change, and each starts at a different point of its lap. The factory offset follows the chosen altitude. Measurements have no noise, so a fully corrected fix is exact.

Left out: the Sagnac effect, the ionosphere and troposphere, clock noise, orbit errors, and the clock corrections the control segment uploads. Real GPS would catch a drifting clock through those uploads, so the kilometre-scale figures show the size of the effect, not a forecast of an outage.

## Verification

From the repository root:

```sh
npm test
npm run build
BROWSER_PRODUCTION=1 npm run test:browser
```

Unit tests cover the published GPS rates and factory frequency, Kepler period and speed, the balance altitude, Kepler's equation, the periodic term against a numerical integration of the exact rate, eccentricity limits, sky geometry, exact fixes with all corrections, drift without them, the special-relativity-only case, absorption of a shared error by the receiver clock, the oval-orbit residual, every preset, and formatting. Browser tests cover navigation, each correction, presets and preset links, the receiver clock option, orbit buttons, keyboard control, playback, and responsive layouts.
