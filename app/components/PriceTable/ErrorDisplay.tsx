'use client';

interface ErrorDisplayProps {
  error: string;
  isRateLimited: boolean;
  hasPrices: boolean;
}

export default function ErrorDisplay({
  error,
  isRateLimited,
  hasPrices,
}: ErrorDisplayProps) {
  return (
    <div
      className={`mt-4 text-sm ${
        isRateLimited
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-red-600 dark:text-red-400'
      }`}
    >
      {isRateLimited ? '⚠️ ' : ''}
      {error}
      {hasPrices && ' (showing last known prices)'}
    </div>
  );
}
