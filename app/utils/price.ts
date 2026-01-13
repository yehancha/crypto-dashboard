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
