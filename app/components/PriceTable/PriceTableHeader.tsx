'use client';

import { type TimeframeType } from '../../lib/timeframe';
import { getTimeframeConfig } from '../../lib/timeframe';
import { getMinutesUntilNextInterval, getEffectiveResolution } from '../../utils/price';

interface PriceTableHeaderProps {
  timeframe: TimeframeType;
  highlightedColumn: number;
}

export default function PriceTableHeader({ timeframe, highlightedColumn }: PriceTableHeaderProps) {
  const config = getTimeframeConfig(timeframe);
  
  // Determine effective resolution based on time to expiry for dynamic timeframes
  const minutesUntilExpiry = getMinutesUntilNextInterval(config.intervalMinutes);
  const supportsDynamicResolution = timeframe === '4h' || timeframe === '1d';
  const resolution = supportsDynamicResolution ? getEffectiveResolution(minutesUntilExpiry) : '1m';
  
  // Format threshold column header based on mode
  const thresholdLabel = resolution === '1h' ? `${highlightedColumn}H` : `${highlightedColumn}m`;
  
  return (
    <thead className="bg-zinc-100 dark:bg-zinc-800">
      <tr>
        <th className="w-12 px-4 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          {/* Empty header for drag handle column */}
        </th>
        <th className="w-12 px-4 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          {/* Empty header for remove button column */}
        </th>
        <th className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Symbol
        </th>
        <th className="px-2 py-4 text-center text-sm font-semibold text-zinc-900 dark:text-zinc-50" title="Notification">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline-block" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
          </svg>
        </th>
        <th className="px-6 py-4 text-right text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          {config.label} Close
        </th>
        <th className="px-6 py-4 text-right text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Price
        </th>
        <th className="px-6 py-4 text-right text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Deviation
        </th>
        <th className="px-2 py-4 text-center text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Safety Rating
        </th>
        <th className="px-6 py-4 text-right text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Threshold {thresholdLabel}
        </th>
        <th className="px-6 py-4 text-right text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Volatility {thresholdLabel}
        </th>
      </tr>
    </thead>
  );
}
