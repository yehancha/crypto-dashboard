import { useEffect, useState, useRef } from 'react';
import { getPrices, type BinancePrice, BinanceRateLimitError } from '../lib/binance';

const POLL_INTERVAL = 5000; // 5 seconds
const MAX_BACKOFF_INTERVAL = 60000; // Maximum 60 seconds between retries

export interface UseCryptoPricesOptions {
  initialSymbols?: string[];
}

export interface UseCryptoPricesReturn {
  symbols: string[];
  prices: BinancePrice[];
  loading: boolean;
  error: string | null;
  isRateLimited: boolean;
  addSymbol: (symbol: string) => void;
  removeSymbol: (symbol: string) => void;
  reorderSymbols: (fromIndex: number, toIndex: number) => void;
}

export function useCryptoPrices(
  options: UseCryptoPricesOptions = {}
): UseCryptoPricesReturn {
  const { initialSymbols = [] } = options;
  
  const [symbols, setSymbols] = useState<string[]>(initialSymbols);
  const [prices, setPrices] = useState<BinancePrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const backoffTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentIntervalRef = useRef<number>(POLL_INTERVAL);
  const symbolsRef = useRef<string[]>(initialSymbols);

  const setupPolling = (interval: number) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    intervalRef.current = setInterval(fetchPrices, interval);
  };

  const fetchPrices = async () => {
    // Use ref to always get latest symbols
    const currentSymbols = symbolsRef.current;
    
    // Don't fetch if no symbols
    if (currentSymbols.length === 0) {
      setPrices([]);
      setLoading(false);
      return;
    }

    try {
      setError(null);
      setIsRateLimited(false);
      const data = await getPrices(currentSymbols);
      // Sort by symbol order to maintain consistent display
      const sortedData = currentSymbols.map(symbol => 
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

  const addSymbol = (symbol: string) => {
    const trimmedSymbol = symbol.trim().toUpperCase();
    if (trimmedSymbol && !symbols.includes(trimmedSymbol)) {
      const newSymbols = [...symbols, trimmedSymbol];
      setSymbols(newSymbols);
      symbolsRef.current = newSymbols;
    }
  };

  const removeSymbol = (symbolToRemove: string) => {
    const newSymbols = symbols.filter(s => s !== symbolToRemove);
    setSymbols(newSymbols);
    symbolsRef.current = newSymbols;
  };

  const reorderSymbols = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    
    const newSymbols = [...symbols];
    const draggedSymbol = newSymbols[fromIndex];
    newSymbols.splice(fromIndex, 1);
    newSymbols.splice(toIndex, 0, draggedSymbol);
    
    setSymbols(newSymbols);
    symbolsRef.current = newSymbols;
  };

  // Update ref when symbols change
  useEffect(() => {
    symbolsRef.current = symbols;
  }, [symbols]);

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
  }, [symbols]);

  return {
    symbols,
    prices,
    loading,
    error,
    isRateLimited,
    addSymbol,
    removeSymbol,
    reorderSymbols,
  };
}
