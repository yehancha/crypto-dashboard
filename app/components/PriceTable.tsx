'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useCryptoPrices } from '../hooks/useCryptoPrices';
import { useNotifications } from '../hooks/useNotifications';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { type TimeframeType, getTimeframeConfig } from '../lib/timeframe';
import { calculateHighlightingFlags, calculateDotCounts, getMinutesUntilNextInterval, getHighlightedColumn, getEffectiveResolution, getNotificationMetPerSymbol, type EffectiveResolution } from '../utils/price';
import SymbolInput from './PriceTable/SymbolInput';
import TimeframeSelector from './PriceTable/TimeframeSelector';
import NotificationConfig from './PriceTable/NotificationConfig';
import CandleCountdown from './PriceTable/CandleCountdown';
import PriceTableHeader from './PriceTable/PriceTableHeader';
import PriceTableRow from './PriceTable/PriceTableRow';
import MaxRangeTable from './PriceTable/MaxRangeTable';
import EmptyState from './PriceTable/EmptyState';
import ErrorDisplay from './PriceTable/ErrorDisplay';
import LoadingState from './PriceTable/LoadingState';
import ErrorState from './PriceTable/ErrorState';

const INITIAL_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT'];

type DisplayType = 'wma' | 'max-range';

export default function PriceTable() {
  const [timeframe, setTimeframe] = useLocalStorage<TimeframeType>('crypto-dashboard-timeframe', '15m');
  const [displayType, setDisplayType] = useLocalStorage<DisplayType>('crypto-dashboard-display-type', 'max-range');
  const [multiplier, setMultiplier] = useLocalStorage<number>('crypto-dashboard-multiplier', 100);
  const [showMore, setShowMore] = useLocalStorage<boolean>('crypto-dashboard-show-more', false);
  const [yellowThreshold, setYellowThreshold] = useLocalStorage<number>('crypto-dashboard-yellow-threshold', 0);
  const [greenThreshold, setGreenThreshold] = useLocalStorage<number>('crypto-dashboard-green-threshold', 0);
  const [maxVolatilityThreshold, setMaxVolatilityThreshold] = useLocalStorage<number>('crypto-dashboard-max-volatility-threshold', 0);
  const [wmaVolatilityThreshold, setWmaVolatilityThreshold] = useLocalStorage<number>('crypto-dashboard-wma-volatility-threshold', 0);

  // Separate history storage for 4H and 1D hourly vs minute modes
  const [historyHours4HHourly, setHistoryHours4HHourly] = useLocalStorage<number>('crypto-dashboard-history-hours-4h-hourly', 168);
  const [historyHours4HMinute, setHistoryHours4HMinute] = useLocalStorage<number>('crypto-dashboard-history-hours-4h-minute', 12);
  const [historyHours1DHourly, setHistoryHours1DHourly] = useLocalStorage<number>('crypto-dashboard-history-hours-1d-hourly', 168);
  const [historyHours1DMinute, setHistoryHours1DMinute] = useLocalStorage<number>('crypto-dashboard-history-hours-1d-minute', 24);
  const [historyHoursOther, setHistoryHoursOther] = useLocalStorage<number>('crypto-dashboard-history-hours', 12);

  const timeframeConfig = getTimeframeConfig(timeframe);
  const minutesRemaining = getMinutesUntilNextInterval(timeframeConfig.intervalMinutes);
  
  const supportsDynamicResolution = timeframe === '4h' || timeframe === '1d';
  const resolution: EffectiveResolution = supportsDynamicResolution ? getEffectiveResolution(minutesRemaining) : '1m';
  const isHourlyResolution = resolution === '1h';
  
  // Select the appropriate history hours value based on timeframe and mode
  const historyHours =
    timeframe === '4h'
      ? (isHourlyResolution ? historyHours4HHourly : historyHours4HMinute)
      : timeframe === '1d'
      ? (isHourlyResolution ? historyHours1DHourly : historyHours1DMinute)
      : historyHoursOther;
  
  // Wrapper function to update the appropriate history hours based on current mode
  const handleHistoryHoursChange = useCallback((value: number) => {
    if (timeframe === '4h' || timeframe === '1d') {
      const cfg = getTimeframeConfig(timeframe);
      const currentMinutesRemaining = getMinutesUntilNextInterval(cfg.intervalMinutes);
      const currentResolution = getEffectiveResolution(currentMinutesRemaining);
      const currentIsHourly = currentResolution === '1h';

      if (timeframe === '4h') {
        if (currentIsHourly) {
          setHistoryHours4HHourly(value);
        } else {
          setHistoryHours4HMinute(value);
        }
      } else {
        if (currentIsHourly) {
          setHistoryHours1DHourly(value);
        } else {
          setHistoryHours1DMinute(value);
        }
      }
    } else {
      setHistoryHoursOther(value);
    }
  }, [timeframe, setHistoryHours4HHourly, setHistoryHours4HMinute, setHistoryHours1DHourly, setHistoryHours1DMinute, setHistoryHoursOther]);
  
  const {
    symbols,
    prices,
    loading,
    error,
    isRateLimited,
    addSymbol,
    removeSymbol,
    reorderSymbols,
  } = useCryptoPrices({ initialSymbols: INITIAL_SYMBOLS, timeframe, historyHours });

  const [newSymbol, setNewSymbol] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [notifiedSymbols, setNotifiedSymbols] = useState<Set<string>>(new Set());
  const [notedSymbols, setNotedSymbols] = useState<Set<string>>(new Set());

  const handleNotificationCellClick = useCallback((symbol: string) => {
    if (notedSymbols.has(symbol)) {
      setNotifiedSymbols((prev) => {
        const next = new Set(prev);
        next.delete(symbol);
        return next;
      });
      setNotedSymbols((prev) => {
        const next = new Set(prev);
        next.delete(symbol);
        return next;
      });
    } else {
      setNotedSymbols((prev) => new Set(prev).add(symbol));
    }
  }, [notedSymbols]);

  // Calculate highlighted column based on timeframe and mode
  const effectiveMaxWindowSize =
    timeframe === '4h'
      ? (isHourlyResolution ? 4 : 60)
      : timeframe === '1d'
      ? (isHourlyResolution ? 24 : 60)
      : timeframeConfig.maxWindowSize;

  const highlightedColumn =
    isHourlyResolution
      ? Math.min(effectiveMaxWindowSize, Math.max(1, Math.ceil(minutesRemaining / 60)))
      : getHighlightedColumn(minutesRemaining, effectiveMaxWindowSize);

  // Calculate highlighting flags (still used for row highlighting)
  const highlightingFlags = useMemo(() => {
    return calculateHighlightingFlags(prices, displayType, multiplier, timeframe, highlightedColumn);
  }, [prices, displayType, multiplier, timeframe, highlightedColumn]);

  // Calculate dot counts (unchanged; used for display only)
  const dotCounts = useMemo(() => {
    return calculateDotCounts(prices, multiplier, timeframe, highlightedColumn);
  }, [prices, multiplier, timeframe, highlightedColumn]);

  const timeLeftFraction = Math.min(1, Math.max(0, minutesRemaining / timeframeConfig.intervalMinutes));
  const notificationMet = useMemo(
    () =>
      getNotificationMetPerSymbol(
        prices,
        multiplier,
        timeframe,
        highlightedColumn,
        timeLeftFraction,
        yellowThreshold,
        greenThreshold,
        maxVolatilityThreshold,
        wmaVolatilityThreshold
      ),
    [prices, multiplier, timeframe, highlightedColumn, timeLeftFraction, yellowThreshold, greenThreshold, maxVolatilityThreshold, wmaVolatilityThreshold]
  );

  // Track previous "met" state per symbol to detect when thresholds are newly met
  const previousMetRef = useRef<Record<string, boolean>>({});
  const isInitialRenderRef = useRef<boolean>(true);

  // Use notifications hook
  const { notify } = useNotifications();

  // Detect when thresholds are met and trigger notifications
  useEffect(() => {
    // Skip notifications on initial render
    if (isInitialRenderRef.current) {
      isInitialRenderRef.current = false;
      previousMetRef.current = Object.fromEntries(
        Object.keys(notificationMet).map((symbol) => [symbol, notificationMet[symbol].yellowMet && notificationMet[symbol].greenMet])
      );
      return;
    }

    // Skip if both thresholds are 0 (notifications disabled)
    if (yellowThreshold === 0 && greenThreshold === 0) {
      previousMetRef.current = Object.fromEntries(
        Object.keys(notificationMet).map((symbol) => [symbol, notificationMet[symbol].yellowMet && notificationMet[symbol].greenMet])
      );
      return;
    }

    const previousMet = previousMetRef.current;

    // Find symbols where thresholds are newly met
    Object.keys(notificationMet).forEach((symbol) => {
      const currentMet = notificationMet[symbol].yellowMet && notificationMet[symbol].greenMet;
      const wasMet = previousMet[symbol] ?? false;

      if (!wasMet && currentMet) {
        if (!notedSymbols.has(symbol)) {
          notify(`${symbol} ${timeframeConfig.label}`, {
            body: 'Deviation exceeds expected range',
          }, 3);
          setNotifiedSymbols((prev) => new Set(prev).add(symbol));
        }
      }
    });

    previousMetRef.current = Object.fromEntries(
      Object.keys(notificationMet).map((symbol) => [symbol, notificationMet[symbol].yellowMet && notificationMet[symbol].greenMet])
    );
  }, [notificationMet, yellowThreshold, greenThreshold, notify, timeframeConfig.label, notedSymbols]);

  const handleAddSymbol = () => {
    const trimmedSymbol = newSymbol.trim().toUpperCase();
    if (trimmedSymbol && !symbols.includes(trimmedSymbol)) {
      addSymbol(trimmedSymbol);
      setNewSymbol('');
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    reorderSymbols(draggedIndex, dropIndex);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  if (loading && prices.length === 0) {
    return <LoadingState />;
  }

  if (error && prices.length === 0) {
    return <ErrorState error={error} />;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-8">
      <div className="w-full max-w-full">
        <div className="mb-8 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-semibold text-black dark:text-zinc-50">
              Crypto Prices
            </h1>
            <div className="flex items-center gap-4">
              <CandleCountdown timeframe={timeframe} />
              <TimeframeSelector value={timeframe} onChange={setTimeframe} />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <NotificationConfig
              yellowThreshold={yellowThreshold}
              greenThreshold={greenThreshold}
              onYellowThresholdChange={setYellowThreshold}
              onGreenThresholdChange={setGreenThreshold}
              maxVolatilityThreshold={maxVolatilityThreshold}
              wmaVolatilityThreshold={wmaVolatilityThreshold}
              onMaxVolatilityThresholdChange={setMaxVolatilityThreshold}
              onWmaVolatilityThresholdChange={setWmaVolatilityThreshold}
            />
          </div>
        </div>

        <SymbolInput
          value={newSymbol}
          onChange={setNewSymbol}
          onAdd={handleAddSymbol}
          disabled={!newSymbol.trim() || symbols.includes(newSymbol.trim().toUpperCase())}
        />

        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full">
            <PriceTableHeader timeframe={timeframe} highlightedColumn={highlightedColumn} />
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {prices.length === 0 ? (
                <EmptyState />
              ) : (
                prices.map((item, index) => (
                  <PriceTableRow
                    key={item.symbol}
                    item={item}
                    index={index}
                    timeframe={timeframe}
                    isDragged={draggedIndex === index}
                    isDragOver={dragOverIndex === index}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onDragEnd={handleDragEnd}
                    onRemove={removeSymbol}
                    highlightColor={highlightingFlags[item.symbol] ?? null}
                    highlightedColumn={highlightedColumn}
                    multiplier={multiplier}
                    displayType={displayType}
                    notificationState={
                      !notifiedSymbols.has(item.symbol)
                        ? 'none'
                        : notedSymbols.has(item.symbol)
                          ? 'noted'
                          : 'tick'
                    }
                    onNotificationCellClick={handleNotificationCellClick}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        <MaxRangeTable 
          prices={prices} 
          timeframe={timeframe}
          displayType={displayType}
          multiplier={multiplier}
          historyHours={historyHours}
          onDisplayTypeChange={setDisplayType}
          onMultiplierChange={setMultiplier}
          onHistoryHoursChange={handleHistoryHoursChange}
          highlightingFlags={highlightingFlags}
          showMore={showMore}
          onShowMoreChange={setShowMore}
        />

        {error && (
          <ErrorDisplay
            error={error}
            isRateLimited={isRateLimited}
            hasPrices={prices.length > 0}
          />
        )}
      </div>
    </div>
  );
}
