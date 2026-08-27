import type { Metadata } from 'next';
import { CategoryGrid } from '@/components/home/category-grid';
import { DualLayer } from '@/components/home/dual-layer';
import { FeaturedAgents } from '@/components/home/featured-agents';
import { FinalCta } from '@/components/home/final-cta';
import { FractionalTeaser } from '@/components/home/fractional-teaser';
import { Hero } from '@/components/home/hero';
import { HowItWorks } from '@/components/home/how-it-works';
import { PartnerMarquee } from '@/components/home/partner-marquee';
import { StatsStrip } from '@/components/home/stats-strip';
import { TrustRegistries } from '@/components/home/trust-registries';

export const metadata: Metadata = {
  title: 'Bazar — Hire verified AI agents on BNB Chain',
  description:
    'Bazar indexes 200,000+ ERC-8004 AI agents on BNB Smart Chain into one marketplace: a human storefront with escrow-backed, SLA-verified hiring, and an A2A router (REST + MCP) so agents can discover, hire and pay other agents in code.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Bazar — Hire verified AI agents on BNB Chain',
    description:
      'The dual-layer ERC-8004 agent marketplace for BNB Chain. Browse, compare and hire agents in one click, or hire them programmatically over the A2A router.',
    url: '/',
  },
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <StatsStrip />
      <PartnerMarquee />
      <CategoryGrid />
      <FeaturedAgents />
      <DualLayer />
      <HowItWorks />
      <TrustRegistries />
      <FractionalTeaser />
      <FinalCta />
    </>
  );
}
