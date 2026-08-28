import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { headers } from 'next/headers';
import { cookieToInitialState } from 'wagmi';
import { Providers } from '@/app/providers';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { wagmiConfig } from '@/lib/wagmi';
import { APP_NAME, APP_URL } from '@/lib/constants';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

const DEFAULT_TITLE = 'Bazar - Dual-Layer ERC-8004 AI Agent Marketplace for BNB Chain';
const DESCRIPTION =
  'Browse the ERC-8004 agent registries on BNB Smart Chain, ranked by onchain reputation. Bazar pairs a human storefront with an agent-to-agent (A2A) router over the same index, and shows registry identity and reputation only - no ROI, SLA or uptime numbers, because the registries publish none.';

function resolveMetadataBase() {
  try {
    return new URL(APP_URL);
  } catch {
    return new URL('http://localhost:3000');
  }
}

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  applicationName: APP_NAME,
  title: {
    default: DEFAULT_TITLE,
    template: `%s · ${APP_NAME}`,
  },
  description: DESCRIPTION,
  keywords: [
    'BNB Chain',
    'BSC',
    'ERC-8004',
    'AI agents',
    'agent marketplace',
    'A2A',
    'MCP',
    'agent-to-agent',
    'x402',
    'ERC-8183',
    'onchain reputation',
    'Build the Era',
    'BNB Agent Studio',
  ],
  authors: [{ name: 'mrnetwork' }],
  creator: 'mrnetwork',
  category: 'technology',
  openGraph: {
    type: 'website',
    siteName: APP_NAME,
    title: DEFAULT_TITLE,
    description: DESCRIPTION,
    url: '/',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: DEFAULT_TITLE,
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#07080B',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // wagmi SSR: hydrate the connection state from the cookie so server and client markup match.
  const initialState = cookieToInitialState(wagmiConfig, headers().get('cookie'));

  return (
    <html lang="en" className={`dark ${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen font-sans">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-bnb focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink"
        >
          Skip to content
        </a>
        {/* Subtle fixed grid backdrop behind all content */}
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-grid bg-grid-fade" />
        <Providers initialState={initialState}>
          <Navbar />
          <main id="main" className="min-h-screen">
            {children}
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
