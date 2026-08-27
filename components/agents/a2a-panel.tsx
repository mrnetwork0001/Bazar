import Link from 'next/link';
import { ArrowUpRight, Network, Plug, Terminal as TerminalIcon } from 'lucide-react';
import type { Agent } from '@/lib/types';
import { APP_URL } from '@/lib/constants';
import { DEMO_HIRER } from '@/lib/data/hires';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CodeBlock, Terminal } from '@/components/home/code';
import { CopyButton } from '@/components/agents/copy-button';
import { cn } from '@/lib/utils';

/** The tier an autonomous caller will reach for: pay-per-execution. */
function callTier(agent: Agent) {
  return agent.pricing.find((t) => t.period === 'task') ?? agent.pricing[0];
}

/** Real, runnable request against the live A2A router, prefilled for this agent. */
function buildCurl(agent: Agent) {
  const tier = callTier(agent);
  const task = agent.a2a.tasks[0];
  return `curl -X POST ${APP_URL}/api/v1/a2a/hire \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentId": "${agent.id}",
    "tierId": "${tier?.id ?? 'task'}",
    "payer": "${DEMO_HIRER}",${task ? `\n    "task": "${task}",` : ''}
    "callerAgentId": "your-agent-slug",
    "sla": { "maxLatencyMs": ${Math.round(agent.metrics.avgResponseMs * 1.5)}, "minUptime": 99 }
  }'`;
}

export interface A2APanelProps {
  agent: Agent;
  className?: string;
}

/**
 * The machine-facing half of the listing: endpoint, supported protocols, the
 * task verbs this agent answers, and a copy-pasteable hire call.
 */
export function A2APanel({ agent, className }: A2APanelProps) {
  const { a2a } = agent;
  const curl = buildCurl(agent);
  const protocols = a2a.mcp ? Array.from(new Set([...a2a.protocols, 'A2A/1.0', 'MCP/2025-06'])) : a2a.protocols;

  if (!a2a.enabled) {
    return (
      <div
        className={cn(
          'rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 text-sm text-slate-400 backdrop-blur-xl',
          className,
        )}
      >
        <p className="font-medium text-slate-200">Human hire only</p>
        <p className="mt-1.5 leading-relaxed">
          {agent.name} has not published an A2A endpoint yet, so it can only be hired from this storefront. Ask the
          owner to register one, or browse{' '}
          <Link href="/marketplace?a2a=1" className="font-medium text-bnb hover:underline ring-focus">
            agents that are A2A ready
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className={cn('grid grid-cols-1 gap-3 lg:grid-cols-[20rem_1fr]', className)}>
      {/* endpoint + protocols + tasks */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 backdrop-blur-xl sm:p-5">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-violet-400/30 bg-violet-400/10 text-violet-300">
            <Network className="h-3.5 w-3.5" aria-hidden />
          </span>
          <h3 className="text-sm font-semibold text-white">A2A endpoint</h3>
        </div>

        <div className="mt-3 flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-ink/60 px-2.5 py-2">
          <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-slate-300" title={a2a.endpoint}>
            {a2a.endpoint}
          </code>
          <CopyButton value={a2a.endpoint} label="A2A endpoint" />
        </div>

        <div className="mt-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Protocols</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {protocols.map((protocol) => (
              <Badge
                key={protocol}
                tone="violet"
                icon={<Plug className="h-3 w-3" aria-hidden />}
                title={
                  protocol.startsWith('MCP')
                    ? 'Exposes a Model Context Protocol server your client can mount directly.'
                    : 'Speaks the Bazar agent-to-agent hire protocol.'
                }
              >
                {protocol}
              </Badge>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Tasks ({a2a.tasks.length})
          </div>
          <ul className="mt-2 space-y-1.5">
            {a2a.tasks.map((task) => (
              <li
                key={task}
                className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5"
              >
                <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
                <code className="truncate font-mono text-xs text-slate-300">{task}</code>
              </li>
            ))}
          </ul>
        </div>

        <Button
          href="/developers#try-it"
          variant="outline"
          size="sm"
          className="mt-4 w-full"
          rightIcon={<ArrowUpRight className="h-3.5 w-3.5" aria-hidden />}
        >
          Full A2A reference
        </Button>
      </div>

      {/* runnable snippet */}
      <Terminal
        title="POST /api/v1/a2a/hire"
        aside={
          <span className="flex items-center gap-1.5">
            <Badge tone="violet" icon={<TerminalIcon className="h-3 w-3" aria-hidden />}>
              Live endpoint
            </Badge>
            <CopyButton value={curl} label="hire request" />
          </span>
        }
        bodyClassName="p-4 sm:p-5"
      >
        <CodeBlock code={curl} />
        <p className="mt-4 border-t border-white/[0.06] pt-3 text-[11px] leading-relaxed text-slate-500">
          Returns a hire id and an escrow quote — amount including the 1% protocol fee, the escrow contract on BNB Smart
          Chain (56) and ready-to-sign <code className="font-mono text-slate-400">lockEscrow</code> calldata. Poll{' '}
          <code className="font-mono text-slate-400">GET /api/v1/a2a/hires/&#123;id&#125;</code> or pass a{' '}
          <code className="font-mono text-slate-400">callbackUrl</code> to be notified on escrow events.
        </p>
      </Terminal>
    </div>
  );
}
