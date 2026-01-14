'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useCryptoPrices } from '../hooks/useCryptoPrices';
import { useNotifications } from '../hooks/useNotifications';
import { type TimeframeType, getTimeframeConfig } from '../lib/timeframe';
import { calculateHighlightingFlags, getMinutesUntilNextInterval, getHighlightedColumn } from '../utils/price';
import SymbolInput from './PriceTable/SymbolInput';
import TimeframeSelector from './PriceTable/TimeframeSelector';
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
  const [timeframe, setTimeframe] = useState<TimeframeType>('15m');
  const [displayType, setDisplayType] = useState<DisplayType>('max-range');
  const [multiplier, setMultiplier] = useState<number>(100);
  
  const {
    symbols,
    prices,
    loading,
    error,
    isRateLimited,
    addSymbol,
    removeSymbol,
    reorderSymbols,
  } = useCryptoPrices({ initialSymbols: INITIAL_SYMBOLS, timeframe });

  const [newSymbol, setNewSymbol] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const timeframeConfig = getTimeframeConfig(timeframe);
  const minutesRemaining = getMinutesUntilNextInterval(timeframeConfig.intervalMinutes);
  const highlightedColumn = getHighlightedColumn(minutesRemaining, timeframeConfig.maxWindowSize);

  // Calculate highlighting flags
  const highlightingFlags = useMemo(() => {
    return calculateHighlightingFlags(prices, displayType, multiplier, timeframe, highlightedColumn);
  }, [prices, displayType, multiplier, timeframe, highlightedColumn]);

  // Track previous highlighting flags to detect new highlights
  const previousHighlightingFlagsRef = useRef<Record<string, boolean>>({});
  const isInitialRenderRef = useRef<boolean>(true);

  // Use notifications hook
  const { notify } = useNotifications();

  // Detect new highlights and trigger notifications
  useEffect(() => {
    // Skip notifications on initial render
    if (isInitialRenderRef.current) {
      isInitialRenderRef.current = false;
      previousHighlightingFlagsRef.current = { ...highlightingFlags };
      return;
    }

    const previousFlags = previousHighlightingFlagsRef.current;
    const currentFlags = highlightingFlags;

    // Find symbols that transitioned from not highlighted to highlighted
    Object.keys(currentFlags).forEach((symbol) => {
      const wasHighlighted = previousFlags[symbol] ?? false;
      const isHighlighted = currentFlags[symbol] ?? false;

      // If symbol just became highlighted (transitioned from false to true)
      if (!wasHighlighted && isHighlighted) {
        notify(`${symbol} ${timeframeConfig.label}`, {
          body: 'Deviation exceeds expected range',
        });
      }
    });

    // Update ref with current flags for next comparison
    previousHighlightingFlagsRef.current = { ...currentFlags };
  }, [highlightingFlags, notify]);

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
          <TimeframeSelector value={timeframe} onChange={setTimeframe} />
        </div>

        <SymbolInput
          value={newSymbol}
          onChange={setNewSymbol}
          onAdd={handleAddSymbol}
          disabled={!newSymbol.trim() || symbols.includes(newSymbol.trim().toUpperCase())}
        />

        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full">
            <PriceTableHeader timeframe={timeframe} />
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
                    isHighlighted={highlightingFlags[item.symbol] ?? false}
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
          onDisplayTypeChange={setDisplayType}
          onMultiplierChange={setMultiplier}
          highlightingFlags={highlightingFlags}
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
