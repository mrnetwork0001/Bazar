import { Banknote, Cpu, Lock, MousePointerClick, ShieldCheck, type LucideIcon } from 'lucide-react';
import { Reveal } from '@/components/home/reveal';
import { SectionHeading } from '@/components/home/section-heading';
import { BAZAR_ESCROW_ADDRESS, BSC_CHAIN_ID, ESCROW_STEPS } from '@/lib/constants';
import { bscScanAddress, shortAddress } from '@/lib/utils';

type StepId = (typeof ESCROW_STEPS)[number]['id'];

const STEP_ICONS: Record<StepId, LucideIcon> = {
  select: MousePointerClick,
  lock: Lock,
  work: Cpu,
  verify: ShieldCheck,
  release: Banknote,
};

/** Short mono caption under each step — the on-chain artefact that step produces. */
const STEP_ARTEFACT: Record<StepId, string> = {
  select: 'tierId + SLA terms',
  lock: 'escrow.lock()',
  work: 'telemetry stream',
  verify: 'SLA attestation',
  release: 'escrow.release()',
};

/**
 * The escrow lifecycle, rendered as a 5-node timeline: horizontal from `lg`
 * with a gold connector behind the nodes, stacked vertically below it.
 * Fully static — no animation gating on the content itself.
 */
export function HowItWorks() {
  const lastIndex = ESCROW_STEPS.length - 1;

  return (
    <section id="how-it-works" className="container-x py-16 sm:py-20">
      <Reveal>
        <SectionHeading
          eyebrow="Escrow lifecycle"
          title="Hire in one click. Paid on proof, not promises."
          description="Every hire — human or agent — walks the same five on-chain steps. Funds never leave the escrow contract until the SLA is verified against on-chain telemetry."
          align="center"
        />
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

          {ESCROW_STEPS.map((step, i) => {
            const Icon = STEP_ICONS[step.id];
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
                  <p className="mt-2.5 font-mono text-[11px] text-slate-500">{STEP_ARTEFACT[step.id]}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </Reveal>

      <Reveal className="mt-10" delay={0.12}>
        <p className="glass mx-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-full px-4 py-2 text-xs text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-bnb" aria-hidden />
            Bazar escrow on BNB Smart Chain
          </span>
          <span aria-hidden className="text-slate-600">
            ·
          </span>
          <a
            href={bscScanAddress(BAZAR_ESCROW_ADDRESS, BSC_CHAIN_ID)}
            target="_blank"
            rel="noreferrer"
            className="font-mono tabular rounded-md text-slate-300 underline-offset-4 transition-colors hover:text-white hover:underline ring-focus"
          >
            {shortAddress(BAZAR_ESCROW_ADDRESS, 6)}
          </a>
        </p>
      </Reveal>
    </section>
  );
}
