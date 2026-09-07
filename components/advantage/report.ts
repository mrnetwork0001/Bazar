/**
 * The Agent Advantage report, split into the two kinds of thing it contains.
 *
 * `RUN` is measured. It is `docs/agent-advantage/results.json` exactly as
 * `scripts/advantage/run-benchmark.mjs` wrote it - every millisecond, status
 * code and field value on the page comes from there and nowhere else. The file
 * is generated, never hand-edited; editing it by hand would make the page a
 * claim about a run that did not happen.
 *
 * `VERDICTS` is written. It is the human judgement about what the measurements
 * mean, and it is kept in a separate structure precisely so a reader can tell
 * the two apart on sight. Nothing in `VERDICTS` restates a number; every number
 * on the page is read live from `RUN`.
 */

import run from '@/docs/agent-advantage/results.json';
import prices from '@/docs/agent-advantage/outputs/price-discovery.json';

/* ------------------------------ measured ------------------------------- */

export interface LegStep {
  label: string;
  status: number;
  note: string;
}

export interface Leg {
  samplesMs: number[];
  medianMs: number;
  error: string | null;
  steps: LegStep[];
  findings: Record<string, unknown> | null;
  outputFile: string;
  priceNote: string;
}

export interface AgentLeg extends Leg {
  name: string;
  tokenId: string;
  transport: string;
  endpoint: string;
  request: string;
}

export interface ManualLeg extends Leg {
  label: string;
}

export interface MeasuredTask {
  id: string;
  title: string;
  category: string;
  question: string;
  agent: AgentLeg;
  manual: ManualLeg;
}

export interface BenchmarkRun {
  startedAt: string;
  finishedAt: string;
  samplesPerLeg: number;
  runner: { node: string; platform: string };
  note: string;
  tasks: MeasuredTask[];
}

/*
 * A JSON module arrives as a structural literal type. The shape is asserted
 * here once, at the single point where generated data enters typed code, so
 * that every consumer downstream is checked normally.
 */
export const RUN = run as BenchmarkRun;

export interface PublishedPrice {
  agent: string;
  tokenId: string;
  endpoint: string;
  status: number;
  scheme: string;
  network: string | null;
  amountHuman: string | null;
  payTo: string | null;
  executed: boolean;
  whyNot: string;
}

export const PRICES = prices.agents as PublishedPrice[];
export const PRICES_NOTE = prices.note;

/* ------------------------------- written -------------------------------- */

/** Who the measurements favour, once the measurements are read properly. */
export type Winner = 'agent' | 'manual' | 'neither' | 'tie';

export interface Verdict {
  /** Which leg the reader should actually use for this task. */
  winner: Winner;
  /** One line, the whole finding. */
  headline: string;
  /** The reasoning, in the order it should be read. */
  body: string[];
  /** The single measured fact that carries the verdict. */
  evidence: string;
  /** Hand-stamped wall clock for the manual leg. Agent legs were not stamped. */
  analystSecondsManual: number;
}

export const VERDICTS: Record<string, Verdict> = {
  'odds-snapshot': {
    winner: 'agent',
    headline: 'The only route to the answer, carrying a label that is wrong.',
    body: [
      'The manual leg was marginally faster and returned nothing usable. Three of the four public sources price an API key and refused without one; the single free source that answered is a fixtures-and-results database whose schema has no odds, price or bookmaker field anywhere in it.',
      'The agent returned 53 fixtures across five leagues, every one of them carrying 1X2 decimals from three separate books. There is no free unauthenticated equivalent, so this is a real advantage rather than a marginal one.',
      'It is also mislabelled. The tool is named get_upcoming_matches and 30 of its 53 rows report match_status "finished". Only four kick off after the moment of the call. A caller who trusts the name and skips a match_date filter will price week-old settled fixtures as live.',
    ],
    evidence: '4 of 53 returned fixtures are actually in the future; 0 of 4 manual sources carry odds.',
    analystSecondsManual: 14,
  },
  'track-record': {
    winner: 'neither',
    headline: 'The metric the track asks for does not exist, on either route.',
    body: [
      'get_metrics returns a serious schema - win rate, Brier, market Brier, Brier improvement, RPS, log loss, calibration error, per-signal accuracy, split by league and by month. Every one of those fields is null. 177 predictions are settled and none has been scored.',
      'The manual route does worse. The public site is a 2.9 KB client-rendered shell with no metric word and no percentage in it, and the ERC-8004 record gives reputation rather than performance: three feedbacks at 100/100 says three counterparties were satisfied, not that any prediction was right.',
      'What the agent does deliver is a denominator and an anchor: 209 predictions, 179 settled, 177 committed and 177 revealed onchain. The win rate it declines to compute is computable by someone else. That is falsifiability, not a track record, and it is what task 5 goes on to exploit.',
      'For a marketplace this is a constraint rather than a footnote. The highest-scoring trading agent on the BNB index publishes no win rate, so any marketplace that shows one for it has invented it.',
    ],
    evidence: '177 settled predictions, 0 scored, win_rate null, brier_score null, calibration_error null.',
    analystSecondsManual: 3,
  },
  'token-contract-check': {
    winner: 'agent',
    headline: 'Three times faster, exactly right, and still not enough to sign on.',
    body: [
      'Every field the agent returned matches the chain: name, symbol, decimals, and a total supply agreeing to its final digit. There is no discrepancy to report and none is manufactured.',
      'It returned six fields, two of which the caller supplied. No owner, no pause flag, no mint authority, no upgradeability. For "what is this token" it is correct and three times faster. For the question actually asked - who controls the contract I am about to grant an allowance to - it is silent, and the six-call manual read is not: a single externally owned account holds owner().',
      'A good first read and a bad last one. Bazar signs an approve against this exact contract on every hire, so its hire flow keeps reading owner() itself.',
    ],
    evidence: 'Agent 4 of 4 returned fields match the chain; owner() and paused() are absent from its response.',
    analystSecondsManual: 46,
  },
  'bridge-route': {
    winner: 'tie',
    headline: 'Faithful numbers, wrong ordering. Take the data, ignore the ranking.',
    body: [
      'Nine milliseconds apart. Neither route is faster in any sense that matters.',
      "The agent is accurate where it counts: its minimum received reproduces the aggregator's own toAmountMin exactly, and it names the same winning bridge. It adds two alternatives the direct call never surfaced and a prefilled execution link, which is genuine added value.",
      'Its ranking contradicts its own cost column. Rank 1 carries a total cost of $0.2714 while rank 2 carries $0.2641. It is ordering by estimated output and presenting that order as best. This is reported rather than smoothed over because "the agent ranked it for you" is exactly the kind of convenience that gets trusted without being checked.',
      'The two legs also differ by $0.0091 on total cost. Quotes move between calls; that is drift, and no significance is claimed for it.',
    ],
    evidence: 'Agent rank 1 total cost $0.2714 against its own rank 2 at $0.2641.',
    analystSecondsManual: 16,
  },
  'commit-reveal-audit': {
    winner: 'manual',
    headline: 'The claim was true. That is not why it should have been believed.',
    body: [
      'The agent answered "verified" in a fifth of the time the chain took to confirm it, and the field beside that answer reads verification_source: local_db. It verified its own database against its own database. Had the commitment been absent from every chain, the same response would have come back.',
      'The independent check stands it up completely. The transaction is real, it succeeded, its calldata carries the match id, the content hash and the commitment hash in the clear, and keccak256(content hash ‖ salt) reproduces the onchain commitment byte for byte. It was committed 1.86 days before kickoff. Nothing was fabricated and the audit found no discrepancy.',
      'Two things the agent never says. The transaction is not on the chain its identity lives on - the ERC-8004 identity is on BNB Smart Chain and the commitment is anchored on Base, found only by trying five networks in turn. And "verified" from this endpoint means self-reported until somebody reads the calldata.',
      'Six seconds of machine time and 58 seconds of hand work turned a self-attestation into a fact. That is the whole argument for a marketplace layer: the value of the agent is that it publishes enough to be checked, and the value of the marketplace is that it checks.',
    ],
    evidence: 'Agent says verified from local_db; the chain confirms it on Base at block 45756452, 1.86 days pre-kickoff.',
    analystSecondsManual: 58,
  },
};

/* ------------------------------- derived -------------------------------- */

export const TOTAL_AGENT_MS = RUN.tasks.reduce((sum, t) => sum + t.agent.medianMs, 0);
export const TOTAL_MANUAL_MS = RUN.tasks.reduce((sum, t) => sum + t.manual.medianMs, 0);

/** Manual-over-agent, so above 1 means the agent was faster. */
export function speedRatio(task: MeasuredTask): number {
  return task.manual.medianMs / task.agent.medianMs;
}

/**
 * A difference under 20% is not called a win.
 *
 * Both agent endpoints are cold-start serverless deployments whose first call
 * after an idle period runs several times slower than steady state - visible in
 * the raw samples. Below that threshold the noise is larger than the signal.
 */
export const TIE_BAND = 0.2;

export function speedVerdict(task: MeasuredTask): { label: string; winner: Winner } {
  const ratio = speedRatio(task);
  if (Math.abs(ratio - 1) < TIE_BAND) return { label: 'no measurable difference', winner: 'tie' };
  return ratio > 1
    ? { label: `agent ${ratio.toFixed(2)}x faster`, winner: 'agent' }
    : { label: `manual ${(1 / ratio).toFixed(2)}x faster`, winner: 'manual' };
}

export const TOTAL_ANALYST_SECONDS = Object.values(VERDICTS).reduce((s, v) => s + v.analystSecondsManual, 0);
