'use client';

import { useEffect, useState } from 'react';
import { getPrices, type BinancePrice } from '../lib/binance';

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT'];
const POLL_INTERVAL = 5000; // 5 seconds

/**
 * Formats a price string to appropriate decimal places
 * Higher prices get fewer decimals, lower prices get more
 */
function formatPrice(price: string): string {
  const numPrice = parseFloat(price);
  
  if (numPrice >= 1000) {
    return numPrice.toFixed(2);
  } else if (numPrice >= 1) {
    return numPrice.toFixed(4);
  } else {
    return numPrice.toFixed(6);
  }
}

export default function PriceTable() {
  const [prices, setPrices] = useState<BinancePrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrices = async () => {
    try {
      setError(null);
      const data = await getPrices(SYMBOLS);
      // Sort by symbol order to maintain consistent display
      const sortedData = SYMBOLS.map(symbol => 
        data.find(item => item.symbol === symbol) || { symbol, price: '0' }
      );
      setPrices(sortedData);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch prices');
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchPrices();

    // Set up polling
    const interval = setInterval(fetchPrices, POLL_INTERVAL);

    // Cleanup on unmount
    return () => clearInterval(interval);
  }, []);

  if (loading && prices.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg text-zinc-600 dark:text-zinc-400">Loading prices...</div>
      </div>
    );
  }

  if (error && prices.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg text-red-600 dark:text-red-400">
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black p-8">
      <div className="w-full max-w-2xl">
        <h1 className="mb-8 text-3xl font-semibold text-black dark:text-zinc-50">
          Crypto Prices
        </h1>
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full">
            <thead className="bg-zinc-100 dark:bg-zinc-800">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Symbol
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Price
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {prices.map((item) => (
                <tr
                  key={item.symbol}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <td className="px-6 py-4 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {item.symbol}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-zinc-600 dark:text-zinc-400">
                    {formatPrice(item.price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {error && (
          <div className="mt-4 text-sm text-red-600 dark:text-red-400">
            Warning: {error} (showing last known prices)
          </div>
        )}
      </div>
    </div>
  );
}
