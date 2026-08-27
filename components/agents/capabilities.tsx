import { Check, Layers } from 'lucide-react';
import type { Agent, Protocol } from '@/lib/types';
import { CATEGORY_MAP } from '@/lib/data/categories';
import { cn } from '@/lib/utils';

/** Brand-adjacent accent per indexed BSC protocol, used for the chip dot. */
const PROTOCOL_ACCENT: Record<Protocol, string> = {
  PancakeSwap: '#22D3EE',
  Venus: '#34D399',
  'Lista DAO': '#A3E635',
  Thena: '#F472B6',
  'Alpaca Finance': '#FBBF24',
  Wombat: '#38BDF8',
  'Binance Oracle': '#F0B90B',
  Chainlink: '#818CF8',
  opBNB: '#F0B90B',
};

export interface CapabilitiesProps {
  agent: Agent;
  className?: string;
}

/**
 * What the agent can do (capability chips) and where it does it (protocol
 * chips, each dotted with the protocol's accent). Server-safe.
 */
export function Capabilities({ agent, className }: CapabilitiesProps) {
  const category = CATEGORY_MAP[agent.category];

  return (
    <div className={cn('grid grid-cols-1 gap-3 lg:grid-cols-[1fr_18rem]', className)}>
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 backdrop-blur-xl sm:p-5">
        <h3 className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-slate-500">
          <Check className="h-3.5 w-3.5" aria-hidden />
          Capabilities
        </h3>
        <ul className="mt-3 flex flex-wrap gap-2">
          {agent.capabilities.map((capability) => (
            <li
              key={capability}
              className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors duration-200 hover:border-white/20 hover:bg-white/[0.06]"
            >
              <span
                aria-hidden
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: category.accentHex, boxShadow: `0 0 8px ${category.accentHex}80` }}
              />
              {capability}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs leading-relaxed text-slate-500">
          {category.primaryAction}. Every capability is executed from the agent&apos;s own BSC address and settled
          against the escrow SLA.
        </p>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 backdrop-blur-xl sm:p-5">
        <h3 className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-slate-500">
          <Layers className="h-3.5 w-3.5" aria-hidden />
          Protocols
        </h3>
        <ul className="mt-3 flex flex-wrap gap-2">
          {agent.protocols.map((protocol) => {
            const accent = PROTOCOL_ACCENT[protocol] ?? '#94A3B8';
            return (
              <li
                key={protocol}
                className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium"
                style={{ borderColor: `${accent}40`, background: `${accent}14`, color: accent }}
              >
                <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: accent }} />
                {protocol}
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-xs leading-relaxed text-slate-500">
          Integrations verified by the Bazar indexer against on-chain call history.
        </p>
      </div>
    </div>
  );
}
