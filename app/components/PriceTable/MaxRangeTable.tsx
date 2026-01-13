'use client';

import { useState, useEffect } from 'react';
import { type BinancePrice } from '../../lib/binance';
import { formatRangeDisplay, formatRangeOnly, formatWMA, getMinutesUntilNext15MinInterval, getHighlightedColumn } from '../../utils/price';

interface MaxRangeTableProps {
  prices: BinancePrice[];
}

export default function MaxRangeTable({ prices }: MaxRangeTableProps) {
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [multiplier, setMultiplier] = useState<number>(100);

  useEffect(() => {
    // Update time every second
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Calculate highlighted column
  const minutesRemaining = getMinutesUntilNext15MinInterval();
  const highlightedColumn = getHighlightedColumn(minutesRemaining);

  // Generate multiplier options from 10% to 200% in 10% increments
  const multiplierOptions = Array.from({ length: 20 }, (_, i) => (i + 1) * 10);

  if (prices.length === 0) {
    return null;
  }

  return (
    <div className="mt-8 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Max Range Analysis
        </h2>
        <div className="flex items-center gap-2">
          <label htmlFor="multiplier-select" className="text-sm text-zinc-600 dark:text-zinc-400">
            Multiplier:
          </label>
          <select
            id="multiplier-select"
            value={multiplier}
            onChange={(e) => setMultiplier(Number(e.target.value))}
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
      <div className="overflow-x-auto">
        <table className="w-full min-w-full">
        <thead className="bg-zinc-100 dark:bg-zinc-800">
          <tr>
            <th className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Symbol
            </th>
            <th
              className={`px-4 py-4 text-right text-xs font-semibold text-zinc-900 dark:text-zinc-50 bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-500`}
              title={`${highlightedColumn} minute max range`}
            >
              {highlightedColumn}m
            </th>
            {Array.from({ length: 15 }, (_, i) => 15 - i).map((windowSize) => {
              const isHighlighted = windowSize === highlightedColumn;
              return (
                <th
                  key={windowSize}
                  className={`px-4 py-4 text-right text-xs font-semibold text-zinc-900 dark:text-zinc-50 ${
                    isHighlighted
                      ? 'bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-500'
                      : ''
                  }`}
                  title={`${windowSize} minute max range`}
                >
                  {windowSize}m
                </th>
              );
            })}
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
              <td
                className={`px-4 py-4 text-right text-xs text-zinc-600 dark:text-zinc-400 bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-500`}
                title={`${highlightedColumn} minute max range`}
              >
                {(() => {
                  const range = item.maxRanges?.find(r => r.windowSize === highlightedColumn);
                  if (!range || range.range === 0) {
                    return '—';
                  }
                  const rangeFormatted = formatRangeOnly(range, multiplier / 100);
                  const wmaFormatted = formatWMA(range.wma, multiplier / 100);
                  return (
                    <div className="flex flex-col">
                      <span>R: {rangeFormatted}</span>
                      <span className="font-bold">WMA: {wmaFormatted}</span>
                    </div>
                  );
                })()}
              </td>
              {Array.from({ length: 15 }, (_, i) => 15 - i).map((windowSize) => {
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
                    title={range ? `${windowSize} minute max range` : 'Insufficient data'}
                  >
                    {range ? formatRangeDisplay(range, item.price) : '—'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
