# Embrace Web RUM Demo

A continuously-running ecommerce storefront that generates realistic [Embrace](https://embrace.io) Web RUM telemetry — Core Web Vitals (LCP, INP, CLS), JS errors, session timelines, and network resource timing — driven by a fleet of headless Chromium browsers under varied network and device conditions.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Traffic Generator (Node + Playwright)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ Worker 1 │  │ Worker 2 │  │ Worker 3 │  │ Worker N │    │
│  │ Chromium │  │ Chromium │  │ Chromium │  │ Chromium │    │
│  │ Persona  │  │ Persona  │  │ Persona  │  │ Persona  │    │
│  │ + Net    │  │ + Net    │  │ + Net    │  │ + Net    │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
└───────┼─────────────┼─────────────┼─────────────┼──────────┘
        │             │             │             │
        └──────┬──────┴──────┬──────┴──────┬──────┘
               ▼             ▼             ▼
        ┌─────────────────────────────────────┐
        │  Storefront (Next.js + Embrace SDK) │
        │  (forked otel-demo frontend)        │
        └────────────────┬────────────────────┘
                         │
                         ▼
        ┌─────────────────────────────────────┐
        │  Backend microservices              │
        │  (cart, checkout, payment, etc.)    │
        └─────────────────────────────────────┘

        Browser SDK ──────► Embrace ingest endpoint
```

**Three components:**

| Component | What | Tech |
|---|---|---|
| **Storefront** | Forked OpenTelemetry Astronomy Shop with Embrace Web SDK injected | Next.js, Go, Rust, Python, Java, .NET, Ruby |
| **Traffic Generator** | Headless Chromium fleet running persona scripts | Node.js, Playwright, TypeScript |
| **Orchestration** | Docker Compose with profiles | Docker Compose v2 |

## Quickstart

### 1. Clone and configure

```bash
git clone <repo-url> embrace-web-rum-demo
cd embrace-web-rum-demo
cp .env.example .env
```

Edit `.env` and set your **Embrace App ID**:

```
EMBRACE_APP_ID=your_app_id_here
```

### 2. Start the storefront

```bash
docker compose up --build
```

Open [http://localhost:8080](http://localhost:8080) — you should see the Astronomy Shop.

### 3. Start with traffic generation

```bash
docker compose --profile traffic up --build
```

This starts the storefront **plus** 5 headless Chromium workers generating realistic user sessions.

## Scaling Workers

| Workers | RAM | CPU | Use case |
|---|---|---|---|
| 5 (default) | 2-3 GB | 2 vCPU | Local dev |
| 10 | 4-6 GB | 4 vCPU | Demo |
| 20 | 8-12 GB | 6-8 vCPU | Stress test |

Scale via environment variable:

```bash
TRAFFIC_WORKER_COUNT=10 docker compose --profile traffic up
```

## Traffic Generator

### Personas

Each session runs a weighted persona script:

| Persona | Weight | Behavior |
|---|---|---|
| `browser` | 30% | Views 2-4 products, never buys |
| `buyer` | 20% | Full checkout flow |
| `cart-abandoner` | 20% | Adds to cart, views cart, leaves |
| `searcher` | 15% | Scrolls through products, reads descriptions |
| `bouncer` | 10% | Lands, stays 2-5s, leaves |
| `power-user` | 5% | Views 5+ products, adds 2-3, completes checkout |

### Network Profiles

Each session gets a random network condition via Chrome DevTools Protocol:

| Profile | Weight | Download | Latency | CPU Throttle |
|---|---|---|---|---|
| cable | 35% | 5 Mbps | 28ms | 1x |
| fast-4g | 25% | 9 Mbps | 85ms | 2x |
| slow-4g | 20% | 1.6 Mbps | 150ms | 4x |
| fast-3g | 10% | 1.5 Mbps | 300ms | 4x |
| slow-3g | 5% | 500 Kbps | 400ms | 6x |
| wifi | 5% | 30 Mbps | 10ms | 1x |

### Device Profiles

Randomized viewport, DPR, and user agent:

Desktop (1080p, 1440p, MacBook 13"), iPhone 14, iPhone SE, Pixel 7, Galaxy S9+

### Geo Profiles

Randomized locale, timezone, and geolocation:

US West, US East, US Central, UK, Germany, India, Japan, Brazil, Australia

### Chaos Mode

5% of sessions (configurable via `TRAFFIC_CHAOS_RATE`) get a chaos event:
- **Rage quit** — abort page mid-load
- **JS error** — inject a realistic TypeError/RangeError/etc.
- **Rage click** — 7 rapid clicks on one element
- **404 navigation** — navigate to nonexistent page

### Debugging a Persona

Run a single persona headed (visible browser):

```bash
cd traffic-gen
npm run dev -- --persona=buyer --once --headed
```

## Backend Fault Injection

The OTel demo ships with feature flags that inject backend failures. Toggle them at [http://localhost:8080/feature](http://localhost:8080/feature) via flagd-ui. These create real failed network requests visible in Embrace session timelines.

## Configuration

| Variable | Default | Description |
|---|---|---|
| `EMBRACE_APP_ID` | *(required)* | Embrace Web app ID |
| `TRAFFIC_WORKER_COUNT` | `5` | Concurrent headless browsers |
| `TRAFFIC_SESSION_GAP_MS` | `2000` | Pause between sessions per worker |
| `TRAFFIC_LOG_LEVEL` | `info` | Pino log level |
| `TRAFFIC_CHAOS_RATE` | `0.05` | Fraction of sessions with chaos events |

## Repo Layout

```
embrace-web-rum-demo/
├── docker-compose.yml            # Full stack (storefront + traffic gen)
├── docker-compose.minimal.yml    # Storefront only
├── .env.example                  # Configuration template
│
├── storefront/                   # Forked & slimmed OTel demo
│   ├── docker-compose.yml        # 16-service storefront stack
│   ├── .env
│   └── src/
│       ├── frontend/             # Next.js + Embrace SDK
│       ├── frontend-proxy/       # Envoy reverse proxy
│       ├── cart/                  # .NET
│       ├── checkout/             # Go
│       ├── product-catalog/      # Go
│       ├── currency/             # C++
│       ├── recommendation/       # Python
│       ├── shipping/             # Rust (hardcoded shipping cost)
│       ├── payment/              # JavaScript
│       ├── email/                # Ruby
│       ├── ad/                   # Java
│       ├── image-provider/       # nginx
│       ├── flagd/                # Feature flags
│       └── flagd-ui/             # Flag management UI
│
└── traffic-gen/                  # Playwright traffic generator
    ├── Dockerfile
    ├── src/
    │   ├── index.ts              # Entry point
    │   ├── worker.ts             # Session loop
    │   ├── chaos.ts              # Fault injection
    │   ├── config.ts             # Env validation
    │   ├── personas/             # 6 user personas
    │   ├── profiles/             # Network, device, geo profiles
    │   └── lib/                  # Utilities
    └── tests/
```

## Troubleshooting

### Port 8080 in use
```bash
lsof -i :8080  # find what's using it
# or change ENVOY_PORT in storefront/.env
```

### Playwright base image mismatch
The `mcr.microsoft.com/playwright:vX.Y.Z-jammy` tag in `traffic-gen/Dockerfile` must match the `playwright` npm version in `traffic-gen/package.json`. Mismatch causes browser-launch failures.

### Backend services logging OTel export errors
Expected. Since we removed the OTel Collector, some services log warnings about failed telemetry exports. These are harmless — the services function normally.

### First build is slow
Backend services are pulled as pre-built Docker images. Only `frontend`, `frontend-proxy`, `shipping`, and `traffic-gen` are built from source. First build takes ~5 minutes; subsequent builds use cache.

## Credits

Based on the [OpenTelemetry Astronomy Shop](https://github.com/open-telemetry/opentelemetry-demo) demo application.
