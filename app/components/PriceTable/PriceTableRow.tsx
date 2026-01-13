'use client';

import { type BinancePrice } from '../../lib/binance';
import { formatPrice } from '../../utils/price';

interface PriceTableRowProps {
  item: BinancePrice;
  index: number;
  isDragged: boolean;
  isDragOver: boolean;
  onDragStart: (index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
  onRemove: (symbol: string) => void;
}

export default function PriceTableRow({
  item,
  index,
  isDragged,
  isDragOver,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onRemove,
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
      } ${isDragOver ? 'bg-zinc-100 dark:bg-zinc-800' : ''}`}
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
        {item.close15m ? formatPrice(item.close15m) : '—'}
      </td>
      <td className="px-6 py-4 text-right text-sm text-zinc-600 dark:text-zinc-400">
        {formatPrice(item.price)}
      </td>
    </tr>
  );
}
