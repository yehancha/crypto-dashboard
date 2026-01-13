'use client';

import { useState } from 'react';
import { useCryptoPrices } from '../hooks/useCryptoPrices';
import SymbolInput from './PriceTable/SymbolInput';
import PriceTableHeader from './PriceTable/PriceTableHeader';
import PriceTableRow from './PriceTable/PriceTableRow';
import MaxRangeTable from './PriceTable/MaxRangeTable';
import EmptyState from './PriceTable/EmptyState';
import ErrorDisplay from './PriceTable/ErrorDisplay';
import LoadingState from './PriceTable/LoadingState';
import ErrorState from './PriceTable/ErrorState';

const INITIAL_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT'];

export default function PriceTable() {
  const {
    symbols,
    prices,
    loading,
    error,
    isRateLimited,
    addSymbol,
    removeSymbol,
    reorderSymbols,
  } = useCryptoPrices({ initialSymbols: INITIAL_SYMBOLS });

  const [newSymbol, setNewSymbol] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleAddSymbol = () => {
    const trimmedSymbol = newSymbol.trim().toUpperCase();
    if (trimmedSymbol && !symbols.includes(trimmedSymbol)) {
      addSymbol(trimmedSymbol);
      setNewSymbol('');
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    reorderSymbols(draggedIndex, dropIndex);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  if (loading && prices.length === 0) {
    return <LoadingState />;
  }

  if (error && prices.length === 0) {
    return <ErrorState error={error} />;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-8">
      <div className="w-full max-w-full">
        <h1 className="mb-8 text-3xl font-semibold text-black dark:text-zinc-50">
          Crypto Prices
        </h1>

        <SymbolInput
          value={newSymbol}
          onChange={setNewSymbol}
          onAdd={handleAddSymbol}
          disabled={!newSymbol.trim() || symbols.includes(newSymbol.trim().toUpperCase())}
        />

        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full">
            <PriceTableHeader />
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {prices.length === 0 ? (
                <EmptyState />
              ) : (
                prices.map((item, index) => (
                  <PriceTableRow
                    key={item.symbol}
                    item={item}
                    index={index}
                    isDragged={draggedIndex === index}
                    isDragOver={dragOverIndex === index}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onDragEnd={handleDragEnd}
                    onRemove={removeSymbol}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        <MaxRangeTable prices={prices} />

        {error && (
          <ErrorDisplay
            error={error}
            isRateLimited={isRateLimited}
            hasPrices={prices.length > 0}
          />
        )}
      </div>
    </div>
  );
}
