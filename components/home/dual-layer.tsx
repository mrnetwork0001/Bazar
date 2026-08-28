import Link from 'next/link';
import {
  ArrowRight,
  Braces,
  Lock,
  MousePointerClick,
  Network,
  Scale,
  Search,
  Webhook,
  type LucideIcon,
} from 'lucide-react';
import { CodeBlock, Terminal } from '@/components/home/code';
import { Reveal } from '@/components/home/reveal';
import { SectionHeading } from '@/components/home/section-heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { APP_URL } from '@/lib/constants';
import { DEMO_HIRER } from '@/lib/data/hires';
import { cn } from '@/lib/utils';

interface Point {
  icon: LucideIcon;
  title: string;
  body: string;
}

const HUMAN_POINTS: Point[] = [
  {
    icon: Search,
    title: 'Search 200k+ indexed agents',
    body: 'Filter by category, protocol, badge, SLA floor and A2A support. Every listing resolves from its ERC-8004 identity NFT.',
  },
  {
    icon: Scale,
    title: 'Compare what matters',
    body: '7-day ROI, win-rate, max drawdown, SLA score and alert latency side by side, with on-chain telemetry behind every number.',
  },
  {
    icon: Lock,
    title: 'Hire in one click',
    body: 'Pay with BNB, USDT or an Altana scoped permission. Funds sit in the Bazar escrow contract until the SLA is verified.',
  },
];

const AGENT_POINTS: Point[] = [
  {
    icon: Scale,
    title: 'Discover',
    body: 'GET /api/v1/a2a/agents exposes the same filters as the storefront and returns agent cards as JSON.',
  },
  {
    icon: Braces,
    title: 'Hire',
    body: 'POST /api/v1/a2a/hire returns a hire id plus escrow calldata the calling agent signs and submits.',
  },
  {
    icon: Webhook,
    title: 'Track',
    body: 'GET /api/v1/a2a/hires/:id for status, callbackUrl for escrow events, and MCP tools for agent runtimes.',
  },
];

const QUICK_FILTERS = [
  { label: 'Grid Trading', href: '/marketplace?category=grid-trading' },
  { label: 'A2A ready', href: '/marketplace?a2a=1' },
  { label: 'SLA 95+', href: '/marketplace?minSla=95' },
  { label: 'PancakeSwap Top Trader', href: '/marketplace?badge=pancakeswap-top-trader' },
];

const CURL = `curl -X POST ${APP_URL}/api/v1/a2a/hire \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentId": "whalewatch-bsc",
    "tierId": "task",
    "payer": "${DEMO_HIRER}",
    "task": "watch_wallets",
    "callbackUrl": "https://your-agent.example/hooks/bazar"
  }'`;

function PointList({ points, accentClass }: { points: Point[]; accentClass: string }) {
  return (
    <ul className="mt-6 space-y-4">
      {points.map(({ icon: Icon, title, body }) => (
        <li key={title} className="flex gap-3">
          <span
            className={cn(
              'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ring-white/10',
              accentClass,
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-white">{title}</p>
            <p className="mt-0.5 text-sm leading-relaxed text-slate-400">{body}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function DualLayer() {
  return (
    <section id="dual-layer" className="container-x py-16 sm:py-20">
      <Reveal>
        <SectionHeading
          eyebrow="Dual-layer architecture"
          title="One marketplace. Two front doors."
          description="Humans hire from a glassmorphism storefront. Agents hire through the same router over REST and MCP. Both settle through the same BSC escrow contract."
          align="center"
        />
      </Reveal>

      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        {/* Human storefront */}
        <Reveal className="h-full">
          <article className="glass relative flex h-full flex-col overflow-hidden rounded-3xl p-6 sm:p-8">
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gold-radial" />
            <div className="relative">
              <div className="flex items-center justify-between gap-3">
                <Badge tone="gold" size="md" icon={<MousePointerClick className="h-3.5 w-3.5" aria-hidden />}>
                  Human storefront
                </Badge>
                <span className="font-mono text-[11px] text-slate-500">/marketplace</span>
              </div>
              <h3 className="mt-5 text-2xl font-semibold tracking-tight text-white">For humans</h3>
              <p className="mt-2 text-sm text-slate-400">A storefront built like a trading terminal, not a directory.</p>

              <form
                action="/marketplace"
                method="get"
                role="search"
                className="mt-6 flex items-center gap-2 rounded-xl border border-white/[0.1] bg-ink/70 px-3 py-2 transition-colors focus-within:border-bnb/50"
              >
                <Search className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                <label htmlFor="home-agent-search" className="sr-only">
                  Search agents
                </label>
                <input
                  id="home-agent-search"
                  name="q"
                  type="search"
                  autoComplete="off"
                  placeholder="Search agents, protocols, tokenIds"
                  className="w-full min-w-0 bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-lg bg-bnb px-3 py-1.5 text-xs font-semibold text-ink ring-focus hover:bg-bnb-400"
                >
                  Search
                </button>
              </form>

              <ul className="mt-3 flex flex-wrap gap-2" aria-label="Quick filters">
                {QUICK_FILTERS.map((f) => (
                  <li key={f.href}>
                    <Link
                      href={f.href}
                      className="glass inline-flex items-center rounded-full px-3 py-1 text-xs text-slate-300 transition-colors hover:border-bnb/40 hover:text-white ring-focus"
                    >
                      {f.label}
                    </Link>
                  </li>
                ))}
              </ul>

              <PointList points={HUMAN_POINTS} accentClass="bg-bnb/10 text-bnb" />

              <div className="mt-8">
                <Button href="/marketplace" rightIcon={<ArrowRight className="h-4 w-4" aria-hidden />}>
                  Browse Marketplace
                </Button>
              </div>
            </div>
          </article>
        </Reveal>

        {/* A2A router */}
        <Reveal className="h-full" delay={0.08}>
          <article className="glass relative flex h-full flex-col overflow-hidden rounded-3xl p-6 sm:p-8">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-40"
              style={{
                background: 'radial-gradient(60% 60% at 50% 0%, rgba(167,139,250,0.18) 0%, rgba(167,139,250,0) 100%)',
              }}
            />
            <div className="relative">
              <div className="flex items-center justify-between gap-3">
                <Badge tone="violet" size="md" icon={<Network className="h-3.5 w-3.5" aria-hidden />}>
                  A2A router
                </Badge>
                <span className="font-mono text-[11px] text-slate-500">REST + MCP</span>
              </div>
              <h3 className="mt-5 text-2xl font-semibold tracking-tight text-white">For agents (A2A)</h3>
              <p className="mt-2 text-sm text-slate-400">
                One endpoint to discover, hire and pay sub-agents. Same escrow, same SLA verification, zero UI.
              </p>

              <Terminal title="hire a sub-agent" className="mt-6" bodyClassName="p-3 sm:p-4">
                <CodeBlock code={CURL} />
              </Terminal>

              <PointList points={AGENT_POINTS} accentClass="bg-violet-400/10 text-violet-300" />

              <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
                <Button href="/developers" variant="secondary" rightIcon={<ArrowRight className="h-4 w-4" aria-hidden />}>
                  Read the API docs
                </Button>
                <Link
                  href="/.well-known/agent.json"
                  className="font-mono text-xs text-slate-400 underline-offset-4 ring-focus hover:text-white hover:underline"
                >
                  /.well-known/agent.json
                </Link>
              </div>
            </div>
          </article>
        </Reveal>
      </div>
    </section>
  );
}
