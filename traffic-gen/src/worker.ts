import { BrowserPool } from './lib/browser-pool';
import { createLogger } from './lib/logger';
import { weightedPick, rand, sleep, jitter, randInt } from './lib/randomize';
import { applyNetworkProfile, networkProfiles } from './profiles/network';
import { deviceProfiles } from './profiles/device';
import { geoProfiles } from './profiles/geo';
import { allPersonas, getPersonaByName, type PersonaContext } from './personas';
import { getConfig } from './config';
import { runChaosEvent } from './chaos';

/**
 * A single worker loop — runs sessions indefinitely (or up to MAX_SESSIONS).
 */
export async function runWorker(workerId: number): Promise<void> {
  const config = getConfig();
  const log = createLogger(`worker-${workerId}`);
  const pool = new BrowserPool(config.HEADLESS);

  let sessionCount = 0;

  try {
    while (true) {
      if (config.MAX_SESSIONS_PER_WORKER > 0 && sessionCount >= config.MAX_SESSIONS_PER_WORKER) {
        log.info({ sessionCount }, 'Reached max sessions, stopping');
        break;
      }

      sessionCount++;

      // Pick profiles
      const persona = config.PERSONA_OVERRIDE
        ? getPersonaByName(config.PERSONA_OVERRIDE) ?? weightedPick(allPersonas)
        : weightedPick(allPersonas);

      const network = weightedPick(networkProfiles);
      const device = weightedPick(deviceProfiles);
      const geo = weightedPick(geoProfiles);

      log.info(
        {
          session: sessionCount,
          persona: persona.name,
          network: network.name,
          device: device.name,
          geo: geo.name,
        },
        'Starting session'
      );

      let context;
      let page;

      try {
        const browser = await pool.getBrowser();

        // Create fresh context with device/geo profile
        context = await browser.newContext({
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

        // Apply network + CPU throttling via CDP
        await applyNetworkProfile(page, network);

        // Navigate to storefront base URL
        const baseUrl = config.STOREFRONT_URL;
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

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
