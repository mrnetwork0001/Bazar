'use client';

import { useCallback, useMemo, useState } from 'react';
import { AlertTriangle, Play, RotateCcw, Terminal } from 'lucide-react';
import { SAMPLE_HIRE_REQUEST } from '@/lib/a2a/schema';
import { DEMO_HIRER } from '@/lib/data/hires';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CodeBlock } from '@/components/developers/code-block';

/**
 * Live console for POST /api/v1/a2a/hire.
 *
 * Everything measured here is client-side: `performance.now()` brackets the
 * fetch, so the number shown is round-trip latency from the browser, not server
 * time. State starts from the canonical `SAMPLE_HIRE_REQUEST` so the first
 * render is deterministic and hydration-safe.
 */

export interface ConsoleAgentOption {
  id: string;
  name: string;
  tokenId: number;
}

export interface TryItConsoleProps {
  /** Agents with `a2a.enabled` — the select rewrites `agentId` in the body. */
  agents: ConsoleAgentOption[];
  endpoint?: string;
  className?: string;
}

interface ConsoleResult {
  seq: number;
  /** null when the request never reached the router. */
  status: number | null;
  statusText: string;
  ms: number;
  body: string;
  error?: { code: string; message: string; details?: unknown };
  networkError?: string;
}

const VALID_BODY = JSON.stringify(SAMPLE_HIRE_REQUEST, null, 2);
const MISSING_FIELDS_BODY = JSON.stringify({ agentId: 'whalewatch-bsc', payer: '0xnot-an-address' }, null, 2);
const UNKNOWN_AGENT_BODY = JSON.stringify(
  { agentId: 'ghostwriter-bsc', tierId: 'task', payer: DEMO_HIRER },
  null,
  2,
);

const PRESETS = [
  { id: 'valid', label: 'Valid hire', hint: '201', body: VALID_BODY },
  { id: 'invalid', label: 'Missing fields', hint: '400', body: MISSING_FIELDS_BODY },
  { id: 'unknown', label: 'Unknown agent', hint: '404', body: UNKNOWN_AGENT_BODY },
] as const;

const STATUS_TEXT: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  400: 'Bad Request',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
};

function toneFor(status: number | null) {
  if (status === null) return 'border-rose-400/30 bg-rose-400/10 text-rose-300';
  if (status < 300) return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300';
  if (status < 500) return 'border-amber-400/30 bg-amber-400/10 text-amber-300';
  return 'border-rose-400/30 bg-rose-400/10 text-rose-300';
}

function readAgentId(raw: string): string | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const value = (parsed as Record<string, unknown>).agentId;
      if (typeof value === 'string') return value;
      if (typeof value === 'number') return String(value);
    }
  } catch {
    // Deliberately tolerant: an unparseable body is a valid thing to send.
  }
  return null;
}

/** Pulls `error` out of an A2AErrorResponse without trusting the shape. */
function readError(raw: string): ConsoleResult['error'] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return undefined;
    const record = parsed as Record<string, unknown>;
    if (record.ok !== false) return undefined;
    const err = record.error;
    if (!err || typeof err !== 'object') return undefined;
    const e = err as Record<string, unknown>;
    return {
      code: typeof e.code === 'string' ? e.code : 'UNKNOWN',
      message: typeof e.message === 'string' ? e.message : '',
      details: e.details,
    };
  } catch {
    return undefined;
  }
}

function prettify(raw: string) {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function ErrorDetails({ details }: { details: unknown }) {
  if (Array.isArray(details)) {
    const issues = details.filter(
      (d): d is { path: string; message: string } =>
        !!d && typeof d === 'object' && typeof (d as { message?: unknown }).message === 'string',
    );
    if (!issues.length) return null;
    return (
      <ul className="mt-2 space-y-1.5">
        {issues.map((issue, i) => (
          <li key={`${issue.path}-${i}`} className="flex flex-wrap items-baseline gap-x-2 text-xs">
            <code className="font-mono text-cyan-300">{issue.path || '(body)'}</code>
            <span className="text-slate-400">{issue.message}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (details && typeof details === 'object') {
    return (
      <ul className="mt-2 space-y-1 text-xs">
        {Object.entries(details as Record<string, unknown>).map(([k, v]) => (
          <li key={k} className="flex flex-wrap items-baseline gap-x-2">
            <code className="font-mono text-cyan-300">{k}</code>
            <span className="font-mono text-slate-400">{String(v)}</span>
          </li>
        ))}
      </ul>
    );
  }
  return null;
}

export function TryItConsole({ agents, endpoint = '/api/v1/a2a/hire', className }: TryItConsoleProps) {
  const [body, setBody] = useState(VALID_BODY);
  const [pending, setPending] = useState(false);
  const [history, setHistory] = useState<ConsoleResult[]>([]);
  const [selected, setSelected] = useState<number | null>(null);

  const agentId = readAgentId(body);
  const parseError = useMemo(() => {
    try {
      JSON.parse(body);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Invalid JSON.';
    }
  }, [body]);

  const result = useMemo(
    () => history.find((h) => h.seq === selected) ?? history[0] ?? null,
    [history, selected],
  );

  const onAgentChange = useCallback((nextId: string) => {
    setBody((current) => {
      try {
        const parsed: unknown = JSON.parse(current);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return JSON.stringify({ ...(parsed as Record<string, unknown>), agentId: nextId }, null, 2);
        }
      } catch {
        // Leave an unparseable body untouched rather than clobbering the user's edit.
      }
      return current;
    });
  }, []);

  const send = useCallback(async () => {
    setPending(true);
    const started = performance.now();
    let outcome: Omit<ConsoleResult, 'seq' | 'ms'>;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      const text = await res.text();
      outcome = {
        status: res.status,
        statusText: STATUS_TEXT[res.status] ?? res.statusText ?? '',
        body: prettify(text),
        error: readError(text),
      };
    } catch (err) {
      outcome = {
        status: null,
        statusText: 'Network error',
        body: '',
        networkError:
          err instanceof Error ? err.message : 'The request never reached the router. Check your connection.',
      };
    }
    const ms = Math.round(performance.now() - started);
    setHistory((prev) => {
      const seq = (prev[0]?.seq ?? 0) + 1;
      setSelected(seq);
      return [{ ...outcome, seq, ms }, ...prev].slice(0, 3);
    });
    setPending(false);
  }, [body, endpoint]);

  return (
    <section id="try-it" className={cn('scroll-mt-24', className)}>
      <div className="glass overflow-hidden rounded-2xl">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-white/[0.08] bg-white/[0.03] px-4 py-3">
          <Terminal className="h-4 w-4 text-bnb" aria-hidden />
          <span className="font-mono text-xs text-slate-300">POST {endpoint}</span>
          <span className="ml-auto font-mono text-[11px] text-slate-500">no auth · CORS open</span>
        </div>

        <div className="grid gap-px bg-white/[0.06] lg:grid-cols-2">
          {/* Request */}
          <div className="bg-ink/60 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <label htmlFor="try-it-agent" className="block text-[11px] font-medium uppercase tracking-wider text-slate-500">
                  Agent
                </label>
                <select
                  id="try-it-agent"
                  value={agentId && agents.some((a) => a.id === agentId) ? agentId : ''}
                  onChange={(e) => onAgentChange(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-white/[0.1] bg-surface px-3 py-2 text-sm text-white ring-focus focus:border-bnb/50"
                >
                  {(!agentId || !agents.some((a) => a.id === agentId)) && (
                    <option value="">{agentId ? `${agentId} (not indexed)` : 'Custom agentId'}</option>
                  )}
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} — {a.id} · #{a.tokenId}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setBody(p.body)}
                    className={cn(
                      'rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-[11px] text-slate-400 transition-colors ring-focus hover:border-white/20 hover:text-white',
                      body === p.body && 'border-bnb/40 text-bnb',
                    )}
                  >
                    {p.label} <span className="tabular font-mono text-slate-600">{p.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <label htmlFor="try-it-body" className="mt-4 block text-[11px] font-medium uppercase tracking-wider text-slate-500">
              Request body
            </label>
            <textarea
              id="try-it-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              spellCheck={false}
              rows={16}
              aria-describedby="try-it-body-status"
              className="mt-1.5 w-full resize-y rounded-xl border border-white/[0.1] bg-ink/80 p-3 font-mono text-[12px] leading-5 text-slate-300 ring-focus focus:border-bnb/50"
            />

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <p id="try-it-body-status" className="min-w-0 flex-1 text-[11px]">
                {parseError ? (
                  <span className="inline-flex items-start gap-1.5 text-amber-300">
                    <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>Not valid JSON — the router answers 400 VALIDATION_ERROR. Send it and see.</span>
                  </span>
                ) : (
                  <span className="text-slate-500">Valid JSON. Edit any field, then send.</span>
                )}
              </p>
              <button
                type="button"
                onClick={() => setBody(VALID_BODY)}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] text-slate-400 ring-focus hover:text-white"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                Reset
              </button>
              <Button
                type="button"
                size="sm"
                onClick={send}
                loading={pending}
                leftIcon={<Play className="h-3.5 w-3.5" aria-hidden />}
              >
                {pending ? 'Sending' : 'Send request'}
              </Button>
            </div>
          </div>

          {/* Response */}
          <div className="bg-ink/60 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Response</h3>
              {result && (
                <div className="flex items-center gap-2" aria-live="polite">
                  <span
                    className={cn(
                      'tabular inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[11px]',
                      toneFor(result.status),
                    )}
                  >
                    {result.status ?? 'ERR'}
                    <span className="text-slate-400">{result.statusText}</span>
                  </span>
                  <span className="tabular font-mono text-[11px] text-slate-500">{result.ms} ms</span>
                </div>
              )}
            </div>

            {!result && (
              <div className="mt-3 rounded-xl border border-dashed border-white/[0.1] p-6 text-center">
                <p className="text-sm text-slate-400">No request sent yet.</p>
                <p className="mt-1 text-xs text-slate-500">
                  Hit <span className="text-slate-300">Send request</span> to call the live router from your browser.
                </p>
              </div>
            )}

            {result?.networkError && (
              <div className="mt-3 rounded-xl border border-rose-400/25 bg-rose-400/[0.06] p-4">
                <p className="flex items-center gap-2 text-sm font-medium text-rose-300">
                  <AlertTriangle className="h-4 w-4" aria-hidden />
                  Request failed
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{result.networkError}</p>
              </div>
            )}

            {result?.error && (
              <div className="mt-3 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-amber-300">
                    {result.error.code}
                  </code>
                  <span className="tabular font-mono text-[11px] text-slate-500">HTTP {result.status}</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{result.error.message}</p>
                <ErrorDetails details={result.error.details} />
              </div>
            )}

            {result && result.body && (
              <CodeBlock
                className="mt-3"
                code={result.body}
                lang="json"
                title={`${result.status ?? 'ERR'} · ${result.ms} ms`}
                copyLabel="response body"
                scroll="max-h-80"
              />
            )}

            {history.length > 0 && (
              <div className="mt-4">
                <h4 className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Last {history.length} requests</h4>
                <ul className="mt-2 space-y-1.5">
                  {history.map((h) => (
                    <li key={h.seq}>
                      <button
                        type="button"
                        onClick={() => setSelected(h.seq)}
                        aria-current={result?.seq === h.seq}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-xs transition-colors ring-focus',
                          result?.seq === h.seq
                            ? 'border-white/20 bg-white/[0.06]'
                            : 'border-white/[0.08] bg-white/[0.02] hover:border-white/20',
                        )}
                      >
                        <span className="tabular font-mono text-slate-600">#{h.seq}</span>
                        <span
                          className={cn(
                            'tabular rounded border px-1.5 py-px font-mono text-[10px]',
                            toneFor(h.status),
                          )}
                        >
                          {h.status ?? 'ERR'}
                        </span>
                        <span className="truncate font-mono text-slate-400">
                          {h.error?.code ?? (h.networkError ? 'NETWORK_ERROR' : 'ok')}
                        </span>
                        <span className="tabular ml-auto font-mono text-slate-500">{h.ms} ms</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-slate-500">
        Hires created here are quotes: status <code className="font-mono text-slate-300">pending</code>, held in the
        router&apos;s in-memory store until the escrow calldata is submitted on BSC. The id is derived from
        (agent, tier, payer, task), so re-sending the same body is idempotent and returns a fresh quote for the same hire.
        A <code className="font-mono text-slate-300">403 A2A_DISABLED</code> cannot be reproduced from this console —
        every agent in the indexed demo set is A2A-ready.
      </p>
    </section>
  );
}
