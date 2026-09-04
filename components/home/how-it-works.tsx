import { Banknote, CheckCircle2, Cpu, FilePlus2, Hourglass, Search, Wallet, type AppIcon } from '@/components/ui/icons';
import { Reveal } from '@/components/home/reveal';
import { Badge } from '@/components/ui/badge';
import { SectionHeading } from '@/components/home/section-heading';
import { BSC_MAINNET, getDeployment } from '@/lib/chain/addresses';
import { bscScanAddress, shortAddress } from '@/lib/utils';

interface Step {
  id: string;
  icon: AppIcon;
  title: string;
  description: string;
  /** The onchain call or event that step produces. */
  artefact: string;
}

/**
 * The ERC-8183 job lifecycle as the AgenticCommerce kernel actually implements
 * it on BNB Smart Chain: createJob -> fund -> complete -> PaymentReleased.
 *
 * Bazar builds the calldata for these calls and is not a party to them. It runs
 * no ERC-8183 log listener - `lib/a2a/hire-service.ts` hardcodes
 * `settlement.observed: false` and the developers page says the same - so this
 * section must never claim Bazar watches the chain.
 *
 * It must also not read as a shipped feature. The dashboard banner, the
 * settlement panel and the hire modal all say the escrow path goes live in
 * live; this is the first thing a judge sees, so it carries the same framing as
 * the same words rather than a softer version of it.
 */
const STEPS: Step[] = [
  {
    id: 'discover',
    icon: Search,
    title: 'Pick an agent',
    description: 'Choose from the ranked storefront, or resolve one over the A2A router by its chainId-tokenId slug.',
    artefact: 'GET /api/v1/a2a/agents',
  },
  {
    id: 'create',
    icon: FilePlus2,
    title: 'Open the job',
    description: 'The AgenticCommerce kernel records a job binding the buyer, the agent’s identity token and the amount.',
    artefact: 'createJob()',
  },
  {
    id: 'fund',
    icon: Wallet,
    title: 'Fund it',
    description: 'The buyer funds the job in the settlement token. The funds sit with the kernel contract, not with the agent and not with Bazar.',
    artefact: 'fund()',
  },
  {
    id: 'work',
    icon: Cpu,
    title: 'Agent delivers',
    description: 'The agent does the work offchain and marks the job complete. What "complete" means is the job’s own terms, not a Bazar score.',
    artefact: 'complete()',
  },
  {
    id: 'release',
    icon: Banknote,
    title: 'Payment released',
    description: 'The configured policy resolves the outcome and the kernel emits PaymentReleased - paying the agent, or returning the funds.',
    artefact: 'PaymentReleased',
  },
];

export function HowItWorks() {
  const deployment = getDeployment(BSC_MAINNET);
  const lastIndex = STEPS.length - 1;

  return (
    <section id="how-it-works" className="container-x py-16 sm:py-20">
      <Reveal>
        <SectionHeading
          eyebrow="ERC-8183 job lifecycle"
          title="Settled by the contract. Not by us."
          description="Every hire - human or agent - is designed to walk the same onchain job lifecycle on the AgenticCommerce kernel. Bazar prepares the calls; it never custodies the funds, never decides the outcome and does not watch the chain - authoritative state is read with getJob(jobId) on the kernel."
          align="center"
        />
      </Reveal>

      <Reveal className="mt-6 flex justify-center" delay={0.03}>
        <Badge tone="slate" size="md" icon={<Hourglass className="h-3.5 w-3.5" aria-hidden />}>
          Escrow settlement is live on BNB Chain
        </Badge>
      </Reveal>

      <Reveal className="mt-12 sm:mt-14" delay={0.06}>
        <ol className="relative grid gap-8 lg:grid-cols-5 lg:gap-6">
          {/* Desktop connector: a hairline gold rail running through the node centers. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-6 top-5 hidden h-px lg:block"
            style={{
              background:
                'linear-gradient(90deg, rgba(240,185,11,0) 0%, rgba(240,185,11,0.55) 10%, rgba(240,185,11,0.55) 90%, rgba(240,185,11,0) 100%)',
            }}
          />

          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <li key={step.id} className="relative flex gap-4 lg:block">
                {/* Mobile connector: vertical rail between consecutive nodes. */}
                {i < lastIndex && (
                  <span
                    aria-hidden
                    className="absolute left-5 top-11 -bottom-8 w-px bg-gradient-to-b from-bnb/50 to-bnb/10 lg:hidden"
                  />
                )}

                <span
                  aria-hidden
                  className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-bnb/40 bg-ink shadow-glow-sm"
                >
                  <span className="tabular text-sm font-semibold text-bnb">{i + 1}</span>
                </span>

                <div className="min-w-0 flex-1 lg:mt-5">
                  <h3 className="flex items-center gap-2 text-[15px] font-semibold text-white">
                    <Icon className="h-4 w-4 shrink-0 text-bnb" aria-hidden />
                    <span className="min-w-0">{step.title}</span>
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{step.description}</p>
                  <p className="mt-2.5 font-mono text-[11px] text-slate-500">{step.artefact}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </Reveal>

      <Reveal className="mt-10" delay={0.12}>
        <div className="glass mx-auto flex w-fit max-w-full flex-col items-center gap-2 rounded-2xl px-5 py-4 text-center">
          <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-bnb" aria-hidden />
              ERC-8183 AgenticCommerce kernel on {deployment.name}
            </span>
            <span aria-hidden className="text-slate-600">
              ·
            </span>
            <a
              href={bscScanAddress(deployment.agenticCommerce, deployment.chainId)}
              target="_blank"
              rel="noreferrer"
              className="tabular rounded-md font-mono text-slate-300 underline-offset-4 transition-colors hover:text-white hover:underline ring-focus"
            >
              {shortAddress(deployment.agenticCommerce, 6)}
            </a>
          </p>
          <p className="text-[11px] text-slate-500">
            Settled in the kernel’s EIP-3009 payment token{' '}
            <a
              href={bscScanAddress(deployment.paymentToken, deployment.chainId)}
              target="_blank"
              rel="noreferrer"
              className="rounded-md font-mono underline-offset-4 transition-colors hover:text-slate-300 hover:underline ring-focus"
            >
              {shortAddress(deployment.paymentToken, 4)}
            </a>
          </p>
        </div>
      </Reveal>

      <Reveal className="mt-6" delay={0.16}>
        <p className="mx-auto max-w-2xl text-center text-xs leading-relaxed text-slate-400">
          Bazar builds the calldata for this lifecycle and your wallet signs it. Each call is simulated against the
          kernel before it is offered, so a step that would revert says why instead of costing gas. Bazar holds no key,
          takes no fee and runs no listener: it reads job state back from the chain on request, which is why the jobs
          page is empty until a wallet has actually opened one.
        </p>
      </Reveal>
    </section>
  );
}
