# Traffic Generator

Playwright-based traffic generator for the Embrace Web RUM demo. Spawns N concurrent headless Chromium workers, each running randomized persona scripts under varied network, device, and geo conditions.

## How Personas Work

Each worker loop:
1. Picks a **persona** (weighted random)
2. Picks a **network profile** (cable, 4G, 3G, wifi)
3. Picks a **device profile** (desktop, iPhone, Pixel, etc.)
4. Picks a **geo profile** (US, UK, India, Japan, etc.)
5. Creates a fresh browser context (= fresh Embrace session)
6. Runs the persona script
7. Optionally triggers a chaos event
8. Closes the context
9. Waits `SESSION_GAP_MS`
10. Repeats

## Adding a New Persona

1. Create `src/personas/my-persona.ts`:

```typescript
import { S } from '../lib/selectors';
import type { Persona } from './index';

export const myPersona: Persona = {
  name: 'my-persona',
  weight: 10,
  run: async ({ page, log, rand, sleep, jitter }) => {
    // Your persona logic here
    await page.goto('/');
    await sleep(jitter(3000));
  },
};
```

2. Add it to `src/personas/index.ts`:

```typescript
import { myPersona } from './my-persona';

export const allPersonas: Persona[] = [
  // ... existing
  myPersona,
];
```

3. Adjust other persona weights so they still feel right.

## Adding a Network/Device/Geo Profile

Add an entry to the corresponding array in `src/profiles/`. Each profile has a `name`, `weight`, and type-specific config.

## Debugging

### Run a single persona in a visible browser

```bash
npm run dev -- --persona=buyer --once --headed
```

### Run against a local storefront

```bash
STOREFRONT_URL=http://localhost:8080 npm run dev -- --once
```

### Run the smoke tests

```bash
npm test
```

## Docker

The traffic generator is designed to run inside Docker as part of the root `docker-compose.yml`:

```bash
# From the repo root
docker compose --profile traffic up --build
```

Standalone build:

```bash
docker build -t traffic-gen .
docker run --network opentelemetry-demo -e STOREFRONT_URL=http://frontend-proxy:8080 traffic-gen
```
