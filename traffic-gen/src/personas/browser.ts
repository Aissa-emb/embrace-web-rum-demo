import { S } from '../lib/selectors';
import type { Persona } from './index';

/**
 * Browser persona — browses the store, views 2-4 products, never buys.
 * Weight: 30 (most common visitor)
 */
export const browser: Persona = {
  name: 'browser',
  weight: 30,
  run: async ({ page, log, rand, sleep, jitter, randInt }) => {
    log.info('Starting browser persona');

    // Land on home page
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await sleep(jitter(3000));

    // Wait for product cards to render
    await page.waitForSelector(S.productCard, { timeout: 15000 });

    const productCount = randInt(2, 4);
    log.info({ productCount }, 'Will view products');

    for (let i = 0; i < productCount; i++) {
      // Get all product cards and pick one
      const cards = await page.$$(S.productCard);
      if (cards.length === 0) {
        log.warn('No product cards found');
        break;
      }

      const card = rand(cards);
      await card.click();

      // Wait for product detail page
      await page.waitForSelector(S.productDetail, { timeout: 30000 });

      // Read the product page
      await sleep(jitter(randInt(3000, 12000)));

      // Sometimes scroll down to see recommendations
      if (Math.random() < 0.4) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await sleep(jitter(2000));
      }

      // Go back to home
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector(S.productCard, { timeout: 30000 });
      await sleep(jitter(1500));
    }

    log.info('Browser persona complete');
  },
};
