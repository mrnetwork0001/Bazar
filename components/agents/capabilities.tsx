import { Layers, Radio, ShieldCheck, Tag, Terminal } from '@/components/ui/icons';
import type { IndexedAgent } from '@/lib/types';
import type { AgentEndpoint } from '@/components/agents/agent-detail';
import { CATEGORY_MAP } from '@/lib/data/categories';
import {
  protocolMeta,
  X402_META,
  type ProtocolAudience,
  type ProtocolMeta,
} from '@/components/agents/protocol-meta';
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

/**
 * One declared endpoint.
 *
 * The protocol blurb used to be a paragraph inside every card. It is protocol
 * documentation, identical on every agent page, so six endpoints meant six
 * generic explanations set louder than the one line that actually varies - the
 * address. It now lives in the card's title, and the group heading above says
 * who the endpoint is for, which is the part a hirer needed it for.
 *
 * What is left is what this agent published: protocol, version, how many tools
 * or skills, and where.
 */
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
    <li
      title={meta.blurb}
      className="group flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition-colors duration-200 hover:border-white/[0.14] hover:bg-white/[0.04]"
    >
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border"
        style={{ borderColor: `${meta.accentHex}40`, background: `${meta.accentHex}14`, color: meta.accentHex }}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-xs font-semibold text-white">{meta.label}</span>
          {facts.length > 0 && <span className="tabular text-[10px] text-slate-500">{facts.join(' · ')}</span>}
        </span>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer nofollow"
            title={endpoint.url}
            className="ring-focus mt-0.5 block truncate rounded font-mono text-[11px] text-slate-400 transition-colors hover:text-bnb"
          >
            {displayUrl(endpoint.url)}
          </a>
        ) : (
          <span className="mt-0.5 block truncate font-mono text-[11px] text-slate-400" title={endpoint.url}>
            {displayUrl(endpoint.url)}
          </span>
        )}
      </span>
    </li>
  );
}

/**
 * Fallback row when the index knows the protocol but resolved no endpoint.
 *
 * Kept visually identical to a resolved card so the grid does not break, with
 * the address line saying what is missing instead of showing one. That absence
 * is the whole content of this card and it should not need a paragraph.
 */
function DeclarationCard({ meta }: { meta: ProtocolMeta }) {
  const Icon = meta.icon;
  return (
    <li
      title={meta.blurb}
      className="flex items-center gap-2.5 rounded-xl border border-dashed border-white/[0.08] bg-white/[0.01] px-3 py-2.5"
    >
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border"
        style={{ borderColor: `${meta.accentHex}30`, background: `${meta.accentHex}0D`, color: meta.accentHex }}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-white">{meta.label}</span>
        <span className="mt-0.5 block text-[11px] text-slate-500">declared, no address published</span>
      </span>
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

  // Grouped by who can call it, so the section says that once in a heading
  // rather than once per card. Resolved endpoints lead each group; declarations
  // with no address follow, because an address you can use outranks one that
  // was only promised.
  const groups: ReadonlyArray<{
    audience: ProtocolAudience;
    title: string;
    hint: string;
    resolved: AgentEndpoint[];
    declared: ProtocolMeta[];
  }> = (['machine', 'human'] as const).map((audience) => ({
    audience,
    title: audience === 'machine' ? 'Machine interfaces' : 'Human contact',
    hint:
      audience === 'machine'
        ? 'Another agent or an LLM client can call these directly.'
        : 'Aimed at a person rather than a runtime.',
    resolved: resolved.filter((e) => protocolMeta(e.protocol).audience === audience),
    declared: [
      ...unresolved.map((p) => protocolMeta(p)),
      ...(agent.x402 ? [X402_META] : []),
    ].filter((m) => m.audience === audience),
  }));

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
          <div className="mt-3 space-y-4">
            {groups
              .filter((g) => g.resolved.length > 0 || g.declared.length > 0)
              .map((group) => (
                <div key={group.audience}>
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <h4 className="text-[11px] font-medium text-slate-300">{group.title}</h4>
                    <span className="text-[11px] text-slate-500">{group.hint}</span>
                  </div>
                  <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {group.resolved.map((endpoint) => (
                      <EndpointCard key={`${endpoint.protocol}-${endpoint.url}`} endpoint={endpoint} />
                    ))}
                    {group.declared.map((meta) => (
                      <DeclarationCard key={`declared-${meta.label}`} meta={meta} />
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        )}

        <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
          Declared by the owner at registration, resolved by the ERC-8004 index, and reported verbatim - Bazar does not
          probe them, so read them as intent rather than as a liveness check.
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
          Every listing a person can read, an agent can read too:
        </p>
        <code className="mt-2.5 block overflow-x-auto rounded-xl border border-white/[0.08] bg-ink/60 px-3 py-2 font-mono text-[11px] text-slate-300">
          GET {a2aPath}
        </code>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
          {unclassified ? (
            <>
              Nothing here matched a category term, so this agent sits under {category.name.toLowerCase()} for coverage
              - and the route says so too, with{' '}
              <span className="font-mono text-slate-400">categoryInferred: true</span>.
            </>
          ) : (
            <>
              Filed under {category.name.toLowerCase()} from the agent&apos;s own registration text. The route returns
              the same shelf, so the page and the record cannot disagree.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
