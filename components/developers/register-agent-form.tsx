'use client';

/**
 * List an agent, signed from the owner's own wallet.
 *
 * This is the same shape as hiring: Bazar validates the inputs and builds the
 * calldata, the wallet signs it, and the chain is the only authority. Bazar
 * never holds the identity and cannot approve or reject a listing - the agent
 * appears in the marketplace because the registry accepted it, not because
 * Bazar did.
 *
 * The card is embedded in the tokenURI as a base64 data URI, so there is no
 * host to keep alive. The agentId is read from the `Registered` event on the
 * receipt rather than from a counter, which races with every other mint.
 */

import { useCallback, useMemo, useState } from 'react';
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from 'wagmi';
import { decodeEventLog } from 'viem';
import { IDENTITY_REGISTRY_ABI } from '@/lib/abi';
import { BSC_MAINNET, getDeployment } from '@/lib/chain/addresses';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConnectButton } from '@/components/wallet/connect-button';
import { CheckCircle2, TriangleAlert } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

interface ServiceRow {
  name: string;
  endpoint: string;
}

type Phase = 'form' | 'preparing' | 'signing' | 'confirming' | 'done';

interface Prepared {
  agentURI: string;
  agentURIBytes: number;
  registry: `0x${string}`;
  notes: string[];
}

const FIELD =
  'w-full rounded-lg border border-white/[0.10] bg-ink/60 px-3 py-2 text-sm text-white placeholder:text-slate-600 ring-focus';

export function RegisterAgentForm() {
  const account = useAccount();
  const { switchChain } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: BSC_MAINNET });
  const { writeContractAsync } = useWriteContract();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [services, setServices] = useState<ServiceRow[]>([{ name: 'A2A', endpoint: '' }]);
  const [phase, setPhase] = useState<Phase>('form');
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const deployment = getDeployment(BSC_MAINNET);
  const onMainnet = account.chainId === BSC_MAINNET;
  const connected = account.status === 'connected' && !!account.address;

  const ready = useMemo(
    () => name.trim().length >= 2 && description.trim().length >= 10 && services.some((s) => s.endpoint.trim()),
    [name, description, services],
  );

  const submit = useCallback(async () => {
    setError(null);
    if (!account.address || !publicClient) return;
    try {
      // 1. Bazar validates and builds the card + calldata. Same endpoint an
      //    autonomous agent would POST to; the UI is just another caller.
      setPhase('preparing');
      const res = await fetch('/api/v1/a2a/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          owner: account.address,
          name: name.trim(),
          description: description.trim(),
          services: services.filter((s) => s.endpoint.trim()).map((s) => ({ name: s.name, endpoint: s.endpoint.trim() })),
        }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        setError(body?.error?.message ?? 'Bazar could not build the registration.');
        setPhase('form');
        return;
      }
      setPrepared({
        agentURI: body.agentURI,
        agentURIBytes: body.agentURIBytes,
        registry: body.registry,
        notes: body.notes ?? [],
      });

      // 2. The owner signs. Bazar holds no key and never sees one.
      setPhase('signing');
      const hash = await writeContractAsync({
        address: body.registry,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: 'register',
        args: [body.agentURI],
        chainId: BSC_MAINNET,
      });
      setTxHash(hash);

      // 3. The id comes off the event, never off a counter.
      setPhase('confirming');
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== String(body.registry).toLowerCase()) continue;
        try {
          const decoded = decodeEventLog({ abi: IDENTITY_REGISTRY_ABI, data: log.data, topics: log.topics });
          if (decoded.eventName === 'Registered') {
            setAgentId(String((decoded.args as { agentId: bigint }).agentId));
            break;
          }
        } catch {
          // not the event we want; keep looking rather than assuming order
        }
      }
      setPhase('done');
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      setError(
        msg.toLowerCase().includes('user rejected') || msg.toLowerCase().includes('denied')
          ? 'You rejected the signature. Nothing was submitted.'
          : msg.split('\n')[0].slice(0, 200),
      );
      setPhase('form');
    }
  }, [account.address, publicClient, name, description, services, writeContractAsync]);

  if (phase === 'done') {
    return (
      <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/[0.06] p-5">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-300" aria-hidden />
          <h4 className="text-base font-semibold text-white">Registered on {deployment.name}</h4>
        </div>
        <dl className="mt-4 space-y-2 text-sm">
          {agentId && (
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">Agent ID</dt>
              <dd className="tabular font-mono text-white">#{agentId}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <dt className="text-slate-400">Transaction</dt>
            <dd>
              <a
                href={`${deployment.explorer}/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                className="ring-focus font-mono text-xs text-bnb hover:underline"
              >
                {txHash?.slice(0, 18)}…
              </a>
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-xs leading-relaxed text-slate-400">
          The index picks new registrations up on its next pass, after which the agent is listed in the marketplace.
          Bazar approves nothing: it is listed because the registry accepted it.
        </p>
        {agentId && (
          <Button href={`/agents/${BSC_MAINNET}-${agentId}`} variant="secondary" size="sm" className="mt-4">
            View the agent page
          </Button>
        )}
      </div>
    );
  }

  const busy = phase !== 'form';

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-base font-semibold text-white">List an agent</h4>
        <Badge tone="gold">Signs from your wallet</Badge>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
        Bazar builds the ERC-8004 card and the calldata; your wallet mints the identity. The same request an autonomous
        agent would POST to <span className="font-mono text-slate-300">/api/v1/a2a/register</span>.
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <label htmlFor="ra-name" className="text-[11px] uppercase tracking-wider text-slate-500">
            Name
          </label>
          <input id="ra-name" className={cn(FIELD, 'mt-1')} value={name} onChange={(e) => setName(e.target.value)} placeholder="Grid Sentinel" disabled={busy} />
        </div>
        <div>
          <label htmlFor="ra-desc" className="text-[11px] uppercase tracking-wider text-slate-500">
            Description
          </label>
          <textarea
            id="ra-desc"
            className={cn(FIELD, 'mt-1 min-h-[72px] resize-y')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What the agent does, and what a hirer gets. This is what the marketplace shows."
            disabled={busy}
          />
        </div>
        {services.map((s, i) => (
          <div key={i} className="flex gap-2">
            <select
              aria-label={`Service ${i + 1} protocol`}
              className={cn(FIELD, 'w-28 shrink-0')}
              value={s.name}
              disabled={busy}
              onChange={(e) => setServices((r) => r.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
            >
              {['A2A', 'MCP', 'Web', 'Email'].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <input
              aria-label={`Service ${i + 1} endpoint`}
              className={FIELD}
              value={s.endpoint}
              disabled={busy}
              placeholder="https://my-agent.example/a2a"
              onChange={(e) => setServices((r) => r.map((x, j) => (j === i ? { ...x, endpoint: e.target.value } : x)))}
            />
          </div>
        ))}
        <button
          type="button"
          disabled={busy}
          onClick={() => setServices((r) => [...r, { name: 'Web', endpoint: '' }])}
          className="ring-focus text-xs text-slate-400 hover:text-white"
        >
          Add another endpoint
        </button>
      </div>

      {prepared && (
        <p className="mt-4 text-xs text-slate-500">
          Card embedded in the tokenURI as a data URI, {prepared.agentURIBytes} bytes. No host to keep alive.
        </p>
      )}
      {prepared?.notes.map((n) => (
        <p key={n} className="mt-2 text-xs leading-relaxed text-amber-200/80">
          {n}
        </p>
      ))}

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-rose-400/30 bg-rose-400/[0.06] p-3">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" aria-hidden />
          <p className="text-xs leading-relaxed text-rose-200">{error}</p>
        </div>
      )}

      <div className="mt-5">
        {!connected ? (
          <ConnectButton fullWidth />
        ) : !onMainnet ? (
          <Button variant="secondary" size="md" onClick={() => switchChain({ chainId: BSC_MAINNET })} className="w-full">
            Switch to {deployment.name}
          </Button>
        ) : (
          <Button variant="primary" size="md" onClick={submit} disabled={!ready || busy} loading={busy} className="w-full">
            {phase === 'preparing'
              ? 'Building the card'
              : phase === 'signing'
                ? 'Awaiting signature'
                : phase === 'confirming'
                  ? 'Confirming onchain'
                  : 'Register on ' + deployment.name}
          </Button>
        )}
      </div>
    </div>
  );
}
