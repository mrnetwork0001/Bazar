import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Tiny deterministic syntax highlighter for the JSON / HTTP / curl snippets on
 * the landing page. Server-safe: a pure string -> ReactNode transformation.
 */
const TOKEN =
  /("(?:[^"\\]|\\.)*")(\s*:)|("(?:[^"\\]|\\.)*")|\b(true|false|null)\b|(-?\b\d+(?:\.\d+)?\b)|(#.*$)|(\\\s*$)|(\b(?:curl|POST|GET|HTTP\/1\.1)\b)|(\s-[A-Za-z]\b)/g;

export function highlightLine(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  TOKEN.lastIndex = 0;
  while ((match = TOKEN.exec(line)) !== null) {
    if (match.index > last) out.push(line.slice(last, match.index));
    const [full, key, colon, str, bool, num, comment, cont, verb, flag] = match;
    const k = out.length;
    if (key) {
      out.push(
        <span key={k} className="text-cyan-300">
          {key}
        </span>,
        colon,
      );
    } else if (str) {
      out.push(
        <span key={k} className="text-bnb-300">
          {str}
        </span>,
      );
    } else if (bool || num) {
      out.push(
        <span key={k} className="text-violet-300">
          {full}
        </span>,
      );
    } else if (comment || cont) {
      out.push(
        <span key={k} className="text-slate-500">
          {full}
        </span>,
      );
    } else if (verb) {
      out.push(
        <span key={k} className="font-semibold text-white">
          {full}
        </span>,
      );
    } else if (flag) {
      out.push(
        <span key={k} className="text-slate-400">
          {full}
        </span>,
      );
    } else {
      out.push(full);
    }
    last = match.index + full.length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

export interface CodeBlockProps {
  code: string;
  className?: string;
}

/** Highlighted, horizontally scrollable code block. Whitespace is preserved per line. */
export function CodeBlock({ code, className }: CodeBlockProps) {
  const lines = code.replace(/^\n+|\n+$/g, '').split('\n');
  return (
    <pre className={cn('overflow-x-auto font-mono text-[12px] leading-5 text-slate-300', className)}>
      <code>
        {lines.map((line, i) => (
          <span key={i} className="block whitespace-pre">
            {line ? highlightLine(line) : ' '}
          </span>
        ))}
      </code>
    </pre>
  );
}

export interface TerminalProps {
  title: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Right-aligned slot in the title bar (e.g. a badge) */
  aside?: ReactNode;
}

/** Glass terminal frame with traffic-light dots and a mono title. */
export function Terminal({ title, children, className, bodyClassName, aside }: TerminalProps) {
  return (
    <div className={cn('glass-strong overflow-hidden rounded-2xl shadow-card', className)}>
      <div className="flex items-center gap-2 border-b border-white/[0.08] bg-white/[0.03] px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
        </span>
        <span className="ml-1 truncate font-mono text-[11px] text-slate-400">{title}</span>
        {aside && <span className="ml-auto flex shrink-0 items-center">{aside}</span>}
      </div>
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </div>
  );
}
