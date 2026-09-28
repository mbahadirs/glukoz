import type { FastifyServerOptions } from 'fastify';
import type { Env } from '../config/env.js';

/** Log hijyeni: kimlik bilgileri ve e-postalar maskelenir; glukoz değerleri loglanmaz. */
export const REDACT_PATHS = [
  'password',
  '*.password',
  'token',
  '*.token',
  'email',
  '*.email',
  'authorization',
  '*.authorization',
  'account-id',
  '*["account-id"]',
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-csrf-token"]',
  'res.headers["set-cookie"]',
];

export function loggerOptions(env: Env): FastifyServerOptions['logger'] {
  return {
    level: env.LOG_LEVEL,
    redact: { paths: REDACT_PATHS, censor: '[gizli]' },
    ...(env.NODE_ENV === 'development' ? { transport: { target: 'pino-pretty' } } : {}),
  };
}
