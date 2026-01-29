'use client';

import { NOTIFY_THRESHOLD_AUTO } from '../../utils/price';

interface NotificationConfigProps {
  yellowThreshold: number;
  greenThreshold: number;
  onYellowThresholdChange: (value: number) => void;
  onGreenThresholdChange: (value: number) => void;
}

export default function NotificationConfig({
  yellowThreshold,
  greenThreshold,
  onYellowThresholdChange,
  onGreenThresholdChange,
}: NotificationConfigProps) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-zinc-600 dark:text-zinc-400">
        Notify when Yellow:
      </label>
      <select
        id="yellow-threshold-select"
        value={yellowThreshold}
        onChange={(e) => onYellowThresholdChange(Number(e.target.value))}
        className="px-3 py-1.5 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
        className="px-3 py-1.5 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        {[0, 1, 2, 3, 4].map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
        <option value={NOTIFY_THRESHOLD_AUTO}>Auto</option>
      </select>
    </div>
  );
}
