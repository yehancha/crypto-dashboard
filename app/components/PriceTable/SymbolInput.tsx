'use client';

interface SymbolInputProps {
  value: string;
  onChange: (value: string) => void;
  onAdd: () => void;
  disabled: boolean;
}

export default function SymbolInput({
  value,
  onChange,
  onAdd,
  disabled,
}: SymbolInputProps) {
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !disabled) {
      onAdd();
    }
  };

  return (
    <div className="mb-6 flex gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder="Enter symbol (e.g., ADAUSDT)"
        className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder-zinc-400 dark:focus:border-zinc-600 dark:focus:ring-zinc-600"
      />
      <button
        onClick={onAdd}
        disabled={disabled}
        className="rounded-lg bg-zinc-900 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-700 dark:hover:bg-zinc-600"
      >
        Add
      </button>
    </div>
  );
}
