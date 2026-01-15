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
 * Formats percentage as an absolute value without sign
 * @param percentage Percentage value as a number
 * @returns Formatted string like "1.23%" (no sign)
 */
export function formatAbsolutePercentage(percentage: number | null): string {
  if (percentage === null || isNaN(percentage)) return '—';
  
  return `${Math.abs(percentage).toFixed(2)}%`;
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

import type { Candle, MaxRange, WindowRangeCache, CachedWindowRange } from '../lib/binance';

/**
 * Generates a cache key for a window range calculation
 * @param windowSize Size of the window
 * @param firstCandleOpenTime Open time of the first candle in the window
 * @returns Cache key string
 */
export function getWindowRangeCacheKey(windowSize: number, firstCandleOpenTime: number): string {
  return `${windowSize}-${firstCandleOpenTime}`;
}

/**
 * Prunes stale entries from the window range cache
 * Removes entries for candles that are no longer in the candle array
 * @param cache The cache to prune
 * @param candles Current candle array
 */
export function pruneWindowRangeCache(cache: WindowRangeCache, candles: Candle[]): void {
  if (candles.length === 0) {
    cache.clear();
    return;
  }
  
  // Get valid openTimes from current candles
  const validOpenTimes = new Set(candles.map(c => c.openTime));
  
  // Remove entries whose firstCandleOpenTime is no longer valid
  for (const key of cache.keys()) {
    const openTime = parseInt(key.split('-')[1], 10);
    if (!validOpenTimes.has(openTime)) {
      cache.delete(key);
    }
  }
}

/**
 * Calculates high, low, and range for a single window of candles
 * @param candles Array of candles in the window
 * @returns CachedWindowRange with high, low, and range
 */
function calculateWindowRange(candles: Candle[]): CachedWindowRange {
  const highs = candles.map(c => parseFloat(c.high));
  const lows = candles.map(c => parseFloat(c.low));
  
  const high = Math.max(...highs);
  const low = Math.min(...lows);
  const range = high - low;
  
  return { high, low, range };
}

/**
 * Calculates the maximum range for a specific window size, using cache when available
 * @param candles Array of candle data
 * @param windowSize Number of consecutive candles to analyze
 * @param cache Optional cache to store/retrieve window range calculations
 * @returns MaxRange object with the maximum range found, or null if insufficient candles
 */
export function calculateMaxRangeForWindow(
  candles: Candle[],
  windowSize: number,
  cache?: WindowRangeCache
): MaxRange | null {
  if (candles.length < windowSize) {
    return null;
  }

  let maxRange = 0;
  let maxHigh = 0;
  let maxLow = 0;
  let maxHighStr = '';
  let maxLowStr = '';
  let weightedSum = 0;
  let weightSum = 0;

  // Slide window through candle array
  for (let i = 0; i <= candles.length - windowSize; i++) {
    const windowCandles = candles.slice(i, i + windowSize);
    const firstCandleOpenTime = windowCandles[0].openTime;
    const cacheKey = getWindowRangeCacheKey(windowSize, firstCandleOpenTime);
    
    let windowRange: CachedWindowRange;
    
    // Check cache first
    if (cache?.has(cacheKey)) {
      windowRange = cache.get(cacheKey)!;
    } else {
      // Calculate and cache
      windowRange = calculateWindowRange(windowCandles);
      cache?.set(cacheKey, windowRange);
    }

    // Track the window with maximum range
    if (windowRange.range > maxRange) {
      maxRange = windowRange.range;
      maxHigh = windowRange.high;
      maxLow = windowRange.low;
      // Find the actual high and low strings from the candles
      const highCandle = windowCandles.find(c => parseFloat(c.high) === maxHigh);
      const lowCandle = windowCandles.find(c => parseFloat(c.low) === maxLow);
      maxHighStr = highCandle?.high || maxHigh.toString();
      maxLowStr = lowCandle?.low || maxLow.toString();
    }

    // Calculate WMA: weight = i + 1 (oldest = 1, next = 2, etc.)
    const weight = i + 1;
    weightedSum += windowRange.range * weight;
    weightSum += weight;
  }

  // Calculate WMA
  const wma = weightSum > 0 ? weightedSum / weightSum : 0;

  return {
    windowSize,
    range: maxRange,
    high: maxHighStr,
    low: maxLowStr,
    wma,
  };
}

/**
 * Calculates maximum ranges for all window sizes from maxWindowSize down to 1
 * @param candles Array of candle data (should have at least maxWindowSize candles for full analysis)
 * @param maxWindowSize Maximum window size to calculate (default: 15 for backward compatibility)
 * @param cache Optional cache to store/retrieve window range calculations
 * @returns Array of MaxRange objects, one for each window size (maxWindowSize, maxWindowSize-1, ..., 1)
 */
export function calculateMaxRanges(candles: Candle[], maxWindowSize: number = 15, cache?: WindowRangeCache): MaxRange[] {
  const ranges: MaxRange[] = [];
  
  // Calculate for window sizes from maxWindowSize down to 1
  for (let windowSize = maxWindowSize; windowSize >= 1; windowSize--) {
    const range = calculateMaxRangeForWindow(candles, windowSize, cache);
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
 * @param showHighLow Whether to show high and low values (default: true)
 * @returns Formatted string like "H: 50000.00, L: 49000.00 (R: 1000.00, WMA: 950.00)" or "(R: 1000.00, WMA: 950.00)" if showHighLow is false
 */
export function formatRangeDisplay(range: MaxRange, basePrice?: string, showHighLow: boolean = true): string {
  if (!range.high || !range.low || range.range === 0) {
    return '—';
  }

  const rangeFormatted = formatPrice(range.range.toString());
  const wmaFormatted = formatWMA(range.wma);

  let result: string;
  if (showHighLow) {
    const highFormatted = formatPrice(range.high);
    const lowFormatted = formatPrice(range.low);
    result = `H: ${highFormatted}, L: ${lowFormatted} (R: ${rangeFormatted}, WMA: ${wmaFormatted})`;
  } else {
    result = `R: ${rangeFormatted}, WMA: ${wmaFormatted}`;
  }

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
 * Generic function to calculate minutes remaining until the next interval
 * @param intervalMinutes Interval in minutes (e.g., 15 for 15-minute intervals, 60 for hourly)
 * @returns Number of minutes until the next interval
 */
export function getMinutesUntilNextInterval(intervalMinutes: number): number {
  const now = new Date();
  
  if (intervalMinutes === 60) {
    // For hourly intervals, calculate minutes until next hour
    const nextHour = new Date(now);
    nextHour.setUTCHours(nextHour.getUTCHours() + 1);
    nextHour.setUTCMinutes(0, 0, 0);
    return (nextHour.getTime() - now.getTime()) / (1000 * 60);
  } else {
    // For other intervals (e.g., 15 minutes)
    const currentMinute = now.getUTCMinutes();
    const nextIntervalMinute = Math.ceil(currentMinute / intervalMinutes) * intervalMinutes;
    const nextInterval = new Date(now);
    nextInterval.setUTCMinutes(nextIntervalMinute, 0, 0);
    
    // If we've already passed the calculated interval (shouldn't happen, but handle edge case)
    if (nextInterval <= now) {
      nextInterval.setUTCHours(nextInterval.getUTCHours() + 1);
      nextInterval.setUTCMinutes(0);
    }
    
    return (nextInterval.getTime() - now.getTime()) / (1000 * 60);
  }
}

/**
 * Calculates the minutes remaining until the next 15-minute interval
 * @returns Number of minutes until the next 15-minute interval (0, 15, 30, 45)
 * @deprecated Use getMinutesUntilNextInterval(15) instead
 */
export function getMinutesUntilNext15MinInterval(): number {
  return getMinutesUntilNextInterval(15);
}

/**
 * Generic function to determine which column to highlight based on minutes remaining
 * @param minutesRemaining Number of minutes remaining until next interval
 * @param maxWindowSize Maximum window size (e.g., 15 or 60)
 * @returns Window size (1 to maxWindowSize) to highlight
 */
export function getHighlightedColumn(minutesRemaining: number, maxWindowSize: number): number {
  return Math.min(maxWindowSize, Math.max(1, Math.ceil(minutesRemaining)));
}

/**
 * Calculates highlighting flags for symbols based on whether absolute deviation exceeds WMA and max-range thresholds
 * @param prices Array of BinancePrice objects
 * @param displayType Display type: 'wma' or 'max-range' (kept for backward compatibility, not used in calculation)
 * @param multiplier Multiplier percentage (e.g., 100 for 100%)
 * @param timeframe Timeframe type: '15m' or '1h'
 * @param highlightedColumn The highlighted column window size
 * @returns Record mapping symbol to 'yellow' | 'green' | null indicating highlight color
 */
export function calculateHighlightingFlags(
  prices: Array<{ symbol: string; price: string; close15m?: string; close1h?: string; maxRanges?: MaxRange[] }>,
  displayType: 'wma' | 'max-range',
  multiplier: number,
  timeframe: '15m' | '1h',
  highlightedColumn: number
): Record<string, 'yellow' | 'green' | null> {
  const flags: Record<string, 'yellow' | 'green' | null> = {};
  const multiplierRatio = multiplier / 100;

  for (const item of prices) {
    // Get the close price based on timeframe
    const closePrice = timeframe === '15m' ? item.close15m : item.close1h;
    if (!closePrice) {
      flags[item.symbol] = null;
      continue;
    }

    // Get the highlighted column's MaxRange
    const range = item.maxRanges?.find(r => r.windowSize === highlightedColumn);
    if (!range || range.range === 0) {
      flags[item.symbol] = null;
      continue;
    }

    // Calculate both thresholds independently
    const wmaThreshold = (range.wma ?? 0) * multiplierRatio;
    const maxRangeThreshold = range.range * multiplierRatio;

    if (wmaThreshold === 0 && maxRangeThreshold === 0) {
      flags[item.symbol] = null;
      continue;
    }

    // Calculate absolute deviation
    const currentPrice = parseFloat(item.price);
    const closePriceNum = parseFloat(closePrice);
    if (isNaN(currentPrice) || isNaN(closePriceNum)) {
      flags[item.symbol] = null;
      continue;
    }

    const absoluteDeviation = Math.abs(currentPrice - closePriceNum);

    // Check max-range threshold first (green takes precedence)
    if (maxRangeThreshold > 0 && absoluteDeviation > maxRangeThreshold) {
      flags[item.symbol] = 'green';
    } else if (wmaThreshold > 0 && absoluteDeviation > wmaThreshold) {
      flags[item.symbol] = 'yellow';
    } else {
      flags[item.symbol] = null;
    }
  }

  return flags;
}
