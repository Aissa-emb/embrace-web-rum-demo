/**
 * Web Vitals Chaos — Inject realistic performance degradations so the
 * Embrace dashboard shows a believable distribution of good / needs-improvement / poor.
 *
 * Target distribution (matches real e-commerce CrUX data):
 *   ~65% good, ~25% needs-improvement, ~10% poor
 *
 * TTFB is handled server-side in _app.tsx (getInitialProps delay).
 * This module handles client-side metrics: LCP, FCP, CLS, INP, TBD, and JS errors.
 *
 * Call `injectWebVitalsChaos()` once from _app.tsx after Embrace init.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Block the main thread synchronously for `ms` milliseconds. */
function blockMainThread(ms: number) {
  const end = performance.now() + ms;
  // eslint-disable-next-line no-empty
  while (performance.now() < end) {}
}

/** Return a random number between min and max (inclusive). */
function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

/** True with the given probability (0–1). */
function chance(p: number) {
  return Math.random() < p;
}

/**
 * Weighted random pick — favors the lower end of the range.
 * Simulates the long-tail distribution seen in real performance data
 * where most values are okay and only a few are truly terrible.
 */
function skewedRand(min: number, max: number): number {
  // Square the random value to skew toward the lower end
  const t = Math.random() * Math.random();
  return min + t * (max - min);
}

// ---------------------------------------------------------------------------
// Individual degradations
// ---------------------------------------------------------------------------

/**
 * Degrade LCP — delay the largest image/element from painting.
 * Uses a skewed distribution: most degradations are mild (500ms–1.5s above
 * baseline), but a few are severe (3–5s above baseline).
 */
function degradeLCP() {
  const delayMs = skewedRand(500, 4000);
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;top:0;left:0;width:100%;height:100%;' +
    'background:white;z-index:99999;pointer-events:none;opacity:1;' +
    'transition:opacity 0.15s ease-out;';
  document.body.appendChild(overlay);
  // Fade out near the end so it looks like a gradual render, not a sudden pop
  setTimeout(() => { overlay.style.opacity = '0'; }, delayMs - 150);
  setTimeout(() => overlay.remove(), delayMs);
}

/**
 * Degrade CLS — inject layout shifts after initial paint.
 * Mimics a late-loading ad banner or dynamically resized hero.
 * Tuned to produce CLS in the 0.05–0.30 range.
 */
function degradeCLS() {
  // 1–3 layout shifts (fewer than before, with smaller heights)
  const shiftCount = Math.floor(rand(1, 4));
  for (let i = 0; i < shiftCount; i++) {
    setTimeout(() => {
      const shifter = document.createElement('div');
      const height = Math.floor(rand(20, 80)); // smaller shifts
      shifter.style.cssText =
        `width:100%;height:${height}px;background:transparent;` +
        'position:relative;overflow:hidden;';
      document.body.insertBefore(shifter, document.body.firstChild);
      setTimeout(() => {
        shifter.style.height = '0px';
        setTimeout(() => shifter.remove(), 100);
      }, rand(200, 500));
    }, rand(800, 3000) + i * rand(400, 800));
  }
}

/**
 * Degrade INP — add main-thread-blocking work to click/tap handlers.
 * Skewed distribution: most interactions are mildly slow (100–250ms),
 * some are sluggish (250–500ms).
 */
function degradeINP() {
  const blockMs = skewedRand(100, 500);
  document.addEventListener(
    'click',
    () => {
      // Only block ~50% of clicks so the metric varies within a session
      if (chance(0.5)) {
        blockMainThread(blockMs);
      }
    },
    { capture: true, passive: true }
  );
}

/**
 * Degrade FCP — block rendering with a synchronous script early in load.
 * Gentler range: 200–800ms (the TTFB delay already adds baseline latency).
 */
function degradeFCP() {
  blockMainThread(skewedRand(200, 800));
}

/**
 * Schedule heavy long tasks that increase Total Blocking Duration (TBD).
 * Mimics JS bundle evaluation, hydration, and third-party script execution.
 */
function degradeTBD() {
  const taskCount = Math.floor(rand(2, 5));
  for (let i = 0; i < taskCount; i++) {
    setTimeout(() => {
      blockMainThread(rand(60, 200));
    }, rand(1000, 8000));
  }
}

/**
 * Degrade Errors — throw realistic-looking unhandled exceptions.
 * These are the actual crash-level errors. Kept at LOW frequency.
 */
function degradeCrashingExceptions() {
  const errors = [
    () => { throw new TypeError("Cannot read properties of undefined (reading 'map')"); },
    () => { throw new ReferenceError("gtag is not defined"); },
    () => { throw new TypeError("document.getElementById(...) is null"); },
    () => { throw new Error("ResizeObserver loop limit exceeded"); },
    () => { Promise.reject(new TypeError("Failed to fetch")); },
  ];

  setTimeout(() => {
    errors[Math.floor(Math.random() * errors.length)]();
  }, rand(3000, 20000));
}

/**
 * Non-crashing logged errors — reported to Embrace via log.message() and
 * console.error(). These populate the Errors/Logs section of the dashboard
 * without killing the page. Fires frequently with realistic e-commerce
 * error messages across many categories.
 */
function degradeLoggedErrors() {
  // Dynamic import to avoid circular deps at module scope
  const logError = (message: string, attrs?: Record<string, string | number | boolean>) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { log } = require('@embrace-io/web-sdk');
      log.message(message, 'error', attrs ? { attributes: attrs } : undefined);
    } catch {
      // SDK not ready — fallback to console
      console.error(`[embrace-log] ${message}`, attrs);
    }
  };

  const logWarning = (message: string, attrs?: Record<string, string | number | boolean>) => {
    try {
      const { log } = require('@embrace-io/web-sdk');
      log.message(message, 'warning', attrs ? { attributes: attrs } : undefined);
    } catch {
      console.warn(`[embrace-log] ${message}`, attrs);
    }
  };

  // -----------------------------------------------------------------------
  // Error catalogue — realistic e-commerce issues across categories
  // -----------------------------------------------------------------------
  const errorPool: Array<{ weight: number; delay: [number, number]; fn: () => void }> = [
    // --- Payment & Checkout ---
    { weight: 8, delay: [5000, 25000], fn: () =>
      logError('Payment gateway timeout: Stripe responded with 504 after 30000ms', {
        gateway: 'stripe', status_code: 504, cart_total: +(Math.random() * 300 + 20).toFixed(2),
      })
    },
    { weight: 6, delay: [4000, 18000], fn: () =>
      logWarning('Payment method validation failed: card_declined', {
        decline_code: 'insufficient_funds', retry_count: Math.floor(rand(1, 3)),
      })
    },
    { weight: 4, delay: [8000, 30000], fn: () =>
      logError('Checkout session expired before order submission', {
        session_age_ms: Math.floor(rand(1800000, 3600000)), items_in_cart: Math.floor(rand(1, 8)),
      })
    },

    // --- Inventory & Product ---
    { weight: 7, delay: [3000, 15000], fn: () =>
      logWarning('Inventory sync conflict: local quantity differs from warehouse', {
        product_id: `SKU-${Math.floor(rand(10000, 99999))}`, local_qty: Math.floor(rand(0, 5)), warehouse_qty: 0,
      })
    },
    { weight: 5, delay: [2000, 12000], fn: () =>
      logError('Product image CDN returned 403 Forbidden', {
        cdn_host: 'img.astronomy-shop.com', status: 403, path: `/products/img_${Math.floor(rand(100, 999))}.webp`,
      })
    },
    { weight: 4, delay: [6000, 20000], fn: () =>
      logWarning('Product price mismatch between catalog and cart service', {
        product_id: `OTEL-${Math.floor(rand(1000, 9999))}`, catalog_price: 49.99, cart_price: 44.99,
      })
    },

    // --- API & Network ---
    { weight: 9, delay: [2000, 10000], fn: () =>
      logError('API request failed: /api/recommendations returned 500', {
        endpoint: '/api/recommendations', status: 500, latency_ms: Math.floor(rand(2000, 8000)),
      })
    },
    { weight: 6, delay: [5000, 15000], fn: () =>
      logWarning('Retry exhausted for /api/currency: 3/3 attempts failed', {
        endpoint: '/api/currency', attempts: 3, last_error: 'ECONNRESET',
      })
    },
    { weight: 5, delay: [3000, 12000], fn: () =>
      logError('GraphQL query timeout: productSearch exceeded 5000ms', {
        operation: 'productSearch', timeout_ms: 5000, query_complexity: Math.floor(rand(15, 45)),
      })
    },
    { weight: 7, delay: [1000, 8000], fn: () =>
      logWarning('CORS preflight rejected for analytics endpoint', {
        origin: 'www.astronomy-shop.com', blocked_url: 'https://analytics.vendor.io/v2/collect',
      })
    },

    // --- Third-party SDKs ---
    { weight: 8, delay: [2000, 10000], fn: () =>
      logWarning('Google Analytics gtag.js failed to load: net::ERR_BLOCKED_BY_CLIENT', {
        script_src: 'https://www.googletagmanager.com/gtag/js', likely_cause: 'ad_blocker',
      })
    },
    { weight: 5, delay: [4000, 14000], fn: () =>
      logError('Intercom widget initialization failed: invalid workspace ID', {
        sdk: 'intercom', workspace_id: 'ws_demo_12345', error_type: 'AuthenticationError',
      })
    },
    { weight: 3, delay: [6000, 20000], fn: () =>
      logWarning('Sentry SDK rate limited: dropping event', {
        sdk: 'sentry', reason: '429 Too Many Requests', events_dropped: Math.floor(rand(1, 5)),
      })
    },

    // --- User Session & Auth ---
    { weight: 6, delay: [3000, 12000], fn: () =>
      logWarning('Session token refresh failed: 401 Unauthorized', {
        token_age_s: Math.floor(rand(3500, 7200)), endpoint: '/api/auth/refresh',
      })
    },
    { weight: 4, delay: [8000, 25000], fn: () =>
      logError('User preference sync failed: localStorage quota exceeded', {
        storage_used_bytes: Math.floor(rand(4800000, 5200000)), quota_bytes: 5242880,
      })
    },

    // --- Rendering & UI ---
    { weight: 7, delay: [1000, 6000], fn: () =>
      logWarning('Image lazy-load observer disconnected unexpectedly', {
        images_pending: Math.floor(rand(3, 12)), viewport_height: 844,
      })
    },
    { weight: 5, delay: [2000, 10000], fn: () =>
      logError('Hydration mismatch: server HTML differs from client render', {
        component: 'ProductCard', attribute: 'data-price', server_value: '$49.99', client_value: '$0.00',
      })
    },
    { weight: 4, delay: [5000, 15000], fn: () =>
      logWarning('React StrictMode double-render detected slow component: CartSidebar (340ms)', {
        component: 'CartSidebar', render_time_ms: Math.floor(rand(200, 500)),
      })
    },

    // --- Feature Flags & A/B Testing ---
    { weight: 5, delay: [1000, 8000], fn: () =>
      logWarning('Feature flag evaluation timeout: flagd server unreachable after 3000ms', {
        flag_key: 'productCatalogFailure', timeout_ms: 3000, fallback_used: true,
      })
    },
    { weight: 3, delay: [4000, 16000], fn: () =>
      logError('A/B test assignment conflict: user in multiple exclusive experiments', {
        experiments: 'checkout_v2,checkout_v3', user_segment: 'returning_customer',
      })
    },

    // --- Performance & Resource ---
    { weight: 6, delay: [3000, 10000], fn: () =>
      logWarning('Memory usage warning: JS heap approaching limit', {
        used_mb: Math.floor(rand(180, 240)), limit_mb: 256, gc_count: Math.floor(rand(15, 40)),
      })
    },
    { weight: 4, delay: [7000, 20000], fn: () =>
      logError('Service Worker registration failed: SecurityError', {
        sw_url: '/sw.js', error: 'Failed to register: SecurityError', protocol: 'http:',
      })
    },
    { weight: 5, delay: [2000, 8000], fn: () =>
      logWarning('Web Worker message channel closed unexpectedly', {
        worker: 'search-indexer', pending_tasks: Math.floor(rand(2, 8)), uptime_s: Math.floor(rand(30, 300)),
      })
    },
  ];

  // Pick 2–5 errors per page load from the weighted pool
  const totalWeight = errorPool.reduce((sum, e) => sum + e.weight, 0);
  const errorCount = Math.floor(rand(2, 6));

  for (let i = 0; i < errorCount; i++) {
    let roll = Math.random() * totalWeight;
    for (const entry of errorPool) {
      if (roll < entry.weight) {
        const [minDelay, maxDelay] = entry.delay;
        setTimeout(entry.fn, rand(minDelay, maxDelay));
        break;
      }
      roll -= entry.weight;
    }
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Call once per page load. Each degradation fires independently based on its
 * probability, creating a realistic spread across sessions.
 *
 * Target distribution for each metric (at chaosRate = 1.0):
 *   LCP:  ~20% of pages degraded → dashboard shows ~70% good, ~20% NI, ~10% poor
 *   CLS:  ~15% of pages degraded → dashboard shows ~75% good, ~15% NI, ~10% poor
 *   INP:  ~22% of pages degraded → dashboard shows ~70% good, ~20% NI, ~10% poor
 *   FCP:  ~12% of pages degraded → most pages unaffected (FCP rarely poor on SSR)
 *   TBD:  ~25% of pages get long tasks → common in JS-heavy apps
 *   Crashes: ~5% of pages throw unhandled → rare but visible
 *   Logged errors: ~45% of pages log non-crashing errors → frequent, realistic
 *
 * @param chaosRate  Global multiplier (0–1). 1.0 = production-like. 0 = disabled.
 */
export function injectWebVitalsChaos(chaosRate: number = 1.0) {
  if (typeof window === 'undefined' || chaosRate <= 0) return;

  if (chance(0.20 * chaosRate)) degradeLCP();
  if (chance(0.15 * chaosRate)) degradeCLS();
  if (chance(0.22 * chaosRate)) degradeINP();
  if (chance(0.12 * chaosRate)) degradeFCP();
  if (chance(0.25 * chaosRate)) degradeTBD();
  if (chance(0.05 * chaosRate)) degradeCrashingExceptions();
  if (chance(0.45 * chaosRate)) degradeLoggedErrors();
}

