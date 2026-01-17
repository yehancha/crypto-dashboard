'use client';

import { useState, useEffect } from 'react';
import { type BinancePrice } from '../../lib/binance';
import { type TimeframeType } from '../../lib/timeframe';
import { getTimeframeConfig } from '../../lib/timeframe';
import { formatRangeDisplay, formatRangeOnly, formatWMA, getMinutesUntilNextInterval, getHighlightedColumn, shouldUse4HHourlyMode } from '../../utils/price';

type DisplayType = 'wma' | 'max-range';

interface MaxRangeTableProps {
  prices: BinancePrice[];
  timeframe: TimeframeType;
  displayType: DisplayType;
  multiplier: number;
  historyHours: number;
  onDisplayTypeChange: (value: DisplayType) => void;
  onMultiplierChange: (value: number) => void;
  onHistoryHoursChange: (value: number) => void;
  highlightingFlags?: Record<string, 'yellow' | 'green' | null>;
  showMore: boolean;
  onShowMoreChange: (value: boolean) => void;
}

export default function MaxRangeTable({ 
  prices, 
  timeframe,
  displayType,
  multiplier,
  historyHours,
  onDisplayTypeChange,
  onMultiplierChange,
  onHistoryHoursChange,
  highlightingFlags = {} as Record<string, 'yellow' | 'green' | null>,
  showMore,
  onShowMoreChange,
}: MaxRangeTableProps) {
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  
  const timeframeConfig = getTimeframeConfig(timeframe);

  useEffect(() => {
    // Update time every second
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Determine if we're in 4H hourly mode
  const use4HHourlyMode = timeframe === '4h' ? shouldUse4HHourlyMode(timeframe, getMinutesUntilNextInterval(240)) : false;
  
  // Calculate highlighted column based on timeframe and mode
  const minutesRemaining = getMinutesUntilNextInterval(timeframeConfig.intervalMinutes);
  // Determine effective max window size for column highlighting
  const effectiveMaxWindowSize = timeframe === '4h' 
    ? (use4HHourlyMode ? 4 : 60)
    : timeframeConfig.maxWindowSize;
  // For 4H hourly mode, convert minutes to hours for highlighted column
  const highlightedColumn = use4HHourlyMode 
    ? Math.min(4, Math.max(1, Math.ceil(minutesRemaining / 60)))
    : getHighlightedColumn(minutesRemaining, effectiveMaxWindowSize);

  // Generate multiplier options from 10% to 200% in 10% increments
  const multiplierOptions = Array.from({ length: 20 }, (_, i) => (i + 1) * 10);
  
  // Generate history options based on mode
  const historyHoursOptions = use4HHourlyMode
    ? [4, 6, 12, 24, 48, 72, 96, 120, 144, 168, 336, 504, 672] // Hours for hourly mode
    : Array.from({ length: 16 }, (_, i) => i + 1); // Hours for minute mode (current behavior)

  if (prices.length === 0) {
    return null;
  }

  return (
    <div className="mt-8 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Max Range Analysis
        </h2>
        <div className="flex items-center gap-4">
          <button
            onClick={() => onShowMoreChange(!showMore)}
            className="px-3 py-1.5 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 hover:bg-zinc-50 dark:hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          >
            {showMore ? 'Show Less' : 'Show More'}
          </button>
          <div className="flex items-center gap-2">
            <label htmlFor="display-type-select" className="text-sm text-zinc-600 dark:text-zinc-400">
              Display:
            </label>
            <select
              id="display-type-select"
              value={displayType}
              onChange={(e) => onDisplayTypeChange(e.target.value as DisplayType)}
              className="px-3 py-1.5 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="wma">WMA</option>
              <option value="max-range">Max Range</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="history-hours-select" className="text-sm text-zinc-600 dark:text-zinc-400">
              History:
            </label>
            <select
              id="history-hours-select"
              value={historyHours}
              onChange={(e) => onHistoryHoursChange(Number(e.target.value))}
              className="px-3 py-1.5 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {historyHoursOptions.map((value) => (
                <option key={value} value={value}>
                  {`${value}H`}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="multiplier-select" className="text-sm text-zinc-600 dark:text-zinc-400">
              Multiplier:
            </label>
            <select
              id="multiplier-select"
              value={multiplier}
              onChange={(e) => onMultiplierChange(Number(e.target.value))}
              className="px-3 py-1.5 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {multiplierOptions.map((value) => (
                <option key={value} value={value}>
                  {value}%
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-full">
        <thead className="bg-zinc-100 dark:bg-zinc-800">
          <tr>
            <th className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Symbol
            </th>
            <th
              className={`px-4 py-4 text-right text-xs font-semibold text-zinc-900 dark:text-zinc-50 bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-500`}
              title={use4HHourlyMode ? `${highlightedColumn} hour max range` : `${highlightedColumn} minute max range`}
            >
              {use4HHourlyMode ? `${highlightedColumn}H` : `${highlightedColumn}m`}
            </th>
            {Array.from({ length: effectiveMaxWindowSize }, (_, i) => {
              return effectiveMaxWindowSize - i;
            }).map((windowSize) => {
              const isHighlighted = windowSize === highlightedColumn;
              return (
                <th
                  key={windowSize}
                  className={`px-4 py-4 text-right text-xs font-semibold text-zinc-900 dark:text-zinc-50 ${
                    isHighlighted
                      ? 'bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-500'
                      : ''
                  }`}
                  title={use4HHourlyMode ? `${windowSize} hour max range` : `${windowSize} minute max range`}
                >
                  {use4HHourlyMode ? `${windowSize}H` : `${windowSize}m`}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {prices.map((item) => {
            const highlightColor = highlightingFlags[item.symbol] ?? null;
            return (
            <tr
              key={item.symbol}
              className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors ${
                highlightColor === 'yellow' ? 'bg-amber-100 dark:bg-amber-950/50 border-l-4 border-l-amber-500 dark:border-l-amber-600' : ''
              } ${
                highlightColor === 'green' ? 'bg-green-100 dark:bg-green-950/50 border-l-4 border-l-green-500 dark:border-l-green-600' : ''
              }`}
            >
              <td className="px-6 py-4 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                {item.symbol}
              </td>
              <td
                className={`px-4 py-4 text-right text-xs text-zinc-600 dark:text-zinc-400 bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-500`}
                title={use4HHourlyMode ? `${highlightedColumn} hour max range` : `${highlightedColumn} minute max range`}
              >
                {(() => {
                  const range = item.maxRanges?.find(r => r.windowSize === highlightedColumn);
                  if (!range || range.range === 0) {
                    return '—';
                  }
                  const rangeFormatted = formatRangeOnly(range, multiplier / 100);
                  const wmaFormatted = formatWMA(range.wma, multiplier / 100);
                  
                  if (displayType === 'wma') {
                    return (
                      <div className="flex flex-col">
                        <span>R: {rangeFormatted}</span>
                        <span className="font-bold">WMA: {wmaFormatted}</span>
                      </div>
                    );
                  } else {
                    return (
                      <div className="flex flex-col">
                        <span className="font-bold">R: {rangeFormatted}</span>
                        <span>WMA: {wmaFormatted}</span>
                      </div>
                    );
                  }
                })()}
              </td>
            {Array.from({ length: effectiveMaxWindowSize }, (_, i) => {
              return effectiveMaxWindowSize - i;
            }).map((windowSize) => {
              const range = item.maxRanges?.find(r => r.windowSize === windowSize);
              const isHighlighted = windowSize === highlightedColumn;
              return (
                <td
                  key={windowSize}
                  className={`px-4 py-4 text-right text-xs text-zinc-600 dark:text-zinc-400 ${
                    isHighlighted
                      ? 'bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-500'
                      : ''
                  }`}
                  title={range ? (use4HHourlyMode ? `${windowSize} hour max range` : `${windowSize} minute max range`) : 'Insufficient data'}
                >
                  {range ? formatRangeDisplay(range, item.price, showMore) : '—'}
                </td>
              );
            })}
            </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
