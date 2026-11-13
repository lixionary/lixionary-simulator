# Apparent Annual Motion of the Sun — Sun Lab

An interactive astronomy simulator at `/apparent-annual-motion/`. Run the shared commands in the [repository root](../README.md).

Follow Earth’s orbit or switch to an unwrapped celestial map to see the Sun’s apparent eastward annual motion against the stars. Change the date, observer latitude, or axial tilt; connected views show declination, solar altitude, geometric daylight, sunrise, and sunset. Playback advances the date and wraps through the fixed 2026 calendar. Manual date changes pause playback.

The four event shortcuts use the 2026 calendar dates: 20 March, 21 June, 23 September, and 21 December. They select UTC-noon samples, not the exact event instant. Guided experiments explore zero tilt, opposite hemispheres, and the midnight Sun. The daily-altitude view can compare the northern and southern declination extremes.

## Model

`src/model.ts` implements the [US Naval Observatory’s approximate solar coordinates](https://aa.usno.navy.mil/faq/sun_approx). Days from J2000 yield mean anomaly and mean longitude, then corrected ecliptic longitude. Right ascension uses `atan2(cos(tilt) × sin(longitude), cos(longitude))`; declination uses `asin(sin(tilt) × sin(longitude))`. The default axial tilt is fixed at 23.44°; changing it simulates a hypothetical tilted planet while retaining the date-to-longitude mapping.

Daily altitude follows spherical geometry:

```text
sin(altitude) = sin(latitude) sin(declination)
              + cos(latitude) cos(declination) cos(hour angle)
hour angle = 15° × (local solar hour − 12)
```

Sunrise and sunset are the geometric center’s crossings of altitude 0°. These use the same geometry as [NOAA’s solar equations](https://gml.noaa.gov/grad/solcalc/solareqns.PDF), with an ideal horizon and no refraction or solar-disk correction. Displayed times are local apparent solar time, with solar noon at 12:00. They are not UTC, time-zone times, or civil clock predictions. Declination is held fixed throughout each selected day.

Polar day and polar night have no sunrise/sunset crossing. At a geographic pole with exactly zero declination, the Sun stays on the horizon: the model reports zero hours strictly above the horizon and explains the degeneracy.

The orbit illustration uses a perspective schematic with enlarged bodies, a fixed projected north-axis direction, and a constant visual orbital radius. The celestial view plots right ascension horizontally and declination vertically; background stars are illustrative. The annual chart samples every day. This is a geometry teaching model, not an ephemeris or weather model. For the physical context, see [NASA’s Earth facts](https://science.nasa.gov/earth/facts/).

## Verification

Numerical tests check the event dates, equinox geometry, zero tilt, complementary hemisphere daylight, sunrise/sunset altitude, polar degeneracies, every calendar date, and finite full-year results across extreme latitudes and tilts. Browser tests cover collection navigation, connected controls, experiments, keyboard access, playback, year wrapping, and mobile/tablet/desktop layouts. Run them from the repository root.
