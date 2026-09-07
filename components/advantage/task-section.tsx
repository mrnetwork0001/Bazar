import { Bot, Coins, ShieldCheck, Terminal, TrendingUp } from '@/components/ui/icons';
import { Badge } from '@/components/ui/badge';
import { GlassCard } from '@/components/ui/glass-card';
import { cn } from '@/lib/utils';
import { FindingsTable, RawOutput, StepList, TimingBars, WinnerChip } from './primitives';
import { rawOutput } from './raw-outputs';
import { VERDICTS, speedVerdict, type MeasuredTask } from './report';

/** Column header for one leg, so the two are told apart before anything is read. */
function LegHeading({
  kind,
  title,
  subtitle,
}: {
  kind: 'agent' | 'manual';
  title: string;
  subtitle: string;
}) {
  const Icon = kind === 'agent' ? Bot : Terminal;
  return (
    <div className="flex items-start gap-2.5">
      <span
        className={cn(
          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset',
          kind === 'agent' ? 'bg-bnb/10 text-bnb ring-bnb/25' : 'bg-sky-400/10 text-sky-300 ring-sky-400/25',
        )}
        aria-hidden
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">{subtitle}</p>
      </div>
    </div>
  );
}

export function TaskSection({ task, index }: { task: MeasuredTask; index: number }) {
  const verdict = VERDICTS[task.id];
  const speed = speedVerdict(task);
  const CategoryIcon = task.category === 'Security' ? ShieldCheck : TrendingUp;

  return (
    <section id={task.id} className="scroll-mt-24">
      <div className="flex flex-wrap items-center gap-2">
        <span className="tabular text-xs font-semibold text-slate-500">Task {index + 1}</span>
        <Badge tone={task.category === 'Security' ? 'emerald' : 'gold'} icon={<CategoryIcon className="h-3 w-3" aria-hidden />}>
          {task.category}
        </Badge>
        {verdict && <WinnerChip winner={verdict.winner} />}
      </div>

      <h3 className="mt-3 text-xl font-semibold tracking-tight text-white sm:text-2xl">{task.title}</h3>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">{task.question}</p>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* ------------------------------ agent ----------------------------- */}
        <GlassCard className="flex flex-col gap-4">
          <LegHeading
            kind="agent"
            title={`${task.agent.name} · token ${task.agent.tokenId}`}
            subtitle={`${task.agent.transport} · ERC-8004 identity on BNB Smart Chain`}
          />

          <div className="space-y-1.5">
            <p className="break-all font-mono text-[10px] text-slate-500">POST {task.agent.endpoint}</p>
            <pre className="overflow-x-auto rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2 font-mono text-[10px] leading-relaxed text-slate-300">
              {task.agent.request}
            </pre>
          </div>

          <TimingBars
            agentMs={task.agent.medianMs}
            manualMs={task.manual.medianMs}
            agentSamples={task.agent.samplesMs}
            manualSamples={task.manual.samplesMs}
          />

          <div>
            <p className="mb-1.5 text-[11px] font-medium text-slate-300">Requests issued</p>
            <StepList steps={task.agent.steps} />
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-medium text-slate-300">What came back</p>
            <FindingsTable findings={task.agent.findings} />
          </div>

          <p className="flex items-start gap-1.5 text-[11px] text-slate-400">
            <Coins className="mt-0.5 h-3 w-3 shrink-0 text-slate-500" aria-hidden />
            <span>{task.agent.priceNote}</span>
          </p>

          <div className="mt-auto">
            <RawOutput
              label="Raw response, attached"
              json={rawOutput(task.agent.outputFile)}
              file={task.agent.outputFile}
            />
          </div>
        </GlassCard>

        {/* ------------------------------ manual ---------------------------- */}
        <GlassCard className="flex flex-col gap-4">
          <LegHeading kind="manual" title="Without the agent" subtitle={task.manual.label} />

          <div className="rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Hand-stamped analyst time</p>
            <p className="tabular mt-0.5 text-sm font-semibold text-sky-300">
              {verdict ? `${verdict.analystSecondsManual} s` : 'not stamped'}
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
              Wall clock for this leg only, at machine speed with the endpoints already known. The agent leg was not
              stamped, so the two are not compared.
            </p>
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-medium text-slate-300">Requests issued</p>
            <StepList steps={task.manual.steps} />
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-medium text-slate-300">What came back</p>
            <FindingsTable findings={task.manual.findings} />
          </div>

          <p className="flex items-start gap-1.5 text-[11px] text-slate-400">
            <Coins className="mt-0.5 h-3 w-3 shrink-0 text-slate-500" aria-hidden />
            <span>{task.manual.priceNote}</span>
          </p>

          <div className="mt-auto">
            <RawOutput
              label="Raw response, attached"
              json={rawOutput(task.manual.outputFile)}
              file={task.manual.outputFile}
            />
          </div>
        </GlassCard>
      </div>

      {/* ------------------------------ verdict ----------------------------- */}
      {verdict && (
        <GlassCard strong className="mt-4 border-l-2 border-l-bnb/50">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-white">{verdict.headline}</p>
            <span className="tabular text-[11px] text-slate-400">Machine time: {speed.label}</span>
          </div>

          <div className="mt-3 space-y-2.5">
            {verdict.body.map((para) => (
              <p key={para.slice(0, 40)} className="max-w-4xl text-[13px] leading-relaxed text-slate-300">
                {para}
              </p>
            ))}
          </div>

          <p className="mt-4 rounded-lg border border-white/[0.06] bg-black/25 px-3 py-2 text-[11px] leading-relaxed text-slate-400">
            <span className="font-medium text-slate-300">The measurement that carries it: </span>
            {verdict.evidence}
          </p>
        </GlassCard>
      )}
    </section>
  );
}
