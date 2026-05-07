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
 * Degrade Errors — throw realistic-looking unhandled exceptions randomly.
 * Low probability — real production apps don't throw on every page load.
 */
function degradeExceptions() {
  const weightedErrors = [
    { weight: 50, fn: () => { throw new TypeError("Cannot read properties of undefined (reading 'map')"); } },
    { weight: 20, fn: () => { throw new ReferenceError("gtag is not defined"); } },
    { weight: 12, fn: () => { throw new TypeError("document.getElementById(...) is null"); } },
    { weight: 8,  fn: () => { throw new Error("ResizeObserver loop limit exceeded"); } },
    { weight: 10, fn: () => { Promise.reject(new TypeError("Failed to fetch")); } },
  ];
  
  const totalWeight = weightedErrors.reduce((sum, item) => sum + item.weight, 0);

  setTimeout(() => {
    let randomVal = Math.random() * totalWeight;
    let selectedError = weightedErrors[0].fn;
    
    for (const item of weightedErrors) {
      if (randomVal < item.weight) {
        selectedError = item.fn;
        break;
      }
      randomVal -= item.weight;
    }
    
    selectedError();
  }, rand(3000, 20000));
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
 *   Errors: ~8% of pages throw → realistic for production apps
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
  if (chance(0.08 * chaosRate)) degradeExceptions();
}
