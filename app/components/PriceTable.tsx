'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useCryptoPrices } from '../hooks/useCryptoPrices';
import { useNotifications } from '../hooks/useNotifications';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { type TimeframeType, getTimeframeConfig } from '../lib/timeframe';
import { calculateHighlightingFlags, calculateDotCounts, getMinutesUntilNextInterval, getHighlightedColumn } from '../utils/price';
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
  const [historyHours, setHistoryHours] = useLocalStorage<number>('crypto-dashboard-history-hours', 12);
  const [showMore, setShowMore] = useLocalStorage<boolean>('crypto-dashboard-show-more', false);
  const [yellowThreshold, setYellowThreshold] = useLocalStorage<number>('crypto-dashboard-yellow-threshold', 0);
  const [greenThreshold, setGreenThreshold] = useLocalStorage<number>('crypto-dashboard-green-threshold', 0);
  
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

  const timeframeConfig = getTimeframeConfig(timeframe);
  const minutesRemaining = getMinutesUntilNextInterval(timeframeConfig.intervalMinutes);
  const highlightedColumn = getHighlightedColumn(minutesRemaining, timeframeConfig.maxWindowSize);

  // Calculate highlighting flags (still used for row highlighting)
  const highlightingFlags = useMemo(() => {
    return calculateHighlightingFlags(prices, displayType, multiplier, timeframe, highlightedColumn);
  }, [prices, displayType, multiplier, timeframe, highlightedColumn]);

  // Calculate dot counts for notifications
  const dotCounts = useMemo(() => {
    return calculateDotCounts(prices, multiplier, timeframe, highlightedColumn);
  }, [prices, multiplier, timeframe, highlightedColumn]);

  // Track previous dot counts to detect when thresholds are newly met
  const previousDotCountsRef = useRef<Record<string, { yellowDots: number; greenDots: number }>>({});
  const isInitialRenderRef = useRef<boolean>(true);

  // Use notifications hook
  const { notify } = useNotifications();

  // Detect when thresholds are met and trigger notifications
  useEffect(() => {
    // Skip notifications on initial render
    if (isInitialRenderRef.current) {
      isInitialRenderRef.current = false;
      previousDotCountsRef.current = { ...dotCounts };
      return;
    }

    // Skip if both thresholds are 0 (notifications disabled)
    if (yellowThreshold === 0 && greenThreshold === 0) {
      previousDotCountsRef.current = { ...dotCounts };
      return;
    }

    const previousCounts = previousDotCountsRef.current;
    const currentCounts = dotCounts;

    // Find symbols where thresholds are newly met
    Object.keys(currentCounts).forEach((symbol) => {
      const previous = previousCounts[symbol] || { yellowDots: 0, greenDots: 0 };
      const current = currentCounts[symbol];

      // Check if thresholds were previously met
      const previousMet = previous.yellowDots >= yellowThreshold && previous.greenDots >= greenThreshold;
      
      // Check if thresholds are currently met
      const currentMet = current.yellowDots >= yellowThreshold && current.greenDots >= greenThreshold;

      // Notify only when transitioning from not-met to met
      if (!previousMet && currentMet) {
        notify(`${symbol} ${timeframeConfig.label}`, {
          body: 'Deviation exceeds expected range',
        }, 3);
      }
    });

    // Update ref with current counts for next comparison
    previousDotCountsRef.current = { ...currentCounts };
  }, [dotCounts, yellowThreshold, greenThreshold, notify, timeframeConfig.label]);

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
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-semibold text-black dark:text-zinc-50">
            Crypto Prices
          </h1>
          <div className="flex items-center gap-4">
            <CandleCountdown timeframe={timeframe} />
            <NotificationConfig
              yellowThreshold={yellowThreshold}
              greenThreshold={greenThreshold}
              onYellowThresholdChange={setYellowThreshold}
              onGreenThresholdChange={setGreenThreshold}
            />
            <TimeframeSelector value={timeframe} onChange={setTimeframe} />
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
          onHistoryHoursChange={setHistoryHours}
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
