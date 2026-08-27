'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, ClipboardCopy } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Developer-docs code block: a monospace, horizontally scrollable pre with a
 * copy button and a hand-rolled, dependency-free tokenizer.
 *
 * The landing page ships `components/home/code.tsx`, which highlights JSON and
 * curl only. This module keeps the same colour language (cyan keys, gold
 * strings, violet numbers) and extends it to shell, TypeScript, Python, raw
 * HTTP and Solidity signatures, which the API reference needs.
 */

export type CodeLang = 'json' | 'bash' | 'ts' | 'python' | 'http' | 'sol' | 'text';

const C = {
  key: 'text-cyan-300',
  str: 'text-bnb-300',
  num: 'text-violet-300',
  kw: 'text-sky-300',
  comment: 'text-slate-500',
  verb: 'font-semibold text-white',
  flag: 'text-slate-400',
  type: 'text-emerald-300',
} as const;

/* Building blocks. Every pattern uses non-capturing groups so that the compiled
 * alternation keeps exactly one capture group per rule. */
const DQ = String.raw`"(?:[^"\\]|\\.)*"`;
const SQ = String.raw`'(?:[^'\\]|\\.)*'`;
const BT = String.raw`\x60(?:[^\x60\\]|\\.)*\x60`;
const NUM = String.raw`-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b`;

interface Rule {
  pattern: string;
  cls: string;
}

const RULES: Record<Exclude<CodeLang, 'text'>, Rule[]> = {
  json: [
    { pattern: `${DQ}(?=\\s*:)`, cls: C.key },
    { pattern: DQ, cls: C.str },
    { pattern: String.raw`\b(?:true|false|null)\b`, cls: C.num },
    { pattern: NUM, cls: C.num },
  ],
  // Shell rules also carry the JSON rules so an inlined `-d '{ ... }'` body
  // reads the same as a standalone JSON block.
  bash: [
    { pattern: String.raw`#.*$`, cls: C.comment },
    { pattern: String.raw`\\$`, cls: C.comment },
    { pattern: `${DQ}(?=\\s*:)`, cls: C.key },
    { pattern: DQ, cls: C.str },
    { pattern: SQ, cls: C.str },
    { pattern: String.raw`\b(?:curl|jq|export|echo|npx|node|python3?|pip)\b`, cls: C.verb },
    { pattern: String.raw`\b(?:GET|POST|PUT|DELETE|OPTIONS)\b`, cls: C.verb },
    { pattern: String.raw`(?:^|\s)-{1,2}[A-Za-z][\w-]*`, cls: C.flag },
    { pattern: String.raw`\b(?:true|false|null)\b`, cls: C.num },
    { pattern: NUM, cls: C.num },
  ],
  ts: [
    { pattern: String.raw`//.*$`, cls: C.comment },
    { pattern: `(?:${DQ}|${SQ})(?=\\s*:)`, cls: C.key },
    { pattern: String.raw`^\s*[A-Za-z_$][\w$]*(?=\s*:)`, cls: C.key },
    { pattern: `${DQ}|${SQ}|${BT}`, cls: C.str },
    {
      pattern: String.raw`\b(?:const|let|var|async|await|function|return|import|export|from|type|interface|if|else|new|throw|try|catch|typeof|as|of)\b`,
      cls: C.kw,
    },
    { pattern: String.raw`\b(?:true|false|null|undefined)\b`, cls: C.num },
    { pattern: NUM, cls: C.num },
  ],
  python: [
    { pattern: String.raw`#.*$`, cls: C.comment },
    { pattern: `(?:${DQ}|${SQ})(?=\\s*:)`, cls: C.key },
    { pattern: `${DQ}|${SQ}`, cls: C.str },
    {
      pattern: String.raw`\b(?:import|from|def|return|if|elif|else|for|in|not|and|or|with|as|raise|try|except|class|print|pass)\b`,
      cls: C.kw,
    },
    { pattern: String.raw`\b(?:True|False|None)\b`, cls: C.num },
    { pattern: NUM, cls: C.num },
  ],
  http: [
    { pattern: String.raw`^(?:GET|POST|PUT|DELETE|OPTIONS)\b`, cls: C.verb },
    { pattern: String.raw`\bHTTP/[\d.]+\b`, cls: C.verb },
    { pattern: String.raw`^[A-Za-z][\w-]*(?=:)`, cls: C.key },
    { pattern: `${DQ}`, cls: C.str },
    { pattern: NUM, cls: C.num },
  ],
  sol: [
    { pattern: String.raw`//.*$`, cls: C.comment },
    {
      pattern: String.raw`\b(?:function|event|external|public|payable|nonpayable|view|indexed|returns|emit|contract|interface)\b`,
      cls: C.kw,
    },
    { pattern: String.raw`\b(?:uint256|uint8|bytes32|bytes|address|bool|string)\b`, cls: C.type },
    { pattern: `${DQ}`, cls: C.str },
    { pattern: NUM, cls: C.num },
  ],
};

const COMPILED = new Map<string, { re: RegExp; classes: string[] }>();

function compiled(lang: Exclude<CodeLang, 'text'>) {
  const cached = COMPILED.get(lang);
  if (cached) return cached;
  const rules = RULES[lang];
  const entry = {
    re: new RegExp(rules.map((r) => `(${r.pattern})`).join('|'), 'g'),
    classes: rules.map((r) => r.cls),
  };
  COMPILED.set(lang, entry);
  return entry;
}

/** Tokenizes one line. Pure and deterministic — safe on the server too. */
export function highlightLine(line: string, lang: CodeLang): ReactNode[] {
  if (lang === 'text' || !line) return [line];
  const { re, classes } = compiled(lang);
  const out: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  re.lastIndex = 0;
  while ((match = re.exec(line)) !== null) {
    if (match[0] === '') {
      re.lastIndex += 1;
      continue;
    }
    if (match.index > last) out.push(line.slice(last, match.index));
    const groupIndex = match.slice(1).findIndex((g) => g !== undefined);
    out.push(
      <span key={`${match.index}-${out.length}`} className={classes[groupIndex] ?? undefined}>
        {match[0]}
      </span>,
    );
    last = match.index + match[0].length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

/* -------------------------------- copy --------------------------------- */

export interface CopyButtonProps {
  value: string;
  /** Noun used in the accessible label, e.g. "base URL" -> "Copy base URL". */
  label?: string;
  /** Render the label next to the icon instead of icon-only. */
  showLabel?: boolean;
  className?: string;
}

/** Copy-to-clipboard control with an inline confirmation state. */
export function CopyButton({ value, label = 'code', showLabel, className }: CopyButtonProps) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const copy = useCallback(async () => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(value);
      ok = true;
    } catch {
      // Clipboard API is unavailable outside secure contexts — fall back.
      try {
        const el = document.createElement('textarea');
        el.value = value;
        el.setAttribute('readonly', '');
        el.style.position = 'fixed';
        el.style.opacity = '0';
        document.body.appendChild(el);
        el.select();
        ok = document.execCommand('copy');
        document.body.removeChild(el);
      } catch {
        ok = false;
      }
    }
    setState(ok ? 'copied' : 'failed');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), 1600);
  }, [value]);

  const copied = state === 'copied';
  const failed = state === 'failed';

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-[11px] font-medium transition-colors ring-focus hover:border-white/20 hover:text-white',
        copied ? 'text-emerald-300' : failed ? 'text-rose-300' : 'text-slate-400',
        className,
      )}
    >
      {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <ClipboardCopy className="h-3.5 w-3.5" aria-hidden />}
      <span className={showLabel ? undefined : 'sr-only'}>{copied ? 'Copied' : failed ? 'Copy failed' : 'Copy'}</span>
      <span aria-live="polite" className="sr-only">
        {copied ? `${label} copied to clipboard` : failed ? `Could not copy ${label}` : ''}
      </span>
    </button>
  );
}

/* ------------------------------ code block ------------------------------ */

export interface CodeBlockProps {
  code: string;
  lang?: CodeLang;
  /** Mono caption in the frame header, e.g. "POST /api/v1/a2a/hire". */
  title?: string;
  /** Value handed to the copy button. Defaults to `code`. */
  copyValue?: string;
  /** Noun for the copy button's accessible label. */
  copyLabel?: string;
  /** Extra node in the header, right of the title. */
  aside?: ReactNode;
  /** Drop the glass frame and header — just the highlighted pre. */
  bare?: boolean;
  /** Tailwind max-height for a vertical scroll area, e.g. "max-h-96". */
  scroll?: string;
  className?: string;
}

export function CodeBlock({
  code,
  lang = 'text',
  title,
  copyValue,
  copyLabel,
  aside,
  bare,
  scroll,
  className,
}: CodeBlockProps) {
  const lines = code.replace(/^\n+|\n+$/g, '').split('\n');

  const pre = (
    <pre
      className={cn(
        'overflow-x-auto font-mono text-[12px] leading-5 text-slate-300',
        scroll && `overflow-y-auto ${scroll}`,
        bare ? className : 'p-3 sm:p-4',
      )}
      tabIndex={0}
    >
      <code>
        {lines.map((line, i) => (
          <span key={i} className="block whitespace-pre">
            {line ? highlightLine(line, lang) : ' '}
          </span>
        ))}
      </code>
    </pre>
  );

  if (bare) return pre;

  return (
    <div className={cn('glass-strong overflow-hidden rounded-xl', className)}>
      <div className="flex items-center gap-2 border-b border-white/[0.08] bg-white/[0.03] px-3 py-2">
        {title && <span className="truncate font-mono text-[11px] text-slate-400">{title}</span>}
        <span className="ml-auto flex shrink-0 items-center gap-2">
          {aside}
          <CopyButton value={copyValue ?? code} label={copyLabel ?? title ?? 'code'} />
        </span>
      </div>
      {pre}
    </div>
  );
}
