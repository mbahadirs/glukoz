import { GLUCOSE_THRESHOLDS as T } from './constants.js';

export type RangeClass = 'veryLow' | 'low' | 'inRange' | 'high' | 'veryHigh';

/** Değeri konsensüs aralık sınıfına eşler. 70–180 dahil hedef; 181–250 yüksek. */
export function classifyGlucose(mgdl: number): RangeClass {
  if (mgdl < T.VERY_LOW) return 'veryLow';
  if (mgdl < T.LOW) return 'low';
  if (mgdl <= T.HIGH) return 'inRange';
  if (mgdl <= T.VERY_HIGH) return 'high';
  return 'veryHigh';
}

export const RANGE_ORDER: readonly RangeClass[] = ['veryHigh', 'high', 'inRange', 'low', 'veryLow'];
