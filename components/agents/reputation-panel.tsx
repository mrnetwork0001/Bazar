import type { ReactNode } from 'react';
import { Activity, MessageSquare, Star, Trophy } from '@/components/ui/icons';
import type { IndexedAgent } from '@/lib/types';
import { DEPLOYMENTS, type SupportedChainId } from '@/lib/chain/addresses';
import type { ScoreDimension } from '@/components/agents/agent-detail';
import { formatScore } from '@/components/agents/reputation-format';
import { clamp, cn, formatDate, formatNumber } from '@/lib/utils';

/* --------------------------------- shell -------------------------------- */

/**
 * One reputation metric.
 *
 * `note` is a single line and `detail` is the sentence it compresses, carried
 * on the card as a title. These were one three-line paragraph per card, pinned
 * to the bottom by a `flex-1` spacer: on the Health card, whose content is a
 * number and a bar, that opened a hand-sized hole between the two and set the
 * caveat in more space than the measurement.
 *
 * The provenance those paragraphs carried is worth keeping - each says what
 * its number is not, which is the part a hirer gets wrong - so none of it is
 * deleted, only compressed to a line with the rest a hover away.
 */
function Card({
  title,
  icon,
  accent,
  note,
  detail,
  children,
}: {
  title: string;
  icon: ReactNode;
  accent: string;
  note: ReactNode;
  detail?: string;
  children: ReactNode;
}) {
  return (
    <div
      title={detail}
      className="flex flex-col rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 backdrop-blur-xl sm:p-5"
    >
      <div className="flex items-center gap-2">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border"
          style={{ borderColor: `${accent}40`, background: `${accent}14`, color: accent }}
        >
          {icon}
        </span>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      {/* No flex-1 spacer: the caption follows the content instead of being
          pushed to a shared baseline the shortest card cannot reach. */}
      <div className="mt-4">{children}</div>
      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">{note}</p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/[0.05] py-2 last:border-b-0">
      <dt className="shrink-0 text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1.5 text-right">{children}</dd>
    </div>
  );
}

/* ------------------------------ score ring ------------------------------ */

function ScoreRing({ score, accent }: { score: number; accent: string }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * (clamp(score, 0, 100) / 100);

  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90" aria-hidden focusable="false">
        <circle cx="40" cy="40" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke={accent}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${dash.toFixed(2)} ${(circumference - dash).toFixed(2)}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular text-2xl font-semibold leading-none text-white">
          {formatScore(score)}
        </span>
        <span className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-500">/ 100</span>
      </div>
    </div>
  );
}

/* --------------------------------- meter -------------------------------- */

function Meter({ value, accent }: { value: number; accent: string }) {
  return (
    <div
      className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]"
      role="img"
      aria-label={`${Math.round(value)} out of 100`}
    >
      <div
        className="h-full rounded-full"
        style={{ width: `${clamp(value, 0, 100)}%`, background: accent }}
      />
    </div>
  );
}

/* --------------------------------- panel -------------------------------- */

export interface ReputationPanelProps {
  agent: IndexedAgent;
  /** Component scores published alongside the aggregate, when available. */
  scores?: ScoreDimension[];
  /** When the index last recomputed those scores. */
  scoredAt?: string | null;
  className?: string;
}

/**
 * Validation counts are deliberately absent.
 *
 * The index publishes `total_validations` / `successful_validations`, but the
 * ERC-8004 Validation Registry has no production deployment on BNB Smart Chain,
 * so the pair is 0/0 for every BSC identity. The landing page states plainly
 * that Bazar renders no validator attestations; a "Validations - None" row here
 * contradicted that for the sake of a field that can only ever read zero.
 */

/**
 * Reputation exactly as the ERC-8004 Reputation Registry index publishes it:
 * an aggregate score, a mean feedback rating, star and feedback counts, an
 * optional health score and optional ranks.
 *
 * Zero feedback is the normal case - most of even the top-ranked BSC agents
 * have never had a feedback entry written against them - so the empty state
 * is designed as a first-class state, and no ratio is ever divided by
 * `totalFeedbacks`.
 */
export function ReputationPanel({ agent, scores, scoredAt, className }: ReputationPanelProps) {
  const rep = agent.reputation;
  const hasFeedback = rep.totalFeedbacks > 0;
  // 0 shows up on agents with 100+ entries: the index simply has not populated
  // an average there. Rendering it as "0" would read as a damning rating.
  const hasAverage = rep.averageScore > 0;
  const ranked = rep.rank !== null || rep.networkRank !== null;
  // `networkRank` is per-chain, so the label names the chain the identity is on
  // rather than asserting BSC for a record that may not be from it.
  const networkName = DEPLOYMENTS[agent.chainId as SupportedChainId]?.name ?? `Chain ${agent.chainId}`;

  const breakdown = scores ?? [];

  return (
    <div className={cn('space-y-3', className)}>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* ---------------------------- aggregate --------------------------- */}
        <Card
          title="Reputation score"
          icon={<Trophy className="h-3.5 w-3.5" aria-hidden />}
          accent="#F0B90B"
          note="Published by the index - never recomputed here."
          detail="The aggregate score published by the ERC-8004 reputation index for this identity. Bazar ranks and sorts on it, and never recomputes or smooths it."
        >
          <div className="flex items-center gap-4">
            <ScoreRing score={rep.totalScore} accent="#F0B90B" />
            <div className="min-w-0 flex-1">
              {ranked ? (
                <dl>
                  {rep.rank !== null && (
                    <Row label="Rank">
                      <span className="tabular text-sm font-semibold text-white">
                        #{formatNumber(rep.rank, { compact: false })}
                      </span>
                    </Row>
                  )}
                  {rep.networkRank !== null && (
                    <Row label={`${networkName} rank`}>
                      <span className="tabular text-sm font-semibold text-white">
                        #{formatNumber(rep.networkRank, { compact: false })}
                      </span>
                    </Row>
                  )}
                </dl>
              ) : (
                <>
                  <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Rank</div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-300">Not published</div>
                  <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
                    The index has not placed this identity in a ranking. Bazar reports that rather than inferring a
                    position from the score.
                  </p>
                </>
              )}
            </div>
          </div>
        </Card>

        {/* ----------------------------- feedback --------------------------- */}
        <Card
          title="Feedback"
          icon={<MessageSquare className="h-3.5 w-3.5" aria-hidden />}
          accent="#22D3EE"
          note="Counts and a mean only - the registry publishes no split."
          detail="Feedback entries and stars recorded against this identity in the Reputation Registry. The registry publishes counts and an average, not a positive/negative split, so Bazar shows no split."
        >
          {hasFeedback ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className="tabular text-3xl font-semibold leading-none text-white">
                  {formatNumber(rep.totalFeedbacks, { compact: false })}
                </span>
                <span className="text-xs text-slate-500">
                  feedback {rep.totalFeedbacks === 1 ? 'entry' : 'entries'}
                </span>
              </div>

              {hasAverage ? (
                <div className="mt-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                      Average rating
                    </span>
                    <span className="tabular text-sm font-semibold text-white">
                      {formatScore(rep.averageScore)} / 100
                    </span>
                  </div>
                  <div className="mt-2">
                    <Meter value={rep.averageScore} accent="#22D3EE" />
                  </div>
                  <p className="mt-2 text-[11px] leading-snug text-slate-500">
                    On a 0-100 scale, not five stars.
                  </p>
                </div>
              ) : (
                <p className="mt-4 rounded-xl border border-dashed border-white/[0.12] bg-white/[0.02] px-3 py-2.5 text-[11px] leading-relaxed text-slate-500">
                  The index publishes no average rating for these entries. That is a gap in the data, not a score of
                  zero, so Bazar leaves it blank rather than rendering a zero.
                </p>
              )}

              <dl className="mt-4">
                <Row label="Stars">
                  <Star className="h-3.5 w-3.5 text-bnb" aria-hidden />
                  <span className="tabular text-sm font-semibold text-white">
                    {formatNumber(rep.starCount, { compact: false })}
                  </span>
                </Row>
              </dl>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-white/[0.12] bg-white/[0.02] px-3.5 py-4">
              <p className="text-sm font-medium text-slate-300">No feedback recorded yet</p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
                Nobody has written a feedback entry for this agent. That is the norm rather than a warning: most
                registered agents on BNB Smart Chain have none.
              </p>
              <dl className="mt-3">
                <Row label="Stars">
                  <Star className="h-3.5 w-3.5 text-bnb" aria-hidden />
                  <span className="tabular text-sm font-semibold text-white">
                    {formatNumber(rep.starCount, { compact: false })}
                  </span>
                </Row>
              </dl>
            </div>
          )}
        </Card>

        {/* ------------------------------ health ---------------------------- */}
        <Card
          title="Health score"
          icon={<Activity className="h-3.5 w-3.5" aria-hidden />}
          accent="#34D399"
          note={
            <>
              Record completeness, not trading or uptime.{' '}
              <a
                href="https://8004scan.io"
                target="_blank"
                rel="noreferrer"
                className="ring-focus text-slate-400 transition-colors hover:text-bnb"
              >
                8004scan
              </a>
            </>
          }
          detail="A completeness and liveness measure computed by the index over the registry record itself, not a trading or uptime metric. Source: 8004scan."
        >
          {rep.healthScore === null ? (
            <div className="rounded-xl border border-dashed border-white/[0.12] bg-white/[0.02] px-3.5 py-4">
              <p className="text-sm font-medium text-slate-300">Not computed</p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
                The index has not published a health score for this identity. Bazar leaves the field empty rather than
                substituting a default.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                <span className="tabular text-3xl font-semibold leading-none text-white">
                  {rep.healthScore.toFixed(0)}
                </span>
                <span className="text-xs text-slate-500">/ 100</span>
              </div>
              <div className="mt-3">
                <Meter value={rep.healthScore} accent="#34D399" />
              </div>
            </>
          )}

        </Card>
      </div>

      {/* ---------------------------- breakdown --------------------------- */}
      {breakdown.length > 0 && (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 backdrop-blur-xl sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold text-white">What the score is made of</h3>
            {scoredAt && <p className="text-[11px] text-slate-500">Recomputed {formatDate(scoredAt)}</p>}
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            The index publishes the component scores behind the aggregate, each on a 0-100 scale. Bazar shows them so
            a low headline number can be read rather than guessed at.
          </p>
          <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {breakdown.map((dimension) => (
              <div key={dimension.key}>
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                    {dimension.label}
                  </dt>
                  <dd className="tabular text-xs font-semibold text-white">{formatScore(dimension.value)}</dd>
                </div>
                <div className="mt-1.5">
                  <Meter value={dimension.value} accent="#F0B90B" />
                </div>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
