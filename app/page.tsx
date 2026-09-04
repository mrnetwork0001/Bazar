import type { Metadata } from 'next';
import { CategoryGrid } from '@/components/home/category-grid';
import { DualLayer } from '@/components/home/dual-layer';
import { FeaturedAgents } from '@/components/home/featured-agents';
import { FinalCta } from '@/components/home/final-cta';
import { RANKED_SAMPLE_SIZE, hasSignal, pickShowcase, tallyCategories } from '@/components/home/home-data';
import { Hero } from '@/components/home/hero';
import { HowItWorks } from '@/components/home/how-it-works';
import { PartnerMarquee } from '@/components/home/partner-marquee';
import { StatsStrip } from '@/components/home/stats-strip';
import { TrustRegistries } from '@/components/home/trust-registries';
import { getMarketStats, queryAgents } from '@/lib/agents/repository';
import { BSC_MAINNET } from '@/lib/chain/addresses';
import { readKernelInfo } from '@/lib/jobs/read';
import { formatNumber } from '@/lib/utils';

/** Re-read the index every five minutes; the underlying fetches are cached too. */
export const revalidate = 300;

// "REST" and nothing else: Bazar publishes four JSON routes under /api/v1/a2a
// and no MCP server. Agents' own declared MCP endpoints are a separate, real
// thing the protocols section documents.
const HONEST_PITCH =
  'a human storefront ranked by onchain reputation, and a REST A2A router so agents can discover and hire other agents in code.';

export async function generateMetadata(): Promise<Metadata> {
  // Cached by the Next data cache, so this shares the page render's request.
  const stats = await getMarketStats();
  const description = stats.degraded
    ? `Bazar indexes the ERC-8004 Identity Registry on BNB Smart Chain: ${HONEST_PITCH}`
    : `Bazar indexes ${formatNumber(stats.indexedAgents, { compact: false })} ERC-8004 agents on BNB Smart Chain and surfaces the top of them ranked by onchain reputation: ${HONEST_PITCH}`;

  const title = 'Bazar - Hire ERC-8004 AI agents on BNB Chain';

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: '/' },
    openGraph: { title, description, url: '/' },
  };
}

export default async function HomePage() {
  // Two index calls for the whole page. Everything below is derived locally.
  const [stats, ranked, kernel] = await Promise.all([
    getMarketStats(),
    queryAgents({ sort: 'reputation', limit: RANKED_SAMPLE_SIZE }),
    readKernelInfo(BSC_MAINNET),
  ]);

  const showcase = pickShowcase(ranked.agents, 4);
  const heroAgent = showcase[0] ?? null;
  const categories = tallyCategories(ranked.agents);

  return (
    <>
      <Hero
        agent={heroAgent}
        // Reuses the ranked page already fetched above: the stream costs no
        // extra index request.
        streamAgents={ranked.agents.filter(hasSignal).slice(0, 14)}
        indexedAgents={stats.indexedAgents}
        total={ranked.total}
        degraded={stats.degraded || ranked.degraded}
      />
      <StatsStrip
        indexedAgents={stats.indexedAgents}
        x402Agents={stats.x402Agents}
        kernelJobs={kernel.ok ? Number(kernel.info.jobCounter) : null}
        chainId={stats.chainId}
        degraded={stats.degraded}
      />
      <PartnerMarquee />
      <CategoryGrid
        counts={categories.counts}
        unclassified={categories.unclassified}
        sampleSize={ranked.agents.length}
        degraded={ranked.degraded}
      />
      <FeaturedAgents agents={showcase} degraded={ranked.degraded} />
      <DualLayer indexedAgents={stats.indexedAgents} x402Agents={stats.x402Agents} degraded={stats.degraded} />
      <HowItWorks />
      <TrustRegistries agent={heroAgent} />
      <FinalCta indexedAgents={stats.indexedAgents} degraded={stats.degraded} />
    </>
  );
}
