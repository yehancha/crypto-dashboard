import type { Candle } from '../lib/binance';

export function trueRange(high: number, low: number, prevClose: number): number {
  const hl = high - low;
  return Math.max(hl, Math.abs(high - prevClose), Math.abs(low - prevClose));
}

/** Linear WMA: weight j+1 for j = 0..n-1 (oldest → newest, newest heaviest). */
export function wmaLinear(values: number[]): number {
  if (values.length === 0) return 0;
  let weightedSum = 0;
  let weightSum = 0;
  for (let j = 0; j < values.length; j++) {
    const w = j + 1;
    weightedSum += values[j] * w;
    weightSum += w;
  }
  return weightSum > 0 ? weightedSum / weightSum : 0;
}

/**
 * Expects 26 candles: [seed, 24 completed, 1 incomplete].
 * TR only for indices 1..24; prevClose from candle i-1.
 */
export function hourlyTrsForAtr(candles: Candle[]): number[] | null {
  if (candles.length < 26) return null;
  const trs: number[] = [];
  for (let i = 1; i <= 24; i++) {
    const c = candles[i];
    const prevClose = parseFloat(candles[i - 1].close);
    const high = parseFloat(c.high);
    const low = parseFloat(c.low);
    if (![prevClose, high, low].every(Number.isFinite)) return null;
    trs.push(trueRange(high, low, prevClose));
  }
  return trs;
}

/**
 * Expects 32 candles: [seed, 30 completed, 1 incomplete].
 * TR only for indices 1..30.
 */
export function dailyTrsForAtr(candles: Candle[]): number[] | null {
  if (candles.length < 32) return null;
  const trs: number[] = [];
  for (let i = 1; i <= 30; i++) {
    const c = candles[i];
    const prevClose = parseFloat(candles[i - 1].close);
    const high = parseFloat(c.high);
    const low = parseFloat(c.low);
    if (![prevClose, high, low].every(Number.isFinite)) return null;
    trs.push(trueRange(high, low, prevClose));
  }
  return trs;
}

export interface RangeRowValues {
  label: string;
  atr: number;
  min: number;
  max: number;
}

export interface SymbolRangesComputed {
  symbol: string;
  currentPrice: number;
  rows: RangeRowValues[];
}

/** Table order: 1h..23h, then 1d..30d. */
export function computeSymbolRanges(
  hourlyCandles: Candle[],
  dailyCandles: Candle[],
  symbol: string
): SymbolRangesComputed | null {
  const hTrs = hourlyTrsForAtr(hourlyCandles);
  const dTrs = dailyTrsForAtr(dailyCandles);
  if (!hTrs || !dTrs) return null;

  const base1h = wmaLinear(hTrs);
  const base1d = wmaLinear(dTrs);

  const last1h = hourlyCandles[hourlyCandles.length - 1];
  const currentPrice = parseFloat(last1h.close);
  if (!Number.isFinite(currentPrice)) return null;

  const rows: RangeRowValues[] = [];

  for (let n = 1; n <= 23; n++) {
    const atr = base1h * Math.sqrt(n);
    rows.push({
      label: `${n}h`,
      atr,
      min: currentPrice - atr,
      max: currentPrice + atr,
    });
  }

  for (let n = 1; n <= 30; n++) {
    const atr = base1d * Math.sqrt(n);
    rows.push({
      label: `${n}d`,
      atr,
      min: currentPrice - atr,
      max: currentPrice + atr,
    });
  }

  return { symbol, currentPrice, rows };
}
