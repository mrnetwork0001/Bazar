import type { ReactNode } from 'react';
import { ArrowUpRight, BadgeCheck, CalendarClock, Fingerprint, Link2, User, Wallet } from 'lucide-react';
import type { Agent } from '@/lib/types';
import { CATEGORY_MAP } from '@/lib/data/categories';
import { AgentBadge, Badge } from '@/components/ui/badge';
import { CATEGORY_ICONS, CATEGORY_TONE } from '@/components/marketplace/marketplace-config';
import { CopyButton } from '@/components/agents/copy-button';
import { bscScanAddress, cn, formatDate, shortAddress } from '@/lib/utils';

/* ---------------------------- identity rows ----------------------------- */

interface IdentityFieldProps {
  icon: ReactNode;
  label: string;
  /** Rendered value (already shortened where appropriate). */
  display: string;
  /** Full value placed on the clipboard. */
  value: string;
  /** Optional BscScan (or agent card) link. */
  href?: string;
  linkLabel?: string;
}

function IdentityField({ icon, label, display, value, href, linkLabel }: IdentityFieldProps) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 px-3.5 py-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-slate-400">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{label}</div>
        <div className="tabular truncate font-mono text-xs text-slate-200">{display}</div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <CopyButton value={value} label={label} />
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            aria-label={linkLabel ?? `Open ${label} on BscScan`}
            title={linkLabel ?? `Open ${label} on BscScan`}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-slate-400 transition-colors hover:border-bnb/40 hover:bg-bnb/10 hover:text-bnb ring-focus"
          >
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </a>
        )}
      </div>
    </div>
  );
}

/* -------------------------------- header -------------------------------- */

export interface AgentHeaderProps {
  agent: Agent;
  className?: string;
}

/**
 * Agent identity block: avatar, name, category, description, trust badges and
 * the four ERC-8004 identity fields (tokenId, owner, agent address, agentURI).
 * Server component — the copy controls are the only client islands.
 */
export function AgentHeader({ agent, className }: AgentHeaderProps) {
  const category = CATEGORY_MAP[agent.category];
  const CategoryIcon = CATEGORY_ICONS[category.icon];

  const fields: IdentityFieldProps[] = [
    {
      icon: <Fingerprint className="h-3.5 w-3.5" aria-hidden />,
      label: 'Token ID',
      display: `#${agent.tokenId}`,
      value: String(agent.tokenId),
    },
    {
      icon: <User className="h-3.5 w-3.5" aria-hidden />,
      label: 'Owner',
      display: shortAddress(agent.owner, 6),
      value: agent.owner,
      href: bscScanAddress(agent.owner),
      linkLabel: 'View owner on BscScan',
    },
    {
      icon: <Wallet className="h-3.5 w-3.5" aria-hidden />,
      label: 'Agent address',
      display: shortAddress(agent.agentAddress, 6),
      value: agent.agentAddress,
      href: bscScanAddress(agent.agentAddress),
      linkLabel: 'View agent address on BscScan',
    },
    {
      icon: <Link2 className="h-3.5 w-3.5" aria-hidden />,
      label: 'Agent URI',
      display: agent.agentURI.replace(/^https?:\/\//, ''),
      value: agent.agentURI,
      href: agent.agentURI,
      linkLabel: 'Open the ERC-8004 agent card',
    },
  ];

  return (
    <header className={cn('relative', className)}>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
        <div
          aria-hidden
          className={cn(
            'flex h-20 w-20 shrink-0 select-none items-center justify-center rounded-2xl bg-gradient-to-br text-2xl font-bold tracking-wide text-white ring-1 ring-inset ring-white/20 sm:h-24 sm:w-24 sm:text-3xl',
            agent.avatar.gradient,
          )}
        >
          {agent.avatar.initials}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl lg:text-4xl">{agent.name}</h1>
            {agent.verified && (
              <BadgeCheck
                className="h-6 w-6 shrink-0 text-bnb sm:h-7 sm:w-7"
                role="img"
                aria-label="ERC-8004 verified identity"
              />
            )}
            <Badge
              tone={CATEGORY_TONE[category.accent]}
              size="md"
              icon={<CategoryIcon className="h-3.5 w-3.5" aria-hidden />}
              className="ml-auto sm:ml-0"
            >
              {category.name}
            </Badge>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-sm text-slate-400">
            <span>{agent.handle}</span>
            <span aria-hidden className="text-slate-600">
              ·
            </span>
            <span className="tabular text-slate-500">ERC-8004 #{agent.tokenId}</span>
            <span aria-hidden className="text-slate-600">
              ·
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-500">
              <CalendarClock className="h-3.5 w-3.5" aria-hidden />
              Registered {formatDate(agent.registeredAt)}
            </span>
          </div>

          <p className="mt-4 text-base font-medium leading-relaxed text-slate-200 sm:text-lg">{agent.tagline}</p>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">{agent.description}</p>

          <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Verified badges">
            {agent.badges.map((badge) => (
              <li key={badge}>
                <AgentBadge badge={badge} size="md" />
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ERC-8004 identity fields */}
      <div className="mt-6 grid grid-cols-1 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] sm:grid-cols-2 lg:grid-cols-4">
        {fields.map((field, i) => (
          <div
            key={field.label}
            className={cn(
              'min-w-0 border-white/[0.06]',
              i > 0 && 'border-t sm:border-t-0',
              i % 2 === 1 && 'sm:border-l',
              i >= 2 && 'sm:border-t lg:border-t-0',
              i > 0 && 'lg:border-l',
            )}
          >
            <IdentityField {...field} />
          </div>
        ))}
      </div>
    </header>
  );
}
