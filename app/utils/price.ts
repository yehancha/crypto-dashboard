/**
 * Formats a price string to appropriate decimal places
 * Higher prices get fewer decimals, lower prices get more
 */
export function formatPrice(price: string): string {
  const numPrice = parseFloat(price);
  
  if (numPrice >= 1000) {
    return numPrice.toFixed(2);
  } else if (numPrice >= 1) {
    return numPrice.toFixed(4);
  } else {
    return numPrice.toFixed(6);
  }
}

/**
 * Calculates the absolute deviation between current price and 15m close price
 * @param currentPrice Current price as string
 * @param close15m 15-minute close price as string
 * @returns Absolute deviation as a number, or null if either price is missing
 */
export function calculateAbsoluteDeviation(currentPrice: string, close15m?: string): number | null {
  if (!close15m) return null;
  
  const current = parseFloat(currentPrice);
  const close = parseFloat(close15m);
  
  if (isNaN(current) || isNaN(close)) return null;
  
  return current - close;
}

/**
 * Calculates the percentage deviation between current price and 15m close price
 * @param currentPrice Current price as string
 * @param close15m 15-minute close price as string
 * @returns Percentage deviation as a number, or null if either price is missing
 */
export function calculateDeviation(currentPrice: string, close15m?: string): number | null {
  if (!close15m) return null;
  
  const current = parseFloat(currentPrice);
  const close = parseFloat(close15m);
  
  if (isNaN(current) || isNaN(close) || close === 0) return null;
  
  return ((current - close) / close) * 100;
}

/**
 * Formats deviation as a percentage string with sign
 * @param deviation Percentage deviation as a number
 * @returns Formatted string like "+1.23%" or "-0.45%"
 */
export function formatDeviation(deviation: number | null): string {
  if (deviation === null) return '—';
  
  const sign = deviation >= 0 ? '+' : '';
  return `${sign}${deviation.toFixed(2)}%`;
}

/**
 * Formats both absolute and percentage deviation
 * @param absoluteDeviation Absolute deviation as a number
 * @param percentageDeviation Percentage deviation as a number
 * @returns Formatted string like "+123.45 (+1.23%)" or "-45.67 (-0.45%)"
 */
export function formatDeviationWithAbsolute(
  absoluteDeviation: number | null,
  percentageDeviation: number | null
): string {
  if (absoluteDeviation === null || percentageDeviation === null) return '—';
  
  const absSign = absoluteDeviation >= 0 ? '+' : '';
  const absFormatted = formatPrice(Math.abs(absoluteDeviation).toString());
  const pctFormatted = formatDeviation(percentageDeviation);
  
  return `${absSign}${absFormatted} (${pctFormatted})`;
}

import type { Candle, MaxRange } from '../lib/binance';

/**
 * Calculates the maximum range for a specific window size
 * @param candles Array of candle data
 * @param windowSize Number of consecutive candles to analyze
 * @returns MaxRange object with the maximum range found, or null if insufficient candles
 */
export function calculateMaxRangeForWindow(
  candles: Candle[],
  windowSize: number
): MaxRange | null {
  if (candles.length < windowSize) {
    return null;
  }

  let maxRange = 0;
  let maxHigh = '';
  let maxLow = '';
  let weightedSum = 0;
  let weightSum = 0;

  // Slide window through candle array
  for (let i = 0; i <= candles.length - windowSize; i++) {
    const window = candles.slice(i, i + windowSize);
    
    // Find max high and min low in this window
    const highs = window.map(c => parseFloat(c.high));
    const lows = window.map(c => parseFloat(c.low));
    
    const windowHigh = Math.max(...highs);
    const windowLow = Math.min(...lows);
    const range = windowHigh - windowLow;

    // Track the window with maximum range
    if (range > maxRange) {
      maxRange = range;
      // Find the actual high and low strings from the candles
      const highCandle = window.find(c => parseFloat(c.high) === windowHigh);
      const lowCandle = window.find(c => parseFloat(c.low) === windowLow);
      maxHigh = highCandle?.high || windowHigh.toString();
      maxLow = lowCandle?.low || windowLow.toString();
    }

    // Calculate WMA: weight = i + 1 (oldest = 1, next = 2, etc.)
    const weight = i + 1;
    weightedSum += range * weight;
    weightSum += weight;
  }

  // Calculate WMA
  const wma = weightSum > 0 ? weightedSum / weightSum : 0;

  return {
    windowSize,
    range: maxRange,
    high: maxHigh,
    low: maxLow,
    wma,
  };
}

/**
 * Calculates maximum ranges for all window sizes from 15 down to 1
 * @param candles Array of candle data (should have at least 15 candles for full analysis)
 * @returns Array of MaxRange objects, one for each window size (15, 14, ..., 1)
 */
export function calculateMaxRanges(candles: Candle[]): MaxRange[] {
  const ranges: MaxRange[] = [];
  
  // Calculate for window sizes from 15 down to 1
  for (let windowSize = 15; windowSize >= 1; windowSize--) {
    const range = calculateMaxRangeForWindow(candles, windowSize);
    if (range) {
      ranges.push(range);
    } else {
      // If insufficient candles, still add a placeholder with null values
      ranges.push({
        windowSize,
        range: 0,
        high: '',
        low: '',
        wma: 0,
      });
    }
  }
  
  return ranges;
}

/**
 * Formats a range display showing high, low, range, and WMA
 * @param range MaxRange object to format
 * @param basePrice Optional base price for percentage calculation
 * @returns Formatted string like "H: 50000.00, L: 49000.00 (R: 1000.00, WMA: 950.00)"
 */
export function formatRangeDisplay(range: MaxRange, basePrice?: string): string {
  if (!range.high || !range.low || range.range === 0) {
    return '—';
  }

  const highFormatted = formatPrice(range.high);
  const lowFormatted = formatPrice(range.low);
  const rangeFormatted = formatPrice(range.range.toString());
  const wmaFormatted = formatWMA(range.wma);

  let result = `H: ${highFormatted}, L: ${lowFormatted} (R: ${rangeFormatted}, WMA: ${wmaFormatted})`;

  // Add percentage if base price is provided
  if (basePrice) {
    const base = parseFloat(basePrice);
    if (!isNaN(base) && base !== 0) {
      const percentage = (range.range / base) * 100;
      result += ` (${percentage >= 0 ? '+' : ''}${percentage.toFixed(2)}%)`;
    }
  }

  return result;
}

/**
 * Formats only the range value (no high, low, or percentage)
 * @param range MaxRange object or null
 * @param multiplier Optional multiplier to apply to the range (default 1.0)
 * @returns Formatted range value as string, or "—" if no range
 */
export function formatRangeOnly(range: MaxRange | null | undefined, multiplier: number = 1.0): string {
  if (!range || range.range === 0) {
    return '—';
  }

  const adjustedRange = range.range * multiplier;
  return formatPrice(adjustedRange.toString());
}

/**
 * Formats WMA (Weighted Moving Average) value
 * @param wma WMA value or null/undefined
 * @param multiplier Optional multiplier to apply to the WMA (default 1.0)
 * @returns Formatted WMA value as string, or "—" if no WMA
 */
export function formatWMA(wma: number | null | undefined, multiplier: number = 1.0): string {
  if (wma === null || wma === undefined || wma === 0) {
    return '—';
  }

  const adjustedWMA = wma * multiplier;
  return formatPrice(adjustedWMA.toString());
}

/**
 * Calculates the minutes remaining until the next 15-minute interval
 * @returns Number of minutes until the next 15-minute interval (0, 15, 30, 45)
 */
export function getMinutesUntilNext15MinInterval(): number {
  const now = new Date();
  const currentMinute = now.getMinutes();
  const nextIntervalMinute = Math.ceil(currentMinute / 15) * 15;
  const nextInterval = new Date(now);
  nextInterval.setMinutes(nextIntervalMinute, 0, 0);
  
  // If we've already passed the calculated interval (shouldn't happen, but handle edge case)
  if (nextInterval <= now) {
    nextInterval.setHours(nextInterval.getHours() + 1);
    nextInterval.setMinutes(0);
  }
  
  return (nextInterval.getTime() - now.getTime()) / (1000 * 60);
}

/**
 * Determines which column to highlight based on minutes remaining until next 15-minute interval
 * @param minutesRemaining Number of minutes remaining
 * @returns Window size (1-15) to highlight
 */
export function getHighlightedColumn(minutesRemaining: number): number {
  return Math.min(15, Math.max(1, Math.ceil(minutesRemaining)));
}
