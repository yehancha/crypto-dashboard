'use client';

import { type TimeframeType } from '../../lib/timeframe';
import { getTimeframeConfig } from '../../lib/timeframe';
import { getMinutesUntilNextInterval, shouldUse4HHourlyMode } from '../../utils/price';

interface PriceTableHeaderProps {
  timeframe: TimeframeType;
  highlightedColumn: number;
}

export default function PriceTableHeader({ timeframe, highlightedColumn }: PriceTableHeaderProps) {
  const config = getTimeframeConfig(timeframe);
  
  // Determine if we're in 4H hourly mode
  const use4HHourlyMode = timeframe === '4h' ? shouldUse4HHourlyMode(timeframe, getMinutesUntilNextInterval(240)) : false;
  
  // Format threshold column header based on mode
  const thresholdLabel = use4HHourlyMode ? `${highlightedColumn}H` : `${highlightedColumn}m`;
  
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
      </tr>
    </thead>
  );
}
