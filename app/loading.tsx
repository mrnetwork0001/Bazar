import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="flex min-h-[60vh] items-center justify-center">
      <div className="relative flex h-14 w-14 items-center justify-center">
        <span aria-hidden className="absolute inset-0 rounded-full border border-bnb/40 animate-pulse-ring" />
        <span aria-hidden className="absolute inset-2 rounded-full bg-bnb/[0.06]" />
        <Loader2 className="relative h-6 w-6 animate-spin text-bnb" aria-hidden />
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}
