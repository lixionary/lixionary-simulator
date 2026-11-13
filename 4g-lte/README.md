# 4G LTE — Signal Lab

This simulator now lives at `/4g-lte/` in the [Lixionary Simulators collection](../README.md). Its source, numerical tests, browser scenarios, and model documents are kept together here. Run all commands below from the repository root (one directory above this README).

A browser-only 4G LTE-inspired teaching simulator. Follow a message through coding, QAM modulation, an OFDM resource grid, a wireless channel, synchronization, equalization, and decoding. Seven guided experiments connect noise, echoes, cyclic-prefix protection, symbol timing, frequency offset, and error correction to the recovered data.

Built from [the original simulation specification](docs/4g-simulator.md). See [model notes](docs/model-notes.md) for numerical conventions and deliberate simplifications.

## Run locally

Use Node.js 22.12 or newer (Node 22.23 was used for validation).

```sh
npm ci
npm run dev
```

Open `/4g-lte/` at the Local URL printed by Vite. The default is `http://127.0.0.1:5173/4g-lte/`; Vite chooses another port if that one is occupied.

```sh
npm run build
npm run preview
```

The production build lives in `dist/`. Serve this directory from any static host. There is no backend, account, API key, runtime network dependency, or database. Browser ES modules and Web Workers require serving over HTTP rather than opening `index.html` as a local file.

## Checks

```sh
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

To run the same browser scenarios against the static production build, run `npm run build` followed by `BROWSER_PRODUCTION=1 npm run test:browser` (macOS/Linux).

Unit tests cover independent CRC reference vectors, analytic FFT behavior, constellation normalization and LLR signs, single-error Hamming correction, Viterbi recovery, all modulation/coding/CRC/prefix combinations, multi-slot capacity, CFO compensation, seeded noise statistics, and isolated cyclic-prefix interference. CP acquisition tests verify blind timing detection, fractional CFO estimation, both prefixes, delayed final echoes, and actual recovery after wrong FFT alignment.

Browser tests cover stage inspection, message recovery, guided experiments, invalid and rapid edits, custom taps, reserved resources, animation controls, CP scanning and application, measured frequency correction, keyboard access, and layouts at 375, 768, and 1440 pixels. They launch a dedicated server on port 4177 and never reuse another app's server. Desktop/mobile screenshots and failure traces are written to ignored `test-results/`.

## Organization

- `src/sim/`: typed configuration/results, numerical primitives, codecs, complete transceiver, worker, and numerical tests.
- `src/components/`: controls, Canvas plots, SVG diagrams, stage views, and accessible numerical inspection.
- `src/App.tsx`: guided experiments, linked selections, worker coordination, and recovered data.

`simulate(config)` is a pure, seeded function returning intermediate signals and decoded results. The app executes it in a worker with request IDs so stale responses cannot overwrite a newer configuration. Settings are debounced by 70 ms; playback steps through computed symbols without changing the transmission.

## Learning controls

Enter up to 128 ASCII characters or 1,024 binary digits. Select BPSK through 256-QAM, adjust SNR, choose a reduced channel profile or edit up to six complex taps. Compare prefixes, equalizers, and decision modes. Transmitter options expose CRC, coding, resource reservations, and scrambling seed.

The seed preserves noise for comparisons. **New noise** advances the seed. **Reset** returns to the clean default transmission. Choose a stage or resource cell and use previous/next/play to follow symbols across views. **Inspect numerical values** provides exact complex symbols, sample tables, and channel response values alongside the plots.

## See how the receiver synchronizes

Open **Experiments → Find the symbol boundary**, or select **Receiver** in the playground.

1. The experiment starts with a delayed signal and a wrongly placed manual FFT window, so the decoded data fails its checksum.
2. Animate the correlation scan: orange probe windows compare received samples 64 positions apart. A normalized correlation peak reveals the repeated cyclic prefix.
3. Jump to the peak and apply CP synchronization. The measured boundary moves the actual FFT windows, restoring the clean-channel message.
4. Change arrival delay, prefix length, SNR, or channel taps to see how the match changes. Choose manual timing to place the FFT window yourself.
5. Add a frequency offset. Enable compensation and select **CP estimate** to correct it using the measured correlation phase.

The view exposes I/Q sample pairs, the receiver's FFT window, actual/estimated timing, correlation values, and fractional CFO. CP establishes symbol timing in this bounded capture experiment; full LTE frame/cell identification is outside the model.

Metrics are from individual finite transmissions. Use repeated realizations before drawing statistical conclusions about coding or equalization performance.
