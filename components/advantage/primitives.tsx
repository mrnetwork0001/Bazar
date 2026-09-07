import type { ReactNode } from 'react';
import { CheckCircle2, Minus, TriangleAlert } from '@/components/ui/icons';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { LegStep, Winner } from './report';

/* ------------------------------- winner --------------------------------- */

const WINNER_COPY: Record<Winner, { label: string; tone: BadgeTone }> = {
  agent: { label: 'Agent wins', tone: 'gold' },
  manual: { label: 'Manual wins', tone: 'sky' },
  tie: { label: 'Too close to call', tone: 'slate' },
  neither: { label: 'Neither answered', tone: 'rose' },
};

export function WinnerChip({ winner, className }: { winner: Winner; className?: string }) {
  const { label, tone } = WINNER_COPY[winner];
  const Icon = winner === 'neither' ? TriangleAlert : winner === 'tie' ? Minus : CheckCircle2;
  return (
    <Badge tone={tone} size="md" icon={<Icon className="h-3.5 w-3.5" aria-hidden />} className={className}>
      {label}
    </Badge>
  );
}

/* ------------------------------- timing --------------------------------- */

/**
 * Two proportional bars, agent against manual.
 *
 * The number is always printed. The bar is a second encoding of a figure the
 * reader can already read, never the only place it appears - a chart is a bad
 * place to put a measurement someone may need to quote.
 */
export function TimingBars({
  agentMs,
  manualMs,
  agentSamples,
  manualSamples,
}: {
  agentMs: number;
  manualMs: number;
  agentSamples: number[];
  manualSamples: number[];
}) {
  const scale = Math.max(agentMs, manualMs, 1);
  const rows = [
    { label: 'Agent', ms: agentMs, samples: agentSamples, fill: 'bg-bnb/70', text: 'text-bnb' },
    { label: 'Manual', ms: manualMs, samples: manualSamples, fill: 'bg-sky-400/60', text: 'text-sky-300' },
  ];

  return (
    <div className="space-y-2.5">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="flex items-baseline justify-between gap-3 text-[11px]">
            <span className="font-medium text-slate-300">{row.label}</span>
            <span className={cn('tabular font-semibold', row.text)}>{row.ms.toFixed(1)} ms</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className={cn('h-full rounded-full', row.fill)}
              style={{ width: `${Math.max((row.ms / scale) * 100, 2)}%` }}
              role="img"
              aria-label={`${row.label} median ${row.ms.toFixed(1)} milliseconds`}
            />
          </div>
          <p className="tabular mt-1 text-[10px] text-slate-500">
            samples {row.samples.map((s) => s.toFixed(1)).join(' / ')}
          </p>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------- steps --------------------------------- */

function statusTone(status: number): string {
  if (status >= 200 && status < 300) return 'text-emerald-300';
  if (status === 402) return 'text-bnb';
  return 'text-rose-300';
}

/** Every request a leg issued, with the status code it really came back with. */
export function StepList({ steps }: { steps: LegStep[] }) {
  if (steps.length === 0) return <p className="text-xs text-slate-500">No steps recorded.</p>;
  return (
    <ol className="space-y-1.5">
      {steps.map((step, i) => (
        <li key={`${step.label}-${i}`} className="flex items-start gap-2 text-[11px] leading-relaxed">
          <span className={cn('tabular w-8 shrink-0 font-mono font-semibold', statusTone(step.status))}>
            {step.status}
          </span>
          <span className="min-w-0">
            <span className="break-words font-mono text-slate-300">{step.label}</span>
            {step.note && <span className="text-slate-500"> - {step.note}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------- findings -------------------------------- */

/** Terms that are already correctly cased and must survive the sentence-casing pass. */
const ACRONYMS: Record<string, string> = { usd: 'USD', utc: 'UTC', mcp: 'MCP', html: 'HTML', erc20: 'ERC-20' };

/**
 * Turn a harness key into a readable label: "rowsActuallyInTheFuture" becomes
 * "Rows actually in the future".
 *
 * The word split runs on digit boundaries as well as case boundaries, because
 * findings keys carry market notation - "sourcesCarrying1X2Odds" has to come
 * out as "1X2", not "1 x2". Any word containing a digit keeps its own casing
 * for the same reason.
 */
function humanise(key: string): string {
  const words = key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z0-9])/g, '$1 $2')
    .replace(/([0-9])([A-Z][a-z])/g, '$1 $2')
    .split(' ')
    .filter(Boolean)
    .map((word) => ACRONYMS[word.toLowerCase()] ?? (/\d/.test(word) ? word : word.toLowerCase()));

  const [first, ...rest] = words;
  if (!first) return key;
  const lead = ACRONYMS[first.toLowerCase()] ?? first.charAt(0).toUpperCase() + first.slice(1);
  return [lead, ...rest].join(' ');
}

/**
 * A value exactly as the harness recorded it.
 *
 * `null` is rendered as the word null in a muted tone rather than as an empty
 * cell or a dash. Half this report turns on fields that came back null, and a
 * blank cell reads as "not collected" when the truth is "collected, and empty".
 */
function renderValue(value: unknown): ReactNode {
  if (value === null || value === undefined) return <span className="text-rose-300/80">null</span>;
  if (typeof value === 'boolean') {
    return <span className={value ? 'text-emerald-300' : 'text-slate-400'}>{String(value)}</span>;
  }
  if (typeof value === 'number') return <span className="tabular text-white">{value}</span>;
  if (Array.isArray(value)) {
    return value.length === 0 ? (
      <span className="text-slate-500">empty</span>
    ) : (
      <span className="break-words text-slate-200">{value.map((v) => String(v)).join(', ')}</span>
    );
  }
  if (typeof value === 'object') {
    return <span className="break-all font-mono text-[10px] text-slate-300">{JSON.stringify(value)}</span>;
  }
  const text = String(value);
  const mono = /^0x[0-9a-fA-F]{8,}$/.test(text);
  return <span className={cn('break-words', mono ? 'font-mono text-[10px] text-slate-300' : 'text-slate-200')}>{text}</span>;
}

export function FindingsTable({ findings }: { findings: Record<string, unknown> | null }) {
  if (!findings) return <p className="text-xs text-slate-500">The leg recorded no findings.</p>;
  const entries = Object.entries(findings);
  return (
    <dl className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.06] bg-black/20">
      {entries.map(([key, value]) => (
        <div
          key={key}
          className="grid gap-x-3 gap-y-0.5 px-3 py-2 text-[11px] sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]"
        >
          <dt className="text-slate-400">{humanise(key)}</dt>
          <dd className="min-w-0">{renderValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------ attachment ------------------------------- */

/**
 * The response bytes, collapsed by default.
 *
 * `<details>` rather than state, so the page stays a server component and the
 * attachment is present in the HTML whether or not it is opened - a judge who
 * views source, or reads with JavaScript off, still has the evidence.
 */
export function RawOutput({ label, json, file }: { label: string; json: string | null; file: string }) {
  return (
    <details className="group rounded-xl border border-white/[0.06] bg-black/20">
      <summary className="ring-focus flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-[11px] text-slate-400 hover:text-slate-200">
        <span>{label}</span>
        <span className="font-mono text-[10px] text-slate-500">{file}</span>
      </summary>
      {json === null ? (
        <p className="px-3 pb-3 text-[11px] text-rose-300/80">
          Attachment not bundled with this page. The file is in the repository at docs/agent-advantage/{file}.
        </p>
      ) : (
        <pre className="max-h-80 overflow-auto border-t border-white/[0.06] px-3 py-3 text-[10px] leading-relaxed text-slate-300">
          {json}
        </pre>
      )}
    </details>
  );
}
