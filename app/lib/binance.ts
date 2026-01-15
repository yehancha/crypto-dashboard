export interface Candle {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

export interface MaxRange {
  windowSize: number;
  range: number;
  high: string;
  low: string;
  wma?: number; // Weighted Moving Average
}

// Cache entry for a single window's range calculation
export interface CachedWindowRange {
  high: number;
  low: number;
  range: number;
}

// Cache for window range calculations, keyed by "<windowSize>-<firstCandleOpenTime>"
export type WindowRangeCache = Map<string, CachedWindowRange>;

export interface BinancePrice {
  symbol: string;
  price: string;
  close15m?: string; // 15-minute candle close price
  close1h?: string; // 1-hour candle close price
  candles1m?: Candle[]; // 1-minute candles (up to 60 or 600 depending on timeframe)
  maxRanges?: MaxRange[]; // Max ranges for windows (15, 14, ..., 1 or 60, 59, ..., 1 depending on timeframe)
}

export class BinanceRateLimitError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public retryAfter?: number
  ) {
    super(message);
    this.name = 'BinanceRateLimitError';
  }
}

const BINANCE_API_BASE = 'https://api.binance.com';

/**
 * Fetches current prices for multiple symbols from Binance API
 * @param symbols Array of trading pair symbols (e.g., ['BTCUSDT', 'ETHUSDT'])
 * @returns Promise with array of price data
 * @throws BinanceRateLimitError if rate limited (429) or IP banned (418)
 */
export async function getPrices(symbols: string[]): Promise<BinancePrice[]> {
  try {
    // Binance API accepts symbols as a JSON array in the query string
    const symbolsParam = JSON.stringify(symbols);
    const url = `${BINANCE_API_BASE}/api/v3/ticker/price?symbols=${encodeURIComponent(symbolsParam)}`;
    
    const response = await fetch(url, {
      next: { revalidate: 0 }, // Always fetch fresh data
    });

    // Handle rate limiting (429) and IP ban (418) with Retry-After header
    if (response.status === 429 || response.status === 418) {
      const retryAfterHeader = response.headers.get('Retry-After');
      const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;
      
      const errorMessage = response.status === 418
        ? 'IP banned by Binance. Please wait before retrying.'
        : 'Rate limit exceeded. Please slow down requests.';
      
      throw new BinanceRateLimitError(errorMessage, response.status, retryAfter);
    }

    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
    }

    const data: BinancePrice[] = await response.json();
    return data;
  } catch (error) {
    // Re-throw rate limit errors as-is
    if (error instanceof BinanceRateLimitError) {
      throw error;
    }
    
    console.error('Error fetching prices from Binance:', error);
    throw error;
  }
}

/**
 * Generic function to fetch the previous completed candle close price for a symbol from Binance API
 * @param symbol Trading pair symbol (e.g., 'BTCUSDT')
 * @param interval Candle interval (e.g., '15m', '1h')
 * @returns Promise with the close price of the previous completed candle
 * @throws BinanceRateLimitError if rate limited (429) or IP banned (418)
 * 
 * Weight: 2 per request
 */
export async function getCandleClose(symbol: string, interval: string): Promise<string> {
  try {
    // Fetch 2 candles: the previous completed one (index 0) and the current incomplete one (index 1)
    // We use the previous completed candle's close price
    const url = `${BINANCE_API_BASE}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=2`;
    
    const response = await fetch(url, {
      next: { revalidate: 0 }, // Always fetch fresh data
    });

    // Handle rate limiting (429) and IP ban (418) with Retry-After header
    if (response.status === 429 || response.status === 418) {
      const retryAfterHeader = response.headers.get('Retry-After');
      const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;
      
      const errorMessage = response.status === 418
        ? 'IP banned by Binance. Please wait before retrying.'
        : 'Rate limit exceeded. Please slow down requests.';
      
      throw new BinanceRateLimitError(errorMessage, response.status, retryAfter);
    }

    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
    }

    const data: any[][] = await response.json();
    
    // Kline response format: [Open time, Open, High, Low, Close, Volume, ...]
    // Close price is at index 4
    // data[0] = previous completed candle, data[1] = current incomplete candle
    if (data.length === 0 || !data[0] || data[0].length < 5) {
      throw new Error(`Invalid kline data for ${symbol}`);
    }
    
    // Return the close price of the previous completed candle (first element)
    return data[0][4] as string;
  } catch (error) {
    // Re-throw rate limit errors as-is
    if (error instanceof BinanceRateLimitError) {
      throw error;
    }
    
    console.error(`Error fetching ${interval} candle for ${symbol}:`, error);
    throw error;
  }
}

/**
 * Fetches the previous completed 15-minute candle close price for a symbol from Binance API
 * @param symbol Trading pair symbol (e.g., 'BTCUSDT')
 * @returns Promise with the close price of the previous completed 15m candle
 * @throws BinanceRateLimitError if rate limited (429) or IP banned (418)
 * 
 * Weight: 2 per request
 * @deprecated Use getCandleClose(symbol, '15m') instead
 */
export async function get15mCandleClose(symbol: string): Promise<string> {
  return getCandleClose(symbol, '15m');
}

/**
 * Generic function to fetch candle close prices for multiple symbols
 * @param symbols Array of trading pair symbols (e.g., ['BTCUSDT', 'ETHUSDT'])
 * @param interval Candle interval (e.g., '15m', '1h')
 * @returns Promise with map of symbol to close price
 * @throws BinanceRateLimitError if rate limited (429) or IP banned (418)
 * 
 * Weight: 2 per symbol per request
 */
export async function getCandleCloses(symbols: string[], interval: string): Promise<Record<string, string>> {
  const results: Record<string, string> = {};
  
  // Fetch all candles in parallel
  const promises = symbols.map(async (symbol) => {
    try {
      const closePrice = await getCandleClose(symbol, interval);
      return { symbol, closePrice };
    } catch (error) {
      // Log error but don't fail entire batch
      console.error(`Failed to fetch ${interval} candle for ${symbol}:`, error);
      return { symbol, closePrice: undefined };
    }
  });
  
  const settled = await Promise.allSettled(promises);
  
  settled.forEach((result) => {
    if (result.status === 'fulfilled' && result.value.closePrice) {
      results[result.value.symbol] = result.value.closePrice;
    }
  });
  
  return results;
}

/**
 * Fetches 15-minute candle close prices for multiple symbols
 * @param symbols Array of trading pair symbols (e.g., ['BTCUSDT', 'ETHUSDT'])
 * @returns Promise with map of symbol to close price
 * @throws BinanceRateLimitError if rate limited (429) or IP banned (418)
 * 
 * Weight: 2 per symbol per request
 * @deprecated Use getCandleCloses(symbols, '15m') instead
 */
export async function get15mCandleCloses(symbols: string[]): Promise<Record<string, string>> {
  return getCandleCloses(symbols, '15m');
}

/**
 * Fetches 1-minute candle data for a symbol from Binance API
 * @param symbol Trading pair symbol (e.g., 'BTCUSDT')
 * @param limit Number of candles to fetch (default: 60 for 1 hour)
 * @returns Promise with array of candle objects
 * @throws BinanceRateLimitError if rate limited (429) or IP banned (418)
 * 
 * Weight: 1 per request
 */
export async function get1mCandles(symbol: string, limit: number = 60): Promise<Candle[]> {
  try {
    const url = `${BINANCE_API_BASE}/api/v3/klines?symbol=${symbol}&interval=1m&limit=${limit}`;
    
    const response = await fetch(url, {
      next: { revalidate: 0 }, // Always fetch fresh data
    });

    // Handle rate limiting (429) and IP ban (418) with Retry-After header
    if (response.status === 429 || response.status === 418) {
      const retryAfterHeader = response.headers.get('Retry-After');
      const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;
      
      const errorMessage = response.status === 418
        ? 'IP banned by Binance. Please wait before retrying.'
        : 'Rate limit exceeded. Please slow down requests.';
      
      throw new BinanceRateLimitError(errorMessage, response.status, retryAfter);
    }

    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
    }

    const data: any[][] = await response.json();
    
    // Kline response format: [Open time, Open, High, Low, Close, Volume, ...]
    return data.map((kline) => ({
      openTime: kline[0] as number,
      open: kline[1] as string,
      high: kline[2] as string,
      low: kline[3] as string,
      close: kline[4] as string,
      volume: kline[5] as string,
    }));
  } catch (error) {
    // Re-throw rate limit errors as-is
    if (error instanceof BinanceRateLimitError) {
      throw error;
    }
    
    console.error(`Error fetching 1m candles for ${symbol}:`, error);
    throw error;
  }
}

/**
 * Fetches 1-minute candle data for multiple symbols
 * @param symbols Array of trading pair symbols (e.g., ['BTCUSDT', 'ETHUSDT'])
 * @param limit Number of candles to fetch per symbol (default: 60)
 * @returns Promise with map of symbol to candle array
 * @throws BinanceRateLimitError if rate limited (429) or IP banned (418)
 * 
 * Weight: 1 per symbol per request
 */
export async function get1mCandlesBatch(
  symbols: string[],
  limit: number = 60
): Promise<Record<string, Candle[]>> {
  const results: Record<string, Candle[]> = {};
  
  // Fetch all candles in parallel
  const promises = symbols.map(async (symbol) => {
    try {
      const candles = await get1mCandles(symbol, limit);
      return { symbol, candles };
    } catch (error) {
      // Log error but don't fail entire batch
      console.error(`Failed to fetch 1m candles for ${symbol}:`, error);
      return { symbol, candles: undefined };
    }
  });
  
  const settled = await Promise.allSettled(promises);
  
  settled.forEach((result) => {
    if (result.status === 'fulfilled' && result.value.candles) {
      results[result.value.symbol] = result.value.candles;
    }
  });
  
  return results;
}
