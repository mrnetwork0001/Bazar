import {
  Banknote,
  Coins,
  FileSignature,
  PackageCheck,
  ShieldCheck,
  Undo2,
  type AppIcon,
} from '@/components/ui/icons';
import {
  AGENTIC_COMMERCE_EVENT_SIGNATURES as ERC8183_EVENT_SIGNATURES,
  AGENTIC_COMMERCE_FUNCTION_SIGNATURES as ERC8183_FUNCTION_SIGNATURES,
  MAX_EXPIRY_SECONDS,
  MIN_EXPIRY_SECONDS,
} from '@/lib/abi';
import { getDeployment, PAYMENT_TOKEN_EIP712 } from '@/lib/chain/addresses';
import { bscScanAddress, shortAddress } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { SectionHeading } from '@/components/home/section-heading';
import { CodeBlock, CopyButton } from '@/components/developers/code-block';
import type { CalldataWord, DocsExamples } from '@/components/developers/docs-data';

/**
 * The payment half of an A2A job: what the router hands back, what the calling
 * agent submits, and who moves the money afterwards.
 *
 * Bazar quotes nothing. The ERC-8004 registries publish identity and
 * reputation; they publish no price. So the router encodes `createJob` and
 * stops - the budget is a number the client picks at `fund` time.
 */

/**
 * The kernel on BscScan. Bazar's ABI is now the artifact the official BNB Agent
 * Studio SDK publishes, vendored verbatim in `lib/abi/`, and every signature
 * below is derived from it with viem rather than typed out - but the deployed
 * contract is still the thing a reader can verify these selectors against.
 */
const ABI_SOURCE = `${bscScanAddress(getDeployment().agenticCommerce, getDeployment().chainId)}#code`;

const SIGNATURES = [
  '// AgenticCommerce kernel - derived from the vendored SDK ABI, not transcribed',
  `function ${ERC8183_FUNCTION_SIGNATURES.createJob} returns (uint256 jobId)`,
  `function ${ERC8183_FUNCTION_SIGNATURES.setBudget}`,
  `function ${ERC8183_FUNCTION_SIGNATURES.fund}`,
  `function ${ERC8183_FUNCTION_SIGNATURES.submit}`,
  `function ${ERC8183_FUNCTION_SIGNATURES.complete}`,
  `function ${ERC8183_FUNCTION_SIGNATURES.reject}`,
  `function ${ERC8183_FUNCTION_SIGNATURES.claimRefund}`,
  `function ${ERC8183_FUNCTION_SIGNATURES.getJob} view`,
  `function ${ERC8183_FUNCTION_SIGNATURES.jobCounter} view`,
  '',
  '// the ERC-20 call in the middle - on the payment token, not the kernel',
  'function approve(address spender, uint256 amount) returns (bool)',
  '',
  '// events',
  `event ${ERC8183_EVENT_SIGNATURES.JobCreated}`,
  `event ${ERC8183_EVENT_SIGNATURES.BudgetSet}`,
  `event ${ERC8183_EVENT_SIGNATURES.JobFunded}`,
  `event ${ERC8183_EVENT_SIGNATURES.JobSubmitted}`,
  `event ${ERC8183_EVENT_SIGNATURES.JobCompleted}`,
  `event ${ERC8183_EVENT_SIGNATURES.PaymentReleased}`,
  `event ${ERC8183_EVENT_SIGNATURES.Refunded}`,
  `event ${ERC8183_EVENT_SIGNATURES.JobExpired}`,
].join('\n');

interface Step {
  icon: AppIcon;
  title: string;
  actor: string;
  body: string;
  emits?: string;
  accent: string;
}

const STEPS: Step[] = [
  {
    icon: FileSignature,
    title: 'createJob',
    actor: 'Your agent',
    body: 'POST /hire answers 201 with ABI-encoded createJob calldata addressed to the kernel. Send it yourself - Bazar holds no key and never broadcasts. The jobId it returns is the handle for everything after.',
    emits: 'JobCreated',
    accent: 'bg-bnb/10 text-bnb',
  },
  {
    icon: Coins,
    title: 'setBudget',
    actor: 'Your agent',
    body: 'Write your budget onto the job. This is the step people skip: fund reverts ZeroBudget() without it, because the amount lives on the job rather than being a fund argument. You choose the number - no onchain price exists for an ERC-8004 agent, so nothing, Bazar included, can quote one.',
    emits: 'BudgetSet',
    accent: 'bg-cyan-400/10 text-cyan-300',
  },
  {
    icon: Banknote,
    title: 'approve → fund',
    actor: 'Your agent',
    body: 'fund pulls the budget with an ERC-20 transferFrom, so approve the kernel on the payment token first, then call fund(jobId, expectedBudget, optParams). expectedBudget asserts the stored budget rather than setting it - a mismatch reverts BudgetMismatch(). No BNB moves; value stays 0x0.',
    emits: 'Approval + JobFunded',
    accent: 'bg-sky-400/10 text-sky-300',
  },
  {
    icon: PackageCheck,
    title: 'submit',
    actor: 'The hired agent',
    body: 'The provider does the work and records a deliverable hash against the jobId. Bazar is not in this path at all - it introduced the two parties and stepped out.',
    emits: 'JobSubmitted',
    accent: 'bg-violet-400/10 text-violet-300',
  },
  {
    icon: ShieldCheck,
    title: 'complete',
    actor: 'Evaluator',
    body: 'The evaluator accepts the deliverable and the kernel releases the escrow to the provider in the same transaction - there is no separate "released" state to wait for. reject is the mirror path, and claimRefund(jobId) returns the budget once expiredAt passes with the escrow still held.',
    emits: 'JobCompleted + PaymentReleased',
    accent: 'bg-emerald-400/10 text-emerald-300',
  },
];

export interface JobFlowProps {
  calldata: string;
  selector: string;
  words: CalldataWord[];
  intentId: string;
  chainId: number;
  /** Live kernel and payment-token state, read while the page rendered. */
  kernel: DocsExamples['kernel'];
}

export function JobFlow({ calldata, selector, words, intentId, chainId, kernel }: JobFlowProps) {
  const deployment = getDeployment(chainId);
  const tokenSymbol = kernel.tokenSymbol;
  const tokenDecimals = kernel.tokenDecimals;

  return (
    <section id="settlement" className="scroll-mt-24">
      <SectionHeading
        eyebrow="Settlement - ERC-8183"
        title="From intent to payout, without a middleman"
        description="Bazar never custodies funds, never asks for a key and never quotes a price. It resolves the provider from the ERC-8004 Identity Registry, encodes the createJob transaction for the ERC-8183 AgenticCommerce kernel, and hands back the three calls that follow it with their ABI fragments. You send all four. Bazar sends none."
      />

      <ol className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <li key={step.title} className="glass relative flex flex-col rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-lg ring-1 ring-inset ring-white/10 ${step.accent}`}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="tabular font-mono text-xs text-slate-600">0{i + 1}</span>
              </div>
              <h3 className="mt-4 font-mono text-base font-semibold text-white">{step.title}</h3>
              <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">{step.actor}</p>
              <p className="mt-2.5 text-sm leading-relaxed text-slate-400">{step.body}</p>
              {step.emits && (
                <p className="mt-3 font-mono text-[11px] text-emerald-300/80">emits {step.emits}</p>
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        <div className="glass rounded-2xl p-5 sm:p-6">
          <h3 className="text-base font-semibold text-white">Inside createJob.calldata</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Intent <code className="font-mono text-cyan-300">{intentId}</code> encodes{' '}
            <code className="break-all font-mono text-slate-300">{ERC8183_FUNCTION_SIGNATURES.createJob}</code> with
            selector <code className="font-mono text-bnb-300">{selector}</code>. Five head words, then the dynamic{' '}
            <code className="font-mono text-slate-300">description</code> tail.
          </p>

          <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/[0.08] bg-ink/70 px-3 py-2">
            <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-slate-400">{calldata}</code>
            <CopyButton value={calldata} label="createJob calldata" />
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-white/[0.08]">
            <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
              <caption className="sr-only">Decoded createJob arguments</caption>
              <thead>
                <tr className="bg-white/[0.03] text-[11px] uppercase tracking-wider text-slate-500">
                  <th scope="col" className="px-3 py-2 font-medium">
                    Argument
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Word
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Meaning
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {words.map((w) => (
                  <tr key={w.label} className="align-top">
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <span className="font-mono text-[12px] text-cyan-300">{w.label}</span>
                      <span className="ml-1.5 font-mono text-[11px] text-emerald-300">{w.type}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="block max-w-[12rem] truncate font-mono text-[11px] text-slate-500" title={w.value}>
                        {w.value}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[13px] leading-relaxed text-slate-400">{w.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            Notice what is <span className="text-slate-300">not</span> in there: an amount. ERC-8183 separates job
            creation from funding precisely so the payer sets the budget. Intent ids are deterministic over
            (agent, payer, description, expiredAt), so re-posting the same body can never produce two jobs.
          </p>
        </div>

        <div className="glass rounded-2xl p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-white">Kernel &amp; token</h3>
            <Badge tone="gold" className="ml-auto">
              {deployment.name} · {deployment.chainId}
            </Badge>
          </div>

          <dl className="mt-4 space-y-3">
            {[
              {
                label: 'AgenticCommerce kernel',
                address: deployment.agenticCommerce,
                note: 'Holds the escrowed budget and releases it on complete.',
              },
              {
                label: 'EvaluatorRouter',
                address: deployment.evaluatorRouter,
                note: 'Default evaluator on every intent. Override it with the evaluator field.',
              },
              {
                label: 'OptimisticPolicy',
                address: deployment.optimisticPolicy,
                note: 'Settlement policy the kernel defers to when no evaluator acts.',
              },
              {
                label: `Payment token - ${PAYMENT_TOKEN_EIP712.name}`,
                address: deployment.paymentToken,
                note:
                  tokenSymbol && tokenDecimals !== null
                    ? `The ERC-20 every budget is denominated in: symbol ${tokenSymbol}, ${tokenDecimals} decimals, read off the token while this page rendered. A budget is never in BNB, and no transaction in this flow carries native value. Approve the kernel on it before calling fund.`
                    : 'The ERC-20 every budget is denominated in - never BNB. Bazar could not read its symbol and decimals while this page rendered and will not guess them; read symbol() and decimals() yourself. Approve the kernel on it before calling fund.',
              },
            ].map((row) => (
              <div key={row.label}>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{row.label}</dt>
                <dd>
                  <div className="mt-1 flex items-center gap-2 rounded-lg border border-white/[0.08] bg-ink/70 px-3 py-2">
                    <a
                      href={bscScanAddress(row.address, deployment.chainId)}
                      target="_blank"
                      rel="noreferrer"
                      className="min-w-0 flex-1 truncate font-mono text-xs text-slate-300 underline-offset-4 ring-focus hover:text-bnb hover:underline"
                      title={row.address}
                    >
                      {shortAddress(row.address, 8)}
                    </a>
                    <CopyButton value={row.address} label={`${row.label} address`} />
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{row.note}</p>
                </dd>
              </div>
            ))}
          </dl>

          <CodeBlock
            className="mt-4"
            code={SIGNATURES}
            lang="sol"
            title="ERC-8183 AgenticCommerce - signatures Bazar uses"
            copyLabel="ERC-8183 signatures"
            scroll="max-h-72"
          />

          <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-white/[0.08] bg-ink/50 p-3">
            {[
              {
                label: 'Kernel paused',
                value: kernel.paused === null ? 'unread' : kernel.paused ? 'yes' : 'no',
              },
              {
                label: 'Platform fee',
                value: kernel.platformFeeBP === null ? 'unread' : `${kernel.platformFeeBP} bp`,
              },
              { label: 'Jobs issued', value: kernel.jobCounter ?? 'unread' },
              {
                label: 'Expiry window',
                value: `${MIN_EXPIRY_SECONDS}s - ${MAX_EXPIRY_SECONDS}s`,
              },
            ].map((row) => (
              <div key={row.label}>
                <dt className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{row.label}</dt>
                <dd className="tabular mt-0.5 font-mono text-sm text-slate-200">{row.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            {kernel.read
              ? 'Read off the kernel while this page rendered. A 0 bp platform fee means the budget you fund is the budget the provider receives - there is no fee arithmetic to do.'
              : 'The kernel did not answer while this page rendered, so those four figures are marked unread rather than filled in. The expiry window is the bound the kernel enforces on expiredAt, measured from the block that mines createJob.'}
          </p>

          <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-slate-500">
            <Undo2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-600" aria-hidden />
            <span>
              <code className="font-mono text-slate-400">getJob(uint256)</code> is no longer listed for reference only.
              Bazar&apos;s ABI is the artifact the BNB Agent Studio SDK publishes, vendored verbatim, so the return
              tuple is the real one and Bazar calls it: <code className="font-mono text-slate-400">GET /api/v1/a2a/jobs/&#123;id&#125;</code>{' '}
              is that call. It reads on request only - there is no log listener behind it and no job history stored.
            </span>
          </p>

          <a
            href={ABI_SOURCE}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-bnb ring-focus hover:text-bnb-300"
          >
            Read the deployed kernel on BscScan
          </a>
        </div>
      </div>
    </section>
  );
}
