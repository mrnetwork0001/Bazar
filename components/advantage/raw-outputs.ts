/**
 * The attached raw responses, keyed by the path the benchmark recorded.
 *
 * These are imported as modules rather than read from disk at request time so
 * that the bundler traces them: a judge reading /advantage on a deployment gets
 * the same bytes as a judge reading docs/agent-advantage/outputs in the repo.
 * The track requires actual outputs attached for comparison, and an attachment
 * that only exists on the author's filesystem is not attached.
 */

import bridgeAgent from '@/docs/agent-advantage/outputs/bridge-route.agent.json';
import bridgeManual from '@/docs/agent-advantage/outputs/bridge-route.manual.json';
import auditAgent from '@/docs/agent-advantage/outputs/commit-reveal-audit.agent.json';
import auditManual from '@/docs/agent-advantage/outputs/commit-reveal-audit.manual.json';
import oddsAgent from '@/docs/agent-advantage/outputs/odds-snapshot.agent.json';
import oddsManual from '@/docs/agent-advantage/outputs/odds-snapshot.manual.json';
import tokenAgent from '@/docs/agent-advantage/outputs/token-contract-check.agent.json';
import tokenManual from '@/docs/agent-advantage/outputs/token-contract-check.manual.json';
import trackAgent from '@/docs/agent-advantage/outputs/track-record.agent.json';
import trackManual from '@/docs/agent-advantage/outputs/track-record.manual.json';

const BY_PATH: Record<string, unknown> = {
  'outputs/bridge-route.agent.json': bridgeAgent,
  'outputs/bridge-route.manual.json': bridgeManual,
  'outputs/commit-reveal-audit.agent.json': auditAgent,
  'outputs/commit-reveal-audit.manual.json': auditManual,
  'outputs/odds-snapshot.agent.json': oddsAgent,
  'outputs/odds-snapshot.manual.json': oddsManual,
  'outputs/token-contract-check.agent.json': tokenAgent,
  'outputs/token-contract-check.manual.json': tokenManual,
  'outputs/track-record.agent.json': trackAgent,
  'outputs/track-record.manual.json': trackManual,
};

/**
 * Pretty-printed attachment for one leg, or null when the benchmark recorded a
 * path this module does not carry. Null renders as a stated absence rather than
 * an empty block, because a missing attachment is a fact about the run.
 */
export function rawOutput(outputFile: string): string | null {
  const value = BY_PATH[outputFile];
  return value === undefined ? null : JSON.stringify(value, null, 2);
}
