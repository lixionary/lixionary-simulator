# Gravity Lens Lab

Open `/gravitational-lensing/` for a browser-only lab on gravitational lensing. Put a star, a black hole, a galaxy, or a cluster in front of something distant and see the true sky beside the lensed one: two images, arcs, an Einstein ring, a four-image cross, or just a brightening. The collection links to the lab; Vite, TypeScript, Vitest, Playwright, Docker, and deployment page checks include it.

## Explore

| Experiment | What it shows |
| --- | --- |
| Arcs | A galaxy slightly off-centre behind another: a long arc and a small counter-image. |
| A perfect ring | Exact alignment closes the arcs into an Einstein ring 1.03″ in radius. |
| Einstein cross | A lopsided lens (shear 0.14) and a quasar near its centre: four images. |
| A cluster of galaxies | A 17″ ring and a field of background galaxies stretched along circles around the lens. |
| A star passes a star | A 0.55 mas ring, unresolvable. Only the brightness changes, over about 19 days. |
| A lone black hole | Seven solar masses 5,000 light-years away: a 5.3 mas ring and a ten-week event. |

`?preset=<key>` opens an experiment directly (`arcs`, `ring`, `cross`, `cluster`, `microlens`, `blackhole`). An unknown key opens the first experiment and says so. Edits are not stored in the address.

Controls: the lens is a compact mass (0.001 to 10¹⁰ solar masses) or a galaxy (star speed 50 to 1,500 km/s, lopsidedness up to 0.3), at chosen distances to lens and background. The background is a star, a galaxy, or a field of galaxies, with a size and a position in ring radii. Drag it in the true sky, use the sliders, or let it drift past. The Einstein ring and the lens's own light can be hidden.

Readouts: ring radius on the sky, ring size at the lens, bending angle at the ring, mass inside the ring, what is seen (image count or a ring), total brightness, peak brightness along the path, and the time to cross one ring radius at 200 km/s. Charts show brightness along the path and a side view of the bent paths.

## Engine interface

`src/model.ts` is pure TypeScript. Physical quantities are SI; sky positions are in Einstein ring radii, north up.

- Types: `Lens` (`kind`, `massSolar`, `sigmaKms`, `shear`, `lensLy`, `sourceLy`), `Source` (`kind`, `x`, `y`, `size`).
- `deflectionAngle(massSolar, impact)`: `4GM/(c²b)` in radians.
- `einsteinRadius(lens)`, `ringSize(lens)`, `bendingAtRing(lens)`, `ringMass(lens)`, `crossingTime(lens)`.
- `deflect(kind, shear, x, y)`: deflection in ring units. Compact: `θ/|θ|²`. Galaxy: `θ/|θ|`. Shear adds `(γx, −γy)`.
- `pointImages(u)` and `radialImages(kind, offset)`: analytic image positions and gains for round lenses.
- `lightCurve(kind, shear, size, y0, xs)` and `brightness(...)`: total gain of a Gaussian source by inverse ray shooting on a 560 × 560 grid over ±4 ring radii.
- `countImages(kind, shear, source)`: connected bright patches at 30% of peak, and whether they form a ring.

`src/render.ts` paints either sky as RGBA pixels by evaluating the background at `β = θ − α(θ)`. `src/format.ts` formats angles, masses, lengths, and durations. `src/presets.ts` holds the experiments.

## Limits of the model

Distances are Euclidean: `D_LS = D_S − D_L`. At cosmological distances real angular-diameter distances do not subtract, so ring sizes there are indicative. A galaxy is a singular isothermal sphere with optional external shear; it has no core and no ellipticity of its own. There are no binary lenses, so no planetary blips or caustic crossings beyond the shear's. Time delays between images, telescope blur, and noise are left out. Brightness and image counts treat the background as one round soft-edged source of the chosen size, including when a galaxy or a field is drawn. Images further than 2.8 ring radii from the lens fall outside the picture.

## Verification

From the repository root:

```sh
npm test
npm run build
BROWSER_PRODUCTION=1 npm run test:browser
```

Unit tests cover the 1.75″ solar deflection, ring sizes for the presets, mass from ring size, deflection laws, analytic image positions, image counts for two images, one image, a ring, and a cross, brightness against the textbook curves for both lens kinds, the shape of the light curve, rendered pixels at the predicted image positions, presets, and formatting. Browser tests cover navigation, presets and preset links, ring pixels on the canvas, the four-image cross, the microlensing readouts, playback, dragging, lens and background controls, and responsive layouts.
