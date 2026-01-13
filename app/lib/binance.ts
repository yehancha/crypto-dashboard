export interface BinancePrice {
  symbol: string;
  price: string;
  close15m?: string; // 15-minute candle close price
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
 * Fetches the last 15-minute candle close price for a symbol from Binance API
 * @param symbol Trading pair symbol (e.g., 'BTCUSDT')
 * @returns Promise with the close price of the last 15m candle
 * @throws BinanceRateLimitError if rate limited (429) or IP banned (418)
 * 
 * Weight: 2 per request
 */
export async function get15mCandleClose(symbol: string): Promise<string> {
  try {
    const url = `${BINANCE_API_BASE}/api/v3/klines?symbol=${symbol}&interval=15m&limit=1`;
    
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
    if (data.length === 0 || !data[0] || data[0].length < 5) {
      throw new Error(`Invalid kline data for ${symbol}`);
    }
    
    return data[0][4] as string;
  } catch (error) {
    // Re-throw rate limit errors as-is
    if (error instanceof BinanceRateLimitError) {
      throw error;
    }
    
    console.error(`Error fetching 15m candle for ${symbol}:`, error);
    throw error;
  }
}

/**
 * Fetches 15-minute candle close prices for multiple symbols
 * @param symbols Array of trading pair symbols (e.g., ['BTCUSDT', 'ETHUSDT'])
 * @returns Promise with map of symbol to close price
 * @throws BinanceRateLimitError if rate limited (429) or IP banned (418)
 * 
 * Weight: 2 per symbol per request
 */
export async function get15mCandleCloses(symbols: string[]): Promise<Record<string, string>> {
  const results: Record<string, string> = {};
  
  // Fetch all candles in parallel
  const promises = symbols.map(async (symbol) => {
    try {
      const closePrice = await get15mCandleClose(symbol);
      return { symbol, closePrice };
    } catch (error) {
      // Log error but don't fail entire batch
      console.error(`Failed to fetch 15m candle for ${symbol}:`, error);
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
