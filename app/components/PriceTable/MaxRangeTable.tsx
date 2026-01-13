'use client';

import { type BinancePrice } from '../../lib/binance';
import { formatRangeDisplay } from '../../utils/price';

interface MaxRangeTableProps {
  prices: BinancePrice[];
}

export default function MaxRangeTable({ prices }: MaxRangeTableProps) {
  if (prices.length === 0) {
    return null;
  }

  return (
    <div className="mt-8 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Max Range Analysis
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-full">
        <thead className="bg-zinc-100 dark:bg-zinc-800">
          <tr>
            <th className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Symbol
            </th>
            {Array.from({ length: 15 }, (_, i) => 15 - i).map((windowSize) => (
              <th
                key={windowSize}
                className="px-4 py-4 text-right text-xs font-semibold text-zinc-900 dark:text-zinc-50"
                title={`${windowSize} minute max range`}
              >
                {windowSize}m
              </th>
            ))}
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
              {Array.from({ length: 15 }, (_, i) => 15 - i).map((windowSize) => {
                const range = item.maxRanges?.find(r => r.windowSize === windowSize);
                return (
                  <td
                    key={windowSize}
                    className="px-4 py-4 text-right text-xs text-zinc-600 dark:text-zinc-400"
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
