'use client';

import { type BinancePrice } from '../../lib/binance';
import { type TimeframeType } from '../../lib/timeframe';
import { formatPrice, calculateAbsoluteDeviation, calculateDeviation, formatDeviationWithAbsolute, formatRangeOnly, formatWMA, formatAbsolutePercentage } from '../../utils/price';

type DisplayType = 'wma' | 'max-range';

interface PriceTableRowProps {
  item: BinancePrice;
  index: number;
  timeframe: TimeframeType;
  isDragged: boolean;
  isDragOver: boolean;
  onDragStart: (index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
  onRemove: (symbol: string) => void;
  highlightColor?: 'yellow' | 'green' | null;
  highlightedColumn: number;
  multiplier: number;
  displayType: DisplayType;
}

export default function PriceTableRow({
  item,
  index,
  timeframe,
  isDragged,
  isDragOver,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onRemove,
  highlightColor = null,
  highlightedColumn,
  multiplier,
  displayType,
}: PriceTableRowProps) {
  return (
    <tr
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, index)}
      onDragEnd={onDragEnd}
      className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors ${
        isDragged ? 'opacity-50 cursor-grabbing' : 'cursor-grab'
      } ${isDragOver ? 'bg-zinc-100 dark:bg-zinc-800' : ''} ${
        highlightColor === 'yellow' ? 'bg-amber-100 dark:bg-amber-950/50 border-l-4 border-l-amber-500 dark:border-l-amber-600' : ''
      } ${
        highlightColor === 'green' ? 'bg-green-100 dark:bg-green-950/50 border-l-4 border-l-green-500 dark:border-l-green-600' : ''
      }`}
    >
      <td className="px-4 py-4">
        <div
          className="cursor-grab active:cursor-grabbing text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
          title="Drag to reorder"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M7 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM7 8a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM7 14a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM13 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM13 8a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM13 14a2 2 0 1 1 0 4 2 2 0 0 1 0-4z" />
          </svg>
        </div>
      </td>
      <td className="px-4 py-4">
        <button
          onClick={() => onRemove(item.symbol)}
          className="rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-red-600 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-red-400"
          aria-label={`Remove ${item.symbol}`}
          title={`Remove ${item.symbol}`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </td>
      <td className="px-6 py-4 text-sm font-medium text-zinc-900 dark:text-zinc-50">
        {item.symbol}
      </td>
      <td className="px-6 py-4 text-right text-sm text-zinc-600 dark:text-zinc-400">
        {(() => {
          const closePrice = timeframe === '15m' ? item.close15m : item.close1h;
          return closePrice ? formatPrice(closePrice) : '—';
        })()}
      </td>
      <td className="px-6 py-4 text-right text-sm text-zinc-600 dark:text-zinc-400">
        {formatPrice(item.price)}
      </td>
      <td className="px-6 py-4 text-right text-sm font-medium">
        {(() => {
          const closePrice = timeframe === '15m' ? item.close15m : item.close1h;
          const absoluteDeviation = calculateAbsoluteDeviation(item.price, closePrice);
          const percentageDeviation = calculateDeviation(item.price, closePrice);
          const deviationText = formatDeviationWithAbsolute(absoluteDeviation, percentageDeviation);
          const isPositive = absoluteDeviation !== null && absoluteDeviation > 0;
          const isNegative = absoluteDeviation !== null && absoluteDeviation < 0;
          
          return (
            <span
              className={
                isPositive
                  ? 'text-green-600 dark:text-green-400'
                  : isNegative
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-zinc-600 dark:text-zinc-400'
              }
            >
              {deviationText}
            </span>
          );
        })()}
      </td>
      <td className="px-2 py-4 text-center">
        {(() => {
          const closePrice = timeframe === '15m' ? item.close15m : item.close1h;
          const range = item.maxRanges?.find(r => r.windowSize === highlightedColumn);
          const absoluteDeviation = calculateAbsoluteDeviation(item.price, closePrice);
          const absDeviation = absoluteDeviation !== null ? Math.abs(absoluteDeviation) : 0;
          
          const multiplierRatio = multiplier / 100;
          const wmaThreshold = (range?.wma ?? 0) * multiplierRatio;
          const maxRangeThreshold = (range?.range ?? 0) * multiplierRatio;
          
          // Calculate how many dots to color based on WMA (yellow) and max-range (green)
          const getFilledDots = (deviation: number, threshold: number): number => {
            if (threshold === 0) return 0;
            const ratio = deviation / threshold;
            if (ratio > 1) return 4;
            if (ratio > 0.75) return 3;
            if (ratio > 0.5) return 2;
            if (ratio > 0.25) return 1;
            return 0;
          };
          
          const yellowDots = getFilledDots(absDeviation, wmaThreshold);
          const greenDots = getFilledDots(absDeviation, maxRangeThreshold);
          
          return (
            <div className="flex gap-1 justify-center">
              {[0, 1, 2, 3].map((i) => {
                let color = 'bg-zinc-300 dark:bg-zinc-600'; // grey default
                if (i < greenDots) {
                  color = 'bg-green-500 dark:bg-green-400';
                } else if (i < yellowDots) {
                  color = 'bg-amber-400 dark:bg-amber-500';
                }
                return (
                  <span
                    key={i}
                    className={`w-2 h-2 rounded-full ${color}`}
                  />
                );
              })}
            </div>
          );
        })()}
      </td>
      <td className="px-6 py-4 text-right text-sm text-zinc-600 dark:text-zinc-400">
        {(() => {
          const closePrice = timeframe === '15m' ? item.close15m : item.close1h;
          const range = item.maxRanges?.find(r => r.windowSize === highlightedColumn);
          
          if (!range || !closePrice) {
            return '—';
          }
          
          const multiplierRatio = multiplier / 100;
          const closePriceNum = parseFloat(closePrice);
          
          if (displayType === 'wma') {
            // Show WMA value when displayType is 'wma'
            if (!range.wma || range.wma === 0) {
              return '—';
            }
            
            const wmaFormatted = formatWMA(range.wma, multiplierRatio);
            
            if (isNaN(closePriceNum) || closePriceNum === 0) {
              return wmaFormatted;
            }
            
            const adjustedWMA = (range.wma ?? 0) * multiplierRatio;
            const percentage = (adjustedWMA / closePriceNum) * 100;
            const percentageFormatted = formatAbsolutePercentage(percentage);
            
            return (
              <div className="flex flex-col">
                <span className="font-semibold">{wmaFormatted}</span>
                <span>{percentageFormatted}</span>
              </div>
            );
          } else {
            // Show R value when displayType is 'max-range'
            if (range.range === 0) {
              return '—';
            }
            
            const rangeFormatted = formatRangeOnly(range, multiplierRatio);
            
            if (isNaN(closePriceNum) || closePriceNum === 0) {
              return rangeFormatted;
            }
            
            const adjustedRange = range.range * multiplierRatio;
            const percentage = (adjustedRange / closePriceNum) * 100;
            const percentageFormatted = formatAbsolutePercentage(percentage);
            
            return (
              <div className="flex flex-col">
                <span className="font-semibold">{rangeFormatted}</span>
                <span>{percentageFormatted}</span>
              </div>
            );
          }
        })()}
      </td>
    </tr>
  );
}
