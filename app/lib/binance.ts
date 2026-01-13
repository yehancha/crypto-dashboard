export interface BinancePrice {
  symbol: string;
  price: string;
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
