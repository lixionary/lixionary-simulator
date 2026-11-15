# Integral Lab

Integral Lab compares adding up slices under a curve with the exact answer from a formula, then shows the curves whose integral has no formula, then shows numeric integration at work on measured data. It runs in the browser with no server.

Local route: `/numerical-integration/`

## What it shows

Three links of one chain, each with its own experiments:

1. **Against the formula.** A curve with a known antiderivative, cut into slices by one of five rules. The picture colours the area the slices count in error and the area they miss. Readouts give the exact value, the estimate, the error, and what the error does when the slices double.
2. **No formula.** The bell curve, `sin x / x`, `sin(x²)`, `1/ln x`, the length of a sine wave, the period of a pendulum, and the perimeter of an ellipse. None has an elementary antiderivative. The lab integrates them the same way, estimates its own error without the answer, and draws the missing antiderivative as a curve.
3. **In practice.** A car's speed log turned into a distance, with adjustable logging interval and sensor noise; an adaptive rule against equal slices at a requested accuracy; and three cases that fool a numeric rule.

## Using it

Pick an experiment from the list, or build one with the controls. An experiment can be linked with `?preset=<key>`, for example `/numerical-integration/?preset=pendulum`. An unknown key opens the first experiment and says so. Edits are not stored in the address.

Controls for links 1 and 2, and for the traps in link 3: the curve, the two ends of the interval (fixed for the pendulum, the ellipse, and the traps), one extra slider where the curve has a parameter, the rule (left, right, or midpoint rectangles, trapezoids, Simpson), and the number of slices from 1 to 512 with halve and double buttons. Simpson's rule rounds an odd count up to the next even one.

Controls for the rest of link 3. Measured data: time between readings (0.5 to 30 s), sensor noise (0 to 3 m/s), and a button for a new set of noisy readings. Accuracy on demand: the tolerance (10⁻² to 10⁻¹⁰) and the spike's half-width (0.001 to 0.05).

Views: the curve with its slices and sample points; error against slices for all five rules on logarithmic axes; a table of estimates as the slices double; the running area; the self-estimated error against the actual error; the speed log; distance error from coarse logging and from noise; sixty repeats of the noisy trip; error against function evaluations for equal and adaptive slices.

## Engine interface

`src/model.ts` is pure TypeScript.

- Rules: `integrate(f, a, b, n, rule)`, `samplePoints`, `approximant` (the shape a rule draws in each slice), `slicesFor` and `evaluations`.
- Error: `convergence` (estimate, error, and ratio as slices double), `observedOrder`, `errorBound` with `maxAbs`, `isExact` (error within rounding), `slicesNeeded`.
- Truth without a formula: `reference` (five-point Gauss–Legendre on 1,024 panels) and `runningArea`.
- Adaptive: `adaptiveSimpson(f, a, b, tolerance)` and `evenSimpson`, each returning the value, the evaluations, the points used, and its own error estimate.
- Data: `tripSpeed`, `sampleTrip(interval, noise, seed)`, `trapezoidData`, `repeatErrors`.

`src/functions.ts` holds the curves (with antiderivatives and derivatives where they exist) and `solve(setup)`, which returns everything the page shows for one curve, rule, and slice count. `src/presets.ts` holds the experiments. `src/format.ts` formats numbers, errors, and digit counts.

## Limits of the model

All arithmetic is double precision, so errors stop shrinking near 10⁻¹⁶ of the answer. An error within 10⁻¹⁴ of the answer is shown as zero.

The guaranteed bounds use exact derivatives sampled at 401 points across the interval, so the maximum can be very slightly underestimated. Curves in link 2 and the traps have no bound.

The reference values in link 2 are numeric themselves, accurate to about fourteen digits for these curves; "actual error" there means error against that reference.

The trip is an invented speed curve, not a recording. Sensor noise is independent and normally distributed in each reading; real sensors also drift and have bias, which a sum does not cancel.

The adaptive rule starts from eight equal pieces and uses an absolute tolerance. It can still miss a spike narrower than its first pieces, and the lab reports when either method ends outside the requested accuracy.

Left out: Gaussian and Romberg rules as selectable methods, infinite ranges, changes of variable, integrals in more than one dimension, and Monte Carlo integration.

## Verification

From the repository root:

```sh
npm test
npm run build
BROWSER_PRODUCTION=1 npm run test:browser
```

Unit tests cover each rule against hand-worked sums, exactness on lines and cubics, the order of each rule, the midpoint and trapezoid pairing, the drawn shapes against the sums, the textbook bounds, every antiderivative and derivative against finite differences, reference values against known constants, the self-estimated error, the trip and its noise, adaptive against equal slices, the three traps, every experiment, and formatting. Browser tests cover navigation, each rule's readouts, doubling and halving, changing the curve and interval, the curves with no formula, the speed log, the adaptive rule, the traps, the chain, preset links, and 390 px and 1280 px layouts.
