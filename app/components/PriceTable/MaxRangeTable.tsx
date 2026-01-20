'use client';

import { useState, useEffect } from 'react';
import { type BinancePrice } from '../../lib/binance';
import { type TimeframeType } from '../../lib/timeframe';
import { getTimeframeConfig } from '../../lib/timeframe';
import { formatRangeDisplay, formatRangeOnly, formatWMA, formatChange, getMinutesUntilNextInterval, getHighlightedColumn, getEffectiveResolution, getEffectiveMaxWindowSize, type EffectiveResolution } from '../../utils/price';

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

  const dynamicTimeframe = timeframe === '4h' || timeframe === '1d';

  // Calculate highlighted column based on timeframe and effective resolution
  const minutesRemaining = getMinutesUntilNextInterval(timeframeConfig.intervalMinutes);
  const resolution: EffectiveResolution = dynamicTimeframe ? getEffectiveResolution(minutesRemaining) : '1m';
  const effectiveMaxWindowSize = getEffectiveMaxWindowSize(timeframe, resolution);

  const highlightedColumn =
    resolution === '1h'
      ? Math.min(effectiveMaxWindowSize, Math.max(1, Math.ceil(minutesRemaining / 60)))
      : getHighlightedColumn(minutesRemaining, effectiveMaxWindowSize);

  // Generate multiplier options from 10% to 200% in 10% increments
  const multiplierOptions = Array.from({ length: 20 }, (_, i) => (i + 1) * 10);
  
  // Generate history options based on mode
  const historyHoursOptions =
    resolution === '1h'
      ? timeframe === '1d'
        ? [24, 48, 72, 96, 120, 168, 336, 504, 672]
        : [4, 6, 12, 24, 48, 72, 96, 120, 144, 168, 336, 504, 672]
      : Array.from({ length: 16 }, (_, i) => i + 1);

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
              title={resolution === '1h' ? `${highlightedColumn} hour max range` : `${highlightedColumn} minute max range`}
            >
              {resolution === '1h' ? `${highlightedColumn}H` : `${highlightedColumn}m`}
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
                  title={resolution === '1h' ? `${windowSize} hour max range` : `${windowSize} minute max range`}
                >
                  {resolution === '1h' ? `${windowSize}H` : `${windowSize}m`}
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
                title={resolution === '1h' ? `${highlightedColumn} hour max range` : `${highlightedColumn} minute max range`}
              >
                {(() => {
                  const range = item.maxRanges?.find(r => r.windowSize === highlightedColumn);
                  if (!range || range.range === 0) {
                    return '—';
                  }
                  const rangeFormatted = formatRangeOnly(range, multiplier / 100);
                  const wmaFormatted = formatWMA(range.wma, multiplier / 100);
                  const avgChgFormatted = formatChange(range.avgAbsChange, multiplier / 100);
                  const wmaChgFormatted = formatChange(range.wmaAbsChange, multiplier / 100);
                  const maxChgFormatted = formatChange(range.maxAbsChange, multiplier / 100);
                  
                  if (displayType === 'wma') {
                    return (
                      <div className="flex flex-col">
                        <span>R: {rangeFormatted}</span>
                        <span className="font-bold">WMA: {wmaFormatted}</span>
                        <span>Avg Chg: {avgChgFormatted}</span>
                        <span className="font-bold">WMA Chg: {wmaChgFormatted}</span>
                        <span>Max Chg: {maxChgFormatted}</span>
                      </div>
                    );
                  } else {
                    return (
                      <div className="flex flex-col">
                        <span className="font-bold">R: {rangeFormatted}</span>
                        <span>WMA: {wmaFormatted}</span>
                        <span className="font-bold">Avg Chg: {avgChgFormatted}</span>
                        <span>WMA Chg: {wmaChgFormatted}</span>
                        <span>Max Chg: {maxChgFormatted}</span>
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
                  title={range ? (resolution === '1h' ? `${windowSize} hour max range` : `${windowSize} minute max range`) : 'Insufficient data'}
                >
                  {range ? formatRangeDisplay(range, item.price, showMore, multiplier / 100) : '—'}
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
