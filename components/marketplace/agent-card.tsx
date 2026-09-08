import Link from 'next/link';
import type { CSSProperties } from 'react';
import { BadgeCheck, CircleDashed, Coins, HeartPulse, MessageSquare, Star } from '@/components/ui/icons';
import type { IndexedAgent } from '@/lib/types';
import { CATEGORY_MAP } from '@/lib/data/categories';
import { Badge } from '@/components/ui/badge';
import { cn, clamp, formatNumber, shortAddress, truncateWords } from '@/lib/utils';
import {
  CATEGORY_GLOW,
  CATEGORY_ICONS,
  CATEGORY_TONE,
  UNCLASSIFIED_GLOW,
  UNCLASSIFIED_HEX,
  isUnclassified,
  protocolTone,
} from './marketplace-config';

/* -------------------------------- helpers -------------------------------- */

/** Owner display: the index's own label when it has one, else the checksummed address. */
function ownerText(agent: IndexedAgent): string {
  return agent.ownerLabel ?? shortAddress(agent.owner);
}

/**
 * Only an absolute http(s) URL is worth putting in `src`. `image_url` is
 * free-form registry text: a relative path would resolve against Bazar's own
 * origin and an `ipfs://` or `javascript:` value can only fail. Rejecting them
 * here means those agents get the gradient mark immediately instead of a
 * request that was never going to render.
 */
function httpImageSrc(imageUrl: string | null): string | null {
  if (!imageUrl) return null;
  const url = imageUrl.trim();
  return url.startsWith('https://') || url.startsWith('http://') ? url : null;
}

/**
 * Registry image layered over the deterministic gradient + initials, never
 * instead of it.
 *
 * Registry image URLs really do die - three of the seventeen on the first
 * marketplace page returned 404 or 503 when checked on 2026-08-28 - and a
 * server component has no `onError`. So the gradient and initials are painted
 * first and the image sits on top of them: a URL that fails leaves a
 * transparent replaced box (the img is deliberately given no background of its
 * own, which would otherwise mask the mark it is supposed to degrade to) and
 * the reader sees the initials rather than an empty square or a broken-image
 * glyph. `alt=""` keeps the failure silent for assistive tech too - the card is
 * a single link whose `aria-label` already names the agent, so a decorative
 * image needs no second name. Same pattern as `AgentAvatar` on the detail page,
 * so a card and its page never disagree.
 */
function Avatar({ agent, size }: { agent: IndexedAgent; size: 'sm' | 'lg' }) {
  const box = size === 'lg' ? 'h-12 w-12 text-sm' : 'h-10 w-10 text-xs';
  const src = httpImageSrc(agent.imageUrl);

  return (
    <div
      aria-hidden
      className={cn(
        'relative flex shrink-0 select-none items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br font-bold tracking-wide text-white ring-1 ring-inset ring-white/20',
        agent.avatar.gradient,
        box,
      )}
    >
      <span>{agent.avatar.initials}</span>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element -- registry-hosted, arbitrary remote origins
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </div>
  );
}

/**
 * Feedback summary.
 *
 * Two things drive this shape. `totalFeedbacks === 0` is the common case even
 * at the top of the ranking (238 of the top 300 sampled), so "no feedback yet"
 * is a first-class state rather than a zeroed-out rating. And `averageScore`
 * is NOT a 0-5 star rating: the index returns it on a 0-100 scale and leaves
 * it at 0 for many agents that do have feedback (sampled live: 108 feedbacks
 * with an average of 0.0, 3 feedbacks with 100.0). It is therefore shown on
 * the scale it is actually published on, only when it carries a value, and
 * never behind a star glyph that would imply a five-point rating.
 */
function FeedbackLine({ agent, className }: { agent: IndexedAgent; className?: string }) {
  const { averageScore, totalFeedbacks, starCount } = agent.reputation;

  return (
    <div className={cn('flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]', className)}>
      {totalFeedbacks > 0 ? (
        <span className="inline-flex items-center gap-1 text-slate-300">
          <MessageSquare className="h-3 w-3 text-slate-400" aria-hidden />
          <span className="tabular font-semibold text-white">{formatNumber(totalFeedbacks, { compact: false })}</span>
          <span className="text-slate-500">feedback</span>
          {averageScore > 0 && (
            <span className="tabular text-slate-500">
              · avg {averageScore.toFixed(averageScore >= 100 ? 0 : 1)}/100
            </span>
          )}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-slate-500">
          <MessageSquare className="h-3 w-3" aria-hidden />
          No feedback yet
        </span>
      )}
      {starCount > 0 && (
        <span
          className="inline-flex items-center gap-1 text-slate-500"
          title={`${starCount} star${starCount === 1 ? '' : 's'} recorded against this identity`}
        >
          <Star className="h-3 w-3 text-slate-500" aria-hidden />
          <span className="tabular">{formatNumber(starCount, { compact: false })}</span>
          <span className="sr-only">{starCount === 1 ? 'star' : 'stars'}</span>
        </span>
      )}
    </div>
  );
}

/* --------------------------------- card ---------------------------------- */

export interface AgentCardProps {
  agent: IndexedAgent;
  /** Smaller horizontal variant for landing / detail pages. */
  compact?: boolean;
  /** Position in a list; drives a short CSS stagger (content stays visible without JS). */
  index?: number;
}

/**
 * Marketplace agent card. Server-safe: no hooks, no client-only APIs.
 * The whole card is a single link to `/agents/[slug]`; nothing inside is interactive.
 *
 * Everything rendered here comes off the ERC-8004 index: identity, ownership,
 * declared endpoint protocols and reputation. There is no ROI, SLA or price
 * line because the registries publish none of those.
 */
/**
 * How much of a description the card renders.
 *
 * Exported because other surfaces need to know what the card already shows.
 * The PancakeSwap lane quotes an agent's registration text as evidence, and a
 * quote of text the card is printing two inches above it is not evidence, it
 * is the same sentence twice.
 *
 * Sized to the two lines `line-clamp-2` allows at this card width - about 105
 * characters - so the JS trim lands and the clamp never has to cut it again.
 */
export const CARD_DESCRIPTION_CHARS = 100;

export function AgentCard({ agent, compact, index }: AgentCardProps) {
  const category = CATEGORY_MAP[agent.category];
  const CategoryIcon = CATEGORY_ICONS[category.icon];
  const href = `/agents/${agent.slug}`;
  const staggerStyle: CSSProperties | undefined =
    index !== undefined ? { animationDelay: `${Math.min(index, 12) * 45}ms` } : undefined;

  const { totalScore, networkRank, healthScore } = agent.reputation;
  const scorePct = clamp(totalScore, 0, 100);
  // The category is Bazar's, not the registry's. `categoryConfidence` is the
  // classifier's own structural verdict, so when nothing in the agent's
  // registration text matched, the chip says so in words instead of hiding the
  // fact in a `title` tooltip no touch or screen-reader user ever reaches - the
  // link label stops asserting a placement the agent never claimed, and the
  // card drops the category's colour rather than dressing a coverage bucket up
  // as a finding. The reason string stays as supplementary detail only.
  const unclassified = isUnclassified(agent);
  const accentHex = unclassified ? UNCLASSIFIED_HEX : category.accentHex;
  const glow = unclassified ? UNCLASSIFIED_GLOW : CATEGORY_GLOW[category.accent];
  const label = unclassified
    ? `View ${agent.name}, unclassified agent, reputation ${totalScore.toFixed(1)} of 100`
    : `View ${agent.name}, ${category.name} agent, reputation ${totalScore.toFixed(1)} of 100`;

  if (compact) {
    return (
      <Link
        href={href}
        aria-label={
          unclassified
            ? `${agent.name} - unclassified agent, reputation ${totalScore.toFixed(1)} of 100`
            : `${agent.name} - ${category.name} agent, reputation ${totalScore.toFixed(1)} of 100`
        }
        style={staggerStyle}
        className={cn(
          'group flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] p-3 backdrop-blur-xl',
          'shadow-card transition-all duration-300 hover:bg-white/[0.06] ring-focus',
          glow,
          index !== undefined && 'animate-fade-up',
        )}
      >
        <Avatar agent={agent} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-white">{agent.name}</span>
            {agent.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-bnb" aria-hidden />}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
            {unclassified ? (
              <span className="shrink-0 font-medium text-slate-500" title={agent.categoryReason}>
                Unclassified
              </span>
            ) : (
              <span className="shrink-0 font-medium" style={{ color: category.accentHex }}>
                {category.shortName}
              </span>
            )}
            <span aria-hidden className="text-slate-500">·</span>
            <span className="truncate font-mono text-[11px]">#{agent.tokenId}</span>
          </div>
        </div>
        <div className="hidden shrink-0 text-right sm:block">
          <div className="tabular text-sm font-semibold text-white">
            {totalScore.toFixed(1)}
            <span className="text-[11px] font-normal text-slate-500"> / 100</span>
          </div>
          <FeedbackLine agent={agent} className="justify-end" />
        </div>
      </Link>
    );
  }

  const protocols = agent.protocols.slice(0, 3);
  const extraProtocols = agent.protocols.length - protocols.length;

  return (
    <Link
      href={href}
      aria-label={label}
      style={staggerStyle}
      className={cn(
        'group relative block h-full rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl',
        'shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/[0.06] ring-focus',
        glow,
        index !== undefined && 'animate-fade-up',
      )}
    >
      <article className="flex h-full flex-col p-5">
        {/* identity */}
        <div className="flex items-start gap-3">
          <Avatar agent={agent} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-[15px] font-semibold leading-tight text-white">{agent.name}</h3>
              {agent.verified && (
                <BadgeCheck className="h-4 w-4 shrink-0 text-bnb" aria-label="Verified in the Identity Registry" role="img" />
              )}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
              <span className="truncate font-mono">{ownerText(agent)}</span>
              <span aria-hidden className="text-slate-600">·</span>
              <span className="tabular shrink-0 font-mono text-slate-500">#{agent.tokenId}</span>
            </div>
          </div>
          {unclassified ? (
            <Badge
              tone="slate"
              icon={<CircleDashed className="h-3 w-3" aria-hidden />}
              className="shrink-0 border-dashed"
              title={agent.categoryReason}
            >
              Unclassified
            </Badge>
          ) : (
            <Badge
              tone={CATEGORY_TONE[category.accent]}
              icon={<CategoryIcon className="h-3 w-3" aria-hidden />}
              className="shrink-0"
              title={agent.categoryReason}
            >
              {category.shortName}
            </Badge>
          )}
        </div>

        {/* description */}
        {agent.description ? (
          /* The budget has to fit inside the two lines `line-clamp` allows,
             or the clamp cuts the JS-trimmed string again and puts the ellipsis
             back in the middle of a word - which is what a 150 budget did here.
             Two lines at this card width hold about 105 characters, so 100 lands
             inside them and the clamp stays a backstop it never has to be. */
          <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-sm leading-relaxed text-slate-400">
            {truncateWords(agent.description, CARD_DESCRIPTION_CHARS)}
          </p>
        ) : (
          <p className="mt-3 min-h-[2.5rem] text-sm leading-relaxed text-slate-400">
            No description published in the registry.
          </p>
        )}

        {/* reputation - the headline metric, and the only one onchain */}
        <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Reputation score</span>
            {networkRank !== null && (
              <span className="tabular shrink-0 text-[11px] font-medium text-slate-400">
                #{formatNumber(networkRank, { compact: false })} on BSC
              </span>
            )}
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="tabular text-2xl font-semibold leading-none tracking-tight text-white">
              {totalScore.toFixed(1)}
            </span>
            <span className="text-xs text-slate-500">/ 100</span>
          </div>
          <div
            className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-white/[0.07]"
            role="img"
            aria-label={`Reputation ${totalScore.toFixed(1)} out of 100`}
          >
            <div className="h-full rounded-full" style={{ width: `${scorePct}%`, background: accentHex }} />
          </div>
          <FeedbackLine agent={agent} className="mt-2.5" />
        </div>

        {/* declared capabilities */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {protocols.map((p) => (
            <Badge key={p} tone={protocolTone(p)} title={`Declares a ${p} endpoint`}>
              {p}
            </Badge>
          ))}
          {extraProtocols > 0 && (
            <Badge tone="slate" title={agent.protocols.join(', ')}>
              +{extraProtocols}
            </Badge>
          )}
          {agent.x402 && (
            <Badge tone="gold" icon={<Coins className="h-3 w-3" aria-hidden />} title="Advertises x402 machine payments">
              x402
            </Badge>
          )}
          {healthScore !== null && (
            <Badge tone="slate" icon={<HeartPulse className="h-3 w-3" aria-hidden />} title="8004scan health score">
              <span className="tabular">Health {Math.round(healthScore)}</span>
            </Badge>
          )}
          {protocols.length === 0 && !agent.x402 && healthScore === null && (
            <span className="text-[11px] text-slate-400">No endpoints declared</span>
          )}
        </div>

        {/* footer */}
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
          <span className="tabular truncate font-mono text-[11px] text-slate-500">
            Token #{agent.tokenId} · BSC
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-bnb transition-transform duration-200 group-hover:translate-x-0.5">
            View agent
          </span>
        </div>
      </article>
    </Link>
  );
}
