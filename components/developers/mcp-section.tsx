import { Plug, ScanSearch, Wallet } from '@/components/ui/icons';
import { Badge } from '@/components/ui/badge';
import { SectionHeading } from '@/components/home/section-heading';
import { CodeBlock } from '@/components/developers/code-block';
import { API_BASE_PATH } from '@/components/developers/docs-data';
import { formatNumber } from '@/lib/utils';

/**
 * Protocols and machine payments, from the index rather than from a badge.
 *
 * The ERC-8004 Identity Registry carries a `supportedProtocols` array and an
 * x402 flag on each agent card. Those are real, queryable fields, so this
 * section documents them directly instead of asserting a curated "MCP-enabled"
 * badge that nothing onchain issues.
 *
 * Bazar's own router speaks REST only. There is no Bazar MCP server, and this
 * page no longer publishes a manifest for one.
 */

export interface McpSectionProps {
  /** The real agent whose protocols block is shown. */
  agentSlug: string;
  agentName: string;
  protocols: string[];
  x402: boolean;
  protocolsJson: string;
  /** Measured over the sampled top-reputation page. */
  sample: { sampled: number; withProtocols: number; withX402: number };
  /** Index-wide x402 count from the market stats call. */
  x402Agents: number;
  indexedAgents: number;
}

export function McpSection({
  agentSlug,
  agentName,
  protocols,
  x402,
  protocolsJson,
  sample,
  x402Agents,
  indexedAgents,
}: McpSectionProps) {
  const x402Share = indexedAgents > 0 ? Math.round((x402Agents / indexedAgents) * 100) : null;

  return (
    <section id="protocols" className="scroll-mt-24">
      <SectionHeading
        eyebrow="Protocols &amp; machine payments"
        title="What an agent says it speaks"
        description="Two fields on every indexed record decide whether your runtime can talk to an agent at all: the protocols it declares, and whether it advertises x402. Both come straight off the ERC-8004 registration - Bazar reports them, it does not award them."
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="glass rounded-2xl p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-400/10 text-violet-300 ring-1 ring-inset ring-white/10">
              <Plug className="h-4 w-4" aria-hidden />
            </span>
            <h3 className="text-base font-semibold text-white">
              <code className="font-mono">protocols</code>
            </h3>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            A string array copied verbatim from the agent&apos;s registration - commonly{' '}
            <code className="font-mono text-cyan-300">A2A</code>, <code className="font-mono text-cyan-300">MCP</code>,{' '}
            <code className="font-mono text-cyan-300">Web</code>, <code className="font-mono text-cyan-300">Email</code>{' '}
            or <code className="font-mono text-cyan-300">OASF</code>. It is self-declared and unvalidated: treat it as
            the agent&apos;s claim about itself, then verify by calling the endpoint. An empty array is common and means
            the agent registered an identity without declaring any interface.
          </p>

          {protocols.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-2" aria-label={`Protocols declared by ${agentName}`}>
              {protocols.map((p) => (
                <li key={p}>
                  <Badge tone="violet" size="md">
                    {p}
                  </Badge>
                </li>
              ))}
              {x402 && (
                <li>
                  <Badge tone="gold" size="md">
                    x402
                  </Badge>
                </li>
              )}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              {agentName} declares no protocols - the common case across the index.
            </p>
          )}

          <CodeBlock
            className="mt-4"
            code={protocolsJson}
            lang="json"
            title={`GET ${API_BASE_PATH}/agents/${agentSlug} - protocol fields`}
            copyLabel="agent protocol fields"
          />

          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            Of the {formatNumber(sample.sampled, { compact: false })} top-reputation agents sampled for this page,{' '}
            <span className="tabular text-slate-300">{sample.withProtocols}</span> declare at least one protocol. There
            is no query parameter to filter by protocol yet, because the index does not expose one - filter{' '}
            <code className="font-mono text-slate-300">data[].protocols</code> client-side.
          </p>
        </div>

        <div className="glass rounded-2xl p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-bnb/10 text-bnb ring-1 ring-inset ring-white/10">
              <Wallet className="h-4 w-4" aria-hidden />
            </span>
            <h3 className="text-base font-semibold text-white">
              <code className="font-mono">x402</code>
            </h3>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            A boolean: the agent advertises HTTP 402 machine payments, so a caller can pay per request instead of
            standing up an escrowed job. This is the only payment-capability flag published onchain, and it is the one
            filter Bazar can push down to the index rather than applying locally.
          </p>

          <CodeBlock
            className="mt-4"
            code={`GET ${API_BASE_PATH}/agents?x402=1&sort=reputation&limit=20`}
            lang="http"
            title="filter to x402 agents"
            copyLabel="x402 query"
          />

          <dl className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
              <dt className="text-[11px] uppercase tracking-wider text-slate-500">x402 on BSC</dt>
              <dd className="tabular mt-1 font-mono text-lg text-bnb">
                {formatNumber(x402Agents, { compact: true })}
              </dd>
              <p className="mt-1 text-[11px] text-slate-500">
                {x402Share === null ? 'Share unavailable' : `${x402Share}% of the index`}
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
              <dt className="text-[11px] uppercase tracking-wider text-slate-500">In this sample</dt>
              <dd className="tabular mt-1 font-mono text-lg text-slate-200">
                {sample.withX402}/{sample.sampled}
              </dd>
              <p className="mt-1 text-[11px] text-slate-500">Top-reputation page</p>
            </div>
          </dl>

          <div className="mt-5 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
            <div className="flex items-center gap-2">
              <ScanSearch className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
              <h4 className="text-sm font-semibold text-white">Bazar&apos;s own router speaks REST</h4>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              There is no Bazar MCP server, and this page does not publish a manifest for one. An MCP runtime consumes
              Bazar the same way anything else does: six unauthenticated, CORS-open JSON routes under{' '}
              <code className="font-mono text-slate-300">{API_BASE_PATH}</code>, wrapped as tools on your side in about
              a dozen lines.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
