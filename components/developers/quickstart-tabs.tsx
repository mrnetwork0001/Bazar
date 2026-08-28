'use client';

import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { CodeBlock, type CodeLang } from '@/components/developers/code-block';

/**
 * Three renderings of the same call: POST /api/v1/a2a/hire with the canonical
 * body. The body is passed in from the server page, built against a real agent
 * resolved from the live index, so a reader can paste any of these into a
 * terminal and get a 201 - not a 404 on a slug that only ever existed in docs.
 */

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

interface Tab {
  id: string;
  label: string;
  lang: CodeLang;
  title: string;
  code: string;
}

export interface QuickstartTabsProps {
  /** Absolute URL of POST /api/v1/a2a/hire. */
  hireUrl: string;
  /** Pretty-printed request body, targeting a live indexed agent. */
  bodyJson: string;
  className?: string;
}

export function QuickstartTabs({ hireUrl, bodyJson, className }: QuickstartTabsProps) {
  const tabs = useMemo<Tab[]>(() => {
    const curl = `curl -sS -X POST ${hireUrl} \\
  -H "Content-Type: application/json" \\
  -d '${indent(bodyJson, '  ')}'`;

    const typescript = `import type { A2AJobIntentResponse } from "./bazar-types";
import { createWalletClient, custom } from "viem";
import { bsc } from "viem/chains";

const res = await fetch("${hireUrl}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(${indent(toTsObject(bodyJson), '  ')}),
});

const result = (await res.json()) as A2AJobIntentResponse | { ok: false; error: { code: string; message: string } };
if (!result.ok) throw new Error(\`\${result.error.code}: \${result.error.message}\`);

// res.status === 201, result.intent.status === "unsigned_intent".
// Nothing has been signed or sent. Submit createJob yourself:
const { intent } = result;
const wallet = createWalletClient({ chain: bsc, transport: custom(window.ethereum) });
const hash = await wallet.sendTransaction({
  account: intent.client,
  to: intent.createJob.to,          // ERC-8183 AgenticCommerce kernel
  data: intent.createJob.calldata,  // createJob(provider, evaluator, expiredAt, description, hook)
});

// Then read jobId from the JobCreated event, approve intent.payment.token,
// and call fund(jobId, expectedBudget, "0x") with a budget YOU choose -
// intent.payment.quotedAmount is null because no price exists onchain.`;

    const python = `import requests

res = requests.post(
    "${hireUrl}",
    json=${indent(bodyJson, '    ')},
    headers={"Content-Type": "application/json"},
    timeout=30,
)

result = res.json()
if not result["ok"]:
    raise RuntimeError(result["error"]["code"] + ": " + result["error"]["message"])

intent = result["intent"]
assert intent["status"] == "unsigned_intent"   # nothing signed, nothing sent

print(intent["id"])
print(intent["createJob"]["to"])        # ERC-8183 AgenticCommerce kernel
print(intent["createJob"]["calldata"])  # submit this from intent["client"]
print(intent["payment"]["quotedAmount"])  # None - you set the budget in fund()`;

    return [
      { id: 'curl', label: 'curl', lang: 'bash', title: 'POST /api/v1/a2a/hire', code: curl },
      { id: 'typescript', label: 'TypeScript', lang: 'ts', title: 'intent.ts - fetch + viem', code: typescript },
      { id: 'python', label: 'Python', lang: 'python', title: 'intent.py - requests', code: python },
    ];
  }, [hireUrl, bodyJson]);

  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const tab = tabs[active];

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = (active + delta + tabs.length) % tabs.length;
    setActive(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label="Quickstart language"
        onKeyDown={onKeyDown}
        className="inline-flex rounded-xl border border-white/[0.08] bg-white/[0.03] p-1"
      >
        {tabs.map((t, i) => (
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
        <CodeBlock
          code={tab.code}
          lang={tab.lang}
          title={tab.title}
          copyLabel={`${tab.label} snippet`}
          scroll="max-h-[30rem]"
        />
      </div>

      <p className="mt-3 text-xs leading-relaxed text-slate-500">
        A successful call answers <span className="tabular font-mono text-emerald-300">201 Created</span> with{' '}
        <code className="font-mono text-slate-300">status: &quot;unsigned_intent&quot;</code>: the resolved agent, the
        ERC-8183 kernel address and ABI-encoded <code className="font-mono text-slate-300">createJob</code> calldata.
        Bazar signs nothing, holds nothing and takes no fee. No API key is required; the router is CORS-open and
        unauthenticated.
      </p>
    </div>
  );
}
