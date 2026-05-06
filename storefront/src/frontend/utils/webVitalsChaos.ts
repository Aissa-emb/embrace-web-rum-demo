/**
 * Web Vitals Chaos — Inject realistic performance degradations so the
 * Embrace dashboard shows a believable distribution of good / needs-improvement / poor.
 *
 * Each degradation fires probabilistically per page load.
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

// ---------------------------------------------------------------------------
// Individual degradations
// ---------------------------------------------------------------------------

/**
 * Degrade LCP — delay the largest image/element from painting.
 * Inserts a render-blocking overlay that clears after a delay.
 */
function degradeLCP() {
  const delayMs = rand(1800, 4500); // push LCP to 1.8–4.5s
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;top:0;left:0;width:100%;height:100%;' +
    'background:white;z-index:99999;pointer-events:none;';
  document.body.appendChild(overlay);
  setTimeout(() => overlay.remove(), delayMs);
}

/**
 * Degrade CLS — inject layout shifts after initial paint.
 * Mimics a late-loading ad banner or dynamically resized hero.
 */
function degradeCLS() {
  // Schedule 2–4 layout shifts at staggered intervals
  const shiftCount = Math.floor(rand(2, 5));
  for (let i = 0; i < shiftCount; i++) {
    setTimeout(() => {
      const shifter = document.createElement('div');
      const height = Math.floor(rand(40, 120));
      shifter.style.cssText =
        `width:100%;height:${height}px;background:transparent;` +
        'position:relative;overflow:hidden;';
      // Insert at the top of body to push content down
      document.body.insertBefore(shifter, document.body.firstChild);
      // Remove after a beat so it looks like content re-flowed
      setTimeout(() => {
        shifter.style.height = '0px';
        setTimeout(() => shifter.remove(), 100);
      }, rand(200, 600));
    }, rand(500, 2500) + i * rand(300, 700));
  }
}

/**
 * Degrade INP — add main-thread-blocking work to click/tap handlers.
 * This makes interactions feel sluggish.
 */
function degradeINP() {
  const blockMs = rand(250, 600); // push INP to 250–600ms
  document.addEventListener(
    'click',
    () => {
      // Only block ~60% of clicks to look natural
      if (chance(0.6)) {
        blockMainThread(blockMs);
      }
    },
    { capture: true, passive: true }
  );
}

/**
 * Degrade FCP — block rendering with a synchronous script early in load.
 */
function degradeFCP() {
  blockMainThread(rand(400, 1200));
}

/**
 * Schedule heavy long tasks that increase Total Blocking Duration (TBD).
 * Runs 3–6 blocking chunks of 80–250ms each over the first 10 seconds.
 */
function degradeTBD() {
  const taskCount = Math.floor(rand(3, 7));
  for (let i = 0; i < taskCount; i++) {
    setTimeout(() => {
      blockMainThread(rand(80, 250));
    }, rand(1000, 10000));
  }
}

/**
 * Degrade Errors — throw realistic-looking unhandled exceptions randomly.
 * Uses a weighted distribution so some errors dominate (like in real apps),
 * while others are rare tail-end crashes.
 */
function degradeExceptions() {
  const weightedErrors = [
    // 60% chance: The classic null reference dominating the charts
    { weight: 60, fn: () => { throw new TypeError("Cannot read properties of undefined (reading 'map')"); } },
    // 20% chance: Third-party script or ad blocker issue
    { weight: 20, fn: () => { throw new ReferenceError("gtag is not defined"); } },
    // 10% chance: DOM element not found due to race condition
    { weight: 10, fn: () => { throw new TypeError("document.getElementById(...) is null"); } },
    // 5% chance: ResizeObserver loop
    { weight: 5, fn: () => { throw new Error("ResizeObserver loop limit exceeded"); } },
    // 5% chance: Network or promise failure
    { weight: 5, fn: () => { Promise.reject(new TypeError("Failed to fetch")); } }
  ];
  
  // Calculate total weight
  const totalWeight = weightedErrors.reduce((sum, item) => sum + item.weight, 0);

  // Decide how many errors to throw on this page load (usually 0 or 1, rarely 2)
  // We'll use a random distribution that favors 1 error if we decide to throw at all.
  let errorCount = 1;
  if (Math.random() < 0.1) errorCount = 2; // 10% chance of multiple cascading errors

  for (let i = 0; i < errorCount; i++) {
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
    }, rand(2000, 15000));
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Call once per page load. Each degradation fires independently based on its
 * probability, creating a realistic spread across sessions.
 *
 * @param chaosRate  Global multiplier (0–1). 1.0 = full chaos probabilities.
 *                   0.5 = half the chance of each. 0 = disabled.
 */
export function injectWebVitalsChaos(chaosRate: number = 0.5) {
  if (typeof window === 'undefined' || chaosRate <= 0) return;

  // Each vital has its own independent probability × chaosRate
  // These probabilities are tuned to produce a dashboard mix of
  // ~40% good, ~35% needs-improvement, ~25% poor when chaosRate = 0.5.

  if (chance(0.35 * chaosRate)) degradeLCP();
  if (chance(0.45 * chaosRate)) degradeCLS();
  if (chance(0.40 * chaosRate)) degradeINP();
  if (chance(0.25 * chaosRate)) degradeFCP();
  if (chance(0.50 * chaosRate)) degradeTBD();
  if (chance(0.40 * chaosRate)) degradeExceptions();
}
