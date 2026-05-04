import { S } from '../lib/selectors';
import type { Persona } from './index';

/**
 * Buyer persona — full happy-path: browse → add to cart → checkout → complete.
 * Weight: 20
 */
export const buyer: Persona = {
  name: 'buyer',
  weight: 20,
  run: async ({ page, log, rand, sleep, jitter }) => {
    log.info('Starting buyer persona');

    // Land on home
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await sleep(jitter(2000));
    await page.waitForSelector(S.productCard, { timeout: 15000 });

    // Click a random product
    const cards = await page.$$(S.productCard);
    if (cards.length === 0) throw new Error('No products found');
    const card = rand(cards);
    await card.click();

    // View product detail
    await page.waitForSelector(S.productDetail, { timeout: 10000 });
    await sleep(jitter(5000));

    // Add to cart
    const addBtn = await page.waitForSelector(S.productAddToCart, { timeout: 5000 });
    await addBtn.click();
    log.info('Added product to cart');
    await sleep(jitter(1500));

    // Open cart dropdown and go to shopping cart
    await page.click(S.cartIcon);
    await page.waitForSelector(S.cartDropdown, { timeout: 5000 });
    await sleep(jitter(1000));

    const goToCart = await page.waitForSelector(S.cartGoToShopping, { timeout: 5000 });
    await goToCart.click();

    // Wait for cart/checkout page
    await page.waitForURL('**/cart', { timeout: 10000 });
    await sleep(jitter(2000));

    // Fill checkout form
    await fillCheckoutForm(page, sleep, jitter);

    // Place order
    const placeOrder = await page.waitForSelector(S.checkoutPlaceOrder, { timeout: 5000 });
    await placeOrder.click();
    log.info('Placed order');

    // Wait for order confirmation
    await page.waitForURL('**/cart/checkout/**', { timeout: 15000 });
    await sleep(jitter(3000));

    log.info('Buyer persona complete — order placed');
  },
};

async function fillCheckoutForm(
  page: import('playwright').Page,
  sleep: (ms: number) => Promise<void>,
  jitter: (ms: number) => number
): Promise<void> {
  const fields = [
    { selector: S.checkoutEmail, value: `user${Date.now()}@example.com` },
    { selector: S.checkoutStreetAddress, value: '1600 Amphitheatre Parkway' },
    { selector: S.checkoutZipCode, value: '94043' },
    { selector: S.checkoutCity, value: 'Mountain View' },
    { selector: S.checkoutState, value: 'CA' },
    { selector: S.checkoutCreditCardNumber, value: '4432-8015-6152-0454' },
    { selector: S.checkoutCreditCardCvv, value: '672' },
  ];

  for (const field of fields) {
    const el = await page.waitForSelector(field.selector, { timeout: 5000 });
    await el.fill('');
    await el.type(field.value, { delay: jitter(50) });
    await sleep(jitter(400));
  }

  // Select country
  await page.selectOption(S.checkoutCountry, 'United States');
  await sleep(jitter(300));

  // Select expiration month and year
  await page.selectOption(S.checkoutCreditCardExpMonth, 'January');
  await sleep(jitter(200));
  await page.selectOption(S.checkoutCreditCardExpYear, '2030');
  await sleep(jitter(200));
}
