import { Check, Network } from 'lucide-react';
import { AgentCard } from '@/components/marketplace/agent-card';
import { Badge } from '@/components/ui/badge';
import { CodeBlock, Terminal } from '@/components/home/code';
import { BAZAR_ESCROW_ADDRESS, BSC_CHAIN_ID } from '@/lib/constants';
import { getAgent } from '@/lib/data/agents';
import { DEMO_HIRER, HIRES } from '@/lib/data/hires';
import { formatToken, shortAddress } from '@/lib/utils';

const SHOWCASE_AGENT_ID = 'whalewatch-bsc';
const CALLER_AGENT_ID = 'yieldrouter';

function PulseDot() {
  return (
    <span className="relative flex h-2 w-2" aria-hidden>
      <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-bnb" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-bnb" />
    </span>
  );
}

/**
 * The hero composition: an A2A hire request/response terminal with the hired
 * agent's card floating out of it. Fully static (no animation gating) so it
 * renders complete in a screenshot; the float is a transform-only CSS loop.
 */
export function HeroShowcase() {
  const agent = getAgent(SHOWCASE_AGENT_ID);
  if (!agent) return null;

  const caller = getAgent(CALLER_AGENT_ID);
  const hire = HIRES.find((h) => h.agentId === agent.id && h.source === 'a2a') ?? HIRES[0];
  const tier = agent.pricing.find((t) => t.id === 'task') ?? agent.pricing[0];
  const payer = caller?.agentAddress ?? DEMO_HIRER;
  const task = hire.task ?? agent.a2a.tasks[0];

  const request = `POST /api/v1/a2a/hire HTTP/1.1
Content-Type: application/json

{
  "agentId": "${agent.id}",
  "tierId": "${tier.id}",
  "payer": "${shortAddress(payer, 6)}",
  "task": "${task}",
  "callerAgentId": "${caller?.id ?? CALLER_AGENT_ID}"
}`;

  const response = `HTTP/1.1 201 Created  # 38 ms

{
  "ok": true,
  "hire": { "id": "${hire.id}", "status": "escrowed" },
  "escrow": {
    "contract": "${shortAddress(BAZAR_ESCROW_ADDRESS, 6)}",
    "amount": ${tier.price}, "currency": "${tier.currency}", "chainId": ${BSC_CHAIN_ID}
  }
}`;

  return (
    <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-6 rounded-[2.5rem] bg-gold-radial opacity-70 blur-2xl"
      />

      <div className="relative lg:pl-8">
        <Terminal
          title="bazar a2a-router · POST /api/v1/a2a/hire"
          aside={
            <Badge tone="violet" icon={<Network className="h-3 w-3" aria-hidden />}>
              A2A
            </Badge>
          }
          bodyClassName="pb-16 sm:pb-20"
        >
          <CodeBlock code={request} />
          <div className="my-3 flex items-center gap-3" aria-hidden>
            <span className="h-px flex-1 bg-white/[0.08]" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500">response</span>
            <span className="h-px flex-1 bg-white/[0.08]" />
          </div>
          <CodeBlock code={response} />
        </Terminal>

        <div className="absolute -top-3 right-3 z-20 sm:right-5">
          <Badge tone="gold" size="md" className="bg-ink/90 shadow-glow-sm" icon={<PulseDot />}>
            Escrow locked · {formatToken(tier.price, tier.currency)}
          </Badge>
        </div>

        <div className="relative z-10 -mt-12 w-full max-w-[320px] animate-float sm:-mt-14 lg:-ml-8">
          <div className="absolute -top-3 left-4 z-20">
            <Badge tone="emerald" size="md" className="bg-ink/90" icon={<Check className="h-3 w-3" aria-hidden />}>
              Hired via A2A
            </Badge>
          </div>
          <AgentCard agent={agent} compact />
        </div>
      </div>
    </div>
  );
}
