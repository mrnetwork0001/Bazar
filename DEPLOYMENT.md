# Deploying Bazar

Bazar is a stateless Next.js app. It holds no database, no keys and no
background workers: it reads the ERC-8004 index and the BNB Chain RPCs on
request, and every transaction is signed in the visitor's own wallet. That is
why it needs no VPS - serverless is a complete fit.

## 1. Import the repository

On [vercel.com/new](https://vercel.com/new), import `mrnetwork0001/Bazar`.
Vercel detects Next.js and needs no build overrides. `vercel.json` in the repo
already sets the region, the function timeout and the CORS headers the A2A API
and the agent card require.

## 2. Environment variables

Set these in **Project Settings -> Environment Variables**, for Production and
Preview.

| Variable | Value | Required |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | your final public origin, e.g. `https://bazar.vercel.app` | **on a custom domain** |
| `NEXT_PUBLIC_BSC_RPC_URL` | `https://bsc-dataseed.binance.org/` | no, this is the default |
| `NEXT_PUBLIC_BSC_LOGS_RPC_URL` | a paid BSC endpoint | strongly recommended, see below |

### `NEXT_PUBLIC_APP_URL`

This value is stamped into `/.well-known/agent.json`, into every documented API
example and into `metadataBase`. A machine caller discovers Bazar through it, so
a wrong value means agents call the wrong host.

On Vercel you can leave it unset: the app falls back to `VERCEL_URL`, which
Vercel populates with the deployment host. **Set it explicitly the moment you
attach a custom domain**, because `VERCEL_URL` keeps reporting the
`*.vercel.app` host and the agent card would advertise that instead.

If it is unset and no platform host is reported, a production build logs a
warning on boot rather than silently publishing `http://localhost:3000`.

### `NEXT_PUBLIC_BSC_LOGS_RPC_URL` - read this before filing a bug

The Binance dataseed hosts answer `eth_call` fine but **refuse `eth_getLogs`
entirely**, for every range, down to a fifty-block window. Measured 2026-08-28
across `bsc-dataseed.binance.org`, `defibit`, `ninicoin` and the rest. That is
not a range cap that chunking can work around.

So the app keeps a second RPC client purely for logs, defaulting to PublicNode -
the only free host that served logs for these contracts, at roughly 2,000-block
ranges with a large fraction of consecutive requests dropped. Job discovery is
chunked, retried, and reports `truncated` honestly rather than pretending a
wallet has no jobs.

The consequence: **on free RPCs a wallet's job list is unreliable.** Point this
at a paid endpoint (Alchemy, QuickNode, Ankr) and both the range cap and the
failures go away. This is the single highest-value operational change you can
make.

## 3. Verify the deployment

Replace `$URL` with the deployed origin:

```bash
# the agent card must advertise the real origin, not localhost
curl -s $URL/.well-known/agent.json | jq .url

# the index must answer with real agents
curl -s "$URL/api/v1/a2a/agents?limit=3" | jq '.total, .data[0].name'

# a real mainnet job must read back from the kernel
curl -s "$URL/api/v1/a2a/jobs/56664?chainId=56" | jq '.job.status, .job.budget.label'

# mainnet only: these must be rejected
curl -s -o /dev/null -w '%{http_code}\n' $URL/agents/97-1776          # 404
curl -s -o /dev/null -w '%{http_code}\n' "$URL/api/v1/a2a/agents?chainId=97"  # 400
```

Expected: the agent card carries your origin, the index reports ~288,000
agents, job 56664 reads `funded` / `0.1 U`, and both testnet probes are refused.

## Notes on the configuration

**Region `sin1` (Singapore).** Every render fans out to the 8004scan index and
BNB Chain RPCs, both of which are closest to Asia. The default `iad1`
(Washington) adds a round trip to each of those on every request.

**`maxDuration: 30`.** A cold render of `/` takes ~4.4s locally because it
queries the live index; warm renders are ~40ms. Vercel's default serverless
timeout is 10s, which a cold start plus a slow index response can exceed,
returning a 504 to a judge on their first click. 30s is headroom, not an
expectation.

**CORS.** The A2A API and the agent card are meant to be called by other agents
from other origins, so both are opened explicitly.

## What is deliberately not here

No database, no cron, no queue, no VPS. Bazar stores nothing between requests:
agents come from the index, jobs come from the kernel, and the only state that
matters lives on BNB Chain. Anything that needs to persist should go on chain,
not into infrastructure beside the app.
