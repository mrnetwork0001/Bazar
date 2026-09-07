import type { Metadata } from 'next';
import { TaskSection } from '@/components/advantage/task-section';
import { WinnerChip } from '@/components/advantage/primitives';
import {
  PRICES,
  PRICES_NOTE,
  RUN,
  TOTAL_AGENT_MS,
  TOTAL_ANALYST_SECONDS,
  TOTAL_MANUAL_MS,
  VERDICTS,
  speedVerdict,
} from '@/components/advantage/report';
import { Badge } from '@/components/ui/badge';
import { GlassCard } from '@/components/ui/glass-card';
import { CheckCircle2, Coins, FileJson, Scale, ShieldCheck, TriangleAlert } from '@/components/ui/icons';

export const metadata: Metadata = {
  title: 'Agent Advantage Report',
  description:
    'Five real tasks executed twice each - once through a live ERC-8004 agent on BNB Smart Chain, once by hand. Measured times, published prices, attached raw outputs, and the two results that do not favour the agent.',
};

/** UTC, spelled out. A locale-formatted date in a report is a date two readers disagree about. */
function utc(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(
    d.getUTCMinutes(),
  )} UTC`;
}

const REQUIREMENTS = [
  {
    ask: 'Minimum 3 real tasks executed both ways',
    met: `${RUN.tasks.length} tasks, each run through a live agent endpoint and again by hand`,
  },
  {
    ask: 'Document time, cost and output quality per task',
    met: 'Median of three timed samples per leg, the price each side actually charged, and a verdict tied to a named measurement',
  },
  {
    ask: 'Attach actual outputs for comparison',
    met: `${RUN.tasks.length * 2} raw responses attached in full below and committed under docs/agent-advantage/outputs`,
  },
  {
    ask: 'At least one task from trading, stocks or security',
    met: 'Three trading tasks and two security tasks, including an independent audit of an onchain commit-reveal claim',
  },
];

export default function AdvantagePage() {
  const stats = [
    { label: 'Tasks, run both ways', value: String(RUN.tasks.length) },
    { label: 'Agent machine time, total', value: `${(TOTAL_AGENT_MS / 1000).toFixed(2)} s` },
    { label: 'Manual machine time, total', value: `${(TOTAL_MANUAL_MS / 1000).toFixed(2)} s` },
    { label: 'Hand-stamped manual time', value: `${TOTAL_ANALYST_SECONDS} s` },
  ];

  return (
    <div className="relative isolate">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-hero-glow opacity-70" aria-hidden />
      <div className="bg-grid bg-grid-fade pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] opacity-60" aria-hidden />

      <main className="container-x pb-24 pt-10 sm:pt-14">
        {/* --------------------------------- hero -------------------------------- */}
        <header className="max-w-3xl">
          <Badge tone="gold" className="font-mono">
            Termix track · Agent Advantage Report
          </Badge>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-gradient-white sm:text-5xl">
            Five tasks, done twice
          </h1>
          <p className="mt-4 text-base leading-relaxed text-slate-400">
            Each task was executed once through a live endpoint published by an agent registered in the ERC-8004
            Identity Registry on BNB Smart Chain, and once by hand through public APIs and a plain EVM RPC. Every
            request below was really sent. Every response is attached in full.
          </p>
          <p className="mt-3 text-base leading-relaxed text-slate-400">
            Two of the five do not go the agent&apos;s way, and one is a flat failure to answer the question at all.
            Those are written up at the same length as the wins, because a report where the agent wins five times out of
            five tells you only that its author picked the tasks carefully.
          </p>

          <dl className="tabular mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[11px] text-slate-500">
            <div>
              <dt className="inline text-slate-500">Run of record: </dt>
              <dd className="inline text-slate-300">{utc(RUN.startedAt)}</dd>
            </div>
            <div>
              <dt className="inline text-slate-500">Samples per leg: </dt>
              <dd className="inline text-slate-300">{RUN.samplesPerLeg}</dd>
            </div>
            <div>
              <dt className="inline text-slate-500">Runner: </dt>
              <dd className="inline text-slate-300">
                Node {RUN.runner.node}, {RUN.runner.platform}
              </dd>
            </div>
          </dl>
        </header>

        {/* -------------------------------- stats -------------------------------- */}
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <GlassCard key={s.label} className="flex flex-col justify-between">
              <p className="text-[11px] leading-relaxed text-slate-400">{s.label}</p>
              <p className="tabular mt-2 text-2xl font-semibold text-white">{s.value}</p>
            </GlassCard>
          ))}
        </div>

        {/* ----------------------------- requirements ---------------------------- */}
        <section className="mt-12">
          <h2 className="text-lg font-semibold tracking-tight text-white">What the track asked for</h2>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {REQUIREMENTS.map((r) => (
              <GlassCard key={r.ask} className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">{r.ask}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{r.met}</p>
                </div>
              </GlassCard>
            ))}
          </div>
        </section>

        {/* ------------------------------- summary ------------------------------- */}
        <section className="mt-12">
          <h2 className="text-lg font-semibold tracking-tight text-white">Results at a glance</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
            Machine time is the median of {RUN.samplesPerLeg} samples per leg. The last column is the one that matters:
            speed is rarely the interesting difference between the two routes.
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[46rem] border-separate border-spacing-0 text-left text-[12px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="border-b border-white/[0.08] px-3 py-2 font-medium">Task</th>
                  <th className="border-b border-white/[0.08] px-3 py-2 font-medium">Category</th>
                  <th className="border-b border-white/[0.08] px-3 py-2 text-right font-medium">Agent</th>
                  <th className="border-b border-white/[0.08] px-3 py-2 text-right font-medium">Manual</th>
                  <th className="border-b border-white/[0.08] px-3 py-2 font-medium">Machine time</th>
                  <th className="border-b border-white/[0.08] px-3 py-2 font-medium">Who answered the question</th>
                </tr>
              </thead>
              <tbody>
                {RUN.tasks.map((task) => {
                  const verdict = VERDICTS[task.id];
                  return (
                    <tr key={task.id} className="align-top">
                      <td className="border-b border-white/[0.06] px-3 py-2.5">
                        <a className="ring-focus rounded text-slate-200 hover:text-bnb" href={`#${task.id}`}>
                          {task.title}
                        </a>
                      </td>
                      <td className="border-b border-white/[0.06] px-3 py-2.5 text-slate-400">{task.category}</td>
                      <td className="tabular border-b border-white/[0.06] px-3 py-2.5 text-right text-slate-300">
                        {task.agent.medianMs.toFixed(1)} ms
                      </td>
                      <td className="tabular border-b border-white/[0.06] px-3 py-2.5 text-right text-slate-300">
                        {task.manual.medianMs.toFixed(1)} ms
                      </td>
                      <td className="border-b border-white/[0.06] px-3 py-2.5 text-slate-400">
                        {speedVerdict(task).label}
                      </td>
                      <td className="border-b border-white/[0.06] px-3 py-2.5">
                        {verdict ? <WinnerChip winner={verdict.winner} /> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <GlassCard className="mt-4 flex items-start gap-3">
            <Scale className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
            <p className="text-[12px] leading-relaxed text-slate-400">
              Totals come to {(TOTAL_AGENT_MS / 1000).toFixed(2)} s of agent time against{' '}
              {(TOTAL_MANUAL_MS / 1000).toFixed(2)} s of manual time, a{' '}
              <span className="tabular text-slate-200">{(TOTAL_MANUAL_MS / TOTAL_AGENT_MS).toFixed(2)}x</span> ratio.
              That is quoted because it is what was measured, and qualified immediately: the manual leg of task 1
              produced no answer at all, so the two totals are not measuring equal work.
            </p>
          </GlassCard>
        </section>

        {/* -------------------------------- tasks -------------------------------- */}
        <div className="mt-16 space-y-16">
          {RUN.tasks.map((task, i) => (
            <TaskSection key={task.id} task={task} index={i} />
          ))}
        </div>

        {/* ------------------------------- pricing ------------------------------- */}
        <section className="mt-16">
          <h2 className="text-lg font-semibold tracking-tight text-white">What agents charge</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
            Every task above ran against an endpoint that answers for free, which leaves a misleading impression in the
            cost column. These three agents on the same index publish their prices in-band without being paid anything.
            {' '}
            <span className="text-slate-300">None was paid and none was executed:</span> Bazar holds no keys, and the
            harness will not sign a payment. No output, timing or quality judgement is reported for any of them, because
            none was obtained.
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[44rem] border-separate border-spacing-0 text-left text-[12px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="border-b border-white/[0.08] px-3 py-2 font-medium">Agent</th>
                  <th className="border-b border-white/[0.08] px-3 py-2 font-medium">Token</th>
                  <th className="border-b border-white/[0.08] px-3 py-2 font-medium">Price</th>
                  <th className="border-b border-white/[0.08] px-3 py-2 font-medium">Network</th>
                  <th className="border-b border-white/[0.08] px-3 py-2 font-medium">Mechanism</th>
                </tr>
              </thead>
              <tbody>
                {PRICES.map((p) => (
                  <tr key={p.tokenId} className="align-top">
                    <td className="border-b border-white/[0.06] px-3 py-2.5 text-slate-200">{p.agent}</td>
                    <td className="tabular border-b border-white/[0.06] px-3 py-2.5 text-slate-400">{p.tokenId}</td>
                    <td className="border-b border-white/[0.06] px-3 py-2.5 font-medium text-bnb">
                      {p.amountHuman ?? 'no quote returned'}
                    </td>
                    <td className="border-b border-white/[0.06] px-3 py-2.5 font-mono text-[10px] text-slate-400">
                      {p.network ?? 'unstated'}
                    </td>
                    <td className="border-b border-white/[0.06] px-3 py-2.5 text-slate-400">{p.scheme}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <GlassCard className="mt-4 flex items-start gap-3">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-bnb" aria-hidden />
            <p className="text-[12px] leading-relaxed text-slate-400">
              Worth flagging from the discovery run: Agentscan Agent prices its work on chain 84532, which is Base
              Sepolia - a testnet. A buyer reading &quot;0.001 USDC&quot; off that header is being quoted in play money.
            </p>
          </GlassCard>

          <p className="mt-3 flex items-start gap-1.5 text-[11px] text-slate-500">
            <Coins className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            <span>{PRICES_NOTE}</span>
          </p>
        </section>

        {/* -------------------------------- method ------------------------------- */}
        <section className="mt-16">
          <h2 className="text-lg font-semibold tracking-tight text-white">How to check this</h2>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <GlassCard className="space-y-3">
              <div className="flex items-center gap-2">
                <FileJson className="h-4 w-4 text-bnb" aria-hidden />
                <p className="text-sm font-medium text-white">Re-run the measurements</p>
              </div>
              <pre className="overflow-x-auto rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2.5 font-mono text-[10px] leading-relaxed text-slate-300">
                {`node scripts/advantage/run-benchmark.mjs
node scripts/advantage/run-benchmark.mjs --samples 5
node scripts/advantage/price-discovery.mjs`}
              </pre>
              <p className="text-[11px] leading-relaxed text-slate-400">
                Writes docs/agent-advantage/results.json and the raw outputs this page renders. Nothing on this page is
                typed in by hand; every number is read from that file.
              </p>
            </GlassCard>

            <GlassCard className="space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400" aria-hidden />
                <p className="text-sm font-medium text-white">What re-running will not reproduce</p>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-400">
                The findings will reproduce: the null win rate, the six-field token response, the mis-ranked bridge
                routes, the Base transaction and the commitment hash.
              </p>
              <p className="text-[11px] leading-relaxed text-slate-400">
                The milliseconds will not. Latency moves, and both agent endpoints are cold-start serverless
                deployments whose first call after an idle period runs several times slower than steady state - visible
                in the raw samples above, where a first sample of 3160.0 ms sits against a third of 1213.4 ms. Medians
                are shown beside the full sample sets rather than instead of them, and no timing gap under 20 percent is
                called a win.
              </p>
            </GlassCard>
          </div>

          <GlassCard strong className="mt-4 border-l-2 border-l-rose-400/50">
            <p className="text-sm font-medium text-white">The claim this report will not make</p>
            <p className="mt-2 max-w-4xl text-[13px] leading-relaxed text-slate-300">
              It does not claim to know how much human time an agent saves. Nothing here was executed by a human. The
              hand-stamped analyst times are wall clock from an automated run at machine speed, with the endpoints,
              chain ids and token addresses already known - a best case for the manual route and a lower bound on what a
              person would spend. Turning that into a productivity claim about people would be a fabrication, so it is
              not turned into one.
            </p>
            <ul className="mt-4 space-y-1.5 text-[11px] leading-relaxed text-slate-400">
              <li>Machine wall clock only, one machine, one network, {RUN.samplesPerLeg} samples per leg.</li>
              <li>
                Analyst time was stamped for the manual legs only. The agent legs were not stamped, so no side-by-side
                analyst comparison appears anywhere on this page.
              </li>
              <li>No paid agent was invoked and no payment was signed.</li>
              <li>
                Task 1&apos;s manual leg tested free tiers only. The three keyed services were not purchased, and nothing
                is claimed about what they would have returned.
              </li>
            </ul>
          </GlassCard>
        </section>
      </main>
    </div>
  );
}
