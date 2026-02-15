import { useEffect, useState, useRef } from 'react';
import { getPrices, getCandleCloses, get1mCandlesBatch, get1mCandles, get1hCandlesBatch, get1hCandles, type BinancePrice, type Candle, type WindowRangeCache, BinanceRateLimitError } from '../lib/binance';
import { calculateMaxRanges, pruneWindowRangeCache, getMinutesUntilNextInterval, getEffectiveResolution } from '../utils/price';
import { type TimeframeType, getTimeframeConfig } from '../lib/timeframe';
import { useLocalStorage } from './useLocalStorage';

const POLL_INTERVAL = 5000; // 5 seconds
const CANDLE_POLL_INTERVAL = 60000; // 1 minute for 15m candle data
const CANDLE_1M_POLL_INTERVAL = 60000; // 1 minute for 1m candle data
const MAX_BACKOFF_INTERVAL = 60000; // Maximum 60 seconds between retries

export interface UseCryptoPricesOptions {
  initialSymbols?: string[];
  timeframe?: TimeframeType;
  historyHours?: number;
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
  const { initialSymbols = [], timeframe = '15m', historyHours = 12 } = options;
  const timeframeConfig = getTimeframeConfig(timeframe);
  
  const [symbols, setSymbols] = useLocalStorage<string[]>('crypto-dashboard-symbols', initialSymbols);
  const [prices, setPrices] = useState<BinancePrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  
  // State for dynamic mode detection (hourly vs minute) for 4H and 1D timeframes
  const [use4HHourlyMode, setUse4HHourlyMode] = useState(() => {
    if (timeframe === '4h') {
      const minutesUntilExpiry = getMinutesUntilNextInterval(240);
      return getEffectiveResolution(minutesUntilExpiry) === '1h';
    }
    return false;
  });

  const [use1DHourlyMode, setUse1DHourlyMode] = useState(() => {
    if (timeframe === '1d') {
      const minutesUntilExpiry = getMinutesUntilNextInterval(1440);
      return getEffectiveResolution(minutesUntilExpiry) === '1h';
    }
    return false;
  });
  
  const is4HHourly = timeframe === '4h' && use4HHourlyMode;
  const is1DHourly = timeframe === '1d' && use1DHourlyMode;
  const usesHourlyResolution = is4HHourly || is1DHourly;

  // Calculate candle limit based on history hours and mode
  // For hourly resolution, limit is in hours; for minute resolution, convert hours to minutes
  const candleLimit = usesHourlyResolution ? historyHours : historyHours * 60;

  // Effective max window size for max-range calculations
  const effectiveMaxWindowSize =
    timeframe === '4h'
      ? (use4HHourlyMode ? 4 : 60)
      : timeframe === '1d'
      ? (use1DHourlyMode ? 24 : 60)
      : timeframeConfig.maxWindowSize;
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const candleIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const candle1mIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const backoffTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentIntervalRef = useRef<number>(POLL_INTERVAL);
  const symbolsRef = useRef<string[]>(symbols);
  const candles1mRef = useRef<Map<string, Candle[]>>(new Map());
  const candles1hRef = useRef<Map<string, Candle[]>>(new Map());
  const windowRangeCacheRef = useRef<Map<string, WindowRangeCache>>(new Map());

  const getMaxRangesWithCache = (symbol: string, candles: Candle[] | undefined) => {
    if (!candles) return undefined;
    const cache = windowRangeCacheRef.current.get(symbol) || new Map();
    const maxRanges = calculateMaxRanges(candles, effectiveMaxWindowSize, cache);
    windowRangeCacheRef.current.set(symbol, cache);
    return maxRanges;
  };

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

  const setupCandleFetching = () => {
    const isHourlyMode =
      (timeframe === '4h' && use4HHourlyMode) ||
      (timeframe === '1d' && use1DHourlyMode);

    if (isHourlyMode) {
      // Clear 1m polling and fetch 1h candles
      if (candle1mIntervalRef.current) {
        clearInterval(candle1mIntervalRef.current);
        candle1mIntervalRef.current = null;
      }
      fetch1hCandles();
      // Poll 1h candles every hour (3600000 ms)
      candle1mIntervalRef.current = setInterval(fetch1hCandles, 3600000);
    } else {
      // Use 1m candles for all non-hourly modes
      setup1mCandlePolling();
    }
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
          const candles1m = candles1mRef.current.get(symbol);
          const candles1h = candles1hRef.current.get(symbol);
          // Use appropriate candles based on timeframe and mode
          const activeCandles = usesHourlyResolution ? candles1h : candles1m;
          const maxRanges = getMaxRangesWithCache(symbol, activeCandles);
          
          const updatedPrice: BinancePrice = {
            ...newPrice,
            candles1m: prevPrice?.candles1m || candles1m,
            candles1h: prevPrice?.candles1h || candles1h,
            maxRanges: prevPrice?.maxRanges || maxRanges,
          };
          
          // Preserve close price based on timeframe
          if (timeframe === '5m') {
            updatedPrice.close5m = prevPrice?.close5m || newPrice.close5m;
          } else if (timeframe === '15m') {
            updatedPrice.close15m = prevPrice?.close15m || newPrice.close15m;
          } else if (timeframe === '1h' || timeframe === '4h') {
            updatedPrice.close1h = prevPrice?.close1h;
          } else if (timeframe === '1d') {
            updatedPrice.close1d = prevPrice?.close1d;
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
          const prevCandles1m = candles1mRef.current.get(price.symbol);
          const prevCandles1h = candles1hRef.current.get(price.symbol);
          const activeCandles = usesHourlyResolution ? prevCandles1h : prevCandles1m;
          const prevRanges = getMaxRangesWithCache(price.symbol, activeCandles);
          
          const updatedPrice: BinancePrice = {
            ...price,
            candles1m: prevCandles1m,
            candles1h: prevCandles1h,
            maxRanges: prevRanges,
          };
          
          // Update close price based on timeframe
          if (timeframe === '5m') {
            updatedPrice.close5m = candleCloses[price.symbol] || price.close5m;
          } else if (timeframe === '15m') {
            updatedPrice.close15m = candleCloses[price.symbol] || price.close15m;
          } else if (timeframe === '1h' || timeframe === '4h') {
            updatedPrice.close1h = candleCloses[price.symbol] || price.close1h;
          } else if (timeframe === '1d') {
            updatedPrice.close1d = candleCloses[price.symbol] || price.close1d;
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
        } else if (existingCandles.length < candleLimit) {
          // Not enough historical candles - need full fetch to get required amount
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
          const missingCount = Math.min(minutesMissing, candleLimit);
          symbolsNeedingIncrementalFetch.push({ symbol, missingCount });
        }
      }

      // Fetch all candles for symbols that need full fetch
      // Fetch limit+1 candles and skip the last one (incomplete candle)
      if (symbolsNeedingFullFetch.length > 0) {
        const fullFetchData = await get1mCandlesBatch(symbolsNeedingFullFetch, candleLimit + 1);
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
          if (mergedCandles.length > candleLimit) {
            candlesData[symbol] = mergedCandles.slice(-candleLimit);
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
      
      // Update candles ref and prune stale cache entries
      Object.entries(candlesData).forEach(([symbol, candles]) => {
        if (candles && candles.length > 0) {
          candles1mRef.current.set(symbol, candles);
          // Prune stale cache entries for this symbol
          const cache = windowRangeCacheRef.current.get(symbol);
          if (cache) {
            pruneWindowRangeCache(cache, candles);
          }
        }
      });

      // Calculate max ranges for each symbol and update prices
      setPrices((prevPrices) =>
        prevPrices.map((price) => {
          const candles = candles1mRef.current.get(price.symbol);
          const maxRanges = getMaxRangesWithCache(price.symbol, candles);
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

  const fetch1hCandles = async () => {
    const currentSymbols = symbolsRef.current;
    
    // Don't fetch if no symbols
    if (currentSymbols.length === 0) {
      return;
    }

    try {
      const candlesData: Record<string, Candle[]> = {};
      const symbolsNeedingFullFetch: string[] = [];
      const symbolsNeedingIncrementalFetch: Array<{ symbol: string; missingCount: number }> = [];

      // Calculate the latest completed candle's openTime (current time rounded down to the hour)
      const now = Date.now();
      const latestCompletedCandleOpenTime = Math.floor(now / 3600000) * 3600000;

      // Determine which symbols need full fetch vs incremental fetch
      for (const symbol of currentSymbols) {
        const existingCandles = candles1hRef.current.get(symbol);
        
        if (!existingCandles || existingCandles.length === 0) {
          // No existing candles - need full fetch
          symbolsNeedingFullFetch.push(symbol);
        } else if (existingCandles.length < candleLimit) {
          // Not enough historical candles - need full fetch to get required amount
          symbolsNeedingFullFetch.push(symbol);
        } else {
          // Calculate missing candles
          const lastCandleOpenTime = existingCandles[existingCandles.length - 1].openTime;
          const hoursMissing = Math.floor((latestCompletedCandleOpenTime - lastCandleOpenTime) / 3600000);
          
          if (hoursMissing <= 0) {
            // No missing candles - skip this symbol
            continue;
          }
          
          // Cap missing count at the candle limit
          const missingCount = Math.min(hoursMissing, candleLimit);
          symbolsNeedingIncrementalFetch.push({ symbol, missingCount });
        }
      }

      // Fetch all candles for symbols that need full fetch
      // Fetch limit+1 candles and skip the last one (incomplete candle)
      if (symbolsNeedingFullFetch.length > 0) {
        const fullFetchData = await get1hCandlesBatch(symbolsNeedingFullFetch, candleLimit + 1);
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
          const existingCandles = candles1hRef.current.get(symbol)!;
          // Fetch missingCount+1 candles, then skip the last incomplete one
          const fetchedCandles = await get1hCandles(symbol, missingCount + 1);
          const newCandles = fetchedCandles.slice(0, -1); // Remove last incomplete candle
          
          // Merge new candles with existing ones, avoiding duplicates
          const existingOpenTimes = new Set(existingCandles.map(c => c.openTime));
          const uniqueNewCandles = newCandles.filter(c => !existingOpenTimes.has(c.openTime));
          
          // Combine existing and new candles, maintaining chronological order
          const mergedCandles = [...existingCandles, ...uniqueNewCandles].sort((a, b) => a.openTime - b.openTime);
          
          // Remove oldest candles if we exceed the limit
          if (mergedCandles.length > candleLimit) {
            candlesData[symbol] = mergedCandles.slice(-candleLimit);
          } else {
            candlesData[symbol] = mergedCandles;
          }
        } catch (err) {
          // Log error but don't fail entire batch
          console.error(`Error fetching incremental 1h candles for ${symbol}:`, err);
          // Keep existing candles if fetch fails
          candlesData[symbol] = candles1hRef.current.get(symbol) || [];
        }
      }
      
      // Update candles ref and prune stale cache entries
      Object.entries(candlesData).forEach(([symbol, candles]) => {
        if (candles && candles.length > 0) {
          candles1hRef.current.set(symbol, candles);
          // Prune stale cache entries for this symbol
          const cache = windowRangeCacheRef.current.get(symbol);
          if (cache) {
            pruneWindowRangeCache(cache, candles);
          }
        }
      });

      // Calculate max ranges for each symbol and update prices
      setPrices((prevPrices) =>
        prevPrices.map((price) => {
          const candles = candles1hRef.current.get(price.symbol);
          const maxRanges = getMaxRangesWithCache(price.symbol, candles);
          return {
            ...price,
            candles1h: candles,
            maxRanges,
          };
        })
      );
    } catch (err) {
      // Log error but don't update error state for candle data
      // to avoid interfering with main price fetching
      console.error('Error fetching 1h candles:', err);
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
    // Clean up candles and cache for removed symbol
    candles1mRef.current.delete(symbolToRemove);
    candles1hRef.current.delete(symbolToRemove);
    windowRangeCacheRef.current.delete(symbolToRemove);
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

  // Monitor expiry time for 4H timeframe to switch modes dynamically
  useEffect(() => {
    if (timeframe !== '4h') {
      return;
    }

    const checkMode = () => {
      const minutesUntilExpiry = getMinutesUntilNextInterval(240);
      const shouldUseHourly = getEffectiveResolution(minutesUntilExpiry) === '1h';
      setUse4HHourlyMode(prev => {
        // If mode changed, trigger refetch
        if (prev !== shouldUseHourly) {
          // Mode changed - need to refetch with appropriate candles
          setTimeout(() => {
            if (shouldUseHourly) {
              fetch1hCandles();
            } else {
              fetch1mCandles();
            }
          }, 0);
        }
        return shouldUseHourly;
      });
    };

    // Check immediately
    checkMode();

    // Check every minute to detect mode changes
    const modeCheckInterval = setInterval(checkMode, 60000);

    return () => clearInterval(modeCheckInterval);
  }, [timeframe]);

  // Monitor expiry time for 1D timeframe to switch modes dynamically
  useEffect(() => {
    if (timeframe !== '1d') {
      return;
    }

    const checkMode = () => {
      const minutesUntilExpiry = getMinutesUntilNextInterval(1440);
      const shouldUseHourly = getEffectiveResolution(minutesUntilExpiry) === '1h';
      setUse1DHourlyMode(prev => {
        if (prev !== shouldUseHourly) {
          setTimeout(() => {
            if (shouldUseHourly) {
              fetch1hCandles();
            } else {
              fetch1mCandles();
            }
          }, 0);
        }
        return shouldUseHourly;
      });
    };

    checkMode();
    const modeCheckInterval = setInterval(checkMode, 60000);
    return () => clearInterval(modeCheckInterval);
  }, [timeframe]);

  useEffect(() => {
    // Initial fetch
    fetchPrices();
    fetchCandleCloses();
    
    // Set up appropriate candle fetching based on timeframe and mode
    if (usesHourlyResolution) {
      fetch1hCandles();
    } else {
      fetch1mCandles();
    }

    // Set up polling with initial interval
    setupPolling(POLL_INTERVAL);
    setupCandlePolling();
    setupCandleFetching();

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
  }, [symbols, timeframe, historyHours, usesHourlyResolution]);

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
