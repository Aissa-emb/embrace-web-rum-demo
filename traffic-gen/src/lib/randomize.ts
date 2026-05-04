/**
 * Weighted random pick from an array of items with a `weight` property.
 */
export function weightedPick<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

/**
 * Pick a random element from an array.
 */
export function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Sleep for a specified number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Add jitter to a base duration. Returns baseMs ± pct%.
 */
export function jitter(baseMs: number, pct: number = 0.3): number {
  const variance = baseMs * pct;
  return Math.round(baseMs + (Math.random() * 2 - 1) * variance);
}

/**
 * Random integer between min and max (inclusive).
 */
export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
