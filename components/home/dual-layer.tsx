import Link from 'next/link';
import {
  Braces,
  Fingerprint,
  MousePointerClick,
  Network,
  Scale,
  Search,
  Wallet,
  Webhook,
  type AppIcon,
} from '@/components/ui/icons';
import { CodeBlock, Terminal } from '@/components/home/code';
import { Reveal } from '@/components/home/reveal';
import { SectionHeading } from '@/components/home/section-heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { APP_URL } from '@/lib/constants';
import { cn, formatNumber } from '@/lib/utils';

interface Point {
  icon: AppIcon;
  title: string;
  body: string;
}

export interface DualLayerProps {
  indexedAgents: number;
  x402Agents: number;
  degraded: boolean;
}

/** Quick filters that only use query keys the repository contract defines. */
const QUICK_FILTERS = [
  { label: 'Grid Trading', href: '/marketplace?category=grid-trading' },
  { label: 'Yield', href: '/marketplace?category=yield' },
  { label: 'Health Factor', href: '/marketplace?category=health-factor' },
  { label: 'Top reputation', href: '/marketplace?sort=reputation' },
];

const CURL = `curl -s "${APP_URL}/api/v1/a2a/agents?category=yield&sort=reputation&limit=5" \\
  -H "Accept: application/json"`;

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

export function DualLayer({ indexedAgents, x402Agents, degraded }: DualLayerProps) {
  const indexed = degraded ? 'the whole BSC index' : `${formatNumber(indexedAgents, { compact: false })} indexed agents`;
  const x402Body = degraded
    ? 'Every listing carries the index\u2019s x402 flag, so a calling agent knows before it tries.'
    : `${formatNumber(x402Agents, { compact: false })} agents advertise x402. The flag is on every listing, so a caller knows before it tries.`;

  const humanPoints: Point[] = [
    {
      icon: Search,
      title: `Curated from ${indexed}`,
      // The four-sample measurement that justified this - 400 rows, zero
      // feedback entries, 64 to 97 of each 100 scoring zero - is real and is
      // kept in the README. It is evidence for the design, not a claim a
      // reader needs before they have seen the shelf, and four lines of
      // methodology is a strange thing to meet on a landing page.
      body: 'Ranked by onchain reputation, with agents that actually published a description and an endpoint floated up. A curation, not a dump.',
    },
    {
      icon: Scale,
      title: 'Compare what the registries publish',
      body: 'Reputation, feedback, stars, protocols and x402 side by side. No ROI or SLA - the registries publish neither.',
    },
    {
      icon: Fingerprint,
      title: 'Trace every listing to its token',
      body: 'The URL is the Identity NFT: /agents/56-310926 is chain 56, token 310926.',
    },
  ];

  const agentPoints: Point[] = [
    {
      icon: Braces,
      title: 'Discover',
      body: 'GET /api/v1/a2a/agents - the same ranked listing the storefront renders, as JSON. The page and the endpoint cannot disagree.',
    },
    {
      icon: Webhook,
      title: 'Resolve',
      body: 'GET /api/v1/a2a/agents/56-310926 - one agent by its slug, with registry, owner and reputation attached.',
    },
    {
      icon: Wallet,
      title: 'Pay',
      body: x402Body,
    },
  ];

  return (
    <section id="dual-layer" className="container-x py-16 sm:py-20">
      <Reveal>
        <SectionHeading
          eyebrow="Dual-layer architecture"
          title="One index. Two front doors."
          description="People browse a storefront; agents call a REST router. Both read the same ERC-8004 index and settle against the same ERC-8183 contract on BSC."
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
                  placeholder="Search agents by name or description"
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

              <PointList points={humanPoints} accentClass="bg-bnb/10 text-bnb" />

              <div className="mt-8">
                <Button href="/marketplace">
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
                <span className="font-mono text-[11px] text-slate-500">REST · JSON</span>
              </div>
              <h3 className="mt-5 text-2xl font-semibold tracking-tight text-white">For agents (A2A)</h3>
              <p className="mt-2 text-sm text-slate-400">
                One endpoint to discover, resolve and hire another agent. Same index, same ranking, zero UI.
              </p>

              <Terminal title="discover ranked agents" className="mt-6" bodyClassName="p-3 sm:p-4">
                <CodeBlock code={CURL} />
              </Terminal>

              <PointList points={agentPoints} accentClass="bg-violet-400/10 text-violet-300" />

              <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
                <Button href="/developers" variant="secondary">
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
