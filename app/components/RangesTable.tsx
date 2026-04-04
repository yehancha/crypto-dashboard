'use client';

import { Fragment, useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { get1hCandlesBatch, get1dCandlesBatch } from '../lib/binance';
import { computeSymbolRanges, type SymbolRangesComputed } from '../utils/rangesAtr';
import { formatPrice } from '../utils/price';
import SymbolInput from './PriceTable/SymbolInput';
import ErrorDisplay from './PriceTable/ErrorDisplay';

const RANGES_SYMBOLS_KEY = 'crypto-dashboard-ranges-symbols';
const DEFAULT_SYMBOLS = ['BTCUSDT', 'ETHUSDT'];

function formatNum(n: number): string {
  return formatPrice(n.toString());
}

export default function RangesTable() {
  const [symbols, setSymbols] = useLocalStorage<string[]>(RANGES_SYMBOLS_KEY, DEFAULT_SYMBOLS);
  const [results, setResults] = useState<Record<string, SymbolRangesComputed>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [newSymbol, setNewSymbol] = useState('');

  const prevSymbolsRef = useRef<string[]>([]);

  const fetchAll = useCallback(async (syms: string[], cancelled: () => boolean) => {
    if (syms.length === 0) {
      if (!cancelled()) {
        setResults({});
        setLoading(false);
        setError(null);
        setLastUpdated(null);
      }
      return;
    }

    if (!cancelled()) {
      setLoading(true);
      setError(null);
    }

    try {
      const [hMap, dMap] = await Promise.all([
        get1hCandlesBatch(syms, 26),
        get1dCandlesBatch(syms, 32),
      ]);

      if (cancelled()) return;

      const next: Record<string, SymbolRangesComputed> = {};
      for (const s of syms) {
        const h = hMap[s];
        const d = dMap[s];
        if (!h || !d) continue;
        const computed = computeSymbolRanges(h, d, s);
        if (computed) next[s] = computed;
      }

      setResults(next);
      setLastUpdated(new Date());
    } catch (e) {
      if (!cancelled()) {
        setError(e instanceof Error ? e.message : 'Failed to load range data');
      }
    } finally {
      if (!cancelled()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const isCancelled = () => cancelled;

    if (symbols.length === 0) {
      prevSymbolsRef.current = [];
      setResults({});
      setLoading(false);
      setLastUpdated(null);
      setError(null);
      return () => {
        cancelled = true;
      };
    }

    const prev = prevSymbolsRef.current;
    const added = symbols.filter((s) => !prev.includes(s));
    const removed = prev.filter((s) => !symbols.includes(s));

    if (prev.length === 0 && symbols.length > 0) {
      prevSymbolsRef.current = symbols;
      void fetchAll(symbols, isCancelled);
    } else if (added.length > 0) {
      prevSymbolsRef.current = symbols;
      void fetchAll(symbols, isCancelled);
    } else if (removed.length > 0) {
      prevSymbolsRef.current = symbols;
      setResults((r) => {
        const next = { ...r };
        removed.forEach((s) => {
          delete next[s];
        });
        return next;
      });
    }

    return () => {
      cancelled = true;
    };
  }, [symbols, fetchAll]);

  const handleAddSymbol = () => {
    const trimmed = newSymbol.trim().toUpperCase();
    if (trimmed && !symbols.includes(trimmed)) {
      setSymbols([...symbols, trimmed]);
      setNewSymbol('');
    }
  };

  const handleRemoveSymbol = (s: string) => {
    setSymbols(symbols.filter((x) => x !== s));
  };

  const rowCount = 53;
  const templateRow = results[symbols[0]]?.rows;

  if (loading && symbols.length > 0 && Object.keys(results).length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="text-lg text-zinc-600 dark:text-zinc-400">Loading ranges…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-8 dark:bg-black">
      <div className="w-full max-w-full">
        <div className="mb-8 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <h1 className="text-3xl font-semibold text-black dark:text-zinc-50">Ranges</h1>
              <Link
                href="/"
                className="text-sm font-medium text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                Crypto Prices
              </Link>
            </div>
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              {lastUpdated ? (
                <span>Last updated: {lastUpdated.toLocaleString()}</span>
              ) : (
                <span>—</span>
              )}
            </div>
          </div>
        </div>

        <SymbolInput
          value={newSymbol}
          onChange={setNewSymbol}
          onAdd={handleAddSymbol}
          disabled={!newSymbol.trim() || symbols.includes(newSymbol.trim().toUpperCase())}
        />

        {symbols.length === 0 ? (
          <p className="text-zinc-600 dark:text-zinc-400">Add at least one symbol to load ATR ranges.</p>
        ) : (
          <div className="overflow-x-auto overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <table className="w-full min-w-max border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800">
                  <th
                    rowSpan={2}
                    className="sticky left-0 z-20 border-r border-zinc-200 bg-zinc-100 px-4 py-3 text-left font-semibold text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  >
                    Duration
                  </th>
                  {symbols.map((sym) => (
                    <th
                      key={sym}
                      colSpan={3}
                      className="border-l border-zinc-200 px-2 py-2 text-center font-semibold text-zinc-900 dark:border-zinc-700 dark:text-zinc-50"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <span>{sym}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSymbol(sym)}
                          className="rounded px-1.5 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                          aria-label={`Remove ${sym}`}
                        >
                          ×
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
                <tr className="border-b border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800">
                  {symbols.map((sym) => (
                    <Fragment key={`${sym}-sub`}>
                      <th className="border-l border-zinc-200 px-2 py-2 text-center text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                        Min
                      </th>
                      <th className="border-l border-zinc-200 px-2 py-2 text-center text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                        ATR
                      </th>
                      <th className="border-l border-zinc-200 px-2 py-2 text-center text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                        Max
                      </th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {Array.from({ length: rowCount }, (_, rowIdx) => {
                  const label =
                    templateRow?.[rowIdx]?.label ??
                    (rowIdx < 23 ? `${rowIdx + 1}h` : `${rowIdx - 22}d`);
                  return (
                    <tr key={label} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                      <td className="sticky left-0 z-10 border-r border-zinc-200 bg-white px-4 py-2 font-medium text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50">
                        {label}
                      </td>
                      {symbols.map((sym) => {
                        const row = results[sym]?.rows[rowIdx];
                        return (
                          <Fragment key={`${sym}-${label}`}>
                            <td className="border-l border-zinc-200 px-2 py-2 text-right tabular-nums text-zinc-800 dark:border-zinc-700 dark:text-zinc-200">
                              {row ? formatNum(row.min) : '—'}
                            </td>
                            <td className="border-l border-zinc-200 px-2 py-2 text-right tabular-nums text-zinc-800 dark:border-zinc-700 dark:text-zinc-200">
                              {row ? formatNum(row.atr) : '—'}
                            </td>
                            <td className="border-l border-zinc-200 px-2 py-2 text-right tabular-nums text-zinc-800 dark:border-zinc-700 dark:text-zinc-200">
                              {row ? formatNum(row.max) : '—'}
                            </td>
                          </Fragment>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {loading && symbols.length > 0 && Object.keys(results).length > 0 && (
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Refreshing…</p>
        )}

        {error && (
          <ErrorDisplay error={error} isRateLimited={false} hasPrices={Object.keys(results).length > 0} />
        )}
      </div>
    </div>
  );
}
