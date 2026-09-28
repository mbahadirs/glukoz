import type { Env } from '../config/env.js';
import { LluClient, type LluClientOptions } from './client.js';
import { MockLluClient } from './mock.js';
import type { LluApi } from './types.js';

export { LluError, type LluErrorCode } from './errors.js';
export {
  parseMeasurement,
  parseFactoryTimestamp,
  sensorExpectedEnd,
  normalizeTrend,
} from './parse.js';
export type { LluApi, LluConnection, LluMeasurement, LluSession } from './types.js';
export { mockPatients, mockSensorAt, type MockPatient } from './mock.js';
export { glucoseAt, isGap } from './synthetic.js';

export type LluClientFactory = (
  opts: Omit<LluClientOptions, 'product' | 'version'> & { product: string; version: string },
) => LluApi;

/** Env'e göre gerçek veya sahte istemci üretir. */
export function createLluClientFactory(
  env: Pick<Env, 'LLU_MOCK' | 'LLU_MOCK_FAIL'>,
): LluClientFactory {
  if (env.LLU_MOCK) {
    const shared = new MockLluClient(env.LLU_MOCK_FAIL);
    return () => shared;
  }
  return (opts) => new LluClient(opts);
}
