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

      await page.waitForSelector(S.productDetail, { timeout: 10000 });
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
            const qtyInput = await page.$(S.productQuantity);
            if (qtyInput) {
              await qtyInput.fill('');
              await qtyInput.type(String(randInt(1, 3)), { delay: 100 });
              await sleep(jitter(500));
            }
          }

          await addBtn.click();
          added++;
          log.info({ added, total: productsToAdd }, 'Power user added product');
          await sleep(jitter(1000));
        }
      }

      // Go back home
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector(S.productCard, { timeout: 10000 });
      await sleep(jitter(1000));
    }

    // Go to cart and checkout
    await page.click(S.cartIcon);
    await page.waitForSelector(S.cartDropdown, { timeout: 5000 });
    await sleep(jitter(1000));

    const goToCart = await page.waitForSelector(S.cartGoToShopping, { timeout: 5000 });
    await goToCart.click();
    await page.waitForURL('**/cart', { timeout: 10000 });
    await sleep(jitter(3000));

    // Fill checkout form
    await fillPowerUserCheckout(page, sleep, jitter);

    // Place order
    const placeOrder = await page.waitForSelector(S.checkoutPlaceOrder, { timeout: 5000 });
    await placeOrder.click();
    log.info('Power user placed order');

    await page.waitForURL('**/cart/checkout/**', { timeout: 15000 });
    await sleep(jitter(3000));

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
    { selector: S.checkoutCreditCardNumber, value: '4532-0153-4280-7832' },
    { selector: S.checkoutCreditCardCvv, value: '431' },
  ];

  for (const field of fields) {
    const el = await page.waitForSelector(field.selector, { timeout: 5000 });
    await el.fill('');
    await el.type(field.value, { delay: jitter(40) });
    await sleep(jitter(350));
  }

  await page.selectOption(S.checkoutCountry, 'United States');
  await sleep(jitter(200));
  await page.selectOption(S.checkoutCreditCardExpMonth, 'March');
  await sleep(jitter(200));
  await page.selectOption(S.checkoutCreditCardExpYear, '2028');
  await sleep(jitter(200));
}
