import type { ReactNode } from 'react';
import { ArrowUpRight, Fingerprint, ShieldCheck, Star, ThumbsDown, ThumbsUp } from 'lucide-react';
import type { Agent } from '@/lib/types';
import { CopyButton } from '@/components/agents/copy-button';
import {
  ERC8004_IDENTITY_REGISTRY,
  ERC8004_REPUTATION_REGISTRY,
  ERC8004_VALIDATION_REGISTRY,
} from '@/lib/constants';
import { bscScanAddress, clamp, cn, formatNumber, formatRelative, shortAddress } from '@/lib/utils';

/* -------------------------------- shell --------------------------------- */

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

function RegistryPanel({
  title,
  registry,
  icon,
  accent,
  children,
}: {
  title: string;
  /** ERC-8004 registry contract this panel reads from. */
  registry: string;
  icon: ReactNode;
  accent: string;
  children: ReactNode;
}) {
  const deployed = registry !== ZERO_ADDRESS;
  return (
    <div className="flex flex-col rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 backdrop-blur-xl sm:p-5">
      <div className="flex items-center gap-2">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border"
          style={{ borderColor: `${accent}40`, background: `${accent}14`, color: accent }}
        >
          {icon}
        </span>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      <p className="mt-2 font-mono text-[10px] leading-snug text-slate-600">
        {deployed ? (
          <a
            href={bscScanAddress(registry)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 transition-colors hover:text-slate-300 ring-focus"
          >
            {shortAddress(registry, 6)}
            <ArrowUpRight className="h-3 w-3" aria-hidden />
          </a>
        ) : (
          'Registry address set at deploy time'
        )}
      </p>
      <div className="mt-4 flex-1">{children}</div>
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
  const pct = clamp(score, 0, 100) / 100;
  const dash = circumference * pct;

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
        <span className="tabular text-2xl font-semibold leading-none text-white">{score}</span>
        <span className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-500">/ 100</span>
      </div>
    </div>
  );
}

/* -------------------------------- panel --------------------------------- */

export interface ReputationPanelProps {
  agent: Agent;
  className?: string;
}

/**
 * The three ERC-8004 registries, side by side: Identity (who the agent is),
 * Reputation (what hirers reported) and Validation (what independent
 * validators attested). Server-safe apart from the copy controls.
 */
export function ReputationPanel({ agent, className }: ReputationPanelProps) {
  const rep = agent.reputation;
  const total = Math.max(1, rep.positiveFeedback + rep.negativeFeedback);
  const positivePct = (rep.positiveFeedback / total) * 100;
  const negativePct = 100 - positivePct;

  return (
    <div className={cn('grid grid-cols-1 gap-3 lg:grid-cols-3', className)}>
      {/* ------------------------------ Identity ---------------------------- */}
      <RegistryPanel
        title="Identity Registry"
        registry={ERC8004_IDENTITY_REGISTRY}
        accent="#F0B90B"
        icon={<Fingerprint className="h-3.5 w-3.5" aria-hidden />}
      >
        <dl>
          <Row label="Token ID">
            <span className="tabular font-mono text-sm font-semibold text-white">#{agent.tokenId}</span>
          </Row>
          <Row label="Owner">
            <a
              href={bscScanAddress(agent.owner)}
              target="_blank"
              rel="noreferrer"
              className="tabular truncate font-mono text-xs text-slate-300 transition-colors hover:text-bnb ring-focus"
            >
              {shortAddress(agent.owner)}
            </a>
            <CopyButton value={agent.owner} label="owner address" />
          </Row>
          <Row label="Agent URI">
            <a
              href={agent.agentURI}
              target="_blank"
              rel="noreferrer"
              className="truncate font-mono text-xs text-slate-300 transition-colors hover:text-bnb ring-focus"
              title={agent.agentURI}
            >
              {agent.agentURI.replace(/^https?:\/\//, '')}
            </a>
            <CopyButton value={agent.agentURI} label="agent URI" />
          </Row>
          <Row label="Status">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 text-xs font-semibold',
                agent.verified ? 'text-emerald-300' : 'text-slate-400',
              )}
            >
              <span
                aria-hidden
                className={cn('h-1.5 w-1.5 rounded-full', agent.verified ? 'bg-emerald-400' : 'bg-slate-500')}
              />
              {agent.verified ? 'Verified' : 'Unverified'}
            </span>
          </Row>
        </dl>
      </RegistryPanel>

      {/* ----------------------------- Reputation --------------------------- */}
      <RegistryPanel
        title="Reputation Registry"
        registry={ERC8004_REPUTATION_REGISTRY}
        accent="#22D3EE"
        icon={<Star className="h-3.5 w-3.5" aria-hidden />}
      >
        <div className="flex items-center gap-4">
          <ScoreRing score={rep.score} accent="#22D3EE" />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Reviews</div>
            <div className="tabular text-xl font-semibold text-white">{formatNumber(rep.reviews, { compact: false })}</div>
            <p className="mt-1 text-[11px] leading-snug text-slate-500">
              Signed feedback from settled escrows, one vote per hire.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2.5">
          <div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="inline-flex items-center gap-1.5 font-medium text-emerald-300">
                <ThumbsUp className="h-3 w-3" aria-hidden />
                Positive
              </span>
              <span className="tabular text-slate-400">
                {formatNumber(rep.positiveFeedback, { compact: false })} · {positivePct.toFixed(1)}%
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full bg-emerald-400" style={{ width: `${positivePct}%` }} />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="inline-flex items-center gap-1.5 font-medium text-rose-300">
                <ThumbsDown className="h-3 w-3" aria-hidden />
                Negative
              </span>
              <span className="tabular text-slate-400">
                {formatNumber(rep.negativeFeedback, { compact: false })} · {negativePct.toFixed(1)}%
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full bg-rose-400" style={{ width: `${negativePct}%` }} />
            </div>
          </div>
        </div>
      </RegistryPanel>

      {/* ----------------------------- Validation --------------------------- */}
      <RegistryPanel
        title="Validation Registry"
        registry={ERC8004_VALIDATION_REGISTRY}
        accent="#34D399"
        icon={<ShieldCheck className="h-3.5 w-3.5" aria-hidden />}
      >
        <dl>
          <Row label="Validations">
            <span className="tabular text-sm font-semibold text-white">
              {formatNumber(rep.validations, { compact: false })}
            </span>
          </Row>
          <Row label="Last validated">
            <span className="text-xs text-slate-300">{formatRelative(rep.lastValidatedAt)}</span>
          </Row>
        </dl>

        <div className="mt-3">
          <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Validators</div>
          <ul className="mt-2 space-y-1.5">
            {rep.validators.map((validator) => (
              <li key={validator}>
                <a
                  href={bscScanAddress(validator)}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 transition-colors hover:border-emerald-400/30 hover:bg-emerald-400/[0.06] ring-focus"
                >
                  <span className="tabular truncate font-mono text-xs text-slate-300 group-hover:text-white">
                    {shortAddress(validator, 6)}
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-600 group-hover:text-emerald-300" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </RegistryPanel>
    </div>
  );
}
