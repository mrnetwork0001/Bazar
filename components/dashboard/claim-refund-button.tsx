'use client';

/**
 * Claim an expired job's escrow back.
 *
 * The dashboard could already tell a client that a refund was claimable - it
 * reads the status and the expiry off the kernel and says so - and then left
 * them with the name of a function and no way to call it. The money was
 * visible, correctly described, and unreachable.
 *
 * `claimRefund` is one call, takes only the job id, and the kernel enforces
 * every condition itself: the caller must be the job's client, the status must
 * be FUNDED, and the expiry must have passed. So this deliberately re-checks
 * nothing. The button is offered when the page has already decided the refund
 * is claimable, and any disagreement between that reading and the chain is
 * settled by the revert, which is shown verbatim rather than reworded.
 */

import { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';

import { AGENTIC_COMMERCE_ABI } from '@/lib/abi';
import { getDeployment, type SupportedChainId } from '@/lib/chain/addresses';
import { Button } from '@/components/ui/button';
import { CircleCheck, ExternalLink, TriangleAlert } from '@/components/ui/icons';
import { bscScanTx } from '@/lib/utils';

export interface ClaimRefundButtonProps {
  jobId: bigint;
  chainId: SupportedChainId;
  /** Re-read the job from the chain once the refund confirms. */
  onRefunded?: () => void;
}

export function ClaimRefundButton({ jobId, chainId, onRefunded }: ClaimRefundButtonProps) {
  const [hash, setHash] = useState<`0x${string}` | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { writeContractAsync, isPending } = useWriteContract();

  const receipt = useWaitForTransactionReceipt({
    hash: hash ?? undefined,
    query: { enabled: hash !== null },
  });

  const confirmed = receipt.data?.status === 'success';
  if (confirmed && onRefunded) onRefunded();

  const claim = async () => {
    setError(null);
    try {
      const tx = await writeContractAsync({
        chainId,
        address: getDeployment(chainId).agenticCommerce,
        abi: AGENTIC_COMMERCE_ABI,
        functionName: 'claimRefund',
        args: [jobId],
      });
      setHash(tx);
    } catch (err) {
      // The kernel's own reason, not a paraphrase. "not expired yet" and
      // "not your job" are different problems and the caller needs to know
      // which one they have.
      const message = (err as Error)?.message?.split('\n')[0] ?? 'The wallet rejected the transaction.';
      setError(message);
    }
  };

  if (confirmed) {
    return (
      <p className="mt-3 flex items-center gap-2 text-xs text-emerald-300">
        <CircleCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Refunded. The kernel released the escrow back to this wallet.
        {hash && (
          <a
            href={bscScanTx(hash, chainId)}
            target="_blank"
            rel="noreferrer"
            className="ring-focus inline-flex items-center gap-1 rounded underline decoration-emerald-400/40 underline-offset-2 hover:text-emerald-200"
          >
            transaction
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        )}
      </p>
    );
  }

  return (
    <div className="mt-3">
      <Button
        type="button"
        size="sm"
        onClick={claim}
        loading={isPending || receipt.isLoading}
        disabled={isPending || receipt.isLoading}
      >
        {receipt.isLoading ? 'Confirming…' : `Claim refund of job ${jobId.toString()}`}
      </Button>

      {hash && !receipt.isLoading && !confirmed && (
        <p className="mt-2 text-[11px] text-slate-500">
          Sent as{' '}
          <a
            href={bscScanTx(hash, chainId)}
            target="_blank"
            rel="noreferrer"
            className="ring-focus rounded font-mono underline decoration-white/25 underline-offset-2 hover:text-slate-300"
          >
            {hash.slice(0, 10)}…
          </a>
        </p>
      )}

      {error && (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-rose-300">
          <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          <span className="break-words">{error}</span>
        </p>
      )}
    </div>
  );
}
