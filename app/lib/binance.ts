export interface BinancePrice {
  symbol: string;
  price: string;
}

const BINANCE_API_BASE = 'https://api.binance.com';

/**
 * Fetches current prices for multiple symbols from Binance API
 * @param symbols Array of trading pair symbols (e.g., ['BTCUSDT', 'ETHUSDT'])
 * @returns Promise with array of price data
 */
export async function getPrices(symbols: string[]): Promise<BinancePrice[]> {
  try {
    // Binance API accepts symbols as a JSON array in the query string
    const symbolsParam = JSON.stringify(symbols);
    const url = `${BINANCE_API_BASE}/api/v3/ticker/price?symbols=${encodeURIComponent(symbolsParam)}`;
    
    const response = await fetch(url, {
      next: { revalidate: 0 }, // Always fetch fresh data
    });

    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
    }

    const data: BinancePrice[] = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching prices from Binance:', error);
    throw error;
  }
}
