# Lixionary Simulators

A collection of interactive, browser-only teaching simulations. Each simulator has its own directory and HTML entry point; one React / TypeScript / Vite toolchain builds the collection.

| Simulator | Local route | Source and model notes |
| --- | --- | --- |
| Collection | `/` | `src/` |
| Error Detection — Bit Lab | `/error-detection/` | [error-detection/](error-detection/README.md) |
| 4G LTE — Signal Lab | `/4g-lte/` | [4g-lte/](4g-lte/README.md) |
| Apparent Annual Motion of the Sun — Sun Lab | `/apparent-annual-motion/` | [apparent-annual-motion/](apparent-annual-motion/README.md) |

## Run locally

Use Node.js 22.12 or newer. Run commands from this repository’s root:

```sh
npm ci
npm run dev
```

Open the local URL Vite prints (usually `http://127.0.0.1:5173`). Choose a simulator from the collection page. No backend, account, API key, or runtime network dependency is required.

The development server listens on all network interfaces and allows this Mac mini’s Tailscale hostname. For a fixed port, run `npm run dev -- --port 5174 --strictPort`, then open `http://mac-mini.fluffy-oratrice.ts.net:5174/` from another device on the tailnet.

```sh
npm test
npm run build
npm run test:browser
```

Browser tests require Playwright Chromium (`npx playwright install chromium` if needed). The tests start their own server on port 4177. To check the built pages and the LTE worker against the production output:

```sh
npm run build
BROWSER_PRODUCTION=1 npm run test:browser
```

`npm run preview` serves the production build. Deploy the contents of `dist/` to a static host that serves directory `index.html` files. All four pages build together. Serve over HTTP; do not open HTML files directly from disk.

## Project layout

```text
src/                          Collection page and shared base styles
4g-lte/
  index.html                  LTE entry point
  src/                        Original transceiver, UI, worker, numerical tests
  tests/                      Original LTE browser scenarios
  docs/                       LTE specification and model notes
apparent-annual-motion/
  index.html                  Sun simulator entry point
  src/                        Solar model, SVG views, UI, numerical tests
error-detection/
  index.html                  Bit Lab entry point
  src/                        Error detection algorithms, traces, UI, unit tests
tests/                        Collection, Sun, and Bit Lab browser scenarios
vite.config.ts                Multi-page build and unit-test discovery
playwright.config.ts          Shared browser-test server
```

To add another simulator, create a directory with its own `index.html` and source, register the HTML entry point in `vite.config.ts`, include its TypeScript and tests in the shared configuration, and add a card to the collection page.
