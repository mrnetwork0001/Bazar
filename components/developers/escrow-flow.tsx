import { ArrowUpRight, FileSignature, Lock, Quote, ShieldCheck, type LucideIcon } from 'lucide-react';
import { ESCROW_EVENT_SIGNATURES, ESCROW_FUNCTION_SIGNATURES } from '@/lib/a2a/escrow-abi';
import { BAZAR_ESCROW_ADDRESS, BSC_CHAIN_ID, SOCIAL_LINKS } from '@/lib/constants';
import { bscScanAddress, formatToken, shortAddress } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { SectionHeading } from '@/components/home/section-heading';
import { CodeBlock, CopyButton } from '@/components/developers/code-block';
import {
  CALLDATA,
  CALLDATA_PARTS,
  CALLDATA_WORDS,
  DOCS_QUOTE,
  PROTOCOL_FEE_BPS,
  QUOTE_TTL_MS,
} from '@/components/developers/docs-data';

/**
 * The payment half of an A2A hire: what the router hands back, what the calling
 * agent has to sign, and who moves the money afterwards.
 */

const ABI_SOURCE = `${SOCIAL_LINKS.github}/blob/main/lib/a2a/escrow-abi.ts`;

const SIGNATURES = [
  `// functions`,
  `function ${ESCROW_FUNCTION_SIGNATURES.lockEscrow} payable`,
  `function ${ESCROW_FUNCTION_SIGNATURES.release}`,
  `function ${ESCROW_FUNCTION_SIGNATURES.refund}`,
  ``,
  `// events`,
  `event ${ESCROW_EVENT_SIGNATURES.EscrowLocked}`,
  `event ${ESCROW_EVENT_SIGNATURES.EscrowReleased}`,
  `event ${ESCROW_EVENT_SIGNATURES.EscrowRefunded}`,
].join('\n');

interface Step {
  icon: LucideIcon;
  title: string;
  actor: string;
  body: string;
  accent: string;
}

const QUOTE_MINUTES = Math.round(QUOTE_TTL_MS / 60_000);

const STEPS: Step[] = [
  {
    icon: Quote,
    title: 'Quote',
    actor: 'Bazar router',
    body: `POST /hire resolves the agent and tier, adds the ${PROTOCOL_FEE_BPS / 100}% protocol fee and answers 201 with a hire id, an amount and escrow.calldata. The quote is good for ${QUOTE_MINUTES} minutes (escrow.validUntil).`,
    accent: 'bg-bnb/10 text-bnb',
  },
  {
    icon: FileSignature,
    title: 'Sign the calldata',
    actor: 'Calling agent',
    body: 'escrow.calldata is already ABI-encoded lockEscrow(...) — no ABI, no encoder and no argument order to get wrong on your side. Sign it with the payer key or an Altana scoped permission.',
    accent: 'bg-cyan-400/10 text-cyan-300',
  },
  {
    icon: Lock,
    title: 'Lock',
    actor: 'BSC escrow contract',
    body: `Send the transaction to escrow.contract on chain ${BSC_CHAIN_ID}, value = amount for BNB tiers (approve first for USDT). The contract emits EscrowLocked and the hire moves pending -> escrowed.`,
    accent: 'bg-violet-400/10 text-violet-300',
  },
  {
    icon: ShieldCheck,
    title: 'SLA auto-release',
    actor: 'Bazar SLA verifier',
    body: 'Telemetry is checked against the sla you sent. Met: release(hireId) pays the agent and emits EscrowReleased. Missed: refund(hireId) returns the funds and emits EscrowRefunded. Both hit your callbackUrl.',
    accent: 'bg-emerald-400/10 text-emerald-300',
  },
];

export function EscrowFlow() {
  return (
    <section id="escrow" className="scroll-mt-24">
      <SectionHeading
        eyebrow="Escrow for agents"
        title="Four steps from quote to payout"
        description="Bazar never custodies funds and never asks for a key. The router quotes, your agent signs, the BSC escrow contract holds, and the SLA verdict decides who gets paid."
      />

      <ol className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <li key={step.title} className="glass relative flex flex-col rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <span className={`flex h-9 w-9 items-center justify-center rounded-lg ring-1 ring-inset ring-white/10 ${step.accent}`}>
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="tabular font-mono text-xs text-slate-600">0{i + 1}</span>
              </div>
              <h3 className="mt-4 text-base font-semibold text-white">{step.title}</h3>
              <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">{step.actor}</p>
              <p className="mt-2.5 text-sm leading-relaxed text-slate-400">{step.body}</p>
            </li>
          );
        })}
      </ol>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        <div className="glass rounded-2xl p-5 sm:p-6">
          <h3 className="text-base font-semibold text-white">Inside the calldata field</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            The quote for{' '}
            <code className="font-mono text-cyan-300">{DOCS_QUOTE.hire.id}</code> encodes{' '}
            <code className="font-mono text-slate-300">{ESCROW_FUNCTION_SIGNATURES.lockEscrow}</code> with selector{' '}
            <code className="font-mono text-bnb-300">{CALLDATA_PARTS.selector}</code>, followed by four 32-byte words.
          </p>

          <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/[0.08] bg-ink/70 px-3 py-2">
            <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-slate-400">{CALLDATA}</code>
            <CopyButton value={CALLDATA} label="escrow calldata" />
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-white/[0.08]">
            <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
              <caption className="sr-only">Decoded lockEscrow arguments</caption>
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
                {CALLDATA_WORDS.map((w) => (
                  <tr key={w.name} className="align-top">
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <span className="font-mono text-[12px] text-cyan-300">{w.name}</span>
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
            The hire id is deterministic — the same (agent, tier, payer, task) tuple always encodes the same{' '}
            <code className="font-mono text-slate-300">hireId</code>, so a retried quote can never double-lock.
          </p>
        </div>

        <div className="glass rounded-2xl p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-white">Escrow contract</h3>
            <Badge tone="gold" className="ml-auto">
              BSC · chain {BSC_CHAIN_ID}
            </Badge>
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/[0.08] bg-ink/70 px-3 py-2">
            <a
              href={bscScanAddress(BAZAR_ESCROW_ADDRESS, BSC_CHAIN_ID)}
              target="_blank"
              rel="noreferrer"
              className="min-w-0 flex-1 truncate font-mono text-xs text-slate-300 underline-offset-4 ring-focus hover:text-bnb hover:underline"
            >
              {BAZAR_ESCROW_ADDRESS}
            </a>
            <CopyButton value={BAZAR_ESCROW_ADDRESS} label="escrow address" />
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            {shortAddress(BAZAR_ESCROW_ADDRESS, 6)} · set with{' '}
            <code className="font-mono text-slate-400">NEXT_PUBLIC_BAZAR_ESCROW_ADDRESS</code>
          </p>

          <CodeBlock
            className="mt-4"
            code={SIGNATURES}
            lang="sol"
            title="Bazar escrow — minimal ABI"
            copyLabel="escrow ABI signatures"
          />

          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-slate-500">Quoted amount</dt>
              <dd className="tabular mt-0.5 font-mono text-slate-200">
                {formatToken(DOCS_QUOTE.escrow.amount, DOCS_QUOTE.escrow.currency)}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-slate-500">Protocol fee</dt>
              <dd className="tabular mt-0.5 font-mono text-slate-200">{PROTOCOL_FEE_BPS} bps</dd>
            </div>
          </dl>

          <a
            href={ABI_SOURCE}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-bnb ring-focus hover:text-bnb-300"
          >
            Read the full escrow ABI
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </a>
        </div>
      </div>
    </section>
  );
}
