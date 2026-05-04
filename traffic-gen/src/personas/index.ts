import type { Page } from 'playwright';
import type pino from 'pino';

export type PersonaContext = {
  page: Page;
  log: pino.Logger;
  rand: <T>(arr: T[]) => T;
  sleep: (ms: number) => Promise<void>;
  jitter: (baseMs: number, pct?: number) => number;
  randInt: (min: number, max: number) => number;
};

export type Persona = {
  name: string;
  weight: number;
  run: (ctx: PersonaContext) => Promise<void>;
};

import { browser } from './browser';
import { buyer } from './buyer';
import { cartAbandoner } from './cart-abandoner';
import { searcher } from './searcher';
import { bouncer } from './bouncer';
import { powerUser } from './power-user';

export const allPersonas: Persona[] = [
  browser,
  buyer,
  cartAbandoner,
  searcher,
  bouncer,
  powerUser,
];

export function getPersonaByName(name: string): Persona | undefined {
  return allPersonas.find((p) => p.name === name);
}
