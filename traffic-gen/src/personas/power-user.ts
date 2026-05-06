import { S } from '../lib/selectors';
import type { Persona } from './index';

/**
 * Power user persona — views 5+ products, adds 2-3 to cart, completes checkout.
 * Weight: 5 (rare but high-value)
 */
export const powerUser: Persona = {
  name: 'power-user',
  weight: 5,
  run: async ({ page, log, rand, sleep, jitter, randInt }) => {
    log.info('Starting power-user persona');

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await sleep(jitter(2000));
    await page.waitForSelector(S.productCard, { timeout: 15000 });

    const productsToView = randInt(5, 8);
    const productsToAdd = randInt(2, 3);
    let added = 0;

    log.info({ productsToView, productsToAdd }, 'Power user plan');

    for (let i = 0; i < productsToView; i++) {
      const cards = await page.$$(S.productCard);
      if (cards.length === 0) break;

      const card = rand(cards);
      await card.click();

      await page.waitForSelector(S.productDetail, { timeout: 30000 });
      await sleep(jitter(randInt(2000, 6000)));

      // Scroll to see full product
      await page.evaluate(() => window.scrollBy(0, 300));
      await sleep(jitter(1500));

      // Add to cart if we haven't reached our target
      if (added < productsToAdd && (i >= productsToView - productsToAdd || Math.random() < 0.5)) {
        const addBtn = await page.$(S.productAddToCart);
        if (addBtn) {
          // Sometimes change quantity first
          if (Math.random() < 0.3) {
            const qty = String(randInt(1, 3));
            await page.selectOption(S.productQuantity, qty);
            await sleep(jitter(500));
          }

          await addBtn.click();
          added++;
          log.info({ added, total: productsToAdd }, 'Power user added product');
          await sleep(jitter(1000));
        }
      }

      // Go back home
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector(S.productCard, { timeout: 30000 });
      await sleep(jitter(1000));
    }

    // Navigate to cart page directly (dropdown is unreliable on mobile viewports)
    await page.goto('/cart', { waitUntil: 'domcontentloaded' });
    await sleep(jitter(3000));

    // Fill checkout form
    await fillPowerUserCheckout(page, sleep, jitter);

    // Place order
    const placeOrder = await page.waitForSelector(S.checkoutPlaceOrder, { timeout: 15000 });
    await placeOrder.click();
    log.info('Power user placed order');

    // Wait for order confirmation (may timeout under heavy throttling — that's OK,
    // the order was already placed and RUM data captured)
    try {
      await page.waitForURL('**/cart/checkout/**', { timeout: 30000, waitUntil: 'domcontentloaded' });
      await sleep(jitter(3000));
    } catch {
      log.warn('Checkout confirmation page timed out (order was still placed)');
    }

    log.info({ productsViewed: productsToView, productsAdded: added }, 'Power-user persona complete');
  },
};

async function fillPowerUserCheckout(
  page: import('playwright').Page,
  sleep: (ms: number) => Promise<void>,
  jitter: (ms: number) => number
): Promise<void> {
  const fields = [
    { selector: S.checkoutEmail, value: `poweruser${Date.now()}@enterprise.com` },
    { selector: S.checkoutStreetAddress, value: '350 Fifth Avenue' },
    { selector: S.checkoutZipCode, value: '10118' },
    { selector: S.checkoutCity, value: 'New York' },
    { selector: S.checkoutState, value: 'NY' },
    { selector: S.checkoutCreditCardNumber, value: '4432-8015-6152-0454' },
    { selector: S.checkoutCreditCardCvv, value: '431' },
  ];

  for (const field of fields) {
    const el = await page.waitForSelector(field.selector, { timeout: 15000 });
    await el.fill('');
    await el.type(field.value, { delay: jitter(40) });
    await sleep(jitter(350));
  }

  // Country is a text input, not a select
  const countryEl = await page.waitForSelector(S.checkoutCountry);
  await countryEl.fill('');
  await countryEl.type('United States', { delay: jitter(40) });
  await sleep(jitter(200));
  await page.selectOption(S.checkoutCreditCardExpMonth, '3');
  await sleep(jitter(200));
  await page.selectOption(S.checkoutCreditCardExpYear, '2028');
  await sleep(jitter(200));
}
