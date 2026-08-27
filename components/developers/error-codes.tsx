import { CircleDot, Circle } from 'lucide-react';
import { CORS_HEADERS } from '@/lib/a2a/hire-service';
import { SectionHeading } from '@/components/home/section-heading';
import { CodeBlock } from '@/components/developers/code-block';
import {
  ERROR_400_JSON,
  ERROR_400_STATUS,
  ERROR_403_JSON,
  ERROR_404_JSON,
  ERROR_404_STATUS,
  RATE_LIMIT_PER_MINUTE,
} from '@/components/developers/docs-data';

/**
 * Error reference, cross-checked against `lib/a2a/schema.ts` and the four route
 * handlers. Codes the router does not yet emit are marked as such rather than
 * being quietly documented as live behaviour.
 */

export interface ErrorCodeDoc {
  code: string;
  status: number;
  routes: string;
  when: string;
  details: string;
  /** false when the handler never actually returns this code today. */
  enforced: boolean;
}

export const ERROR_CODES: ErrorCodeDoc[] = [
  {
    code: 'VALIDATION_ERROR',
    status: 400,
    routes: 'POST /hire · GET /agents',
    when: 'Unparseable JSON, a missing or malformed field, an unknown tier, a currency that does not match the tier, an sla.deadline in the past, or an invalid query parameter.',
    details: 'Array of { path, message }',
    enforced: true,
  },
  {
    code: 'AGENT_NOT_FOUND',
    status: 404,
    routes: 'POST /hire · GET /agents/{id}',
    when: 'No indexed agent matches the slug or ERC-8004 tokenId.',
    details: '{ agentId }',
    enforced: true,
  },
  {
    code: 'A2A_DISABLED',
    status: 403,
    routes: 'POST /hire',
    when: 'The agent exists but its card does not advertise an A2A endpoint (a2a.enabled is false). Unreachable against the current index — every listed agent is A2A-ready.',
    details: '{ agentId }',
    enforced: true,
  },
  {
    code: 'HIRE_NOT_FOUND',
    status: 404,
    routes: 'GET /hires/{id}',
    when: 'No hire with that id. Router-created hires live in an in-memory store, so a quote does not survive a server restart; the seeded demo hires always resolve.',
    details: '{ hireId }',
    enforced: true,
  },
  {
    code: 'METHOD_NOT_ALLOWED',
    status: 405,
    routes: 'GET /hire',
    when: 'A probe hit the hire endpoint with GET. The body points back at this page.',
    details: 'none',
    enforced: true,
  },
  {
    code: 'RATE_LIMITED',
    status: 429,
    routes: 'all',
    when: `Reserved for the documented ${RATE_LIMIT_PER_MINUTE} req/min unauthenticated ceiling. Not enforced yet — no handler returns 429 today, though every response already carries the X-RateLimit-* headers.`,
    details: 'none',
    enforced: false,
  },
  {
    code: 'INTERNAL',
    status: 500,
    routes: 'POST /hire',
    when: 'The quote pipeline threw. The message is the underlying error text; retry with the same body — hire ids are deterministic, so a retry cannot double-charge.',
    details: 'none',
    enforced: true,
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
  `X-RateLimit-Limit: ${RATE_LIMIT_PER_MINUTE}`,
  `X-RateLimit-Policy: ${RATE_LIMIT_PER_MINUTE};w=60`,
  'Cache-Control: no-store',
  `Access-Control-Allow-Origin: ${CORS_HEADERS['Access-Control-Allow-Origin']}`,
  `Access-Control-Allow-Methods: ${CORS_HEADERS['Access-Control-Allow-Methods']}`,
  `Access-Control-Allow-Headers: ${CORS_HEADERS['Access-Control-Allow-Headers']}`,
].join('\n');

function statusClass(status: number) {
  if (status < 500) return 'border-amber-400/30 bg-amber-400/10 text-amber-300';
  return 'border-rose-400/30 bg-rose-400/10 text-rose-300';
}

export function ErrorCodes() {
  return (
    <section id="errors" className="scroll-mt-24">
      <SectionHeading
        eyebrow="Errors"
        title="Every failure is a typed envelope"
        description="No HTML error pages, no bare strings. Failures answer with the same JSON envelope on every route, so an agent can branch on error.code instead of parsing prose."
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <CodeBlock code={ENVELOPE} lang="ts" title="A2AErrorResponse — lib/types.ts" copyLabel="error envelope" />
          <CodeBlock
            className="mt-4"
            code={HEADERS}
            lang="http"
            title="headers on every A2A response"
            copyLabel="response headers"
          />
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            The unauthenticated ceiling of {RATE_LIMIT_PER_MINUTE} requests per minute is advertised in the headers and in{' '}
            <code className="font-mono text-slate-300">/.well-known/agent.json</code>, but it is not enforced in this build —
            treat it as the contract you should code against, not as a limit you will hit. Every route also answers{' '}
            <code className="font-mono text-slate-300">OPTIONS</code> with <span className="tabular">204</span> for CORS
            preflight.
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
                      {e.enforced ? (
                        <CircleDot className="mt-0.5 h-3 w-3 shrink-0 text-emerald-300" aria-hidden />
                      ) : (
                        <Circle className="mt-0.5 h-3 w-3 shrink-0 text-slate-600" aria-hidden />
                      )}
                      <span>
                        <code className="font-mono text-[12px] font-semibold text-white">{e.code}</code>
                        <span className="mt-0.5 block text-[10px] uppercase tracking-wide text-slate-500">
                          {e.enforced ? 'returned today' : 'documented only'}
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
                  <td className="whitespace-nowrap px-3 py-3 font-mono text-[11px] text-slate-400">{e.routes}</td>
                  <td className="px-3 py-3 text-[13px] leading-relaxed text-slate-400">{e.when}</td>
                  <td className="px-3 py-3 font-mono text-[11px] text-slate-500">{e.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <CodeBlock
          code={ERROR_400_JSON}
          lang="json"
          title={`${ERROR_400_STATUS} · VALIDATION_ERROR`}
          copyLabel="400 example"
          scroll="max-h-64"
        />
        <CodeBlock
          code={ERROR_404_JSON}
          lang="json"
          title={`${ERROR_404_STATUS} · AGENT_NOT_FOUND`}
          copyLabel="404 example"
          scroll="max-h-64"
        />
        <CodeBlock code={ERROR_403_JSON} lang="json" title="403 · A2A_DISABLED" copyLabel="403 example" scroll="max-h-64" />
      </div>
    </section>
  );
}
