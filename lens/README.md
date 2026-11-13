# Lens Lab

Open `/lens/` for a browser-only optical bench. Shape convex and concave lenses, trace rays through them with Snell's law, and stack lenses into an achromatic doublet, a camera triplet, and a compound microscope. The collection links to the lab; Vite, TypeScript, Vitest, Playwright, Docker, and deployment page checks include it.

## Explore

Experiments run in a teaching order:

| Experiment | What it shows |
| --- | --- |
| Convex lens | Rays converge to a real, upside-down image. Bring the object inside the focal point and the image turns virtual and magnified. |
| Concave lens | Rays spread. Traced backward (dashed) they meet at a small, upright, virtual image. |
| A wide lens in white light | Spherical aberration (edge rays focus short) and chromatic aberration (blue focuses short). |
| The same lens, stopped down | A small aperture sharpens the spot and costs light. Colour error remains. |
| Achromatic doublet | Crown convex cemented to flint concave: colour and edge errors cancel, focusing power remains. |
| Camera lens (Cooke triplet) | 50 mm f/4.7, convex–concave–convex around an aperture. Sharp in every colour and at a tilt. |
| Compound microscope | An objective forms a magnified real image in the tube. An eyepiece hands the eye parallel rays, about 80× in total. |
| Refracting telescope | A 200 mm objective and a 25 mm eyepiece share a focal point: parallel light in, parallel light out, 8× steeper. |

`?preset=<key>` opens an experiment directly (`convex`, `concave`, `flaws`, `stopped`, `doublet`, `camera`, `microscope`, `telescope`). An unknown key opens the first experiment and says so. Edits to an experiment are not stored in the address.

Drag the object, any lens, the aperture, or the sensor on the bench. Every draggable item also has a slider, so the lab works from the keyboard. The light is either a nearby object (distance and height) or distant parallel light (tilt up to 25°), in green only or in white light (blue 486 nm, green 588 nm, red 656 nm). Each lens has a position, front and back curvature, centre thickness, diameter, and glass. Cemented lenses move together and keep their shared face matched. A change that cannot be built (edges that would meet, overlapping lenses, an aperture inside glass) is refused with a reason.

While **Keep the sensor in focus** is on, the sensor follows the sharpest position after every change. Moving the sensor yourself turns that off; **Autofocus** refocuses once. When rays leave parallel or spreading there is no sensor.

Readouts: focal length, f-number, image type and place, magnification (angular magnifying power for a parallel exit beam), blur at the sensor, colour error (blue focus minus red focus), edge-ray error (longitudinal spherical aberration), and the blur of one plain lens with the same focal length and opening. Two charts show a magnified close-up of the focus and where each ray lands against where it entered the lens.

The vertical axis of the bench is stretched to fill the frame; the scale bar states the factor.

## Engine interface

`src/model.ts` is pure TypeScript. Lengths are millimetres, light travels toward +x, and a positive curvature has its centre to the right of the surface.

- Types: `Element` (`x`, `c1`, `c2`, `thickness`, `semi`, `glass`), `Stop`, `System` (`elements`, `stop`, `sensorX`), `Source` (`point` or `parallel`).
- `indexAt(glass, nm)`: refractive index from a two-term Cauchy fit through the glass's index and Abbe number.
- `validate(system, source?)`: the reason a setup cannot be built, or `null`.
- `surfacesOf(system, nm)`: ordered surfaces; touching faces with equal curvature are cemented into one.
- `traceRay(surfaces, ray)`: exact ray/sphere intersection and vector refraction. Status is `through`, `blocked` (missed a lens), `stopped` (hit the aperture), or `reflected` (total internal reflection).
- `fan(system, source, nm, count)`: rays spread evenly over the part of the first lens that reaches the far side, plus the rays that are cut off.
- `samples`, `blurAt`, `bestFocus`: exit rays as lines, RMS blur on a screen, and the screen position of least blur in closed form.
- `paraxial(system)`: focal length, focal points, principal planes, entrance beam radius, and f-number from ray-transfer matrices. `imageOf(system, source)`: textbook image position, height, magnification, and kind.
- `colorShift`, `sphericalShift`, `equivalentSinglet`, `elementFocal`, `describe`.

`src/presets.ts` holds the experiments. The triplet is the classic 40° Cooke triplet prescription with dense crown (n 1.620, V 60.3) and flint (n 1.620, V 36.4). The doublet was solved for this lab: crown (n 1.517, V 64.2) R 48.08 / −44.40 mm, flint R −44.40 / −393.4 mm, 6 + 2.5 mm thick, 99.9 mm focal length. The microscope scales that doublet to a 20 mm objective and a 25 mm eyepiece, the telescope to a 200 mm objective and a 25 mm eyepiece; both are placed by calculation.

## Limits of the model

The bench is a flat slice through the lens axis. It shows spherical aberration, colour error, coma, and field curvature, and not astigmatism. It leaves out diffraction, surface reflections, coatings, and absorption. Blur is the RMS spread of 41 rays per colour, so it is a geometric figure, not a diffraction-limited one. Rays that would meet more than 1.5 m behind the last lens count as parallel.

## Verification

From the repository root:

```sh
npm test
npm run build
BROWSER_PRODUCTION=1 npm run test:browser
```

Unit tests cover dispersion, Snell's law, total internal reflection, aperture and rim clipping, the lensmaker's focal length against traced rays, the thin-lens equation for real and virtual images, two-lens combination, cementing, validation, every preset, doublet and triplet correction against an equivalent single lens, and microscope and telescope magnification. Browser tests cover navigation, each lens type, presets, white light, adding and removing lenses, validation messages, autofocus, dragging, keyboard control, preset links, and responsive layouts.
