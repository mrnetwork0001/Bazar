import Link from 'next/link';
import { SearchX } from '@/components/ui/icons';
import { DEPLOYMENTS, type SupportedChainId } from '@/lib/chain/addresses';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface UnresolvedAgentProps {
  chainId: number;
  tokenId: string;
  className?: string;
}

/**
 * "Not resolvable" - a distinct state from "does not exist".
 *
 * The slug is well formed and names a real network, but the index returned no
 * record for that token id: either it has not indexed the identity, or it is
 * unreachable right now. Bazar cannot tell those apart from the outside, and
 * neither one justifies a 404 that asserts the agent does not exist.
 */
export function UnresolvedAgent({ chainId, tokenId, className }: UnresolvedAgentProps) {
  const deployment = DEPLOYMENTS[chainId as SupportedChainId] as (typeof DEPLOYMENTS)[SupportedChainId] | undefined;
  const explorer = deployment?.explorer ?? 'https://bscscan.com';
  const registry = deployment?.identityRegistry;
  const tokenUrl = registry ? `${explorer}/token/${registry}?a=${tokenId}` : undefined;

  return (
    <div className={cn('container-x pb-24 pt-16 sm:pt-24', className)}>
      <div className="mx-auto max-w-xl rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 text-center backdrop-blur-xl sm:p-8">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.04]">
          <SearchX className="h-5 w-5 text-slate-400" aria-hidden />
        </span>
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-white sm:text-2xl">
          Agent #{tokenId} could not be resolved
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-400">
          The ERC-8004 index returned no record for token #{tokenId} on{' '}
          {deployment?.name ?? `chain ${chainId}`}. Either the identity was never registered there, or the index is
          not answering at the moment - from here those look the same.
        </p>
        <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-slate-500">
          So Bazar says what it actually knows instead of asserting the agent does not exist. The registry itself is
          the authority; check it directly below.
        </p>

        <div className="mt-6 flex flex-col justify-center gap-2.5 sm:flex-row">
          <Button href="/marketplace" variant="primary">
            Back to the marketplace
          </Button>
          {tokenUrl && (
            <Button
              href={tokenUrl}
              external
              variant="outline"
            >
              Check the registry on BscScan
            </Button>
          )}
        </div>

        <p className="mt-5 text-[11px] text-slate-600">
          Looking for something specific?{' '}
          <Link href="/marketplace" className="text-slate-400 underline-offset-2 hover:text-bnb hover:underline ring-focus">
            Search the ranked index
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
