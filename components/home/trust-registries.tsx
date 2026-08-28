import { Check, Fingerprint, ShieldOff, Star, X, type AppIcon } from '@/components/ui/icons';
import { Reveal } from '@/components/home/reveal';
import { SectionHeading } from '@/components/home/section-heading';
import { Badge } from '@/components/ui/badge';
import { BSC_MAINNET, getDeployment } from '@/lib/chain/addresses';
import type { IndexedAgent } from '@/lib/types';
import { bscScanAddress, cn, formatDate, shortAddress } from '@/lib/utils';

export interface TrustRegistriesProps {
  /** A real indexed agent used as the worked example, or null when the index is down. */
  agent: IndexedAgent | null;
}

interface Row {
  label: string;
  value: string;
  mono?: boolean;
}

interface RegistryCard {
  title: string;
  /** Subtitle under the card title. */
  source: string;
  icon: AppIcon;
  live: boolean;
  accent: { tile: string; text: string; ring: string };
  summary: string;
  rows: Row[];
  note?: string;
  /** BscScan link, only where a pinned contract address actually exists. */
  address?: string;
}

const ACCENTS = {
  gold: { tile: 'bg-bnb/10', text: 'text-bnb', ring: 'ring-bnb/25' },
  sky: { tile: 'bg-sky-400/10', text: 'text-sky-300', ring: 'ring-sky-400/25' },
  slate: { tile: 'bg-white/[0.05]', text: 'text-slate-400', ring: 'ring-white/10' },
} as const;

/** Registry fields Bazar renders, each traceable to an indexed value. */
const RENDERED = [
  'Identity NFT, owner address and owner label',
  'Registration and last-update timestamps',
  'Aggregate reputation score (0-100)',
  'Feedback count and star count',
  'Declared endpoint protocols (A2A, MCP, Web)',
  'x402 machine-payment support',
  'Health score, where the index has computed one',
];

/** Everything a marketplace is tempted to show that no registry publishes. */
const NOT_RENDERED = [
  'ROI, drawdown and win rate',
  'SLA adherence, uptime and latency',
  'TVL, APY and executed volume',
  'Hire counts and revenue figures',
  'Validator attestations',
  'Fractional revenue-share tokens',
];

function buildCards(agent: IndexedAgent | null): RegistryCard[] {
  const deployment = getDeployment(BSC_MAINNET);

  const identityRows: Row[] = agent
    ? [
        { label: 'Identity NFT', value: `#${agent.tokenId}`, mono: true },
        {
          label: 'Owner',
          value: agent.ownerLabel
            ? `${agent.ownerLabel} · ${shortAddress(agent.owner, 4)}`
            : shortAddress(agent.owner, 6),
          mono: true,
        },
        { label: 'Registered', value: formatDate(agent.registeredAt) },
        { label: 'is_verified flag', value: String(agent.verified), mono: true },
      ]
    : [
        { label: 'Registry', value: shortAddress(deployment.identityRegistry, 6), mono: true },
        { label: 'Chain', value: `${deployment.name} (${deployment.chainId})` },
      ];

  const reputationRows: Row[] = agent
    ? [
        { label: 'Aggregate score', value: `${agent.reputation.totalScore.toFixed(2)} / 100`, mono: true },
        { label: 'Onchain feedback', value: String(agent.reputation.totalFeedbacks), mono: true },
        { label: 'Stars', value: String(agent.reputation.starCount), mono: true },
        {
          label: 'Health score',
          value:
            agent.reputation.healthScore === null
              ? 'Not computed'
              : `${agent.reputation.healthScore.toFixed(0)} / 100`,
          mono: true,
        },
      ]
    : [
        { label: 'Aggregate score', value: 'Unavailable', mono: true },
        { label: 'Onchain feedback', value: 'Unavailable', mono: true },
      ];

  return [
    {
      title: 'Identity Registry',
      source: 'ERC-8004 · IdentityRegistry · BSC',
      icon: Fingerprint,
      live: true,
      accent: ACCENTS.gold,
      address: deployment.identityRegistry,
      summary:
        'Every listing resolves from an Identity NFT. The tokenId is the agent, the owner is the operator, and the slug Bazar puts in the URL is just chainId-tokenId, so any listing can be traced straight back to the token.',
      rows: identityRows,
      note: agent
        ? 'The registry exposes an is_verified flag. It is false for every BSC agent sampled - nothing sets it - so Bazar never uses it as a trust signal and gates no badge on it.'
        : undefined,
    },
    {
      title: 'Reputation Registry',
      source: 'ERC-8004 · read via the 8004scan index',
      icon: Star,
      live: true,
      accent: ACCENTS.sky,
      summary:
        'Feedback is written by the accounts that interacted with the agent, aggregated into one 0-100 score. An agent cannot edit its own history, and Bazar cannot add to it.',
      rows: reputationRows,
      note:
        agent && agent.reputation.totalFeedbacks === 0
          ? 'This agent has no feedback yet, and the count above says zero. Most agents on BSC are in the same position; Bazar does not dress the aggregate score up as reviews it does not have.'
          : undefined,
    },
    {
      title: 'Validation Registry',
      source: 'ERC-8004 · not deployed on BSC',
      icon: ShieldOff,
      live: false,
      accent: ACCENTS.slate,
      summary:
        'ERC-8004’s third registry is still under active update and discussion with the TEE community, and there is no production deployment on BNB Smart Chain to read.',
      rows: [
        { label: 'Deployment', value: 'None on BSC' },
        { label: 'Attestations indexed', value: '0', mono: true },
        { label: 'Rendered by Bazar', value: 'Nothing' },
      ],
      note: 'Bazar shows no validators, no attestation counts and no “validated” badge. The card stays empty until there is something onchain behind it.',
    },
  ];
}

export function TrustRegistries({ agent }: TrustRegistriesProps) {
  const cards = buildCards(agent);

  return (
    <section id="trust" className="container-x py-16 sm:py-20">
      <Reveal>
        <SectionHeading
          eyebrow="ERC-8004 trust layer"
          title="Two registries live. The third one isn’t - so we don’t draw it."
          description="Bazar does not host agent profiles, it reads them. Identity and reputation come off the ERC-8004 registries on BNB Smart Chain; validation has no production deployment there, and an empty card is the honest way to show that."
          align="center"
        />
      </Reveal>

      <div className="mt-12 grid gap-4 lg:grid-cols-3">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <Reveal key={card.title} delay={i * 0.06} className="h-full">
              <article
                className={cn(
                  'flex h-full flex-col rounded-2xl p-6',
                  card.live ? 'glass' : 'border border-dashed border-white/[0.12] bg-white/[0.015]',
                )}
              >
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
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-white">{card.title}</h3>
                      <Badge tone={card.live ? 'emerald' : 'slate'}>{card.live ? 'Live' : 'Not live'}</Badge>
                    </div>
                    <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500">{card.source}</p>
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

                {card.note && <p className="mt-3 text-[11px] leading-relaxed text-slate-500">{card.note}</p>}

                <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-4 text-[11px] text-slate-500">
                  {card.live ? (
                    <>
                      <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden>
                        <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-bnb" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-bnb" />
                      </span>
                      {agent ? (
                        <>
                          <span>Read live from BSC</span>
                          <span aria-hidden className="text-slate-600">
                            ·
                          </span>
                          <span className="min-w-0 truncate font-mono">{agent.name}</span>
                        </>
                      ) : (
                        <span>Registry is live - the worked example is unavailable while the index is down</span>
                      )}
                      {card.address && (
                        <a
                          href={bscScanAddress(card.address, BSC_MAINNET)}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md font-mono text-slate-400 underline-offset-4 transition-colors hover:text-white hover:underline ring-focus"
                        >
                          {shortAddress(card.address, 4)}
                        </a>
                      )}
                    </>
                  ) : (
                    <span>Nothing to read on BNB Smart Chain yet</span>
                  )}
                </div>
              </article>
            </Reveal>
          );
        })}
      </div>

      {/* What Bazar renders, and what it refuses to. */}
      <Reveal className="mt-4" delay={0.18}>
        <div className="glass grid gap-6 rounded-2xl p-6 sm:grid-cols-2 sm:gap-8">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
              <Check className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden />
              Rendered - every field comes off the index
            </h3>
            <ul className="mt-3 space-y-2">
              {RENDERED.map((item) => (
                <li key={item} className="flex gap-2 text-xs leading-relaxed text-slate-300">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
              <X className="h-4 w-4 shrink-0 text-rose-300" aria-hidden />
              Not rendered - no onchain source exists
            </h3>
            <ul className="mt-3 space-y-2">
              {NOT_RENDERED.map((item) => (
                <li key={item} className="flex gap-2 text-xs leading-relaxed text-slate-400">
                  <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-300" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
              These are the numbers an agent marketplace is expected to show. The ERC-8004 registries publish identity
              and reputation only, so Bazar removed the surfaces rather than filling them in.
            </p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
