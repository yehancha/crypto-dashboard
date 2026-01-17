'use client';

import { type TimeframeType } from '../../lib/timeframe';

interface TimeframeSelectorProps {
  value: TimeframeType;
  onChange: (timeframe: TimeframeType) => void;
}

export default function TimeframeSelector({ value, onChange }: TimeframeSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="timeframe-select" className="text-sm text-zinc-600 dark:text-zinc-400">
        Timeframe:
      </label>
      <select
        id="timeframe-select"
        value={value}
        onChange={(e) => onChange(e.target.value as TimeframeType)}
        className="px-3 py-1.5 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="15m">15m</option>
        <option value="1h">1H</option>
        <option value="4h">4H</option>
      </select>
    </div>
  );
}
