import Link from 'next/link';
import { ArrowRight, Network, Star } from '@/components/ui/icons';
import { CodeBlock, Terminal } from '@/components/home/code';
import { Badge } from '@/components/ui/badge';
import { CATEGORY_MAP } from '@/lib/data/categories';
import type { IndexedAgent } from '@/lib/types';
import { cn, formatNumber } from '@/lib/utils';

export interface HeroShowcaseProps {
  /** The top-ranked indexed agent, or null when the index is unreachable. */
  agent: IndexedAgent | null;
  /** Index-wide total behind the ranked listing. */
  total: number;
  degraded: boolean;
}

function PulseDot() {
  return (
    <span className="relative flex h-2 w-2" aria-hidden>
      <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-bnb" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-bnb" />
    </span>
  );
}

/** JSON-safe string literal, so an agent name with a quote cannot break the snippet. */
function q(value: string): string {
  return JSON.stringify(value);
}

/**
 * An excerpt of the real `GET /api/v1/a2a/agents/{slug}` body, in the shape the
 * route actually returns (`toAgentSummary` in lib/a2a/schema.ts).
 *
 * Two details are load-bearing and must not be "tidied": `category` is nested
 * under `bazar` with `categoryInferred` beside it, because ERC-8004 has no
 * category field and flattening it next to `owner` and `tokenId` would imply the
 * registry published it; and `rank` is printed even when null, because it is
 * null on every listing row the index serves. Values come from the agent's own
 * record - nothing here is written by hand.
 */
function buildResponse(agent: IndexedAgent): string {
  const { reputation: r } = agent;
  return `HTTP/1.1 200 OK

{
  "ok": true,
  "data": {
    "slug": ${q(agent.slug)},
    "name": ${q(agent.name)},
    "chainId": ${agent.chainId},
    "tokenId": ${q(agent.tokenId)},
    "registry": ${q(agent.registry)},
    "protocols": [${agent.protocols.map(q).join(', ')}],
    "x402": ${agent.x402},
    "reputation": {
      "totalScore": ${r.totalScore},
      "totalFeedbacks": ${r.totalFeedbacks},
      "starCount": ${r.starCount},
      "rank": ${r.rank ?? 'null'}
    },
    "bazar": {
      "category": ${q(agent.category)},
      "categoryInferred": ${agent.categoryConfidence === 'unclassified'}
    }
  }
}`;
}

const DEGRADED_RESPONSE = `HTTP/1.1 503 Service Unavailable

{
  "ok": false,
  "error": {
    "code": "INDEX_UNAVAILABLE",
    "message": "The ERC-8004 index is unreachable. Bazar returns nothing rather than a cached guess."
  }
}`;

/**
 * The hero composition: a real A2A router request against the top-ranked
 * indexed agent, with that agent's card floating out of the terminal. Every
 * value in the snippet is the agent's own registry data, in the field layout
 * the route really returns - nothing is written by hand. Renders complete
 * without JS; the float is a transform-only loop.
 */
export function HeroShowcase({ agent, total, degraded }: HeroShowcaseProps) {
  const path = agent ? `/api/v1/a2a/agents/${agent.slug}` : '/api/v1/a2a/agents?sort=reputation&limit=1';
  const request = `GET ${path} HTTP/1.1
Accept: application/json`;

  return (
    <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-6 rounded-[2.5rem] bg-gold-radial opacity-70 blur-2xl"
      />

      <div className="relative lg:pl-8">
        <Terminal
          title={`bazar a2a-router · GET ${agent ? '/agents/:slug' : '/agents'}`}
          aside={
            <Badge tone="violet" icon={<Network className="h-3 w-3" aria-hidden />}>
              A2A
            </Badge>
          }
          bodyClassName={agent ? 'pb-16 sm:pb-20' : undefined}
        >
          <CodeBlock code={request} />
          <div className="my-3 flex items-center gap-3" aria-hidden>
            <span className="h-px flex-1 bg-white/[0.08]" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500">response</span>
            <span className="h-px flex-1 bg-white/[0.08]" />
          </div>
          <CodeBlock code={agent ? buildResponse(agent) : DEGRADED_RESPONSE} />
        </Terminal>

        <div className="absolute -top-3 right-3 z-20 sm:right-5">
          <Badge tone="gold" size="md" className="bg-ink/90 shadow-glow-sm" icon={<PulseDot />}>
            {degraded ? 'Index unreachable' : `${formatNumber(total, { compact: false })} agents indexed`}
          </Badge>
        </div>

        {agent ? (
          <div className="relative z-10 -mt-12 w-full max-w-[340px] animate-float sm:-mt-14 lg:-ml-8">
            <div className="absolute -top-3 left-4 z-20">
              <Badge tone="emerald" size="md" className="bg-ink/90" icon={<Star className="h-3 w-3" aria-hidden />}>
                Top of the reputation ranking
              </Badge>
            </div>
            <ShowcaseCard agent={agent} />
          </div>
        ) : (
          <p className="mt-4 text-xs leading-relaxed text-slate-500">
            The ERC-8004 index is not answering right now, so no agent is shown here. Bazar renders an empty shelf
            rather than stale data.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * A compact, home-only agent card. Deliberately independent of the
 * marketplace AgentCard: it carries the hero's own emphasis (reputation and
 * declared endpoints) and must not shift when the marketplace card changes.
 */
function ShowcaseCard({ agent }: { agent: IndexedAgent }) {
  const category = CATEGORY_MAP[agent.category];
  const { reputation: r } = agent;
  const protocols = agent.protocols.slice(0, 3);

  return (
    <Link
      href={`/agents/${agent.slug}`}
      aria-label={`View ${agent.name}, ERC-8004 reputation score ${r.totalScore.toFixed(2)} out of 100, ${r.totalFeedbacks} feedback ${r.totalFeedbacks === 1 ? 'entry' : 'entries'}`}
      className="glass-strong group block rounded-2xl p-4 transition-all duration-300 hover:border-bnb/40 hover:bg-white/[0.07] ring-focus"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            'flex h-11 w-11 shrink-0 select-none items-center justify-center rounded-xl bg-gradient-to-br text-xs font-bold tracking-wide text-white ring-1 ring-inset ring-white/20',
            agent.avatar.gradient,
          )}
        >
          {agent.avatar.initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{agent.name}</p>
          <p className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
            <span className="truncate" style={{ color: category.accentHex }}>
              {category.shortName}
            </span>
            <span aria-hidden className="text-slate-600">
              ·
            </span>
            <span className="tabular truncate text-slate-500">#{agent.tokenId}</span>
          </p>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 divide-x divide-white/[0.06] rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <div className="min-w-0 px-3 py-2">
          <dt className="truncate text-[10px] font-medium uppercase tracking-wider text-slate-500">Reputation</dt>
          <dd className="tabular mt-0.5 text-sm font-semibold text-white">
            {r.totalScore.toFixed(2)}
            <span className="text-xs font-normal text-slate-500"> / 100</span>
          </dd>
        </div>
        <div className="min-w-0 px-3 py-2">
          <dt className="truncate text-[10px] font-medium uppercase tracking-wider text-slate-500">Feedback</dt>
          <dd className="tabular mt-0.5 text-sm font-semibold text-white">
            {r.totalFeedbacks}
            <span className="text-xs font-normal text-slate-500"> onchain</span>
          </dd>
        </div>
      </dl>

      <div className="mt-3 flex items-center justify-between gap-3">
        <ul className="flex flex-wrap gap-1.5" aria-label="Declared endpoint protocols">
          {protocols.map((p) => (
            <li key={p}>
              <Badge tone="slate">{p}</Badge>
            </li>
          ))}
          {agent.x402 && (
            <li>
              <Badge tone="violet">x402</Badge>
            </li>
          )}
        </ul>
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-bnb transition-transform duration-200 group-hover:translate-x-0.5">
          View
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </span>
      </div>
    </Link>
  );
}
