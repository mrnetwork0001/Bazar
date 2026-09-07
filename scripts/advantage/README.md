# Agent Advantage benchmark

The measuring instrument behind [`docs/agent-advantage/REPORT.md`](../../docs/agent-advantage/REPORT.md)
and the `/advantage` page.

```bash
node scripts/advantage/run-benchmark.mjs              # 5 tasks, both ways, 3 samples per leg
node scripts/advantage/run-benchmark.mjs --samples 5
node scripts/advantage/price-discovery.mjs            # published prices; pays nobody
```

Requires Node 18+ and the repo's `viem` dependency (`npm install`). No other
setup, no keys, no environment variables. Every endpoint it calls is public.

## What it writes

| Path | Contents |
|---|---|
| `docs/agent-advantage/results.json` | Every timing, status code and extracted field. The `/advantage` page reads this file and nothing else. |
| `docs/agent-advantage/outputs/<task>.agent.json` | The agent's raw response for that task. |
| `docs/agent-advantage/outputs/<task>.manual.json` | The manual leg's raw response. |
| `docs/agent-advantage/outputs/price-discovery.json` | The prices three paid agents publish without being paid. |

These files are generated. Editing one by hand turns the report into a claim
about a run that did not happen.

## Files

- `transport.mjs` - MCP over Streamable HTTP (handles both the `application/json`
  and `text/event-stream` framings seen in the wild), plain HTTP, EVM JSON-RPC,
  and the timing helper.
- `evm.mjs` - selector derivation, ABI return decoding, and the keccak
  commitment re-derivation, all through `viem`.
- `tasks.mjs` - the five tasks, each with an `agent` leg and a `manual` leg that
  answer the same question.
- `run-benchmark.mjs` - runs both legs of every task `--samples` times, writes
  the results and the attachments.
- `price-discovery.mjs` - reads published prices from paid agents. It does not
  pay and does not execute a paid task.

## What it measures, and what it cannot

It measures **machine wall clock**: from issuing a leg's first request to
holding its parsed result. Human time is not measured here and is not
measurable here - the analyst figures in the report were stamped by hand and are
labelled in the report as not reproducible by this script.

Re-running will reproduce the *findings* - the null win rate, the six-field
token response, the mis-ranked bridge routes, the Base transaction, the
commitment hash. It will not reproduce the milliseconds. Latency moves, and both
agent endpoints are cold-start serverless deployments whose first call after an
idle period runs several times slower than steady state. That is why each leg is
sampled more than once and the median is reported alongside the full sample set
rather than instead of it.

## Adding a task

Append to `TASKS` in `tasks.mjs`. Both legs must answer the same question, and
the manual leg must be the route a competent developer would actually take -
stacking the manual leg is the easiest way to make this whole exercise
worthless. A leg returns:

```js
{
  steps:    [{ label, status, note }],  // every request, with the status it really returned
  findings: { ... },                    // the fields the verdict will turn on
  attach:   { ... },                    // written verbatim to outputs/, quoted in the report
}
```

Then write the verdict in `components/advantage/report.ts`. Measurements and
judgement are kept in separate structures on purpose, so a reader can tell which
is which.
