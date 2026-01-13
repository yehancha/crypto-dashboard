'use client';

interface ErrorStateProps {
  error: string;
}

export default function ErrorState({ error }: ErrorStateProps) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-lg text-red-600 dark:text-red-400">Error: {error}</div>
    </div>
  );
}
