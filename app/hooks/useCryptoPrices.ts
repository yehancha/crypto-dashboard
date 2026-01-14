import { useEffect, useState, useRef } from 'react';
import { getPrices, getCandleCloses, get1mCandlesBatch, get1mCandles, type BinancePrice, type Candle, BinanceRateLimitError } from '../lib/binance';
import { calculateMaxRanges } from '../utils/price';
import { type TimeframeType, getTimeframeConfig } from '../lib/timeframe';
import { useLocalStorage } from './useLocalStorage';

const POLL_INTERVAL = 5000; // 5 seconds
const CANDLE_POLL_INTERVAL = 60000; // 1 minute for 15m candle data
const CANDLE_1M_POLL_INTERVAL = 60000; // 1 minute for 1m candle data
const MAX_BACKOFF_INTERVAL = 60000; // Maximum 60 seconds between retries

export interface UseCryptoPricesOptions {
  initialSymbols?: string[];
  timeframe?: TimeframeType;
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
  const { initialSymbols = [], timeframe = '15m' } = options;
  const timeframeConfig = getTimeframeConfig(timeframe);
  
  const [symbols, setSymbols] = useLocalStorage<string[]>('crypto-dashboard-symbols', initialSymbols);
  const [prices, setPrices] = useState<BinancePrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const candleIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const candle1mIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const backoffTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentIntervalRef = useRef<number>(POLL_INTERVAL);
  const symbolsRef = useRef<string[]>(symbols);
  const candles1mRef = useRef<Map<string, Candle[]>>(new Map());

  const setupPolling = (interval: number) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    intervalRef.current = setInterval(fetchPrices, interval);
  };

  const setupCandlePolling = () => {
    if (candleIntervalRef.current) {
      clearInterval(candleIntervalRef.current);
    }
    candleIntervalRef.current = setInterval(fetchCandleCloses, CANDLE_POLL_INTERVAL);
  };

  const setup1mCandlePolling = () => {
    if (candle1mIntervalRef.current) {
      clearInterval(candle1mIntervalRef.current);
    }
    candle1mIntervalRef.current = setInterval(fetch1mCandles, CANDLE_1M_POLL_INTERVAL);
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
      // Preserve existing candle data when updating prices
      setPrices((prevPrices) => {
        const prevPriceMap = new Map(prevPrices.map(p => [p.symbol, p]));
        return currentSymbols.map(symbol => {
          const newPrice = data.find(item => item.symbol === symbol) || { symbol, price: '0' };
          const prevPrice = prevPriceMap.get(symbol);
          const candles = candles1mRef.current.get(symbol);
          const maxRanges = candles ? calculateMaxRanges(candles, timeframeConfig.maxWindowSize) : undefined;
          
          const updatedPrice: BinancePrice = {
            ...newPrice,
            candles1m: prevPrice?.candles1m || candles,
            maxRanges: prevPrice?.maxRanges || maxRanges,
          };
          
          // Preserve close price based on timeframe
          if (timeframe === '15m') {
            updatedPrice.close15m = prevPrice?.close15m || newPrice.close15m;
          } else {
            updatedPrice.close1h = prevPrice?.close1h;
          }
          
          return updatedPrice;
        });
      });
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

  const fetchCandleCloses = async () => {
    const currentSymbols = symbolsRef.current;
    
    // Don't fetch if no symbols
    if (currentSymbols.length === 0) {
      return;
    }

    try {
      const candleCloses = await getCandleCloses(currentSymbols, timeframeConfig.candleInterval);
      
      // Update prices with candle close data
      setPrices((prevPrices) =>
        prevPrices.map((price) => {
          const prevCandles = candles1mRef.current.get(price.symbol);
          const prevRanges = prevCandles ? calculateMaxRanges(prevCandles, timeframeConfig.maxWindowSize) : undefined;
          
          const updatedPrice: BinancePrice = {
            ...price,
            candles1m: prevCandles,
            maxRanges: prevRanges,
          };
          
          // Update close price based on timeframe
          if (timeframe === '15m') {
            updatedPrice.close15m = candleCloses[price.symbol] || price.close15m;
          } else {
            updatedPrice.close1h = candleCloses[price.symbol] || price.close1h;
          }
          
          return updatedPrice;
        })
      );
    } catch (err) {
      // Log error but don't update error state for candle data
      // to avoid interfering with main price fetching
      console.error(`Error fetching ${timeframeConfig.candleInterval} candle closes:`, err);
    }
  };

  const fetch1mCandles = async () => {
    const currentSymbols = symbolsRef.current;
    
    // Don't fetch if no symbols
    if (currentSymbols.length === 0) {
      return;
    }

    try {
      const candlesData: Record<string, Candle[]> = {};
      const symbolsNeedingFullFetch: string[] = [];
      const symbolsNeedingIncrementalFetch: Array<{ symbol: string; missingCount: number }> = [];

      // Calculate the latest completed candle's openTime (current time rounded down to the minute)
      const now = Date.now();
      const latestCompletedCandleOpenTime = Math.floor(now / 60000) * 60000;

      // Determine which symbols need full fetch vs incremental fetch
      for (const symbol of currentSymbols) {
        const existingCandles = candles1mRef.current.get(symbol);
        
        if (!existingCandles || existingCandles.length === 0) {
          // No existing candles - need full fetch
          symbolsNeedingFullFetch.push(symbol);
        } else {
          // Calculate missing candles
          const lastCandleOpenTime = existingCandles[existingCandles.length - 1].openTime;
          const minutesMissing = Math.floor((latestCompletedCandleOpenTime - lastCandleOpenTime) / 60000);
          
          if (minutesMissing <= 0) {
            // No missing candles - skip this symbol
            continue;
          }
          
          // Cap missing count at the candle limit
          const missingCount = Math.min(minutesMissing, timeframeConfig.candleLimit);
          symbolsNeedingIncrementalFetch.push({ symbol, missingCount });
        }
      }

      // Fetch all candles for symbols that need full fetch
      // Fetch limit+1 candles and skip the last one (incomplete candle)
      if (symbolsNeedingFullFetch.length > 0) {
        const fullFetchData = await get1mCandlesBatch(symbolsNeedingFullFetch, timeframeConfig.candleLimit + 1);
        // Skip the last candle (incomplete) from each symbol's results
        Object.entries(fullFetchData).forEach(([symbol, candles]) => {
          if (candles && candles.length > 0) {
            candlesData[symbol] = candles.slice(0, -1); // Remove last incomplete candle
          }
        });
      }

      // Fetch missing candles for symbols that need incremental fetch
      // Fetch missingCount+1 candles and skip the last one (incomplete candle)
      for (const { symbol, missingCount } of symbolsNeedingIncrementalFetch) {
        try {
          const existingCandles = candles1mRef.current.get(symbol)!;
          // Fetch missingCount+1 candles, then skip the last incomplete one
          const fetchedCandles = await get1mCandles(symbol, missingCount + 1);
          const newCandles = fetchedCandles.slice(0, -1); // Remove last incomplete candle
          
          // Merge new candles with existing ones, avoiding duplicates
          const existingOpenTimes = new Set(existingCandles.map(c => c.openTime));
          const uniqueNewCandles = newCandles.filter(c => !existingOpenTimes.has(c.openTime));
          
          // Combine existing and new candles, maintaining chronological order
          const mergedCandles = [...existingCandles, ...uniqueNewCandles].sort((a, b) => a.openTime - b.openTime);
          
          // Remove oldest candles if we exceed the limit
          if (mergedCandles.length > timeframeConfig.candleLimit) {
            candlesData[symbol] = mergedCandles.slice(-timeframeConfig.candleLimit);
          } else {
            candlesData[symbol] = mergedCandles;
          }
        } catch (err) {
          // Log error but don't fail entire batch
          console.error(`Error fetching incremental 1m candles for ${symbol}:`, err);
          // Keep existing candles if fetch fails
          candlesData[symbol] = candles1mRef.current.get(symbol) || [];
        }
      }
      
      // Update candles ref
      Object.entries(candlesData).forEach(([symbol, candles]) => {
        if (candles && candles.length > 0) {
          candles1mRef.current.set(symbol, candles);
        }
      });

      // Calculate max ranges for each symbol and update prices
      setPrices((prevPrices) =>
        prevPrices.map((price) => {
          const candles = candles1mRef.current.get(price.symbol);
          const maxRanges = candles ? calculateMaxRanges(candles, timeframeConfig.maxWindowSize) : undefined;
          return {
            ...price,
            candles1m: candles,
            maxRanges,
          };
        })
      );
    } catch (err) {
      // Log error but don't update error state for candle data
      // to avoid interfering with main price fetching
      console.error('Error fetching 1m candles:', err);
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
    // Clean up candles for removed symbol
    candles1mRef.current.delete(symbolToRemove);
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

  // Update ref when symbols change (for localStorage persistence)
  useEffect(() => {
    symbolsRef.current = symbols;
  }, [symbols]);

  useEffect(() => {
    // Initial fetch
    fetchPrices();
    fetchCandleCloses();
    fetch1mCandles();

    // Set up polling with initial interval
    setupPolling(POLL_INTERVAL);
    setupCandlePolling();
    setup1mCandlePolling();

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (candleIntervalRef.current) {
        clearInterval(candleIntervalRef.current);
      }
      if (candle1mIntervalRef.current) {
        clearInterval(candle1mIntervalRef.current);
      }
      if (backoffTimeoutRef.current) {
        clearTimeout(backoffTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols, timeframe]);

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
