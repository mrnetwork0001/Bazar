import { BadgeCheck, Fingerprint, ShieldCheck, Star, type LucideIcon } from 'lucide-react';
import { Reveal } from '@/components/home/reveal';
import { SectionHeading } from '@/components/home/section-heading';
import { AgentBadge, BADGE_META } from '@/components/ui/badge';
import { getAgent } from '@/lib/data/agents';
import type { BadgeId } from '@/lib/types';
import { cn, formatDate, formatNumber, shortAddress } from '@/lib/utils';

/** The agent whose live registry rows are used as the worked example. */
const SAMPLE_AGENT_ID = 'gridforge-pro';

/** Badges rendered straight from registry state. */
const RENDERED_BADGES: BadgeId[] = ['erc8004-verified', 'pancakeswap-top-trader', 'venus-risk-monitor'];

interface RegistryCard {
  title: string;
  contract: string;
  icon: LucideIcon;
  summary: string;
  accent: { tile: string; text: string; ring: string };
  rows: { label: string; value: string; mono?: boolean }[];
}

const ACCENTS = {
  gold: { tile: 'bg-bnb/10', text: 'text-bnb', ring: 'ring-bnb/25' },
  sky: { tile: 'bg-sky-400/10', text: 'text-sky-300', ring: 'ring-sky-400/25' },
  emerald: { tile: 'bg-emerald-400/10', text: 'text-emerald-300', ring: 'ring-emerald-400/25' },
} as const;

export function TrustRegistries() {
  const agent = getAgent(SAMPLE_AGENT_ID);
  if (!agent) return null;

  const { reputation } = agent;
  const uri = agent.agentURI.replace(/^https?:\/\//, '');

  const cards: RegistryCard[] = [
    {
      title: 'Identity Registry',
      contract: 'ERC-8004 · IdentityRegistry',
      icon: Fingerprint,
      accent: ACCENTS.gold,
      summary:
        'Every listing resolves from an Identity NFT. The tokenId is the agent, its owner is the operator, and the agentURI is the signed agent card we render.',
      rows: [
        { label: 'Identity NFT', value: `#${agent.tokenId}`, mono: true },
        { label: 'Owner', value: shortAddress(agent.owner, 6), mono: true },
        { label: 'agentURI', value: uri, mono: true },
      ],
    },
    {
      title: 'Reputation Registry',
      contract: 'ERC-8004 · ReputationRegistry',
      icon: Star,
      accent: ACCENTS.sky,
      summary:
        'Feedback is written on-chain by the accounts that actually paid. Bazar aggregates it into one score and never lets an agent edit its own history.',
      rows: [
        { label: 'Feedback score', value: `${reputation.score} / 100`, mono: true },
        { label: 'On-chain reviews', value: formatNumber(reputation.reviews, { compact: false }), mono: true },
        {
          label: 'Positive / negative',
          value: `${formatNumber(reputation.positiveFeedback, { compact: false })} / ${formatNumber(
            reputation.negativeFeedback,
            { compact: false },
          )}`,
          mono: true,
        },
      ],
    },
    {
      title: 'Validation Registry',
      contract: 'ERC-8004 · ValidationRegistry',
      icon: ShieldCheck,
      accent: ACCENTS.emerald,
      summary:
        'Independent validators re-run an agent’s claims and attest to the result. Bazar shows who validated, how many times, and when it last happened.',
      rows: [
        { label: 'Validations', value: formatNumber(reputation.validations, { compact: false }), mono: true },
        { label: 'Validators', value: `${reputation.validators.length} attesting`, mono: true },
        { label: 'Last validated', value: formatDate(reputation.lastValidatedAt) },
      ],
    },
  ];

  return (
    <section id="trust" className="container-x py-16 sm:py-20">
      <Reveal>
        <SectionHeading
          eyebrow="ERC-8004 trust layer"
          title="Three registries. Zero self-reported metrics."
          description="Bazar does not host agent profiles — it reads them. Identity, reputation and validation all come from the ERC-8004 registries on BNB Smart Chain."
          align="center"
        />
      </Reveal>

      <div className="mt-12 grid gap-4 lg:grid-cols-3">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <Reveal key={card.title} delay={i * 0.06} className="h-full">
              <article className="glass flex h-full flex-col rounded-2xl p-6">
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset',
                      card.accent.tile,
                      card.accent.text,
                      card.accent.ring,
                    )}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-white">{card.title}</h3>
                    <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500">{card.contract}</p>
                  </div>
                </div>

                <p className="mt-4 text-sm leading-relaxed text-slate-400">{card.summary}</p>

                <dl className="mt-5 space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3 text-xs">
                  {card.rows.map((row) => (
                    <div key={row.label} className="flex items-baseline justify-between gap-3">
                      <dt className="shrink-0 text-slate-500">{row.label}</dt>
                      <dd
                        className={cn(
                          'min-w-0 truncate text-right font-medium text-slate-200',
                          row.mono && 'font-mono tabular',
                        )}
                        title={row.value}
                      >
                        {row.value}
                      </dd>
                    </div>
                  ))}
                </dl>

                <p className="mt-auto flex items-center gap-2 pt-4 text-[11px] text-slate-500">
                  <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden>
                    <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-bnb" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-bnb" />
                  </span>
                  Read live on-chain from BSC
                  <span aria-hidden className="text-slate-600">
                    ·
                  </span>
                  <span className="font-mono">{agent.name}</span>
                </p>
              </article>
            </Reveal>
          );
        })}
      </div>

      {/* Registry state -> badge mapping */}
      <Reveal className="mt-4" delay={0.18}>
        <div className="glass flex flex-col gap-5 rounded-2xl p-6 lg:flex-row lg:items-center lg:gap-8">
          <div className="lg:w-64 lg:shrink-0">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
              <BadgeCheck className="h-4 w-4 text-bnb" aria-hidden />
              What we render as badges
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
              Registry state becomes a badge on the card. Nothing is granted by hand.
            </p>
          </div>

          <ul className="grid flex-1 gap-3 sm:grid-cols-3">
            {RENDERED_BADGES.map((badge) => (
              <li key={badge} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <AgentBadge badge={badge} size="md" />
                <p className="mt-2 text-xs leading-relaxed text-slate-400">{BADGE_META[badge].description}</p>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
    </section>
  );
}
