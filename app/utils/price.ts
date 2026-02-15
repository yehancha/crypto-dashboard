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
import type { TimeframeType } from '../lib/timeframe';

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
 * Calculates high, low, range, and volatility for a single window of candles
 * Volatility = sum((high - low) * 2 - abs(close - open)) / range for the window
 * @param candles Array of candles in the window
 * @returns CachedWindowRange with high, low, range, and volatility
 */
function calculateWindowRange(candles: Candle[]): CachedWindowRange {
  const highs = candles.map(c => parseFloat(c.high));
  const lows = candles.map(c => parseFloat(c.low));
  
  const high = Math.max(...highs);
  const low = Math.min(...lows);
  const range = high - low;

  const sumVol = candles.reduce((acc, c) => {
    const h = parseFloat(c.high);
    const l = parseFloat(c.low);
    const o = parseFloat(c.open);
    const cl = parseFloat(c.close);
    return acc + ((h - l) * 2 - Math.abs(cl - o));
  }, 0);
  const volatility = range > 0 ? sumVol / range : 0;
  
  return { high, low, range, volatility };
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
  let maxVolatility = 0;
  let weightedVolatilitySum = 0;
  
  // Change metrics
  let sumAbsChange = 0;
  let weightedAbsChangeSum = 0;
  let maxAbsChange = 0;
  let windowCount = 0;

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
    maxVolatility = Math.max(maxVolatility, windowRange.volatility);
    weightedVolatilitySum += windowRange.volatility * weight;
    
    // Calculate change: close price of ending candle - open price of starting candle
    const startOpen = parseFloat(windowCandles[0].open);
    const endClose = parseFloat(windowCandles[windowSize - 1].close);
    const change = endClose - startOpen;
    const absChange = Math.abs(change);
    
    // Track change metrics
    sumAbsChange += absChange;
    weightedAbsChangeSum += absChange * weight;
    if (absChange > maxAbsChange) {
      maxAbsChange = absChange;
    }
    windowCount++;
  }

  // Calculate WMA
  const wma = weightSum > 0 ? weightedSum / weightSum : 0;
  const wmaVolatility = weightSum > 0 ? weightedVolatilitySum / weightSum : 0;
  
  // Calculate change metrics
  const avgAbsChange = windowCount > 0 ? sumAbsChange / windowCount : 0;
  const wmaAbsChange = weightSum > 0 ? weightedAbsChangeSum / weightSum : 0;

  return {
    windowSize,
    range: maxRange,
    high: maxHighStr,
    low: maxLowStr,
    wma,
    avgAbsChange,
    wmaAbsChange,
    maxAbsChange,
    maxVolatility,
    wmaVolatility,
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
        avgAbsChange: 0,
        wmaAbsChange: 0,
        maxAbsChange: 0,
        maxVolatility: 0,
        wmaVolatility: 0,
      });
    }
  }
  
  return ranges;
}

/**
 * Formats a range display showing high, low, range, and WMA
 * @param range MaxRange object to format
 * @param basePrice Optional base price for percentage calculation
 * @param showHighLow Whether to show high and low values and change metrics (default: true)
 * @param multiplier Multiplier for change metrics; when useVolatilityMultipliers is true, R/WMA use volatility (default 1.0)
 * @param useVolatilityMultipliers When true, display R as range*maxVolatility and WMA as wma*wmaVolatility (default false)
 * @returns Formatted string like "H: 50000.00, L: 49000.00 (R: 1000.00, WMA: 950.00)" or "(R: 1000.00, WMA: 950.00)" if showHighLow is false
 */
export function formatRangeDisplay(range: MaxRange, basePrice?: string, showHighLow: boolean = true, multiplier: number = 1.0, useVolatilityMultipliers: boolean = false): string {
  if (!range.high || !range.low || range.range === 0) {
    return '—';
  }

  const rangeVal = useVolatilityMultipliers ? range.range * Math.max(range.maxVolatility ?? 0, 1) : range.range;
  const wmaVal = useVolatilityMultipliers ? (range.wma ?? 0) * Math.max(range.wmaVolatility ?? 0, 1) : (range.wma ?? 0);
  const rangeFormatted = formatPrice(rangeVal.toString());
  const wmaFormatted = formatWMA(wmaVal, 1);

  const changeMultiplier = useVolatilityMultipliers ? 1 : multiplier;

  let result: string;
  if (showHighLow) {
    const highFormatted = formatPrice(range.high);
    const lowFormatted = formatPrice(range.low);
    result = `H: ${highFormatted}, L: ${lowFormatted} (R: ${rangeFormatted}, WMA: ${wmaFormatted})`;
    
    // Add change metrics when showHighLow is true
    if (range.avgAbsChange !== undefined || range.wmaAbsChange !== undefined || range.maxAbsChange !== undefined) {
      const avgChgFormatted = formatChange(range.avgAbsChange, changeMultiplier);
      const wmaChgFormatted = formatChange(range.wmaAbsChange, changeMultiplier);
      const maxChgFormatted = formatChange(range.maxAbsChange, changeMultiplier);
      result += ` | Avg Chg: ${avgChgFormatted}, WMA Chg: ${wmaChgFormatted}, Max Chg: ${maxChgFormatted}`;
    }
  } else {
    result = `R: ${rangeFormatted}, WMA: ${wmaFormatted}`;
  }

  // Add volatility when present
  if (range.maxVolatility !== undefined || range.wmaVolatility !== undefined) {
    const maxVolStr = formatVolatility(range.maxVolatility);
    const wmaVolStr = formatVolatility(range.wmaVolatility);
    result += ` | Max Vol: ${maxVolStr}, WMA Vol: ${wmaVolStr}`;
  }

  // Add percentage if base price is provided (use displayed range value when volatility multipliers)
  if (basePrice) {
    const base = parseFloat(basePrice);
    if (!isNaN(base) && base !== 0) {
      const pctVal = useVolatilityMultipliers ? rangeVal : range.range;
      const percentage = (pctVal / base) * 100;
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
 * Formats volatility (ratio: sum((high-low)*2 - abs(close-open)) / range)
 * @param value Volatility value or null/undefined
 * @returns Formatted string with 2-3 decimal places, or "—" if no value
 */
export function formatVolatility(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) {
    return '—';
  }
  return value.toFixed(3);
}

/**
 * Formats change value (average absolute change, WMA of absolute change, or max absolute change)
 * @param change Change value or null/undefined
 * @param multiplier Optional multiplier to apply to the change (default 1.0)
 * @returns Formatted change value as string, or "—" if no change
 */
export function formatChange(change: number | null | undefined, multiplier: number = 1.0): string {
  if (change === null || change === undefined || change === 0) {
    return '—';
  }

  const adjustedChange = change * multiplier;
  return formatPrice(adjustedChange.toString());
}

/**
 * Generic function to calculate minutes remaining until the next interval
 * @param intervalMinutes Interval in minutes (e.g., 15 for 15-minute intervals, 60 for hourly, 240 for 4-hourly)
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
  } else if (intervalMinutes === 240) {
    // For 4-hourly intervals, calculate minutes until next 4-hour interval (00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC)
    const currentHour = now.getUTCHours();
    const currentMinute = now.getUTCMinutes();
    const currentSecond = now.getUTCSeconds();
    const currentMillisecond = now.getUTCMilliseconds();
    
    // 4-hour intervals: 0, 4, 8, 12, 16, 20
    const intervals = [0, 4, 8, 12, 16, 20];
    
    // Find the next interval hour
    let nextIntervalHour = intervals.find(h => h > currentHour);
    
    const nextInterval = new Date(now);
    
    // If no interval found in the current day, use the first interval of the next day
    if (nextIntervalHour === undefined) {
      nextIntervalHour = intervals[0];
      nextInterval.setUTCDate(nextInterval.getUTCDate() + 1);
    } else if (nextIntervalHour === currentHour && (currentMinute === 0 && currentSecond === 0 && currentMillisecond === 0)) {
      // If we're exactly at an interval time, use the next interval
      const currentIndex = intervals.indexOf(currentHour);
      const nextIndex = (currentIndex + 1) % intervals.length;
      nextIntervalHour = intervals[nextIndex];
      if (nextIndex === 0) {
        // Wrapped around to next day
        nextInterval.setUTCDate(nextInterval.getUTCDate() + 1);
      }
    }
    
    nextInterval.setUTCHours(nextIntervalHour, 0, 0, 0);
    
    return (nextInterval.getTime() - now.getTime()) / (1000 * 60);
  } else if (intervalMinutes === 1440) {
    // For daily intervals, calculate minutes until next UTC midnight
    const nextMidnight = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0, 0, 0, 0
    ));
    return (nextMidnight.getTime() - now.getTime()) / (1000 * 60);
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
 * Effective resolution used for max-range calculations.
 * Currently we switch between 1m and 1h candles based solely on time-to-expiry.
 */
export type EffectiveResolution = '1m' | '1h';

/**
 * Chooses effective resolution based on minutes until next expiry.
 * If more than 60 minutes remain, use 1h candles; otherwise use 1m candles.
 */
export function getEffectiveResolution(minutesUntilExpiry: number): EffectiveResolution {
  return minutesUntilExpiry > 60 ? '1h' : '1m';
}

/**
 * Returns the effective maximum window size for a timeframe/resolution pair.
 * This determines how many consecutive candles we consider for max-range.
 */
export function getEffectiveMaxWindowSize(
  timeframe: TimeframeType,
  resolution: EffectiveResolution
): number {
  switch (timeframe) {
    case '5m':
      // 5 windows of 1m candles.
      return 5;
    case '15m':
      // 15 windows of 1m candles.
      return 15;
    case '1h':
      // 60 windows of 1m candles.
      return 60;
    case '4h':
      // 4 windows of 1h candles or 60 windows of 1m candles.
      return resolution === '1h' ? 4 : 60;
    case '1d':
      // 24 windows of 1h candles or 60 windows of 1m candles.
      return resolution === '1h' ? 24 : 60;
    default:
      return 60;
  }
}

/**
 * Determines if 4H timeframe should use hourly mode (>1 hour until expiry) or minute mode (≤1 hour)
 * @param timeframe Timeframe type
 * @param minutesUntilExpiry Minutes until the next interval expiry
 * @returns true if should use hourly mode, false if should use minute mode
 */
export function shouldUse4HHourlyMode(timeframe: string, minutesUntilExpiry: number): boolean {
  return timeframe === '4h' && minutesUntilExpiry > 60;
}

/**
 * Calculates highlighting flags for symbols based on whether absolute deviation exceeds WMA and max-range thresholds
 * @param prices Array of BinancePrice objects
 * @param displayType Display type: 'wma' or 'max-range' (kept for backward compatibility, not used in calculation)
 * @param multiplier Multiplier percentage (e.g., 100 for 100%)
 * @param timeframe Timeframe type: '15m' or '1h'
 * @param highlightedColumn The highlighted column window size
 * @param mainTableScale Scale for sub-minute accuracy (seconds_remaining / window_seconds); default 1
 * @returns Record mapping symbol to 'yellow' | 'green' | null indicating highlight color
 */
export function calculateHighlightingFlags(
  prices: Array<{ symbol: string; price: string; close5m?: string; close15m?: string; close1h?: string; close1d?: string; maxRanges?: MaxRange[] }>,
  displayType: 'wma' | 'max-range',
  multiplier: number,
  timeframe: TimeframeType,
  highlightedColumn: number,
  mainTableScale: number = 1
): Record<string, 'yellow' | 'green' | null> {
  const flags: Record<string, 'yellow' | 'green' | null> = {};

  for (const item of prices) {
    // Get the close price based on timeframe
    const closePrice =
      timeframe === '5m'
        ? item.close5m
        : timeframe === '15m'
        ? item.close15m
        : timeframe === '1d'
        ? item.close1d
        : item.close1h;
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

    const { wmaRatio, rangeRatio } = getThresholdMultipliers(range, multiplier);
    const wmaThreshold = (range.wma ?? 0) * wmaRatio * mainTableScale;
    const maxRangeThreshold = range.range * rangeRatio * mainTableScale;

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

/** Sentinel value for "Auto" notification threshold (dynamic bar from time left). */
export const NOTIFY_THRESHOLD_AUTO = -1;

/** Sentinel value for Multiplier dropdown: use volatility (max-range * maxVolatility, wma * wmaVolatility). */
export const MULTIPLIER_VOLATILITY = -1;

/**
 * Returns effective ratios for WMA and max-range thresholds.
 * When multiplier is MULTIPLIER_VOLATILITY, uses range's wmaVolatility and maxVolatility; otherwise multiplier/100.
 */
export function getThresholdMultipliers(range: MaxRange, multiplier: number): { wmaRatio: number; rangeRatio: number } {
  if (multiplier === MULTIPLIER_VOLATILITY) {
    return {
      wmaRatio: Math.max(range.wmaVolatility ?? 0, 1),
      rangeRatio: Math.max(range.maxVolatility ?? 0, 1),
    };
  }
  const ratio = multiplier / 100;
  return { wmaRatio: ratio, rangeRatio: ratio };
}

/**
 * Calculates the number of filled dots (0-4) based on deviation to threshold ratio
 * @param deviation Absolute deviation value
 * @param threshold Threshold value to compare against
 * @returns Number of dots (0-4) based on ratio thresholds
 */
export function getFilledDots(deviation: number, threshold: number): number {
  if (threshold === 0) return 0;
  const ratio = deviation / threshold;
  if (ratio > 1) return 4;
  if (ratio > 0.75) return 3;
  if (ratio > 0.5) return 2;
  if (ratio > 0.25) return 1;
  return 0;
}

/**
 * Calculates yellow and green dot counts for each symbol based on deviation thresholds
 * @param prices Array of BinancePrice objects
 * @param multiplier Multiplier percentage (e.g., 100 for 100%)
 * @param timeframe Timeframe type: '15m' or '1h'
 * @param highlightedColumn The highlighted column window size
 * @param mainTableScale Scale for sub-minute accuracy (seconds_remaining / window_seconds); default 1
 * @returns Record mapping symbol to object with yellowDots and greenDots (0-4)
 */
export function calculateDotCounts(
  prices: Array<{ symbol: string; price: string; close5m?: string; close15m?: string; close1h?: string; close1d?: string; maxRanges?: MaxRange[] }>,
  multiplier: number,
  timeframe: TimeframeType,
  highlightedColumn: number,
  mainTableScale: number = 1
): Record<string, { yellowDots: number; greenDots: number }> {
  const dotCounts: Record<string, { yellowDots: number; greenDots: number }> = {};

  for (const item of prices) {
    // Get the close price based on timeframe
    const closePrice =
      timeframe === '5m'
        ? item.close5m
        : timeframe === '15m'
        ? item.close15m
        : timeframe === '1d'
        ? item.close1d
        : item.close1h;
    if (!closePrice) {
      dotCounts[item.symbol] = { yellowDots: 0, greenDots: 0 };
      continue;
    }

    // Get the highlighted column's MaxRange
    const range = item.maxRanges?.find(r => r.windowSize === highlightedColumn);
    if (!range || range.range === 0) {
      dotCounts[item.symbol] = { yellowDots: 0, greenDots: 0 };
      continue;
    }

    const { wmaRatio, rangeRatio } = getThresholdMultipliers(range, multiplier);
    const wmaThreshold = (range.wma ?? 0) * wmaRatio * mainTableScale;
    const maxRangeThreshold = range.range * rangeRatio * mainTableScale;

    // Calculate absolute deviation
    const currentPrice = parseFloat(item.price);
    const closePriceNum = parseFloat(closePrice);
    if (isNaN(currentPrice) || isNaN(closePriceNum)) {
      dotCounts[item.symbol] = { yellowDots: 0, greenDots: 0 };
      continue;
    }

    const absoluteDeviation = Math.abs(currentPrice - closePriceNum);

    // Calculate dot counts
    const yellowDots = getFilledDots(absoluteDeviation, wmaThreshold);
    const greenDots = getFilledDots(absoluteDeviation, maxRangeThreshold);

    dotCounts[item.symbol] = { yellowDots, greenDots };
  }

  return dotCounts;
}

/**
 * Determines per-symbol whether the notification bar is met for Yellow and Green.
 * Dot count logic is unchanged; this is used only for notification triggering.
 * When threshold is Auto, "met" means deviation >= baseThreshold * timeLeftFraction.
 * @param prices Array of price items with maxRanges
 * @param multiplier Multiplier percentage (e.g., 100 for 100%)
 * @param timeframe Timeframe type
 * @param highlightedColumn The highlighted column window size
 * @param timeLeftFraction Fraction of time left in candle (0–1)
 * @param yellowThreshold 0–4 or NOTIFY_THRESHOLD_AUTO
 * @param greenThreshold 0–4 or NOTIFY_THRESHOLD_AUTO
 * @param maxVolatilityThreshold 0–10; 0 = do not filter; otherwise notification only when maxVolatility >= this value
 * @param wmaVolatilityThreshold 0–10; 0 = do not filter; otherwise notification only when wmaVolatility >= this value
 * @param mainTableScale Scale for sub-minute accuracy (seconds_remaining / window_seconds); default 1
 * @returns Record mapping symbol to { yellowMet, greenMet }
 */
export function getNotificationMetPerSymbol(
  prices: Array<{ symbol: string; price: string; close5m?: string; close15m?: string; close1h?: string; close1d?: string; maxRanges?: MaxRange[] }>,
  multiplier: number,
  timeframe: TimeframeType,
  highlightedColumn: number,
  timeLeftFraction: number,
  yellowThreshold: number,
  greenThreshold: number,
  maxVolatilityThreshold: number,
  wmaVolatilityThreshold: number,
  mainTableScale: number = 1
): Record<string, { yellowMet: boolean; greenMet: boolean }> {
  const result: Record<string, { yellowMet: boolean; greenMet: boolean }> = {};

  for (const item of prices) {
    const closePrice =
      timeframe === '5m'
        ? item.close5m
        : timeframe === '15m'
        ? item.close15m
        : timeframe === '1d'
        ? item.close1d
        : item.close1h;
    if (!closePrice) {
      result[item.symbol] = { yellowMet: false, greenMet: false };
      continue;
    }

    const range = item.maxRanges?.find(r => r.windowSize === highlightedColumn);
    if (!range || range.range === 0) {
      result[item.symbol] = { yellowMet: false, greenMet: false };
      continue;
    }

    const { wmaRatio, rangeRatio } = getThresholdMultipliers(range, multiplier);
    const wmaThreshold = (range.wma ?? 0) * wmaRatio * mainTableScale;
    const maxRangeThreshold = range.range * rangeRatio * mainTableScale;

    const currentPrice = parseFloat(item.price);
    const closePriceNum = parseFloat(closePrice);
    if (isNaN(currentPrice) || isNaN(closePriceNum)) {
      result[item.symbol] = { yellowMet: false, greenMet: false };
      continue;
    }

    const absoluteDeviation = Math.abs(currentPrice - closePriceNum);

    let yellowMet =
      yellowThreshold === 0
        ? true
        : yellowThreshold === NOTIFY_THRESHOLD_AUTO
        ? absoluteDeviation >= wmaThreshold * timeLeftFraction
        : getFilledDots(absoluteDeviation, wmaThreshold) >= yellowThreshold;

    let greenMet =
      greenThreshold === 0
        ? true
        : greenThreshold === NOTIFY_THRESHOLD_AUTO
        ? absoluteDeviation >= maxRangeThreshold * timeLeftFraction
        : getFilledDots(absoluteDeviation, maxRangeThreshold) >= greenThreshold;

    // Volatility filters: notification only when volatility >= threshold (0 = do not consider)
    if (maxVolatilityThreshold > 0 && (range.maxVolatility ?? 0) < maxVolatilityThreshold) {
      yellowMet = false;
      greenMet = false;
    }
    if (wmaVolatilityThreshold > 0 && (range.wmaVolatility ?? 0) < wmaVolatilityThreshold) {
      yellowMet = false;
      greenMet = false;
    }

    result[item.symbol] = { yellowMet, greenMet };
  }

  return result;
}
