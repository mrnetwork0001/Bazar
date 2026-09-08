import {
  BadgeCheck,
  CalendarClock,
  CircleDashed,
  ExternalLink,
  Fingerprint,
  History,
  User,
} from '@/components/ui/icons';
import type { IndexedAgent } from '@/lib/types';
import type { AgentEndpoint } from '@/components/agents/agent-detail';
import { CATEGORY_MAP } from '@/lib/data/categories';
import { Badge } from '@/components/ui/badge';
import { CATEGORY_ICONS, CATEGORY_TONE } from '@/components/marketplace/marketplace-config';
import { protocolMeta, X402_META } from '@/components/agents/protocol-meta';
import { bscScanAddress, cn, formatDate, shortAddress } from '@/lib/utils';

/* -------------------------------- avatar -------------------------------- */

export interface AgentAvatarProps {
  agent: Pick<IndexedAgent, 'name' | 'imageUrl' | 'avatar'>;
  className?: string;
}

/**
 * Registry image when the agent published one, deterministic gradient +
 * initials when it did not. The image sits on top of the gradient with an
 * empty alt, so a dead image URL degrades back to the gradient instead of a
 * broken-image glyph.
 */
export function AgentAvatar({ agent, className }: AgentAvatarProps) {
  return (
    <div
      aria-hidden
      className={cn(
        'relative flex shrink-0 select-none items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br font-bold tracking-wide text-white ring-1 ring-inset ring-white/20',
        agent.avatar.gradient,
        className,
      )}
    >
      <span>{agent.avatar.initials}</span>
      {agent.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={agent.imageUrl}
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

/* --------------------------------- meta --------------------------------- */

function MetaItem({
  icon,
  children,
  label,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5" title={label}>
      <span className="shrink-0 text-slate-600" aria-hidden>
        {icon}
      </span>
      <span className="sr-only">{label}: </span>
      {children}
    </span>
  );
}

/* -------------------------------- header -------------------------------- */

export interface AgentHeaderProps {
  agent: IndexedAgent;
  /**
   * Endpoints the index resolved for this agent, when the per-agent record was
   * read. A protocol badge with one becomes a link to it; a badge without one
   * stays plain text.
   */
  endpoints?: AgentEndpoint[];
  className?: string;
}

/**
 * Identity block for one indexed ERC-8004 agent.
 *
 * Everything rendered here comes off the registry record: name, owner (ENS or
 * certified name when the index has one, otherwise the raw address), token id,
 * registration and last-update timestamps, declared protocols and the x402
 * flag.
 *
 * The category is the one thing on this header Bazar derived rather than read,
 * so it is never presented as a fact about the agent. When
 * `categoryConfidence` is 'unclassified' - nothing in the registration matched
 * a category term, which is the majority case on BSC - the badge says
 * "Unclassified" instead of naming a shelf, and the reason sentence below is
 * always visible rather than hidden in a tooltip. See `lib/indexer/classify.ts`.
 */
export function AgentHeader({ agent, endpoints, className }: AgentHeaderProps) {
  // `supported_protocols` says an agent speaks Web; `services.web.endpoint`
  // says where. Both come from the same record, so a badge can carry the
  // address instead of only announcing that one exists.
  const endpointFor = new Map(
    (endpoints ?? []).map((e) => [e.protocol.trim().toLowerCase(), e.url] as const),
  );
  const category = CATEGORY_MAP[agent.category];
  const CategoryIcon = CATEGORY_ICONS[category.icon];
  const ownerDisplay = agent.ownerLabel ?? shortAddress(agent.owner, 4);
  const hasDescription = agent.description.trim().length > 0;
  // Branch on the confidence flag, never on the wording of `categoryReason`.
  const unclassified = agent.categoryConfidence === 'unclassified';

  return (
    <header className={cn('relative', className)}>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
        <AgentAvatar agent={agent} className="h-20 w-20 text-2xl sm:h-24 sm:w-24 sm:text-3xl" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
            <h1 className="min-w-0 break-words text-2xl font-semibold tracking-tight text-white sm:text-3xl lg:text-4xl">
              {agent.name}
            </h1>
            {agent.verified && (
              <Badge
                tone="gold"
                size="md"
                icon={<BadgeCheck className="h-3.5 w-3.5" aria-hidden />}
                title="Flagged as verified by the ERC-8004 Identity Registry index."
              >
                Verified
              </Badge>
            )}
            <Badge
              tone={unclassified ? 'slate' : CATEGORY_TONE[category.accent]}
              size="md"
              icon={
                unclassified ? (
                  <CircleDashed className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <CategoryIcon className="h-3.5 w-3.5" aria-hidden />
                )
              }
              title={
                unclassified
                  ? `Nothing in this agent's registration matched a Bazar category term. It sits on the ${category.name} shelf for coverage only.`
                  : `Classified as ${category.name} from this agent's own registration text.`
              }
              className="ml-auto sm:ml-0"
            >
              {unclassified ? 'Unclassified' : category.name}
            </Badge>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-slate-400">
            <MetaItem icon={<User className="h-3.5 w-3.5" aria-hidden />} label="Owner">
              <a
                href={bscScanAddress(agent.owner, agent.chainId)}
                target="_blank"
                rel="noreferrer"
                title={agent.owner}
                className="inline-flex min-w-0 items-center gap-1 truncate rounded font-mono text-slate-300 transition-colors hover:text-bnb ring-focus"
              >
                <span className="truncate">{ownerDisplay}</span>
              </a>
            </MetaItem>
            <span aria-hidden className="text-slate-700">
              ·
            </span>
            <MetaItem icon={<Fingerprint className="h-3.5 w-3.5" aria-hidden />} label="Identity token">
              <span className="tabular font-mono text-slate-400">ERC-8004 #{agent.tokenId}</span>
            </MetaItem>
            <span aria-hidden className="text-slate-700">
              ·
            </span>
            <MetaItem icon={<CalendarClock className="h-3.5 w-3.5" aria-hidden />} label="Registered">
              <span className="text-slate-400">Registered {formatDate(agent.registeredAt)}</span>
            </MetaItem>
            <span aria-hidden className="text-slate-700">
              ·
            </span>
            <MetaItem icon={<History className="h-3.5 w-3.5" aria-hidden />} label="Record updated">
              <span className="text-slate-400">Updated {formatDate(agent.updatedAt)}</span>
            </MetaItem>
          </div>

          {hasDescription ? (
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-300 sm:text-base">{agent.description}</p>
          ) : (
            <p className="mt-4 max-w-3xl rounded-xl border border-dashed border-white/[0.12] bg-white/[0.02] px-3.5 py-3 text-sm leading-relaxed text-slate-500">
              This agent registered without a description. Bazar shows the registry record as published and does not
              write copy on an agent&apos;s behalf.
            </p>
          )}

          {/* Bazar's classification story, stated in the open. ERC-8004 has no
              category field, so this sentence is the only thing that makes the
              shelf above auditable - it is never a tooltip. */}
          {unclassified ? (
            <p className="mt-3 max-w-3xl rounded-xl border border-dashed border-white/[0.12] bg-white/[0.02] px-3.5 py-2.5 text-xs leading-relaxed text-slate-500">
              <span className="font-medium text-slate-300">Not classified.</span> {agent.categoryReason}{' '}
              <span className="text-slate-600">
                ERC-8004 has no category field, and nothing in this registration matched one of Bazar&apos;s category
                terms. The {category.name} shelf it is listed on is Bazar&apos;s own placement for coverage, not a
                claim this agent makes about itself.
              </span>
            </p>
          ) : (
            <p className="mt-3 max-w-3xl text-xs leading-relaxed text-slate-500">
              <span className="font-medium text-slate-400">Filed under {category.name}:</span> {agent.categoryReason}{' '}
              <span className="text-slate-600">
                ERC-8004 has no category field - Bazar classifies from the agent&apos;s own registration text.
              </span>
            </p>
          )}

          {(agent.protocols.length > 0 || agent.x402) && (
            <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Declared endpoints">
              {agent.protocols.map((protocol) => {
                const meta = protocolMeta(protocol);
                const Icon = meta.icon;
                const href = endpointFor.get(protocol.trim().toLowerCase());
                const chrome = 'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium';
                const paint = {
                  borderColor: `${meta.accentHex}40`,
                  background: `${meta.accentHex}14`,
                  color: meta.accentHex,
                };
                return (
                  <li key={protocol}>
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer noopener"
                        // The agent's own declared address, not somewhere Bazar
                        // chose and not somewhere it has probed. The title says
                        // where the click goes, because a globe that silently
                        // leaves the site is worse than one that does nothing.
                        title={`${meta.blurb} - ${href}`}
                        className={cn(chrome, 'ring-focus transition-opacity hover:opacity-80')}
                        style={paint}
                      >
                        <Icon className="h-3.5 w-3.5" aria-hidden />
                        {meta.label}
                        <ExternalLink className="h-3 w-3 opacity-70" aria-hidden />
                      </a>
                    ) : (
                      <span
                        // Declared with no address resolved: still true, still
                        // worth showing, and deliberately not a link.
                        title={`${meta.blurb} - declared, but the index resolved no address for it`}
                        className={chrome}
                        style={paint}
                      >
                        <Icon className="h-3.5 w-3.5" aria-hidden />
                        {meta.label}
                      </span>
                    )}
                  </li>
                );
              })}
              {agent.x402 && (
                <li
                  title={X402_META.blurb}
                  className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
                  style={{
                    borderColor: `${X402_META.accentHex}40`,
                    background: `${X402_META.accentHex}14`,
                    color: X402_META.accentHex,
                  }}
                >
                  <X402_META.icon className="h-3.5 w-3.5" aria-hidden />
                  {X402_META.label}
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </header>
  );
}
