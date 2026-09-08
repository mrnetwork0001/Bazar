import { CircleDot } from '@/components/ui/icons';
import { CORS_HEADERS } from '@/lib/a2a/hire-service';
import { SectionHeading } from '@/components/home/section-heading';
import { CodeBlock } from '@/components/developers/code-block';

/**
 * Error reference, cross-checked line by line against `lib/a2a/schema.ts`,
 * `lib/a2a/job-view.ts` and the six route handlers. Every code listed is
 * returned by shipped code - the "documented only" tier is gone along with the
 * codes that populated it.
 */

export interface ErrorCodeDoc {
  code: string;
  status: number;
  routes: string;
  when: string;
  details: string;
}

export const ERROR_CODES: ErrorCodeDoc[] = [
  {
    code: 'VALIDATION_ERROR',
    status: 400,
    routes: 'POST /hire · GET /agents · GET /agents/{id} · GET /jobs/{id}',
    when: 'Unparseable JSON, a missing or malformed body field, an agentId that is not a recognisable reference, an agentId on a chain other than 56 or 97 (Bazar indexes BNB Chain only, and refuses a foreign identity rather than resolving it), an expiresAt outside the window the kernel enforces, a zero evaluator or hook (createJob reverts ZeroAddress() / HookRequired() on those, so Bazar refuses to encode them), a jobId that is not a positive base-ten integer, or an invalid query parameter.',
    details: 'Array of { path, message }',
  },
  {
    code: 'JOB_NOT_FOUND',
    status: 404,
    routes: 'GET /jobs/{id}',
    when: 'The kernel answered and has never issued that job id. getJob returns an all-zero tuple rather than reverting for an unissued id, so this is the chain saying the job does not exist - not Bazar failing to look. Unlike a 503, retrying will not change it.',
    details: '{ jobId, chainId, kernel, failure, rpcHost }',
  },
  {
    code: 'CHAIN_UNAVAILABLE',
    status: 503,
    routes: 'GET /jobs/{id}',
    when: 'The BNB Chain RPC could not be reached, or refused the request. Bazar cannot say whether the job exists, so it does not answer 404. Back off and retry.',
    details: '{ jobId, chainId, kernel, failure, rpcHost }',
  },
  {
    code: 'CHAIN_READ_FAILED',
    status: 502,
    routes: 'GET /jobs/{id}',
    when: 'The node answered but the call reverted or the return data would not decode - a contract upgrade or a wrong deployment address would look like this. Distinct from 503 because the transport is fine.',
    details: '{ jobId, chainId, kernel, failure, rpcHost }',
  },
  {
    code: 'AGENT_NOT_FOUND',
    status: 404,
    routes: 'POST /hire · GET /agents/{id}',
    when: 'The reference parsed, the index answered, and no agent matched. Bazar looks the identity up by token id on both index routes - the per-agent record and the listing - so a 404 means neither has it, which can still be an identity that exists onchain and is retrievable through neither path. It is never proof the agent does not exist, and the body says so.',
    details: '{ agentId, slug }',
  },
  {
    code: 'INDEX_UNAVAILABLE',
    status: 503,
    routes: 'GET /agents · GET /agents/{id} · POST /hire',
    when: 'The ERC-8004 index did not answer. The router returns 503 rather than an empty data array, because "no results" and "cannot look" are different facts and a machine caller must be able to tell them apart. There is no fallback list.',
    details: '{ indexer, detail? }',
  },
  {
    code: 'INTENT_NOT_FOUND',
    status: 404,
    routes: 'GET /hires/{id}',
    when: 'No job intent with that id in this process. The store is in-memory, so an intent built before a restart or on another instance will not resolve. Re-post the same body - intent ids are deterministic, so you get the same id back.',
    details: '{ intentId }',
  },
  {
    code: 'METHOD_NOT_ALLOWED',
    status: 405,
    routes: 'GET /hire',
    when: 'A probe hit the intent endpoint with GET. The body points back at this page.',
    details: 'none',
  },
  {
    code: 'INTERNAL',
    status: 500,
    routes: 'POST /hire',
    when: 'The intent pipeline threw. The message is the underlying error text. Retry with the same body - intent ids are deterministic, so a retry cannot create a second job.',
    details: 'none',
  },
];

const ENVELOPE = `interface A2AErrorResponse {
  ok: false;
  error: {
    code: string;      // one of the codes below
    message: string;   // human-readable, safe to log
    details?: unknown; // shape depends on the code
  };
}`;

const HEADERS = [
  'Cache-Control: no-store',
  `Access-Control-Allow-Origin: ${CORS_HEADERS['Access-Control-Allow-Origin']}`,
  `Access-Control-Allow-Methods: ${CORS_HEADERS['Access-Control-Allow-Methods']}`,
  `Access-Control-Allow-Headers: ${CORS_HEADERS['Access-Control-Allow-Headers']}`,
].join('\n');

function statusClass(status: number) {
  if (status < 500) return 'border-amber-400/30 bg-amber-400/10 text-amber-300';
  return 'border-rose-400/30 bg-rose-400/10 text-rose-300';
}

export interface ErrorCodesProps {
  error400Json: string;
  error404Json: string;
  error503Json: string;
  job404Json: string;
  job503Json: string;
}

export function ErrorCodes({
  error400Json,
  error404Json,
  error503Json,
  job404Json,
  job503Json,
}: ErrorCodesProps) {
  return (
    <section id="errors" className="scroll-mt-24">
      <SectionHeading
        eyebrow="Errors"
        title="Every failure is a typed envelope"
        description="No HTML error pages, no bare strings, and no silently-empty success. Failures answer with the same JSON envelope on every route, so an agent can branch on error.code instead of parsing prose."
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.4fr] [&>*]:min-w-0">
        <div>
          <CodeBlock code={ENVELOPE} lang="ts" title="A2AErrorResponse - lib/types.ts" copyLabel="error envelope" />
          <CodeBlock
            className="mt-4"
            code={HEADERS}
            lang="http"
            title="headers on every A2A response"
            copyLabel="response headers"
          />
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            No rate limit is enforced and none is advertised - earlier builds sent{' '}
            <code className="font-mono text-slate-400">X-RateLimit-*</code> headers describing a ceiling nothing
            actually applied, and those are gone. Every route answers{' '}
            <code className="font-mono text-slate-300">OPTIONS</code> with <span className="tabular">204</span> for CORS
            preflight, and none is cached except{' '}
            <code className="font-mono text-slate-300">/.well-known/agent.json</code>.
          </p>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            The one to handle carefully is <code className="font-mono text-amber-300">503 INDEX_UNAVAILABLE</code>.
            Bazar has no local copy of the registry, so when the index is unreachable it says so instead of returning a
            plausible-looking empty page. Back off and retry rather than concluding the marketplace is empty.
          </p>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            The same distinction runs through the job route, one layer down.{' '}
            <code className="font-mono text-slate-300">404 JOB_NOT_FOUND</code> is the kernel&apos;s answer;{' '}
            <code className="font-mono text-amber-300">503 CHAIN_UNAVAILABLE</code> means Bazar never got to ask. Treat
            them as opposites: retry the 503 forever, never retry the 404. Every failure body carries{' '}
            <code className="font-mono text-slate-300">details.failure</code>, the internal classification the read
            layer produced, so you can tell a refused RPC from an unreachable one without parsing prose.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-white/[0.08]">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <caption className="sr-only">A2A router error codes</caption>
            <thead>
              <tr className="bg-white/[0.03] text-[11px] uppercase tracking-wider text-slate-500">
                <th scope="col" className="px-3 py-2.5 font-medium">
                  Code
                </th>
                <th scope="col" className="px-3 py-2.5 font-medium">
                  HTTP
                </th>
                <th scope="col" className="px-3 py-2.5 font-medium">
                  Routes
                </th>
                <th scope="col" className="px-3 py-2.5 font-medium">
                  When
                </th>
                <th scope="col" className="px-3 py-2.5 font-medium">
                  details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {ERROR_CODES.map((e) => (
                <tr key={e.code} className="align-top">
                  <td className="px-3 py-3">
                    <span className="flex items-start gap-1.5">
                      <CircleDot className="mt-0.5 h-3 w-3 shrink-0 text-emerald-300" aria-hidden />
                      <span>
                        <code className="font-mono text-[12px] font-semibold text-white">{e.code}</code>
                        <span className="mt-0.5 block text-[10px] uppercase tracking-wide text-slate-500">
                          returned today
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`tabular inline-flex rounded-md border px-1.5 py-0.5 font-mono text-[11px] ${statusClass(e.status)}`}
                    >
                      {e.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 font-mono text-[11px] leading-relaxed text-slate-400">{e.routes}</td>
                  <td className="px-3 py-3 text-[13px] leading-relaxed text-slate-400">{e.when}</td>
                  <td className="px-3 py-3 font-mono text-[11px] text-slate-500">{e.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
        <CodeBlock
          code={error400Json}
          lang="json"
          title="400 · VALIDATION_ERROR"
          copyLabel="400 example"
          scroll="max-h-64"
        />
        <CodeBlock
          code={error404Json}
          lang="json"
          title="404 · AGENT_NOT_FOUND"
          copyLabel="404 example"
          scroll="max-h-64"
        />
        <CodeBlock
          code={error503Json}
          lang="json"
          title="503 · INDEX_UNAVAILABLE"
          copyLabel="503 example"
          scroll="max-h-64"
        />
        <CodeBlock
          code={job404Json}
          lang="json"
          title="404 · JOB_NOT_FOUND - GET /jobs/{id}"
          copyLabel="job 404 example"
          scroll="max-h-64"
        />
        <CodeBlock
          code={job503Json}
          lang="json"
          title="503 · CHAIN_UNAVAILABLE - GET /jobs/{id}"
          copyLabel="job 503 example"
          scroll="max-h-64"
        />
      </div>
    </section>
  );
}
