'use client';

export default function EmptyState() {
  return (
    <tr>
      <td
        colSpan={4}
        className="px-6 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400"
      >
        No symbols added. Add a symbol above to get started.
      </td>
    </tr>
  );
}
