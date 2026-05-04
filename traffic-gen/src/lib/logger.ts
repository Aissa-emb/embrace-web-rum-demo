import pino from 'pino';
import { getConfig } from '../config';

export function createLogger(name: string): pino.Logger {
  return pino({
    name,
    level: getConfig().LOG_LEVEL,
    transport:
      process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  });
}
