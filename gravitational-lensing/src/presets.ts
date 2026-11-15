import type { Lens, Source } from './model';

export interface Preset { key: string; group: string; name: string; notice: string; lens: Lens; source: Source }

const galaxy = (sigmaKms: number, lensLy: number, sourceLy: number, shear = 0): Lens => ({ kind: 'galaxy', massSolar: 1, sigmaKms, shear, lensLy, sourceLy });
const point = (massSolar: number, lensLy: number, sourceLy: number): Lens => ({ kind: 'point', massSolar, sigmaKms: 250, shear: 0, lensLy, sourceLy });

export const PRESETS: Preset[] = [
  { key: 'arcs', group: 'A galaxy in the way', name: 'Arcs', lens: galaxy(250, 3e9, 7e9), source: { kind: 'galaxy', x: 0.42, y: 0.18, size: 0.2 },
    notice: 'A distant galaxy sits a little off to one side of a nearer one. Its light reaches us by two routes: a long arc on its own side and a small image opposite. Drag it in the true sky.' },
  { key: 'ring', group: 'A galaxy in the way', name: 'A perfect ring', lens: galaxy(250, 3e9, 7e9), source: { kind: 'galaxy', x: 0, y: 0, size: 0.2 },
    notice: 'Line the two galaxies up exactly and there is no preferred side. The arcs close into an Einstein ring, one arcsecond across.' },
  { key: 'cross', group: 'A galaxy in the way', name: 'Einstein cross', lens: galaxy(182, 5e8, 8e9, 0.14), source: { kind: 'star', x: 0.04, y: 0.03, size: 0.05 },
    notice: 'Real galaxies are lopsided. A quasar almost dead centre behind one shows up four times, like the Einstein Cross in Pegasus.' },
  { key: 'cluster', group: 'A galaxy in the way', name: 'A cluster of galaxies', lens: galaxy(1000, 4e9, 1e10), source: { kind: 'field', x: 0.3, y: -0.2, size: 0.12 },
    notice: 'A thousand galaxies and their dark matter act as one lens. Every galaxy behind is stretched along circles around it. The stretch maps mass nobody can see.' },
  { key: 'microlens', group: 'A star in the way', name: 'A star passes a star', lens: point(0.3, 13_000, 26_000), source: { kind: 'star', x: -2, y: 0.2, size: 0.05 },
    notice: 'The two images are a thousandth of an arcsecond apart: no telescope can split them. All we see is one star growing brighter for a few weeks. Let it drift past.' },
  { key: 'blackhole', group: 'A star in the way', name: 'A lone black hole', lens: point(7, 5_000, 20_000), source: { kind: 'star', x: 0.5, y: 0.1, size: 0.05 },
    notice: 'A black hole with no companion gives off nothing. It can still brighten and shift a star behind it. In 2022 one was found and weighed this way.' },
];

