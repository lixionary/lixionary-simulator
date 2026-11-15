# Lixionary Simulators

A collection of interactive, browser-only teaching simulations. Each simulator has its own directory and HTML entry point; one React / TypeScript / Vite toolchain builds the collection.

| Simulator | Local route | Source and model notes |
| --- | --- | --- |
| Collection | `/` | `src/` |
| Numerical Integration — Integral Lab | `/numerical-integration/` | [numerical-integration/](numerical-integration/README.md) |
| Thermodynamics — Heat Lab | `/thermodynamics/` | [thermodynamics/](thermodynamics/README.md) |
| Semiconductors — Silicon Lab | `/semiconductor/` | [semiconductor/](semiconductor/README.md) |
| Gravitational Lensing — Gravity Lens Lab | `/gravitational-lensing/` | [gravitational-lensing/](gravitational-lensing/README.md) |
| GPS and Relativity — Relativity Lab | `/gps-relativity/` | [gps-relativity/](gps-relativity/README.md) |
| Lenses — Lens Lab | `/lens/` | [lens/](lens/README.md) |
| Population — Population Lab | `/game-of-life/` | [game-of-life/](game-of-life/README.md) |
| CPU — Clockwork Lab | `/cpu/` | [cpu/](cpu/README.md) |
| OSI Seven Layers — Packet Lab | `/osi/` | [osi/](osi/README.md) |
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

`npm run preview` serves the production build. Deploy the contents of `dist/` to a static host that serves directory `index.html` files. All thirteen pages build together. Serve over HTTP; do not open HTML files directly from disk.

## Project layout

```text
src/                          Collection page and shared base styles
numerical-integration/
  index.html                  Integral Lab entry point
  src/                        Integration rules, error analysis, and adaptive model, SVG views, UI, unit tests
thermodynamics/
  index.html                  Heat Lab entry point
  src/                        Carnot cycle, finite-rate engine, and heat pump model, SVG views, UI, unit tests
semiconductor/
  index.html                  Silicon Lab entry point
  src/                        Junction, MOS transistor, and CMOS gate model, SVG views, UI, unit tests
gravitational-lensing/
  index.html                  Gravity Lens Lab entry point
  src/                        Lens equation model, pixel renderer, SVG views, UI, unit tests
gps-relativity/
  index.html                  Relativity Lab entry point
  src/                        Clock-rate and position-fix model, SVG views, UI, unit tests
lens/
  index.html                  Lens Lab entry point
  src/                        Ray-tracing engine, presets, bench UI, unit tests
game-of-life/
  index.html                  Population Lab entry point
  src/                        Seeded ecosystem engine, habitat UI, unit tests
cpu/
  index.html                  CPU Lab entry point
  src/                        Assembler, pipeline engine, UI, unit tests
osi/
  index.html                  OSI Packet Lab entry point
  src/                        Packet/checksum model, copper encoders, UI, unit tests
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
tests/                        Collection and simulator browser scenarios
vite.config.ts                Multi-page build and unit-test discovery
playwright.config.ts          Shared browser-test server
```

To add another simulator, create a directory with its own `index.html` and source, register the HTML entry point in `vite.config.ts`, include its TypeScript and tests in the shared configuration, and add a card to the collection page.

## Docker and deployment

Production runs at **https://simulation.lixionary.com** on the x86 VPS reached with `ssh lixsu@lixionary.com`. Deployment files and the selected image reference live in `/app/lixionary-simulator`.

```sh
docker compose up --build --detach --wait
```

Open `http://127.0.0.1:8590`. The multi-stage Dockerfile runs the unit tests and TypeScript/Vite build, then copies only the static output into an unprivileged Nginx image. Compose targets `linux/amd64`, including on ARM development machines, and binds only to localhost. The host's Nginx handles the public domain and TLS. All simulator directories, hashed assets, and the LTE worker are served directly; unknown URLs return 404.

To run browser tests against the container:

```sh
BROWSER_BASE_URL=http://127.0.0.1:8590 npm run test:browser
docker compose down
```

### GitHub Actions

[Build and deploy simulator](.github/workflows/deploy.yml) runs on pull requests, pushes to `main`, and manual dispatches. It builds an x86 image, runs all browser scenarios against the actual container, and publishes that tested image to `ghcr.io/lixionary/lixionary-simulator` on `main`. Images carry `sha-<full-commit-sha>` and `main` tags; deployments use the immutable registry digest.

After publishing, the workflow uploads `compose.yaml` and `deploy/deploy.sh` over SSH and starts the image on the VPS. It waits for container health, checks each simulator page, and then verifies public HTTPS. A failed container start or local page check restores the previous image when available. The selected image is saved in the server's `.env`, so normal Compose commands keep using the deployed version. GitHub's temporary job token authenticates the registry pull through stdin and a temporary Docker configuration, which is removed after deployment. No registry password is stored on the VPS.

The repository needs two Actions secrets:

| Secret | Value |
| --- | --- |
| `DEPLOY_SSH_KEY` | Dedicated Ed25519 private key authorized for `lixsu` on the VPS |
| `DEPLOY_KNOWN_HOSTS` | Trusted SSH host key entries for `lixionary.com` |

The `production` GitHub environment records deployments. Pushes to other branches and pull requests test the container without deploying. Manual dispatches deploy only when run from `main`.

### Initial VPS setup

The VPS needs Docker with Compose v2 or newer supporting `up --wait`, Nginx, Certbot's Nginx plugin, Bash, curl, and flock. Install the Compose plugin [system-wide](https://docs.docker.com/compose/install/linux/) so it also works with the deployment script's temporary `DOCKER_CONFIG`. `lixsu` needs Docker access and ownership of the deployment directory. Create the directory once:

```sh
sudo install -d -o lixsu -g lixsu /app/lixionary-simulator
```

Point `simulation.lixionary.com` to `157.173.112.110` using an A record or a CNAME to `lixionary.com`. Copy the host proxy configuration from `deploy/simulation.lixionary.com.conf` to the server, then run:

```sh
sudo install -m 644 simulation.lixionary.com.conf /etc/nginx/sites-available/simulation.lixionary.com.conf
sudo ln -s /etc/nginx/sites-available/simulation.lixionary.com.conf /etc/nginx/sites-enabled/simulation.lixionary.com.conf
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx --non-interactive --redirect -d simulation.lixionary.com
```

Certbot uses the VPS's existing ACME account and configures certificate renewal. Install the proxy once; the application workflow does not overwrite Certbot's TLS changes. Host ports 80 and 443 remain owned by the existing Nginx service.

### Operations and rollback

```sh
ssh lixsu@lixionary.com
cd /app/lixionary-simulator
docker compose ps
docker compose logs --tail 100 simulator
```

For rollback, use a previously deployed digest. The image must already exist on the VPS, or the shell must have registry pull access:

```sh
bash deploy/deploy.sh ghcr.io/lixionary/lixionary-simulator@sha256:<previous-digest>
```

For private images, pass a GitHub username as the second argument and pipe a token with `read:packages` on stdin. The script pulls before changing the running service; a registry failure leaves the current container running. Retain previous images if rollback is needed; this project does not prune shared VPS images.
