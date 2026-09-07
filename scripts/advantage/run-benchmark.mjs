#!/usr/bin/env node
/**
 * Agent Advantage benchmark - the measuring instrument behind
 * docs/agent-advantage/REPORT.md and the /advantage page.
 *
 *   node scripts/advantage/run-benchmark.mjs
 *   node scripts/advantage/run-benchmark.mjs --samples 5
 *
 * It executes every task in tasks.mjs both ways against live endpoints, times
 * each leg, and writes:
 *
 *   docs/agent-advantage/results.json        the numbers the page renders
 *   docs/agent-advantage/outputs/*.json      the raw responses, attached
 *
 * What it measures is machine time: the wall clock from issuing the first
 * request of a leg to holding its parsed result. It does not and cannot
 * measure the human time either route costs - that number is recorded by hand
 * in REPORT.md and is labelled there as not reproducible by this script.
 *
 * Re-running it will not reproduce the committed numbers exactly. Network
 * latency moves, and two of the endpoints are cold-start serverless
 * deployments whose first call after an idle period is several times slower
 * than its steady state. That is why every leg is sampled more than once and
 * the median is reported alongside the full sample set rather than instead of
 * it.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { TASKS } from './tasks.mjs';
import { median, timed } from './transport.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const DOCS = path.join(ROOT, 'docs', 'agent-advantage');
const OUTPUTS = path.join(DOCS, 'outputs');

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i === -1 ? fallback : process.argv[i + 1];
}

const SAMPLES = Math.max(1, Number(arg('--samples', '3')));

/**
 * Run one leg `SAMPLES` times. Timing comes from every sample; the attached
 * output comes from the last one, so the bytes on disk are bytes that were
 * really returned rather than a merge of several runs.
 */
async function runLeg(leg) {
  const samples = [];
  let last = null;
  let error = null;
  for (let i = 0; i < SAMPLES; i += 1) {
    const r = await timed(() => leg.run());
    samples.push(r.ms);
    if (r.error) error = r.error;
    else last = r.value;
  }
  return {
    samplesMs: samples,
    medianMs: median(samples),
    error,
    steps: last?.steps ?? [],
    findings: last?.findings ?? null,
    attach: last?.attach ?? null,
  };
}

async function main() {
  await mkdir(OUTPUTS, { recursive: true });

  const startedAt = new Date().toISOString();
  const results = [];

  for (const task of TASKS) {
    process.stdout.write(`\n[${task.id}] ${task.title}\n`);

    process.stdout.write(`  agent  (${task.agent.name}) `);
    const agent = await runLeg(task.agent);
    process.stdout.write(`${agent.error ? 'ERROR ' + agent.error : `${agent.medianMs} ms median of ${agent.samplesMs.join(', ')}`}\n`);

    process.stdout.write('  manual ');
    const manual = await runLeg(task.manual);
    process.stdout.write(`${manual.error ? 'ERROR ' + manual.error : `${manual.medianMs} ms median of ${manual.samplesMs.join(', ')}`}\n`);

    await writeFile(path.join(OUTPUTS, `${task.id}.agent.json`), `${JSON.stringify(agent.attach, null, 2)}\n`, 'utf8');
    await writeFile(path.join(OUTPUTS, `${task.id}.manual.json`), `${JSON.stringify(manual.attach, null, 2)}\n`, 'utf8');

    results.push({
      id: task.id,
      title: task.title,
      category: task.category,
      question: task.question,
      agent: {
        name: task.agent.name,
        tokenId: task.agent.tokenId,
        transport: task.agent.transport,
        endpoint: task.agent.endpoint,
        request: task.agent.request,
        priceNote: task.agent.priceNote,
        samplesMs: agent.samplesMs,
        medianMs: agent.medianMs,
        error: agent.error,
        steps: agent.steps,
        findings: agent.findings,
        outputFile: `outputs/${task.id}.agent.json`,
      },
      manual: {
        label: task.manual.label,
        priceNote: task.manual.priceNote,
        samplesMs: manual.samplesMs,
        medianMs: manual.medianMs,
        error: manual.error,
        steps: manual.steps,
        findings: manual.findings,
        outputFile: `outputs/${task.id}.manual.json`,
      },
    });
  }

  const doc = {
    startedAt,
    finishedAt: new Date().toISOString(),
    samplesPerLeg: SAMPLES,
    runner: { node: process.version, platform: `${process.platform}/${process.arch}` },
    note:
      'Machine wall-clock only. Human analyst time is recorded by hand in REPORT.md and is not reproducible by this script.',
    tasks: results,
  };

  await writeFile(path.join(DOCS, 'results.json'), `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  process.stdout.write(`\nWrote ${path.relative(ROOT, path.join(DOCS, 'results.json'))} and ${results.length * 2} raw outputs.\n`);
}

main().catch((cause) => {
  console.error(cause);
  process.exit(1);
});
