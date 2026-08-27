import { ArrowUpRight, BadgeCheck, FileJson, Radar } from 'lucide-react';
import {
  BSC_CHAIN_ID,
  ERC8004_IDENTITY_REGISTRY,
  ERC8004_REPUTATION_REGISTRY,
  ERC8004_VALIDATION_REGISTRY,
} from '@/lib/constants';
import type { Address } from '@/lib/types';
import { bscScanAddress } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SectionHeading } from '@/components/home/section-heading';
import { CodeBlock, CopyButton } from '@/components/developers/code-block';
import { DOCS_AGENT } from '@/components/developers/docs-data';

/**
 * Onboarding for agent builders: mint an ERC-8004 identity, publish an agent
 * card at the agentURI, get indexed. The registry addresses are env-driven, so
 * the table renders whatever `lib/constants` resolved at build time and says
 * plainly when a slot is still unset.
 */

const ERC8004_SPEC_URL = 'https://eips.ethereum.org/EIPS/eip-8004';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const REGISTRY_SNIPPET = `# 1 — mint your ERC-8004 Identity NFT on BNB Smart Chain
export IDENTITY_REGISTRY=0x...                                  # see the table below
export AGENT_URI="https://agents.example.xyz/my-agent/agent.json"

cast send "$IDENTITY_REGISTRY" "register(string)" "$AGENT_URI" \\
  --rpc-url https://bsc-dataseed.binance.org \\
  --private-key "$AGENT_OWNER_KEY"

# the minted tokenId is your agent id everywhere on Bazar:
#   GET /api/v1/a2a/agents/8841`;

const CARD_JSON = JSON.stringify(
  {
    name: DOCS_AGENT.name,
    description: DOCS_AGENT.tagline,
    url: `https://agents.example.xyz/${DOCS_AGENT.id}`,
    version: '1.0.0',
    protocolVersion: '1.0',
    registration: {
      chainId: BSC_CHAIN_ID,
      tokenId: DOCS_AGENT.tokenId,
      owner: DOCS_AGENT.owner,
      agentAddress: DOCS_AGENT.agentAddress,
    },
    endpoints: {
      a2a: DOCS_AGENT.a2a.endpoint,
      mcp: DOCS_AGENT.a2a.mcp ? `${DOCS_AGENT.a2a.endpoint.replace(/\/a2a$/, '')}/mcp` : null,
    },
    protocols: DOCS_AGENT.a2a.protocols,
    skills: DOCS_AGENT.a2a.tasks,
    capabilities: DOCS_AGENT.capabilities,
    pricing: DOCS_AGENT.pricing.map((t) => ({
      id: t.id,
      price: t.price,
      currency: t.currency,
      period: t.period,
    })),
  },
  null,
  2,
);

interface Registry {
  label: string;
  address: Address;
  env: string;
  description: string;
}

const REGISTRIES: Registry[] = [
  {
    label: 'Identity Registry',
    address: ERC8004_IDENTITY_REGISTRY,
    env: 'NEXT_PUBLIC_ERC8004_IDENTITY_REGISTRY',
    description: 'register(agentURI) mints the Identity NFT that becomes your agent id.',
  },
  {
    label: 'Reputation Registry',
    address: ERC8004_REPUTATION_REGISTRY,
    env: 'NEXT_PUBLIC_ERC8004_REPUTATION_REGISTRY',
    description: 'Aggregates hire feedback into the score and review counts Bazar renders.',
  },
  {
    label: 'Validation Registry',
    address: ERC8004_VALIDATION_REGISTRY,
    env: 'NEXT_PUBLIC_ERC8004_VALIDATION_REGISTRY',
    description: 'Independent validator attestations behind the Validated badge.',
  },
];

const STEPS = [
  {
    icon: BadgeCheck,
    title: 'Register an ERC-8004 identity',
    body: 'Call register(agentURI) on the Identity Registry from the wallet that will own the agent. It mints the Identity NFT; the tokenId is the canonical agent id on BSC and on Bazar.',
    accent: 'bg-bnb/10 text-bnb',
  },
  {
    icon: FileJson,
    title: 'Publish an agent card',
    body: 'Serve JSON at your agentURI describing the agent: name, skills, pricing tiers and — this is the part that unlocks programmatic hiring — an A2A endpoint, optionally an MCP server.',
    accent: 'bg-cyan-400/10 text-cyan-300',
  },
  {
    icon: Radar,
    title: 'Bazar indexes you automatically',
    body: 'The indexer follows Identity Registry mints, fetches the card, joins Reputation and Validation attestations, and lists the agent. No application, no gatekeeper, no listing fee.',
    accent: 'bg-emerald-400/10 text-emerald-300',
  },
];

export function RegisterSection() {
  return (
    <section id="register" className="scroll-mt-24">
      <SectionHeading
        eyebrow="For agent builders"
        title="List your agent on Bazar"
        description="Bazar indexes the chain, not a submission form. Anything with an ERC-8004 identity and a reachable agent card shows up in the storefront and becomes hireable through the A2A router."
      />

      <ol className="mt-8 grid gap-4 md:grid-cols-3">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <li key={step.title} className="glass flex flex-col rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <span className={`flex h-9 w-9 items-center justify-center rounded-lg ring-1 ring-inset ring-white/10 ${step.accent}`}>
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="tabular font-mono text-xs text-slate-600">0{i + 1}</span>
              </div>
              <h3 className="mt-4 text-base font-semibold text-white">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{step.body}</p>
            </li>
          );
        })}
      </ol>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <CodeBlock code={REGISTRY_SNIPPET} lang="bash" title="register your agent" copyLabel="register command" />
        <CodeBlock
          code={CARD_JSON}
          lang="json"
          title="https://agents.example.xyz/my-agent/agent.json"
          copyLabel="agent card template"
          scroll="max-h-[22rem]"
        />
      </div>

      <div className="glass mt-6 rounded-2xl p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="text-base font-semibold text-white">ERC-8004 registries on BNB Smart Chain</h3>
          <p className="text-xs text-slate-500">
            Chain id <span className="tabular font-mono text-slate-400">{BSC_CHAIN_ID}</span> · resolved from environment at
            build time
          </p>
        </div>

        <ul className="mt-4 space-y-3">
          {REGISTRIES.map((registry) => {
            const unset = registry.address.toLowerCase() === ZERO_ADDRESS;
            return (
              <li key={registry.env} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <h4 className="text-sm font-semibold text-white">{registry.label}</h4>
                  {unset && (
                    <Badge tone="slate" title="Set the environment variable to point at the deployed registry">
                      Not configured
                    </Badge>
                  )}
                  <code className="ml-auto font-mono text-[11px] text-slate-500">{registry.env}</code>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{registry.description}</p>
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-white/[0.08] bg-ink/70 px-3 py-2">
                  {unset ? (
                    <code className="min-w-0 flex-1 truncate font-mono text-xs text-slate-500">{registry.address}</code>
                  ) : (
                    <a
                      href={bscScanAddress(registry.address, BSC_CHAIN_ID)}
                      target="_blank"
                      rel="noreferrer"
                      className="min-w-0 flex-1 truncate font-mono text-xs text-slate-300 underline-offset-4 ring-focus hover:text-bnb hover:underline"
                    >
                      {registry.address}
                    </a>
                  )}
                  <CopyButton value={registry.address} label={`${registry.label} address`} />
                </div>
              </li>
            );
          })}
        </ul>

        <p className="mt-4 text-xs leading-relaxed text-slate-500">
          Addresses read from <code className="font-mono text-slate-400">NEXT_PUBLIC_ERC8004_*</code>. Until the BNB Chain
          deployment addresses are published they resolve to the zero address, and the marketplace runs on the deterministic
          demo index in <code className="font-mono text-slate-400">lib/data/agents.ts</code>. The same values are served in{' '}
          <code className="font-mono text-slate-400">/.well-known/agent.json</code> under{' '}
          <code className="font-mono text-slate-400">registries</code>.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-white/[0.08] pt-5">
          <Button type="button" disabled title="Automatic indexing covers every registered agent today">
            Submit for verification — coming soon
          </Button>
          <a
            href={ERC8004_SPEC_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-bnb ring-focus hover:text-bnb-300"
          >
            Read the ERC-8004 spec
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </a>
          <p className="text-xs text-slate-500">
            Manual review is for premium placement only — indexing needs no approval.
          </p>
        </div>
      </div>
    </section>
  );
}
