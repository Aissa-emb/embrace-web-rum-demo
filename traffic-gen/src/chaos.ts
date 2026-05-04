import type { Page } from 'playwright';
import type pino from 'pino';
import { rand, sleep, jitter } from './lib/randomize';

type ChaosEvent = {
  name: string;
  weight: number;
  run: (page: Page, log: pino.Logger) => Promise<void>;
};

const chaosEvents: ChaosEvent[] = [
  {
    name: 'rage-quit',
    weight: 25,
    run: async (page, log) => {
      log.warn('Chaos: rage-quit — aborting page mid-load');
      // Navigate and abort quickly
      const nav = page.goto('/', { waitUntil: 'networkidle' }).catch(() => {});
      await sleep(500);
      await page.evaluate(() => window.stop());
      await nav;
    },
  },
  {
    name: 'js-error',
    weight: 30,
    run: async (page, log) => {
      log.warn('Chaos: injecting JS error');
      const errors = [
        `throw new TypeError("Cannot read properties of undefined (reading 'map')")`,
        `throw new RangeError("Maximum call stack size exceeded")`,
        `throw new Error("NetworkError when attempting to fetch resource")`,
        `throw new SyntaxError("Unexpected token '<' in JSON at position 0")`,
      ];
      await page.evaluate(rand(errors));
    },
  },
  {
    name: 'rage-click',
    weight: 25,
    run: async (page, log) => {
      log.warn('Chaos: rage-clicking');
      // Find a clickable element and click it rapidly
      const btn = await page.$('button, a, [data-cy]');
      if (btn) {
        const box = await btn.boundingBox();
        if (box) {
          for (let i = 0; i < 7; i++) {
            await page.mouse.click(
              box.x + box.width / 2,
              box.y + box.height / 2,
              { delay: 50 }
            );
          }
        }
      }
    },
  },
  {
    name: 'navigate-404',
    weight: 20,
    run: async (page, log) => {
      log.warn('Chaos: navigating to 404');
      await page.goto('/nonexistent-page-' + Date.now(), {
        waitUntil: 'domcontentloaded',
        timeout: 10000,
      }).catch(() => {});
      await sleep(jitter(2000));
    },
  },
];

/**
 * Run a random chaos event on the page.
 */
export async function runChaosEvent(page: Page, log: pino.Logger): Promise<void> {
  const total = chaosEvents.reduce((sum, e) => sum + e.weight, 0);
  let roll = Math.random() * total;
  let event = chaosEvents[0];
  for (const e of chaosEvents) {
    roll -= e.weight;
    if (roll <= 0) {
      event = e;
      break;
    }
  }

  try {
    await event.run(page, log);
  } catch (err) {
    log.debug({ err, chaos: event.name }, 'Chaos event threw (expected)');
  }
}
