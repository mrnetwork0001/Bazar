import { AlertTriangle, Radar } from '@/components/ui/icons';
import type { LiveJobExample } from '@/components/developers/docs-data';
import { EndpointCard, type EndpointParam } from '@/components/developers/endpoint-card';
import { Badge } from '@/components/ui/badge';

/**
 * The GET /jobs/{id} reference.
 *
 * Its example body is a job read off the live AgenticCommerce kernel while this
 * page rendered. There is deliberately no captured fixture behind it: when the
 * chain does not answer, the card says so and shows no job at all. Publishing a
 * made-up jobId, budget or status on the page a reader trusts to describe real
 * settlement would be worse than publishing nothing.
 */

const JOB_PARAMS: EndpointParam[] = [
  {
    name: 'id',
    type: 'uint256',
    in: 'path',
    required: true,
    description:
      'The job id the kernel returned from createJob, base ten. Parsed as a BigInt, not a JS number - mainnet is already past 56,000. 0 and non-numeric ids are a 400.',
  },
  {
    name: 'chainId',
    type: '56 | 97',
    in: 'query',
    description:
      'Which AgenticCommerce deployment to read. Defaults to 56. Job ids are per-deployment: id 721 on 97 and id 721 on 56 are unrelated jobs.',
  },
];

export interface JobReadCardProps {
  liveJob: LiveJobExample;
}

export function JobReadCard({ liveJob }: JobReadCardProps) {
  if (!liveJob.ok) {
    return (
      <section
        id="get-job"
        aria-labelledby="get-job-heading"
        className="glass scroll-mt-24 rounded-2xl border border-amber-400/20 p-5 sm:p-6"
      >
        <h3 id="get-job-heading" className="font-mono text-base font-semibold text-white">
          GET /api/v1/a2a/jobs/&#123;id&#125;
        </h3>
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden />
          <p className="text-sm leading-relaxed text-slate-300">
            The AgenticCommerce kernel did not answer while this page rendered, so there is no example body here.
            The route exists and works; this page just has nothing real to show right now, and it will not invent a
            job to fill the gap.
            <span className="mt-1 block font-mono text-[11px] text-slate-500">{liveJob.reason}</span>
          </p>
        </div>
      </section>
    );
  }

  return (
    <div>
      <EndpointCard
        id="get-job"
        method="GET"
        path="/api/v1/a2a/jobs/{id}"
        summary="Read a live ERC-8183 job off the kernel"
        description="A getJob(uint256) call against the AgenticCommerce kernel, performed while answering your request. This is chain state, not a Bazar record: no cache, no index, no reconstruction from events. Expiry is judged against the head block's own timestamp, so when that read fails the clock-dependent fields come back null instead of being filled in from a server clock."
        statuses={[
          { code: 200, label: 'OK' },
          { code: 400, label: 'VALIDATION_ERROR' },
          { code: 404, label: 'JOB_NOT_FOUND' },
          { code: 502, label: 'CHAIN_READ_FAILED' },
          { code: 503, label: 'CHAIN_UNAVAILABLE' },
        ]}
        params={JOB_PARAMS}
        paramsCaption="Path and query parameters"
        response={liveJob.json}
        responseTitle={`200 OK - GET ${liveJob.path}`}
        note={
          <>
            <span className="mb-2 flex flex-wrap items-center gap-2">
              <Badge tone="gold" size="sm" icon={<Radar className="h-3 w-3" aria-hidden />}>
                Job #{liveJob.jobId} · {liveJob.statusLabel} · {liveJob.budgetLabel}
              </Badge>
              <span className="text-[11px] text-slate-500">
                read from the live kernel while this page rendered. {liveJob.selection} The kernel has issued{' '}
                <span className="tabular text-slate-300">{liveJob.jobCounter}</span> jobs on chain {liveJob.chainId}.
              </span>
            </span>
            <code className="font-mono text-slate-300">404 JOB_NOT_FOUND</code> and{' '}
            <code className="font-mono text-slate-300">503 CHAIN_UNAVAILABLE</code> are not interchangeable.{' '}
            <code className="font-mono text-slate-300">getJob</code> returns an all-zero tuple for an id the kernel
            never issued rather than reverting, which is how Bazar tells &quot;the chain says no such job&quot; apart
            from &quot;Bazar could not ask&quot;. Retry a 503; a 404 will not change.{' '}
            <code className="font-mono text-slate-300">budget.tokenVerifiedInThisResponse</code> is false when the
            token&apos;s own <code className="font-mono text-slate-300">symbol()</code> /{' '}
            <code className="font-mono text-slate-300">decimals()</code> read failed and the response fell back to the
            values Bazar has verified on both deployments.
          </>
        }
      />
    </div>
  );
}
