import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const ConfigSchema = z.object({
  STOREFRONT_URL: z.string().url().default('http://frontend-proxy:8080'),
  WORKER_COUNT: z.coerce.number().int().min(1).default(5),
  SESSION_GAP_MS: z.coerce.number().int().min(0).default(2000),
  MAX_SESSIONS_PER_WORKER: z.coerce.number().int().min(0).default(0),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  HEADLESS: z.coerce.boolean().default(true),
  CHAOS_RATE: z.coerce.number().min(0).max(1).default(0.05),
  // CLI overrides
  PERSONA_OVERRIDE: z.string().optional(),
  SINGLE_RUN: z.coerce.boolean().default(false),
});

export type Config = z.infer<typeof ConfigSchema>;

let _config: Config | null = null;

export function getConfig(): Config {
  if (!_config) {
    _config = ConfigSchema.parse(process.env);
  }
  return _config;
}
