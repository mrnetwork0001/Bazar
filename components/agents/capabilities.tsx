import { Layers, Radio, ShieldCheck, Tag, Terminal } from '@/components/ui/icons';
import type { IndexedAgent } from '@/lib/types';
import type { AgentEndpoint } from '@/components/agents/agent-detail';
import { CATEGORY_MAP } from '@/lib/data/categories';
import { protocolMeta, X402_META, type ProtocolMeta } from '@/components/agents/protocol-meta';
import { cn } from '@/lib/utils';

/* ------------------------------- endpoints ------------------------------ */

function isHttp(url: string) {
  return /^https?:\/\//i.test(url);
}

function isEmail(url: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(url);
}

/** Strips the scheme so a long URL still reads at 375px. */
function displayUrl(url: string) {
  return url.replace(/^https?:\/\//i, '');
}

function EndpointCard({ endpoint }: { endpoint: AgentEndpoint }) {
  const meta = protocolMeta(endpoint.protocol);
  const Icon = meta.icon;
  const href = isHttp(endpoint.url) ? endpoint.url : isEmail(endpoint.url) ? `mailto:${endpoint.url}` : null;

  const facts: string[] = [];
  if (endpoint.version) facts.push(`v${endpoint.version.replace(/^v/i, '')}`);
  if (endpoint.toolCount !== null) facts.push(`${endpoint.toolCount} ${endpoint.toolCount === 1 ? 'tool' : 'tools'}`);
  if (endpoint.skillCount !== null)
    facts.push(`${endpoint.skillCount} ${endpoint.skillCount === 1 ? 'skill' : 'skills'}`);

  return (
    <li className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition-colors duration-200 hover:border-white/[0.14] hover:bg-white/[0.04]">
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border"
        style={{ borderColor: `${meta.accentHex}40`, background: `${meta.accentHex}14`, color: meta.accentHex }}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-xs font-semibold text-white">{meta.label}</span>
          {facts.length > 0 && <span className="tabular text-[10px] text-slate-500">{facts.join(' · ')}</span>}
        </div>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer nofollow"
            title={endpoint.url}
            className="mt-1 inline-flex max-w-full items-center gap-1 rounded font-mono text-[11px] text-slate-400 transition-colors hover:text-bnb ring-focus"
          >
            <span className="truncate">{displayUrl(endpoint.url)}</span>
          </a>
        ) : (
          <p className="mt-1 truncate font-mono text-[11px] text-slate-400" title={endpoint.url}>
            {displayUrl(endpoint.url)}
          </p>
        )}
        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">{meta.blurb}</p>
      </div>
    </li>
  );
}

/** Fallback row when the index knows the protocol but resolved no endpoint. */
function DeclarationCard({ meta }: { meta: ProtocolMeta }) {
  const Icon = meta.icon;
  return (
    <li className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border"
        style={{ borderColor: `${meta.accentHex}40`, background: `${meta.accentHex}14`, color: meta.accentHex }}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
      <div className="min-w-0">
        <div className="text-xs font-semibold text-white">{meta.label}</div>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{meta.blurb}</p>
      </div>
    </li>
  );
}

/* ------------------------------ capabilities ---------------------------- */

export interface CapabilitiesProps {
  agent: IndexedAgent;
  /** Bazar's own A2A route for this agent, e.g. "/api/v1/a2a/agents/56-310926". */
  a2aPath: string;
  /** Resolved service endpoints, when the index published any. */
  endpoints?: AgentEndpoint[];
  /** Tags the owner declared at registration. */
  tags?: string[];
  /** Trust models the agent declares, e.g. "reputation". */
  trustModels?: string[];
  className?: string;
}

/**
 * How this agent can actually be reached.
 *
 * Endpoints, versions and tool counts come from the index's per-agent record -
 * they are the owner's own declarations, resolved by the index, and Bazar does
 * not probe them. Where no endpoint was resolved the protocol is still shown,
 * clearly marked as a declaration rather than an address you can call.
 */
export function Capabilities({ agent, a2aPath, endpoints, tags, trustModels, className }: CapabilitiesProps) {
  const category = CATEGORY_MAP[agent.category];
  // The machine-layer note below may not claim the agent was categorised when
  // the classifier had nothing to work with. Branch on the confidence flag.
  const unclassified = agent.categoryConfidence === 'unclassified';
  const resolved = endpoints ?? [];
  const resolvedKeys = new Set(resolved.map((e) => e.protocol.toLowerCase()));
  // Protocols the identity declares but the index resolved no endpoint for.
  const unresolved = agent.protocols.filter((p) => !resolvedKeys.has(p.trim().toLowerCase()));
  const nothing = resolved.length === 0 && unresolved.length === 0 && !agent.x402;

  return (
    <div className={cn('grid grid-cols-1 gap-3 lg:grid-cols-[1fr_20rem]', className)}>
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 backdrop-blur-xl sm:p-5">
        <h3 className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-slate-500">
          <Layers className="h-3.5 w-3.5" aria-hidden />
          Endpoints
        </h3>

        {nothing ? (
          <div className="mt-3 flex items-start gap-3 rounded-xl border border-dashed border-white/[0.12] bg-white/[0.02] p-3.5">
            <Radio className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
            <p className="text-xs leading-relaxed text-slate-500">
              This agent registered no endpoints and no protocols. There is nothing to call it with yet - the identity
              exists, the interface does not.
            </p>
          </div>
        ) : (
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {resolved.map((endpoint) => (
              <EndpointCard key={`${endpoint.protocol}-${endpoint.url}`} endpoint={endpoint} />
            ))}
            {unresolved.map((protocol) => (
              <DeclarationCard key={`declared-${protocol}`} meta={protocolMeta(protocol)} />
            ))}
            {agent.x402 && <DeclarationCard meta={X402_META} />}
          </ul>
        )}

        <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
          Published by the agent&apos;s owner at registration and resolved by the ERC-8004 index. Bazar reports them
          verbatim and does not probe them, so read them as intent rather than as a liveness check.
        </p>

        {((tags?.length ?? 0) > 0 || (trustModels?.length ?? 0) > 0) && (
          <div className="mt-4 space-y-3 border-t border-white/[0.06] pt-4">
            {tags && tags.length > 0 && (
              <div>
                <h4 className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">
                  <Tag className="h-3 w-3" aria-hidden />
                  Declared tags
                </h4>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <li
                      key={tag}
                      className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-0.5 text-[11px] text-slate-300"
                    >
                      {tag}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {trustModels && trustModels.length > 0 && (
              <div>
                <h4 className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">
                  <ShieldCheck className="h-3 w-3" aria-hidden />
                  Trust models declared
                </h4>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {trustModels.map((model) => (
                    <li
                      key={model}
                      className="rounded-full border border-emerald-400/25 bg-emerald-400/[0.08] px-2.5 py-0.5 text-[11px] text-emerald-300"
                    >
                      {model}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 backdrop-blur-xl sm:p-5">
        <h3 className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-slate-500">
          <Terminal className="h-3.5 w-3.5" aria-hidden />
          Machine layer
        </h3>
        <p className="mt-3 text-xs leading-relaxed text-slate-400">
          Every listing Bazar shows a person is also readable by an agent. This one answers at:
        </p>
        <code className="mt-2.5 block overflow-x-auto rounded-xl border border-white/[0.08] bg-ink/60 px-3 py-2 font-mono text-[11px] text-slate-300">
          GET {a2aPath}
        </code>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
          {unclassified ? (
            <>
              Nothing in this agent&apos;s registration matched a category term, so Bazar shelves it under{' '}
              {category.name.toLowerCase()} for coverage and says so in both places: that route returns the same shelf
              with <span className="font-mono text-slate-400">categoryInferred: true</span>.
            </>
          ) : (
            <>
              Categorised as {category.name.toLowerCase()} from this agent&apos;s own registration text, and that route
              returns the same shelf - the human page and the machine record cannot disagree about what is listed.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
