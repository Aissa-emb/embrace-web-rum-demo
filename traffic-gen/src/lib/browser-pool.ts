import { chromium, Browser } from 'playwright';
import { createLogger } from './logger';

const log = createLogger('browser-pool');

/**
 * Manages a single persistent Chromium browser instance per worker.
 * Contexts are created and destroyed per session for clean state.
 */
export class BrowserPool {
  private browser: Browser | null = null;
  private headless: boolean;

  constructor(headless: boolean = true) {
    this.headless = headless;
  }

  async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      log.info('Launching new Chromium instance');
      this.browser = await chromium.launch({
        headless: this.headless,
        args: [
          '--disable-dev-shm-usage',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-gpu',
        ],
      });
    }
    return this.browser;
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      log.info('Browser closed');
    }
  }
}
