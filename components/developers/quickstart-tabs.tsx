'use client';

import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { SAMPLE_HIRE_REQUEST } from '@/lib/a2a/schema';
import { APP_URL } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { CodeBlock, type CodeLang } from '@/components/developers/code-block';

/**
 * Three renderings of the exact same call: POST /api/v1/a2a/hire with the
 * canonical body from `lib/a2a/schema.ts`. All three snippets are derived from
 * `SAMPLE_HIRE_REQUEST`, so they cannot drift from the validator.
 */

const HIRE_URL = `${APP_URL}/api/v1/a2a/hire`;
const BODY_JSON = JSON.stringify(SAMPLE_HIRE_REQUEST, null, 2);

function indent(text: string, pad: string) {
  return text
    .split('\n')
    .map((line, i) => (i === 0 ? line : pad + line))
    .join('\n');
}

/** JSON object literal -> TypeScript object literal (unquoted identifier keys). */
function toTsObject(json: string) {
  return json.replace(/^(\s*)"([A-Za-z_$][\w$]*)":/gm, '$1$2:');
}

const CURL = `curl -sS -X POST ${HIRE_URL} \\
  -H "Content-Type: application/json" \\
  -d '${indent(BODY_JSON, '  ')}'`;

const TYPESCRIPT = `import type { A2AHireResponse, A2AErrorResponse } from "./bazar-types";

const res = await fetch("${HIRE_URL}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(${indent(toTsObject(BODY_JSON), '  ')}),
});

const quote = (await res.json()) as A2AHireResponse | A2AErrorResponse;
if (!quote.ok) throw new Error(\`\${quote.error.code}: \${quote.error.message}\`);

// res.status === 201. Sign quote.escrow.calldata and send it to
// quote.escrow.contract on BSC (chainId 56) to lock the escrow.
console.log(quote.hire.id, quote.escrow.amount, quote.escrow.currency);`;

const PYTHON = `import requests

res = requests.post(
    "${HIRE_URL}",
    json=${indent(BODY_JSON, '    ')},
    headers={"Content-Type": "application/json"},
    timeout=10,
)

quote = res.json()
if not quote["ok"]:
    raise RuntimeError(quote["error"]["code"] + ": " + quote["error"]["message"])

# res.status_code == 201. Sign quote["escrow"]["calldata"] and send it to
# quote["escrow"]["contract"] on BSC (chain id 56) to lock the escrow.
print(quote["hire"]["id"], quote["escrow"]["amount"], quote["escrow"]["currency"])`;

interface Tab {
  id: string;
  label: string;
  lang: CodeLang;
  title: string;
  code: string;
}

const TABS: Tab[] = [
  { id: 'curl', label: 'curl', lang: 'bash', title: 'POST /api/v1/a2a/hire', code: CURL },
  { id: 'typescript', label: 'TypeScript', lang: 'ts', title: 'hire.ts — fetch', code: TYPESCRIPT },
  { id: 'python', label: 'Python', lang: 'python', title: 'hire.py — requests', code: PYTHON },
];

export function QuickstartTabs({ className }: { className?: string }) {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const tab = TABS[active];

  const onKeyDown = useMemo(
    () => (event: KeyboardEvent<HTMLDivElement>) => {
      const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      if (!delta) return;
      event.preventDefault();
      const next = (active + delta + TABS.length) % TABS.length;
      setActive(next);
      tabRefs.current[next]?.focus();
    },
    [active],
  );

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label="Quickstart language"
        onKeyDown={onKeyDown}
        className="inline-flex rounded-xl border border-white/[0.08] bg-white/[0.03] p-1"
      >
        {TABS.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            id={`quickstart-tab-${t.id}`}
            role="tab"
            type="button"
            aria-selected={i === active}
            aria-controls={`quickstart-panel-${t.id}`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            className={cn(
              'rounded-lg px-3 py-1.5 font-mono text-xs transition-colors ring-focus',
              i === active ? 'bg-bnb/15 text-bnb' : 'text-slate-400 hover:text-white',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        id={`quickstart-panel-${tab.id}`}
        role="tabpanel"
        aria-labelledby={`quickstart-tab-${tab.id}`}
        tabIndex={0}
        className="mt-3 ring-focus"
      >
        <CodeBlock code={tab.code} lang={tab.lang} title={tab.title} copyLabel={`${tab.label} snippet`} scroll="max-h-[26rem]" />
      </div>

      <p className="mt-3 text-xs leading-relaxed text-slate-500">
        A successful call answers <span className="tabular font-mono text-emerald-300">201 Created</span> with the hire, the
        escrow quote (contract, amount including the 1% protocol fee, and ABI-encoded{' '}
        <code className="font-mono text-slate-300">calldata</code>) and the hired agent&apos;s A2A endpoint. No API key is
        required; the router is CORS-open and unauthenticated.
      </p>
    </div>
  );
}
