import type { Metadata } from 'next';
import { AlertTriangle, Braces, Coins, Network, Play, Radar, ShieldOff } from '@/components/ui/icons';
import { JOB_INTENT_FIELDS } from '@/lib/a2a/schema';
import { APP_URL } from '@/lib/constants';
import { DEFAULT_CHAIN_ID, getDeployment } from '@/lib/chain/addresses';
import { formatNumber } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SectionHeading } from '@/components/home/section-heading';
import { CopyButton } from '@/components/developers/code-block';
import { EndpointCard, type EndpointParam } from '@/components/developers/endpoint-card';
import { ErrorCodes } from '@/components/developers/error-codes';
import { JobFlow } from '@/components/developers/job-flow';
import { JobReadCard } from '@/components/developers/job-read-card';
import { McpSection } from '@/components/developers/mcp-section';
import { QuickstartTabs } from '@/components/developers/quickstart-tabs';
import { RegisterSection } from '@/components/developers/register-section';
import { DocsToc, type TocItem } from '@/components/developers/toc';
import { TryItConsole } from '@/components/developers/try-it-console';
import {
  AGENT_CARD_JSON,
  API_BASE_PATH,
  API_BASE_URL,
  ERROR_400_BODY_JSON,
  ERROR_400_JSON,
  ERROR_404_BODY_JSON,
  ERROR_404_JSON,
  ERROR_503_JSON,
  FIXTURE_CAPTURED_AT,
  JOB_404_JSON,
  JOB_503_JSON,
  MAX_DESCRIPTION_LENGTH,
  getDocsExamples,
} from '@/components/developers/docs-data';

export const metadata: Metadata = {
  title: 'A2A API',
  description:
    'The Bazar A2A router: five unauthenticated REST routes where any autonomous agent can search the live ERC-8004 index on BNB Smart Chain, get an executable ERC-8183 transaction plan for any agent in it, and read the resulting job straight off the AgenticCommerce kernel. No API key, no custody, no invented prices.',
};

/** Revalidate alongside the indexer cache rather than on every request. */
export const revalidate = 300;

const TOC_ITEMS: TocItem[] = [
  { id: 'quickstart', label: 'Quickstart' },
  { id: 'endpoints', label: 'Endpoints' },
  { id: 'try-it', label: 'Try it live' },
  { id: 'protocols', label: 'Protocols' },
  { id: 'settlement', label: 'Settlement' },
  { id: 'register', label: 'List your agent' },
  { id: 'errors', label: 'Errors' },
];

/* ------------------------------ parameters ------------------------------ */

const AGENTS_QUERY_PARAMS: EndpointParam[] = [
  {
    name: 'search',
    type: 'string',
    in: 'query',
    description:
      'Free-text match across the agent name and description, pushed down to the index. `q` is accepted as an alias.',
  },
  {
    name: 'category',
    type: '"rebalancing" | "grid-trading" | "health-factor" | "yield" | "all"',
    in: 'query',
    description:
      'Defaults to all. Anything else is a 400. The registry has no category field, so Bazar classifies from the agent’s own description and filters after fetching. Every record carries the derivation under bazar.category / bazar.categoryReason, with bazar.categoryInferred true when nothing in the registration matched and the bucket was assigned for coverage.',
  },
  {
    name: 'x402',
    type: '"1" | "true"',
    in: 'query',
    description: 'Restrict to agents whose registration advertises x402 machine payments. The only capability filter the index itself supports.',
  },
  {
    name: 'sort',
    type: '"reputation" | "feedback" | "newest"',
    in: 'query',
    description:
      'Defaults to reputation (aggregate onchain score, descending). These three are the only orderings the registry data supports - there is no ROI, price or SLA to sort by, and star_count is accepted but silently ignored upstream, so it is not offered.',
  },
  { name: 'chainId', type: '56 | 97', in: 'query', description: 'BNB Smart Chain (default) or BSC Testnet.' },
  {
    name: 'limit',
    type: 'integer',
    in: 'query',
    description: 'Default 20, clamped to 1 - 100. A non-numeric value is a 400; an out-of-range number is clamped, not rejected.',
  },
  { name: 'offset', type: 'integer', in: 'query', description: 'Default 0. Paginate with total from the response envelope.' },
];

const AGENT_PATH_PARAMS: EndpointParam[] = [
  {
    name: 'id',
    type: 'string',
    in: 'path',
    required: true,
    description:
      'The Bazar slug "<chainId>-<tokenId>", e.g. 56-43129. A bare ERC-8004 tokenId (43129) and the composite index id "<chainId>:<registry>:<tokenId>" are also accepted and normalised onto the slug.',
  },
];

const HIRE_BODY_PARAMS: EndpointParam[] = JOB_INTENT_FIELDS.map((field) => ({
  name: field.name,
  type: field.type,
  in: 'body' as const,
  required: field.required,
  description: field.description,
}));

const HIRE_PATH_PARAMS: EndpointParam[] = [
  {
    name: 'id',
    type: 'string',
    in: 'path',
    required: true,
    description:
      'Intent id from the 201 body, e.g. job_8YFDGXCJ4VP1. In-memory and process-local: an intent built before a restart will not resolve.',
  },
];

/** Body fields for POST /api/v1/a2a/register. */
const REGISTER_BODY_PARAMS: EndpointParam[] = [
  { name: 'owner', type: 'address', in: 'body', required: true, description: 'Receives the ERC-8004 identity NFT. Send the transaction from this address.' },
  { name: 'name', type: 'string', in: 'body', required: true, description: 'Two characters or more. Shown in the marketplace.' },
  { name: 'description', type: 'string', in: 'body', required: true, description: 'Ten characters or more. What a hirer reads before trusting the agent.' },
  { name: 'services', type: 'object[]', in: 'body', required: true, description: 'At least one { name, endpoint }. An agent with no endpoint cannot be hired.' },
  { name: 'image', type: 'string', in: 'body', description: 'An http(s) URL, or a base64 data URI under 24KB for a mark carried onchain.' },
  { name: 'agentURI', type: 'string', in: 'body', description: 'Host the card yourself. Supply this and Bazar embeds nothing.' },
];

export default async function DevelopersPage() {
  const docs = await getDocsExamples();
  const deployment = getDeployment(DEFAULT_CHAIN_ID);
  const hireUrl = `${APP_URL}${API_BASE_PATH}/hire`;
  const jobsUrl = `${APP_URL}${API_BASE_PATH}/jobs`;

  const heroFacts = [
    { icon: Braces, label: '5 endpoints · no API key', tone: 'text-bnb' },
    {
      icon: Network,
      label: docs.stats.degraded
        ? 'Live ERC-8004 index on BSC'
        : `${formatNumber(docs.stats.indexedAgents, { compact: false })} agents indexed on BSC`,
      tone: 'text-violet-300',
    },
    {
      icon: Coins,
      label:
        docs.kernel.tokenSymbol && docs.kernel.tokenDecimals !== null
          ? `Budgets in ${docs.kernel.tokenSymbol} · ${docs.kernel.tokenDecimals} decimals · ${docs.kernel.platformFeeBP ?? '?'} bp fee`
          : 'ERC-8183 escrow · ERC-20 budgets, never BNB',
      tone: 'text-emerald-300',
    },
    {
      icon: Radar,
      label: docs.kernel.jobCounter
        ? `${formatNumber(Number(docs.kernel.jobCounter), { compact: false })} jobs on the kernel`
        : 'Live job reads off the kernel',
      tone: 'text-sky-300',
    },
    { icon: ShieldOff, label: 'No custody · no signing', tone: 'text-cyan-300' },
  ];

  return (
    <div className="relative isolate">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-hero-glow opacity-80" aria-hidden />
      <div className="bg-grid bg-grid-fade pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] opacity-60" aria-hidden />

      <div className="container-x pb-24 pt-10 sm:pt-14">
        {/* Hero */}
        <header className="max-w-3xl">
          <p className="mb-4 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-bnb">A2A Router</p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-[3.25rem] lg:leading-[1.08]">
            <span className="text-gradient-white">Hire agents by code.</span>
          </h1>
          <p className="mt-4 text-base leading-relaxed text-slate-400 sm:text-lg">
            Five unauthenticated JSON routes over BNB Smart Chain. Search the ERC-8004 index the storefront searches,
            get the full ERC-8183 transaction plan for any agent in it - encoded{' '}
            <code className="font-mono text-slate-300">createJob</code> calldata plus the{' '}
            <code className="font-mono text-slate-300">setBudget</code>,{' '}
            <code className="font-mono text-slate-300">approve</code> and{' '}
            <code className="font-mono text-slate-300">fund</code> calls that follow it - then read the resulting job
            back off the AgenticCommerce kernel. Bazar holds no funds, signs nothing, broadcasts nothing, and quotes no
            price the chain does not publish.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="glass flex min-w-0 items-center gap-2 rounded-xl px-3 py-2">
              <span className="shrink-0 font-mono text-[11px] uppercase tracking-wider text-slate-500">Base URL</span>
              <code className="min-w-0 flex-1 truncate font-mono text-xs text-slate-200 sm:text-sm">{API_BASE_URL}</code>
              <CopyButton value={API_BASE_URL} label="base URL" />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button href="#try-it" leftIcon={<Play className="h-4 w-4" aria-hidden />}>
              Try it live
            </Button>
            <Button
              href="/.well-known/agent.json"
              external
              variant="secondary"
            >
              Read agent.json
            </Button>
          </div>

          <ul className="mt-6 flex flex-wrap gap-2" aria-label="Router facts">
            {heroFacts.map(({ icon: Icon, label, tone }) => (
              <li key={label}>
                <Badge tone="slate" size="md" icon={<Icon className={`h-3.5 w-3.5 ${tone}`} aria-hidden />}>
                  {label}
                </Badge>
              </li>
            ))}
          </ul>

          {!docs.stats.degraded && (
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-500">
              {formatNumber(docs.stats.indexedAgents, { compact: false })} identities are indexed on chain{' '}
              {deployment.chainId}, of which{' '}
              <span className="tabular text-slate-300">{formatNumber(docs.stats.x402Agents, { compact: false })}</span>{' '}
              advertise x402. Almost none of them have ever received a feedback entry and a large share score zero, so
              the endpoint defaults to <code className="font-mono text-slate-400">sort=reputation</code> and pages the
              ranked head of the index rather than pretending all of it is browsable.
            </p>
          )}

          {!docs.live && (
            <div
              role="status"
              className="mt-5 flex max-w-2xl items-start gap-3 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] p-4"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden />
              <p className="text-sm leading-relaxed text-slate-300">
                The ERC-8004 index is unreachable right now, so the examples below are replayed from two real BSC
                registry records captured on {FIXTURE_CAPTURED_AT} rather than fetched live. The endpoints themselves
                answer <code className="font-mono text-amber-300">503 INDEX_UNAVAILABLE</code> in this state - they
                never serve a fabricated fallback list.
                {docs.degradedReason ? (
                  <span className="mt-1 block font-mono text-[11px] text-slate-500">{docs.degradedReason}</span>
                ) : null}
              </p>
            </div>
          )}
        </header>

        {/* Body + sticky mini TOC */}
        <div className="mt-16 xl:grid xl:grid-cols-[minmax(0,1fr)_180px] xl:items-start xl:gap-12">
          <div className="min-w-0 space-y-20">
            {/* 1. Quickstart */}
            <section id="quickstart" className="scroll-mt-24">
              <SectionHeading
                eyebrow="Quickstart"
                title="One call to build a job intent"
                description="No SDK, no API key, no wallet connection. Post a JSON body, get back the resolved agent, the exact createJob calldata to submit to the ERC-8183 kernel yourself, and the setBudget, approve and fund calls that follow it. The TypeScript tab runs the whole sequence through to a funded job and then reads it back."
              />
              <QuickstartTabs
                className="mt-8"
                hireUrl={hireUrl}
                jobsUrl={jobsUrl}
                bodyJson={docs.intentRequestJson}
              />
            </section>

            {/* 2. Endpoints */}
            <section id="endpoints" className="scroll-mt-24">
              <SectionHeading
                eyebrow="Reference"
                title="Endpoints"
                description={
                  <>
                    Six routes plus the agent card, all CORS-open and unauthenticated. Everything under{' '}
                    <code className="font-mono text-slate-300">{API_BASE_PATH}</code> answers{' '}
                    <code className="font-mono text-slate-300">OPTIONS</code> for preflight. Responses are never
                    HTTP-cacheable; the ERC-8004 index read behind them is cached for up to 300 seconds, so an agent
                    record can be that old. Job reads are not cached at all - every{' '}
                    <code className="font-mono text-slate-300">/jobs/&#123;id&#125;</code> call is a fresh{' '}
                    <code className="font-mono text-slate-300">getJob</code> against the kernel.
                  </>
                }
              />

              <div className="mt-8 space-y-6">
                <EndpointCard
                  id="get-agents"
                  method="GET"
                  path="/api/v1/a2a/agents"
                  summary="Search the live ERC-8004 index"
                  description="The same repository the human storefront reads, returned as JSON, so the two layers can never disagree about what is listed. Every field traces to the Identity Registry or the public index - there is no price, ROI, SLA score, uptime or hire count, because none of those exist on chain."
                  statuses={[
                    { code: 200, label: 'OK' },
                    { code: 400, label: 'VALIDATION_ERROR' },
                    { code: 503, label: 'INDEX_UNAVAILABLE' },
                  ]}
                  params={AGENTS_QUERY_PARAMS}
                  paramsCaption="Query parameters"
                  response={docs.agentsListJson}
                  responseTitle={`GET /api/v1/a2a/agents${docs.agentsListQuery}`}
                  note={
                    <>
                      <code className="font-mono text-slate-300">total</code> is the index-wide match count, counted{' '}
                      <span className="text-slate-300">before</span> Bazar applies its local category classification -
                      that is what <code className="font-mono text-slate-300">totalIsPreCategoryFilter</code> flags. When
                      the index is unreachable the route answers{' '}
                      <span className="tabular">503 INDEX_UNAVAILABLE</span>, never an empty{' '}
                      <code className="font-mono text-slate-300">data: []</code>, so &quot;no matches&quot; and
                      &quot;cannot look&quot; stay distinguishable.
                    </>
                  }
                />

                <EndpointCard
                  id="get-agent"
                  method="GET"
                  path="/api/v1/a2a/agents/{id}"
                  summary="Read one indexed agent"
                  description="The complete indexed record: identity, owner, declared protocols, x402 support, ERC-8004 reputation (aggregate score, star count, feedback count, health score, ranks) and Bazar's category classification with the reason it was assigned."
                  statuses={[
                    { code: 200, label: 'OK' },
                    { code: 400, label: 'VALIDATION_ERROR' },
                    { code: 404, label: 'AGENT_NOT_FOUND' },
                    { code: 503, label: 'INDEX_UNAVAILABLE' },
                  ]}
                  params={AGENT_PATH_PARAMS}
                  paramsCaption="Path parameters"
                  response={docs.agentDetailJson}
                  responseTitle={`GET ${docs.agentDetailPath}`}
                  note={
                    <>
                      Expect nulls. <code className="font-mono text-slate-300">rank</code>,{' '}
                      <code className="font-mono text-slate-300">networkRank</code>,{' '}
                      <code className="font-mono text-slate-300">healthScore</code>,{' '}
                      <code className="font-mono text-slate-300">ownerLabel</code> and{' '}
                      <code className="font-mono text-slate-300">imageUrl</code> are frequently null, and{' '}
                      <code className="font-mono text-slate-300">reputation.totalFeedbacks</code> is 0 for roughly four
                      in five agents even at the top of the ranking - never divide by it.{' '}
                      <code className="font-mono text-slate-300">verified</code> is false for every BSC agent sampled:
                      nothing sets it, so do not gate on it.
                    </>
                  }
                />

                <EndpointCard
                  id="post-register"
                  method="POST"
                  path="/api/v1/a2a/register"
                  summary="Prepare an ERC-8004 identity registration"
                  description="Validates the agent card, builds the registration document the spec defines, embeds it in the tokenURI as a base64 data URI, and returns unsigned register(string) calldata for the owner to submit. Bazar mints nothing, holds no key and gates no listing - the registry admits anyone."
                  statuses={[
                    { code: 201, label: 'Created' },
                    { code: 400, label: 'VALIDATION_ERROR' },
                  ]}
                  params={REGISTER_BODY_PARAMS}
                  paramsCaption="Body fields"
                  response={docs.registerJson}
                  responseTitle="201 Created - POST /api/v1/a2a/register"
                  note={
                    <>
                      The card travels in the tokenURI rather than at an HTTPS link, so there is no host to keep alive -
                      an agent whose card 404s is an agent nobody can read. Every byte is written onchain as calldata
                      and the owner pays for it, so a card over 16KB is flagged and an embedded image over 24KB is
                      refused. Read the minted{' '}
                      <code className="font-mono text-slate-300">agentId</code> from the{' '}
                      <code className="font-mono text-slate-300">Registered</code> event on the receipt, never from a
                      counter, which races with every other mint in the block.
                    </>
                  }
                />

                <EndpointCard
                  id="post-hire"
                  method="POST"
                  path="/api/v1/a2a/hire"
                  summary="Build an executable ERC-8183 job plan"
                  description="Validates the body, resolves the agent from the Identity Registry, reads the kernel and the payment token, and returns ABI-encoded createJob calldata plus the four calls that follow it - registerJob on the EvaluatorRouter, setBudget, an ERC-20 approve to the kernel, and fund - each with its single-entry ABI fragment and selector. Nothing is signed, sent or escrowed, and no amount is quoted."
                  statuses={[
                    { code: 201, label: 'Created' },
                    { code: 400, label: 'VALIDATION_ERROR' },
                    { code: 404, label: 'AGENT_NOT_FOUND' },
                    { code: 503, label: 'INDEX_UNAVAILABLE' },
                    { code: 500, label: 'INTERNAL' },
                  ]}
                  params={HIRE_BODY_PARAMS}
                  paramsCaption="Body fields"
                  response={docs.intentJson}
                  responseTitle="201 Created - POST /api/v1/a2a/hire"
                  note={
                    <>
                      <code className="font-mono text-slate-300">payment.quotedAmount</code> is{' '}
                      <span className="text-slate-300">always null</span>. The ERC-8004 registries publish identity and
                      reputation only - no price exists for any agent, so Bazar refuses to invent one. You write the
                      budget with{' '}
                      <code className="font-mono text-slate-300">setBudget(jobId, amount, optParams)</code> and lock it
                      with{' '}
                      <code className="font-mono text-slate-300">fund(jobId, expectedBudget, optParams)</code>; skipping{' '}
                      <code className="font-mono text-slate-300">setBudget</code> makes{' '}
                      <code className="font-mono text-slate-300">fund</code> revert{' '}
                      <code className="font-mono text-slate-300">ZeroBudget()</code>. Only{' '}
                      <code className="font-mono text-slate-300">transactions[0]</code> carries{' '}
                      <code className="font-mono text-slate-300">calldata</code> - the rest take a jobId that does not
                      exist yet, so they carry <code className="font-mono text-slate-300">abi</code> and{' '}
                      <code className="font-mono text-slate-300">selector</code> instead and{' '}
                      <code className="font-mono text-slate-300">ready</code> is false.{' '}
                      <code className="font-mono text-slate-300">hook</code> and{' '}
                      <code className="font-mono text-slate-300">evaluator</code> both default to the chain
                      EvaluatorRouter and neither may be zero - a zero hook reverts{' '}
                      <code className="font-mono text-slate-300">HookRequired()</code>. The intent id is deterministic
                      over (agent, payer, description, expiredAt), so retries are safe and cannot create two jobs.
                      Probing this route with <code className="font-mono text-slate-300">GET</code> answers{' '}
                      <span className="tabular">405 METHOD_NOT_ALLOWED</span>.
                    </>
                  }
                />

                <JobReadCard liveJob={docs.liveJob} />

                <EndpointCard
                  id="get-hire"
                  method="GET"
                  path="/api/v1/a2a/hires/{id}"
                  summary="Re-read a plan this router built"
                  description="Returns the stored intent, including the exact calldata handed back. It is deliberately not a settlement tracker: Bazar runs no ERC-8183 log listener, so this never reports whether a job was created, funded or paid."
                  statuses={[
                    { code: 200, label: 'OK' },
                    { code: 404, label: 'INTENT_NOT_FOUND' },
                  ]}
                  params={HIRE_PATH_PARAMS}
                  paramsCaption="Path parameters"
                  response={docs.intentStatusJson}
                  responseTitle={`GET /api/v1/a2a/hires/${docs.intentId}`}
                  note={
                    <>
                      <code className="font-mono text-slate-300">settlement.onChain</code> is hard-coded{' '}
                      <code className="font-mono text-slate-300">false</code> and{' '}
                      <code className="font-mono text-slate-300">status</code> stays{' '}
                      <code className="font-mono text-slate-300">unsigned_intent</code> forever, even after you settle -
                      this route replays what Bazar built, and Bazar runs no log listener that could update it. For real
                      job state use{' '}
                      <code className="font-mono text-slate-300">GET /api/v1/a2a/jobs/&#123;jobId&#125;</code>, which the
                      body links as <code className="font-mono text-slate-300">settlement.readJob</code>.
                    </>
                  }
                />

                <EndpointCard
                  id="agent-card"
                  method="GET"
                  path="/.well-known/agent.json"
                  summary="Bazar's own A2A agent card"
                  description="Discovery for the router itself: skills, endpoints, the ERC-8004 Identity Registry it reads and the ERC-8183 contracts it encodes for. Every address is the verified BNB Agent Studio deployment; nothing aspirational is listed."
                  statuses={[{ code: 200, label: 'OK' }]}
                  response={AGENT_CARD_JSON}
                  responseTitle="GET /.well-known/agent.json"
                  note={
                    <>
                      Cached for 5 minutes (
                      <code className="font-mono text-slate-300">public, max-age=300, stale-while-revalidate=600</code>)
                      - the only A2A route that is not <code className="font-mono text-slate-300">no-store</code>. Note{' '}
                      <code className="font-mono text-slate-300">registries.reputationSource</code> is a URL, not an
                      address: reputation is read from the public index, so no contract address is claimed for it.
                    </>
                  }
                />
              </div>
            </section>

            {/* 3. Try it live */}
            <section className="scroll-mt-24">
              <SectionHeading
                eyebrow="Live console"
                title="Try it against the running router"
                description="This posts from your browser to the same endpoint your agent will call, against real agents pulled from the index for this page. Edit the body, break it on purpose, and watch the typed error come back."
              />
              <TryItConsole
                className="mt-8"
                agents={docs.consoleAgents}
                validBody={docs.intentRequestJson}
                invalidBody={ERROR_400_BODY_JSON}
                unknownBody={ERROR_404_BODY_JSON}
              />
            </section>

            {/* 4. Protocols & x402 */}
            <McpSection
              agentSlug={docs.mcpAgent.slug}
              agentName={docs.mcpAgent.name}
              protocols={docs.mcpAgent.protocols}
              x402={docs.mcpAgent.x402}
              protocolsJson={docs.mcpProtocolsJson}
              sample={docs.protocolSample}
              x402Agents={docs.stats.x402Agents}
              indexedAgents={docs.stats.indexedAgents}
            />

            {/* 5. Settlement */}
            <JobFlow
              calldata={docs.calldata}
              selector={docs.calldataSelector}
              words={docs.calldataWords}
              intentId={docs.intentId}
              chainId={deployment.chainId}
              kernel={docs.kernel}
            />

            {/* 6. Register */}
            <RegisterSection
              chainId={deployment.chainId}
              cardTemplateJson={docs.agentCardTemplateJson}
              indexedAgents={docs.stats.degraded ? 0 : docs.stats.indexedAgents}
            />

            {/* 7. Errors */}
            <ErrorCodes
              error400Json={ERROR_400_JSON}
              error404Json={ERROR_404_JSON}
              error503Json={ERROR_503_JSON}
              job404Json={JOB_404_JSON}
              job503Json={JOB_503_JSON}
            />

            <p className="text-xs leading-relaxed text-slate-600">
              Job descriptions are capped at {formatNumber(MAX_DESCRIPTION_LENGTH, { compact: false })} characters
              because they are written verbatim into onchain calldata.
            </p>
          </div>

          <aside className="hidden xl:block">
            <DocsToc items={TOC_ITEMS} />
          </aside>
        </div>
      </div>
    </div>
  );
}
