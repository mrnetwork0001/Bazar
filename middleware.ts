import { NextResponse, type NextRequest } from 'next/server';

import { SUPPORTED_CHAIN_IDS } from '@/lib/indexer/scan-client';

/**
 * Agent detail slugs are "<chainId>-<tokenId>" (e.g. "56-49637"). Anything
 * else - including Bazar's retired pre-index slugs like "gridforge-pro" - can
 * never name an ERC-8004 identity, so it is a real 404.
 *
 * The check lives in middleware rather than in the page because /agents/[id]
 * renders as a streamed dynamic segment: by the time `notFound()` throws, the
 * response head has been committed and the status is pinned at 200. Rewriting
 * to an unrouted path here makes Next serve the not-found page with a true 404.
 *
 * A well-formed slug that the index cannot resolve is NOT sent here - that is a
 * different claim ("we could not look it up") and the page renders
 * `UnresolvedAgent` at 200 instead of asserting the identity does not exist.
 *
 * The chain id is pinned to the BNB Chain deployments Bazar reads, built from
 * the same `SUPPORTED_CHAIN_IDS` the data layer narrows on so the two cannot
 * drift apart. 8004scan answers for Ethereum, Base and the rest, and a bare
 * `\d+-\d+` let an Ethereum identity render inside the BSC storefront with
 * BscScan links pointing at the wrong chain - an offchain claim Bazar cannot
 * back. `resolveAgentDetail` refuses the same chains independently; this is the
 * copy of the rule that gets the status code right.
 */
const AGENT_SLUG = new RegExp(`^(?:${SUPPORTED_CHAIN_IDS.join('|')})-\\d+$`);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith('/agents/')) return NextResponse.next();

  const slug = pathname.slice('/agents/'.length);

  // A malformed percent-escape makes `decodeURIComponent` throw, and an
  // uncaught throw in middleware is a 500 on every route the matcher covers.
  // An undecodable slug can never be "<chainId>-<tokenId>", so it is a 404.
  let decoded: string;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    decoded = '';
  }

  if (!AGENT_SLUG.test(decoded)) {
    const url = request.nextUrl.clone();
    url.pathname = '/_bazar_unroutable';
    return NextResponse.rewrite(url, { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/agents/:slug*',
};
