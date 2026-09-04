'use client';

import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { CodeBlock, type CodeLang } from '@/components/developers/code-block';

/**
 * Three renderings of the same call: POST /api/v1/a2a/hire with the canonical
 * body. The body is passed in from the server page, built against a real agent
 * resolved from the live index, so a reader can paste any of these into a
 * terminal and get a 201 - not a 404 on a slug that only ever existed in docs.
 *
 * The TypeScript and Python tabs go all the way through to a funded job:
 * createJob, setBudget, an ERC-20 approve to the kernel, fund, then a read of
 * the job back off the kernel. Every signature and address in them comes out of
 * the response body, so the snippets cannot drift from what the router returns.
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
  /** Absolute URL prefix of GET /api/v1/a2a/jobs. */
  jobsUrl: string;
  /** Pretty-printed request body, targeting a live indexed agent. */
  bodyJson: string;
  className?: string;
}

export function QuickstartTabs({ hireUrl, jobsUrl, bodyJson, className }: QuickstartTabsProps) {
  const tabs = useMemo<Tab[]>(() => {
    const curl = `curl -sS -X POST ${hireUrl} \\
  -H "Content-Type: application/json" \\
  -d '${indent(bodyJson, '  ')}'`;

    const typescript = `import type { A2AJobIntentResponse } from "./bazar-types";
import { createWalletClient, createPublicClient, custom, http, encodeFunctionData, parseUnits } from "viem";
import { bsc } from "viem/chains";

// 1. Ask Bazar for the plan. No key, no auth, no signature.
const res = await fetch("${hireUrl}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(${indent(toTsObject(bodyJson), '  ')}),
});

const result = (await res.json()) as A2AJobIntentResponse | { ok: false; error: { code: string; message: string } };
if (!result.ok) throw new Error(\`\${result.error.code}: \${result.error.message}\`);

const { intent } = result;                 // res.status === 201
if (intent.blockers.length) throw new Error(intent.blockers.join(" "));

const wallet = createWalletClient({ chain: bsc, transport: custom(window.ethereum) });
const client = createPublicClient({ chain: bsc, transport: http() });
const [createJob, registerJob, setBudget, approve, fund] = intent.transactions;

// YOU choose this number. intent.payment.quotedAmount is null because no price
// for an ERC-8004 agent exists onchain - nothing can quote one for you.
const budget = parseUnits("0.1", intent.payment.decimals!);   // in intent.payment.symbol

// 2. createJob - the only step Bazar can encode in full.
const createHash = await wallet.sendTransaction({
  account: intent.client,
  to: createJob.to,
  data: createJob.calldata!,
});
const receipt = await client.waitForTransactionReceipt({ hash: createHash });
const jobId = /* uint256 from the JobCreated event, or read jobCounter() */ 0n;

// 3. setBudget - skip this and fund reverts ZeroBudget().
await wallet.sendTransaction({
  account: intent.client,
  to: setBudget.to,
  data: encodeFunctionData({ abi: setBudget.abi, functionName: "setBudget", args: [jobId, budget, "0x"] }),
});

// 4. approve the kernel on the payment token - fund pulls with transferFrom.
await wallet.sendTransaction({
  account: intent.client,
  to: approve.to,                          // intent.payment.token, not the kernel
  data: encodeFunctionData({ abi: approve.abi, functionName: "approve", args: [intent.kernel.address, budget] }),
});

// 5. fund - expectedBudget ASSERTS the stored budget; a mismatch reverts.
await wallet.sendTransaction({
  account: intent.client,
  to: fund.to,
  data: encodeFunctionData({ abi: fund.abi, functionName: "fund", args: [jobId, budget, "0x"] }),
});

// 6. Read the job back. This is a live getJob(uint256) - Bazar watches nothing,
// so poll it. 404 means the kernel has no such job; 503 means it could not ask.
const job = await fetch(\`${jobsUrl}/\${jobId}?chainId=\${intent.chainId}\`).then((r) => r.json());
console.log(job.job.status, job.job.budget.label);   // "funded", e.g. "0.1 U"`;

    const python = `import requests

# 1. Ask Bazar for the plan. No key, no auth, no signature.
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
assert intent["status"] == "unsigned_intent"      # nothing signed, nothing sent
assert not intent["blockers"], intent["blockers"]

create_job, register_job, set_budget, approve, fund = intent["transactions"]

print(create_job["to"])                            # ERC-8183 AgenticCommerce kernel
print(create_job["calldata"])                      # send this from intent["client"]
print(intent["payment"]["token"], intent["payment"]["symbol"], intent["payment"]["decimals"])
print(intent["payment"]["quotedAmount"])           # None - you set the budget yourself

# Steps 2-5 carry no calldata: they need a jobId that does not exist yet.
# registerJob binds the job to the settlement policy on the EvaluatorRouter -
# skip it and fund() reverts PolicyNotSet().
# Each one hands you the ABI fragment and selector instead.
for step in (set_budget, approve, fund):
    print(step["step"], step["call"], step["signature"], step["selector"], step["ready"])

# After createJob lands, read the job back off the kernel. Bazar polls nothing.
job_id = ...                                       # uint256 from the JobCreated event
job = requests.get(f"${jobsUrl}/{job_id}", params={"chainId": intent["chainId"]}, timeout=30)
if job.status_code == 404:
    raise RuntimeError("the kernel has never issued this job id")
if job.status_code == 503:
    raise RuntimeError("Bazar could not reach the chain - retry, do not assume it is missing")
print(job.json()["job"]["status"], job.json()["job"]["budget"]["label"])`;

    return [
      { id: 'curl', label: 'curl', lang: 'bash', title: 'POST /api/v1/a2a/hire', code: curl },
      { id: 'typescript', label: 'TypeScript', lang: 'ts', title: 'intent.ts - fetch + viem', code: typescript },
      { id: 'python', label: 'Python', lang: 'python', title: 'intent.py - requests', code: python },
    ];
  }, [hireUrl, jobsUrl, bodyJson]);

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
        ERC-8183 kernel address, ABI-encoded <code className="font-mono text-slate-300">createJob</code> calldata, and
        the <code className="font-mono text-slate-300">setBudget</code> /{' '}
        <code className="font-mono text-slate-300">approve</code> /{' '}
        <code className="font-mono text-slate-300">fund</code> calls that follow it, each with its ABI fragment. Bazar
        signs nothing, broadcasts nothing, holds nothing and takes no fee. No API key is required; the router is
        CORS-open and unauthenticated.
      </p>
    </div>
  );
}
