import type { Persona } from './index';

/**
 * Bouncer persona — lands on the home page, stays 2-5 seconds, then leaves.
 * Weight: 10
 */
export const bouncer: Persona = {
  name: 'bouncer',
  weight: 10,
  run: async ({ page, log, sleep, jitter, randInt }) => {
    log.info('Starting bouncer persona');

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Stay very briefly
    const stayMs = randInt(2000, 5000);
    await sleep(jitter(stayMs, 0.1));

    // Maybe scroll a tiny bit before leaving
    if (Math.random() < 0.3) {
      await page.evaluate(() => window.scrollTo(0, 200));
      await sleep(500);
    }

    log.info({ stayMs }, 'Bouncer persona complete — bounced');
  },
};
