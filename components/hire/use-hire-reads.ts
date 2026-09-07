'use client';

/**
 * Live reads the hire flow needs before it will let anyone sign anything.
 *
 * All three of these are reads of real chain state through the wagmi transports
 * configured in `lib/wagmi.ts`, each pinned to an explicit `chainId` so nothing
 * silently depends on whichever network the wallet happens to be on. None of
 * them has a fallback value: when a read fails the hook says it failed and the
 * UI refuses to proceed, because every one of them gates something that moves
 * money.
 */

import { useMemo } from 'react';
import { useReadContract, useReadContracts } from 'wagmi';

import { AGENTIC_COMMERCE_ABI, ERC20_ABI, IDENTITY_REGISTRY_ABI } from '@/lib/abi';
import { getDeployment, type SupportedChainId } from '@/lib/chain/addresses';
import type { Address, IndexedAgent } from '@/lib/types';
import { isSupportedHireChain } from './hire-networks';
import { OPTIMISTIC_POLICY_ABI } from './optimistic-policy-abi';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/* ------------------------------------------------------------------ */
/* Who gets paid                                                       */
/* ------------------------------------------------------------------ */

export type ProviderSource = 'agent-wallet' | 'token-owner';

export type AgentProviderResolution =
  | { status: 'loading' }
  | { status: 'resolved'; address: Address; source: ProviderSource; registry: Address; registryChainId: number }
  | { status: 'refused'; reason: string };

/**
 * The address a funded job pays.
 *
 * This is the single most dangerous value in the flow: it is written into
 * `createJob` as `provider`, and the kernel releases the escrow to it on
 * completion. Getting it wrong sends real money to the wrong place, so it is
 * resolved from the ERC-8004 Identity Registry itself rather than from the
 * index, and the flow REFUSES to create a job when it cannot be resolved.
 *
 * Order, matching the registry's own semantics:
 *   1. `getAgentWallet(agentId)` - the operating wallet an agent nominates.
 *      Returns the zero address for an id it does not know, so zero is "not
 *      set" rather than an answer.
 *   2. `ownerOf(agentId)` - the ERC-721 holder. Reverts
 *      `ERC721NonexistentToken` for an unknown id, which is a refusal, not a
 *      fallback.
 *
 * Measured on the live registries 2026-08-28: both calls returned the same
 * address for every agent sampled (mainnet 705, 2468, 43129, 49637, 117823;
 * testnet 1, 2, 10, 100), and `getAgentWallet(999999999)` returned the zero
 * address while `ownerOf(999999999)` reverted.
 *
 * The index's `agent.owner` is deliberately NOT used as a third fallback. It is
 * an indexer's claim about the chain; when the chain itself is unreadable the
 * honest move is to refuse, not to fund an address on hearsay.
 */
export function useAgentProvider(agent: IndexedAgent): AgentProviderResolution {
  const registryChainId = agent.chainId;
  const supported = isSupportedHireChain(registryChainId);

  let tokenId: bigint | null = null;
  try {
    tokenId = /^[0-9]+$/.test(agent.tokenId) ? BigInt(agent.tokenId) : null;
  } catch {
    tokenId = null;
  }

  const enabled = supported && tokenId !== null;

  const { data, isPending, isError } = useReadContracts({
    allowFailure: true,
    contracts: enabled
      ? [
          {
            chainId: registryChainId as SupportedChainId,
            address: agent.registry,
            abi: IDENTITY_REGISTRY_ABI,
            functionName: 'getAgentWallet',
            args: [tokenId as bigint],
          },
          {
            chainId: registryChainId as SupportedChainId,
            address: agent.registry,
            abi: IDENTITY_REGISTRY_ABI,
            functionName: 'ownerOf',
            args: [tokenId as bigint],
          },
        ]
      : [],
    query: { enabled, staleTime: 60_000 },
  });

  return useMemo<AgentProviderResolution>(() => {
    if (!supported) {
      return {
        status: 'refused',
        reason: `This agent is registered on chain ${registryChainId}, which has no ERC-8183 commerce kernel Bazar can read. Its wallet cannot be resolved, so no job will be created.`,
      };
    }
    if (tokenId === null) {
      return {
        status: 'refused',
        reason: `The index gives this agent the token id "${agent.tokenId}", which is not a number the Identity Registry can be asked about. No job will be created.`,
      };
    }
    if (isPending && !data) return { status: 'loading' };

    const wallet = data?.[0];
    const owner = data?.[1];

    if (wallet?.status === 'success') {
      const value = wallet.result as Address;
      if (value && value.toLowerCase() !== ZERO_ADDRESS) {
        return {
          status: 'resolved',
          address: value,
          source: 'agent-wallet',
          registry: agent.registry,
          registryChainId,
        };
      }
    }
    if (owner?.status === 'success') {
      const value = owner.result as Address;
      if (value && value.toLowerCase() !== ZERO_ADDRESS) {
        return {
          status: 'resolved',
          address: value,
          source: 'token-owner',
          registry: agent.registry,
          registryChainId,
        };
      }
    }

    if (isError || wallet?.status === 'failure' || owner?.status === 'failure') {
      return {
        status: 'refused',
        reason:
          'The Identity Registry did not answer for this agent, so the address a funded job would pay is unknown. Bazar will not create a job against an address it could not read from the registry.',
      };
    }
    if (isPending) return { status: 'loading' };
    return {
      status: 'refused',
      reason:
        'The Identity Registry has no wallet and no owner recorded for this agent, so there is no address to pay. No job will be created.',
    };
  }, [agent.registry, agent.tokenId, data, isError, isPending, registryChainId, supported, tokenId]);
}

/* ------------------------------------------------------------------ */
/* What the wallet holds                                               */
/* ------------------------------------------------------------------ */

export interface TokenPosition {
  symbol: string;
  decimals: number;
  balance: bigint;
  /** How much of it the AgenticCommerce kernel may already move. */
  allowance: bigint;
}

export type TokenPositionState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; position: TokenPosition };

export interface TokenMeta {
  symbol: string;
  decimals: number;
}

export type TokenMetaState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; meta: TokenMeta };

/**
 * The payment token's own symbol and decimals.
 *
 * Separate from `usePaymentTokenPosition` because these are properties of the
 * token contract, not of any wallet, and reading them needs no address.
 *
 * They used to be fetched in the same batch as `balanceOf` and `allowance`,
 * which meant a disconnected reader could not learn them - and a budget cannot
 * be parsed without decimals, so `canReview` was false and the hire flow's
 * first step could not be left. The button offered no reason, because from its
 * point of view the budget was simply unparseable. Connecting a wallet fixed it
 * by accident, which is the worst way for a requirement to be communicated.
 *
 * A reader can now fill in a brief, a budget and a deadline, and read the whole
 * commitment, before being asked to connect anything.
 */
export function usePaymentTokenMeta(chainId: SupportedChainId): TokenMetaState {
  const deployment = getDeployment(chainId);

  const { data, isPending, isError } = useReadContracts({
    allowFailure: false,
    contracts: [
      { chainId, address: deployment.paymentToken, abi: ERC20_ABI, functionName: 'symbol' },
      { chainId, address: deployment.paymentToken, abi: ERC20_ABI, functionName: 'decimals' },
    ],
    // Immutable for the life of the contract; no reason to refetch it.
    query: { staleTime: Infinity },
  });

  return useMemo<TokenMetaState>(() => {
    if (isError) return { status: 'error' };
    if (!data) return isPending ? { status: 'loading' } : { status: 'error' };
    const [symbol, decimals] = data as unknown as [string, number];
    return { status: 'ready', meta: { symbol, decimals: Number(decimals) } };
  }, [data, isError, isPending]);
}

/**
 * Balance and kernel allowance for the payment token on one chain.
 *
 * The token is read for its own symbol and decimals rather than assumed. It
 * answered "United Stables" / `U` / 18 on both chains on 2026-08-28, and a
 * budget is denominated in that token - never in BNB. BNB is only ever spent on
 * gas here.
 */
export function usePaymentTokenPosition(
  chainId: SupportedChainId,
  owner: Address | undefined,
): TokenPositionState {
  const deployment = getDeployment(chainId);
  const enabled = Boolean(owner);

  const { data, isPending, isError } = useReadContracts({
    allowFailure: false,
    contracts: enabled
      ? [
          { chainId, address: deployment.paymentToken, abi: ERC20_ABI, functionName: 'symbol' },
          { chainId, address: deployment.paymentToken, abi: ERC20_ABI, functionName: 'decimals' },
          {
            chainId,
            address: deployment.paymentToken,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [owner as Address],
          },
          {
            chainId,
            address: deployment.paymentToken,
            abi: ERC20_ABI,
            functionName: 'allowance',
            args: [owner as Address, deployment.agenticCommerce],
          },
        ]
      : [],
    query: { enabled, staleTime: 15_000 },
  });

  return useMemo<TokenPositionState>(() => {
    if (!enabled) return { status: 'idle' };
    if (isError) return { status: 'error' };
    if (!data) return isPending ? { status: 'loading' } : { status: 'error' };
    const [symbol, decimals, balance, allowance] = data as unknown as [string, number, bigint, bigint];
    return {
      status: 'ready',
      position: { symbol, decimals: Number(decimals), balance, allowance },
    };
  }, [data, enabled, isError, isPending]);
}

/* ------------------------------------------------------------------ */
/* How long settlement takes                                           */
/* ------------------------------------------------------------------ */

export interface SettlementPolicy {
  /** Evaluator votes needed to decide a disputed job. */
  voteQuorum: number;
  /** Seconds a completed job can be disputed for. */
  disputeWindow: number;
  voterCount: number;
}

export type SettlementPolicyState =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'ready'; policy: SettlementPolicy };

/**
 * The OptimisticPolicy parameters for one chain, read live.
 *
 * These are the numbers that make the two networks genuinely different, and
 * they are admin-settable, so they are read rather than quoted from a note.
 * When the read fails the state is `unavailable` and the UI says nothing about
 * settlement timing at all.
 */
export function useSettlementPolicy(chainId: SupportedChainId): SettlementPolicyState {
  const deployment = getDeployment(chainId);
  const { data, isPending, isError } = useReadContracts({
    allowFailure: false,
    contracts: [
      { chainId, address: deployment.optimisticPolicy, abi: OPTIMISTIC_POLICY_ABI, functionName: 'voteQuorum' },
      { chainId, address: deployment.optimisticPolicy, abi: OPTIMISTIC_POLICY_ABI, functionName: 'disputeWindow' },
      {
        chainId,
        address: deployment.optimisticPolicy,
        abi: OPTIMISTIC_POLICY_ABI,
        functionName: 'activeVoterCount',
      },
    ],
    query: { staleTime: 300_000 },
  });

  return useMemo<SettlementPolicyState>(() => {
    if (isError) return { status: 'unavailable' };
    if (!data) return isPending ? { status: 'loading' } : { status: 'unavailable' };
    const [quorum, window_, voters] = data as unknown as [number, bigint, number];
    return {
      status: 'ready',
      policy: { voteQuorum: Number(quorum), disputeWindow: Number(window_), voterCount: Number(voters) },
    };
  }, [data, isError, isPending]);
}

/* ------------------------------------------------------------------ */
/* Kernel liveness                                                     */
/* ------------------------------------------------------------------ */

export type KernelPausedState = 'loading' | 'live' | 'paused' | 'unknown';

/**
 * Whether the kernel is accepting calls at all.
 *
 * `EnforcedPause()` is one of its declared errors. Both chains were unpaused on
 * 2026-08-28, but a paused kernel would reject every step of this flow, so it
 * is checked before the wallet is asked for anything.
 */
export function useKernelPaused(chainId: SupportedChainId): KernelPausedState {
  const deployment = getDeployment(chainId);
  const { data, isPending, isError } = useReadContract({
    chainId,
    address: deployment.agenticCommerce,
    abi: AGENTIC_COMMERCE_ABI,
    functionName: 'paused',
    query: { staleTime: 60_000 },
  });
  if (isError) return 'unknown';
  if (data === undefined) return isPending ? 'loading' : 'unknown';
  return data ? 'paused' : 'live';
}
