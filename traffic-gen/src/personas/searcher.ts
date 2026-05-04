import { S } from '../lib/selectors';
import type { Persona } from './index';

/**
 * Searcher persona — navigates categories, views 1-2 products.
 * The OTel demo doesn't have a search box, so this uses category browsing.
 * Weight: 15
 */
export const searcher: Persona = {
  name: 'searcher',
  weight: 15,
  run: async ({ page, log, rand, sleep, jitter, randInt }) => {
    log.info('Starting searcher persona');

    // Land on home
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await sleep(jitter(2000));
    await page.waitForSelector(S.productCard, { timeout: 15000 });

    // Scroll through the page like searching for something
    await page.evaluate(() => window.scrollTo(0, 300));
    await sleep(jitter(1500));
    await page.evaluate(() => window.scrollTo(0, 600));
    await sleep(jitter(1500));
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(jitter(1000));

    const productCount = randInt(1, 2);
    for (let i = 0; i < productCount; i++) {
      const cards = await page.$$(S.productCard);
      if (cards.length === 0) break;

      const card = rand(cards);
      await card.click();

      await page.waitForSelector(S.productDetail, { timeout: 10000 });
      await sleep(jitter(randInt(4000, 10000)));

      // Scroll to read description
      await page.evaluate(() => window.scrollBy(0, 400));
      await sleep(jitter(3000));

      // Maybe add to cart (30% chance)
      if (Math.random() < 0.3) {
        const addBtn = await page.$(S.productAddToCart);
        if (addBtn) {
          await addBtn.click();
          log.info('Searcher added product to cart');
          await sleep(jitter(1000));
        }
      }

      // Go back home
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector(S.productCard, { timeout: 10000 });
      await sleep(jitter(1000));
    }

    log.info('Searcher persona complete');
  },
};
