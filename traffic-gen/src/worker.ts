import { BrowserPool } from './lib/browser-pool';
import { createLogger } from './lib/logger';
import { weightedPick, rand, sleep, jitter, randInt } from './lib/randomize';
import { applyNetworkProfile, networkProfiles } from './profiles/network';
import { deviceProfiles, type DeviceProfile } from './profiles/device';
import { geoProfiles } from './profiles/geo';
import { allPersonas, getPersonaByName, type PersonaContext } from './personas';
import { getConfig } from './config';
import { runChaosEvent } from './chaos';

// ---------------------------------------------------------------------------
// Shared counter for MAX_SESSIONS across all workers (single-process model)
// ---------------------------------------------------------------------------

let _globalSessionCount = 0;

/** Atomically increment and return the new value. */
export function incrementGlobalSessions(): number {
  return ++_globalSessionCount;
}

export function getGlobalSessions(): number {
  return _globalSessionCount;
}

// ---------------------------------------------------------------------------
// Shutdown flag (set by index.ts on MAX_DURATION_S timeout)
// ---------------------------------------------------------------------------

let _shutdownRequested = false;

export function requestShutdown(): void {
  _shutdownRequested = true;
}

export function isShutdownRequested(): boolean {
  return _shutdownRequested;
}

// ---------------------------------------------------------------------------
// Worker loop
// ---------------------------------------------------------------------------

/**
 * A single worker loop — runs sessions until a termination condition is met:
 * - MAX_SESSIONS_PER_WORKER reached
 * - Global MAX_SESSIONS reached
 * - MAX_DURATION_S timeout
 * - SINGLE_RUN mode
 * - Shutdown signal
 */
export async function runWorker(workerId: number): Promise<void> {
  const config = getConfig();
  const log = createLogger(`worker-${workerId}`);
  const pool = new BrowserPool(config.HEADLESS);

  let sessionCount = 0;

  // Resolve device override once
  let deviceOverride: DeviceProfile | undefined;
  if (config.DEVICE_OVERRIDE) {
    deviceOverride = deviceProfiles.find(
      (d) => d.name === config.DEVICE_OVERRIDE
    );
    if (deviceOverride) {
      log.info({ device: deviceOverride.name }, 'Device override active');
    } else {
      log.warn(
        { requested: config.DEVICE_OVERRIDE },
        'Device override not found — using weighted random'
      );
    }
  }

  try {
    while (!_shutdownRequested) {
      // Per-worker session limit
      if (config.MAX_SESSIONS_PER_WORKER > 0 && sessionCount >= config.MAX_SESSIONS_PER_WORKER) {
        log.info({ sessionCount }, 'Reached max sessions per worker, stopping');
        break;
      }

      // Global session limit
      if (config.MAX_SESSIONS > 0) {
        const globalCount = incrementGlobalSessions();
        if (globalCount > config.MAX_SESSIONS) {
          log.info({ globalCount }, 'Reached global max sessions, stopping');
          break;
        }
      }

      sessionCount++;

      // Pick profiles
      const persona = config.PERSONA_OVERRIDE
        ? getPersonaByName(config.PERSONA_OVERRIDE) ?? weightedPick(allPersonas)
        : weightedPick(allPersonas);

      const network = weightedPick(networkProfiles);
      const device = deviceOverride ?? weightedPick(deviceProfiles);
      const geo = weightedPick(geoProfiles);

      log.info(
        {
          session: sessionCount,
          persona: persona.name,
          network: network.name,
          device: device.name,
          geo: geo.name,
          runSource: config.RUN_SOURCE,
        },
        'Starting session'
      );

      let context;
      let page;

      try {
        const browser = await pool.getBrowser();

        // Create fresh context with device/geo profile
        context = await browser.newContext({
          baseURL: config.STOREFRONT_URL,
          ...device.descriptor,
          geolocation: { latitude: geo.lat, longitude: geo.lng },
          locale: geo.locale,
          timezoneId: geo.tz,
          permissions: ['geolocation'],
          extraHTTPHeaders: {
            'Accept-Language': geo.locale,
          },
        });

        page = await context.newPage();
        page.setDefaultTimeout(30000);
        page.setDefaultNavigationTimeout(30000);

        // Apply network + CPU throttling via CDP
        await applyNetworkProfile(page, network);

        // Navigate to storefront with run_source and persona as query params
        // so the Embrace SDK can tag the session without a rebuild.
        const baseUrl = config.STOREFRONT_URL;
        const params = new URLSearchParams({
          run_source: config.RUN_SOURCE,
          user_persona: persona.name,
        });
        await page.goto(`${baseUrl}/?${params.toString()}`, {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });

        // Build persona context
        const ctx: PersonaContext = {
          page,
          log: log.child({ persona: persona.name, session: sessionCount }),
          rand,
          sleep,
          jitter,
          randInt,
        };

        // Run the persona
        await persona.run(ctx);

        // Maybe run a chaos event
        if (Math.random() < config.CHAOS_RATE) {
          await runChaosEvent(page, log);
        }

        log.info({ session: sessionCount, persona: persona.name }, 'Session complete');
      } catch (err) {
        log.error(
          { err, session: sessionCount, persona: persona.name },
          'Session failed (non-fatal)'
        );
      } finally {
        // Clean up — close context but keep browser alive
        if (context) {
          try {
            await context.close();
          } catch {
            // ignore close errors
          }
        }
      }

      // Pause between sessions
      const gap = jitter(config.SESSION_GAP_MS);
      log.debug({ gapMs: gap }, 'Waiting between sessions');
      await sleep(gap);

      // Single-run mode for debugging
      if (config.SINGLE_RUN) break;
    }
  } finally {
    await pool.close();
  }
}
