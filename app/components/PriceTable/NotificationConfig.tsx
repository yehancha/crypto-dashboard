'use client';

import { NOTIFY_THRESHOLD_AUTO } from '../../utils/price';

const VOLATILITY_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const selectClassName =
  'px-3 py-1.5 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

interface NotificationConfigProps {
  yellowThreshold: number;
  greenThreshold: number;
  onYellowThresholdChange: (value: number) => void;
  onGreenThresholdChange: (value: number) => void;
  maxVolatilityThreshold: number;
  wmaVolatilityThreshold: number;
  onMaxVolatilityThresholdChange: (value: number) => void;
  onWmaVolatilityThresholdChange: (value: number) => void;
}

export default function NotificationConfig({
  yellowThreshold,
  greenThreshold,
  onYellowThresholdChange,
  onGreenThresholdChange,
  maxVolatilityThreshold,
  wmaVolatilityThreshold,
  onMaxVolatilityThresholdChange,
  onWmaVolatilityThresholdChange,
}: NotificationConfigProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <label className="text-sm text-zinc-600 dark:text-zinc-400">
        Notify when Yellow:
      </label>
      <select
        id="yellow-threshold-select"
        value={yellowThreshold}
        onChange={(e) => onYellowThresholdChange(Number(e.target.value))}
        className={selectClassName}
      >
        {[0, 1, 2, 3, 4].map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
        <option value={NOTIFY_THRESHOLD_AUTO}>Auto</option>
      </select>
      <label className="text-sm text-zinc-600 dark:text-zinc-400">
        and Green:
      </label>
      <select
        id="green-threshold-select"
        value={greenThreshold}
        onChange={(e) => onGreenThresholdChange(Number(e.target.value))}
        className={selectClassName}
      >
        {[0, 1, 2, 3, 4].map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
        <option value={NOTIFY_THRESHOLD_AUTO}>Auto</option>
      </select>
      <label className="text-sm text-zinc-600 dark:text-zinc-400">
        max volatility:
      </label>
      <select
        id="max-volatility-threshold-select"
        value={maxVolatilityThreshold}
        onChange={(e) => onMaxVolatilityThresholdChange(Number(e.target.value))}
        className={selectClassName}
      >
        {VOLATILITY_OPTIONS.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
      <label className="text-sm text-zinc-600 dark:text-zinc-400">
        wma volatility:
      </label>
      <select
        id="wma-volatility-threshold-select"
        value={wmaVolatilityThreshold}
        onChange={(e) => onWmaVolatilityThresholdChange(Number(e.target.value))}
        className={selectClassName}
      >
        {VOLATILITY_OPTIONS.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
    </div>
  );
}
