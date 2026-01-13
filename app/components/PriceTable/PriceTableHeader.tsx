'use client';

export default function PriceTableHeader() {
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
          15m Close
        </th>
        <th className="px-6 py-4 text-right text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Price
        </th>
        <th className="px-6 py-4 text-right text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Deviation
        </th>
      </tr>
    </thead>
  );
}
