'use client';

import { useEffect, useState, useRef } from 'react';
import { getPrices, type BinancePrice, BinanceRateLimitError } from '../lib/binance';

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT'];
const POLL_INTERVAL = 5000; // 5 seconds
const MAX_BACKOFF_INTERVAL = 60000; // Maximum 60 seconds between retries

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
  const [isRateLimited, setIsRateLimited] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const backoffTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentIntervalRef = useRef<number>(POLL_INTERVAL);

  const setupPolling = (interval: number) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    intervalRef.current = setInterval(fetchPrices, interval);
  };

  const fetchPrices = async () => {
    try {
      setError(null);
      setIsRateLimited(false);
      const data = await getPrices(SYMBOLS);
      // Sort by symbol order to maintain consistent display
      const sortedData = SYMBOLS.map(symbol => 
        data.find(item => item.symbol === symbol) || { symbol, price: '0' }
      );
      setPrices(sortedData);
      setLoading(false);
      
      // Reset to normal interval on success
      if (currentIntervalRef.current !== POLL_INTERVAL) {
        currentIntervalRef.current = POLL_INTERVAL;
        setupPolling(POLL_INTERVAL);
      }
    } catch (err) {
      if (err instanceof BinanceRateLimitError) {
        setIsRateLimited(true);
        const retryAfterMs = err.retryAfter 
          ? Math.min(err.retryAfter * 1000, MAX_BACKOFF_INTERVAL)
          : Math.min(currentIntervalRef.current * 2, MAX_BACKOFF_INTERVAL);
        
        // Update interval with backoff
        currentIntervalRef.current = retryAfterMs;
        
        setError(`${err.message}${err.retryAfter ? ` Retry after ${err.retryAfter}s` : ''}`);
        
        // Stop current polling
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        
        // Clear any existing backoff timeout
        if (backoffTimeoutRef.current) {
          clearTimeout(backoffTimeoutRef.current);
        }
        
        // Wait for the backoff period before retrying and resuming polling
        backoffTimeoutRef.current = setTimeout(() => {
          fetchPrices();
          setupPolling(currentIntervalRef.current);
        }, retryAfterMs);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to fetch prices');
      }
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchPrices();

    // Set up polling with initial interval
    setupPolling(POLL_INTERVAL);

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (backoffTimeoutRef.current) {
        clearTimeout(backoffTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          <div className={`mt-4 text-sm ${
            isRateLimited 
              ? 'text-amber-600 dark:text-amber-400' 
              : 'text-red-600 dark:text-red-400'
          }`}>
            {isRateLimited ? '⚠️ ' : ''}
            {error}
            {prices.length > 0 && ' (showing last known prices)'}
          </div>
        )}
      </div>
    </div>
  );
}
