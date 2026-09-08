# Deploying Bazar

Bazar is a stateless Next.js app. It holds no database, no keys and no
background workers: it reads the ERC-8004 index and the BNB Chain RPCs on
request, and every transaction is signed in the visitor's own wallet.

Serverless is therefore a complete fit, and section A covers it. Bazar is
currently served from a VPS instead - not because it needs one, but because the
box was already there behind Caddy; section B records that deployment exactly as
it runs at https://usebazar.xyz.

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

---

# B. Deploying to a VPS behind Caddy

This is how https://usebazar.xyz actually runs: Ubuntu 24.04, Node 22, Caddy
already terminating TLS for several other sites on the same host. The whole
point of the arrangement below is that Bazar is additive - it introduces one
directory, one systemd unit and one Caddy file, and touches nothing that was
already running.

## Swap first, if there is none

A `next build` peaks well above what a 2-core box has spare, and the kernel's
OOM killer chooses its victim by score, not by whose build it is. On a host
running other production services, an unswapped build risks killing one of
them.

```bash
fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
sysctl -w vm.swappiness=10
```

The build used 699 MB of it. Without swap that would have come out of RAM with
3.3 GB free.

## Build

```bash
git clone https://github.com/mrnetwork0001/Bazar.git /opt/bazar && cd /opt/bazar
npm ci --no-audit --no-fund
printf 'SCAN_API_KEY=...\nNEXT_PUBLIC_APP_URL=https://usebazar.xyz\n' > .env
chmod 600 .env
NODE_OPTIONS="--max-old-space-size=2048" npm run build
```

The heap cap matters more than the swap: it stops Node ballooning in the first
place rather than catching it after.

## systemd

Bound to loopback, so nothing reaches Bazar except through Caddy. `MemoryMax`
is set so that a leak here is killed as Bazar rather than costing a neighbour.

```ini
[Unit]
Description=Bazar - ERC-8004 agent marketplace for BNB Chain
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/bazar
EnvironmentFile=/opt/bazar/.env
Environment=NODE_ENV=production
ExecStart=/opt/bazar/node_modules/.bin/next start -p 3210 -H 127.0.0.1
Restart=always
RestartSec=5
MemoryMax=1500M
SyslogIdentifier=bazar

[Install]
WantedBy=multi-user.target
```

`ExecStart` names the binary in `node_modules/.bin` rather than `npx`, whose
path varies by install method - systemd performs no shell lookup, so a wrong
path is a service that simply never starts.

## Caddy

One file at `/etc/caddy/conf.d/bazar.caddy`, picked up by the `import
/etc/caddy/conf.d/*.caddy` already at the foot of the main Caddyfile. Caddy
obtains and renews the certificate itself; certbot is not involved.

```
usebazar.xyz, www.usebazar.xyz {
        encode zstd gzip
        header {
                X-Content-Type-Options nosniff
                X-Frame-Options SAMEORIGIN
                Referrer-Policy strict-origin-when-cross-origin
        }
        reverse_proxy 127.0.0.1:3210 {
                transport http { read_timeout 120s }
        }
}
```

Two things that are load-bearing:

**No CORS headers here.** `vercel.json` sets them for the A2A routes, but that
file does nothing on a VPS, so the temptation is to restate them in Caddy. The
route handlers already emit them, and doing both produced two
`Access-Control-Allow-Origin` headers - which browsers treat as invalid and
reject, breaking the router for precisely the callers the headers admit. One
owner per header.

**A 120s read timeout.** 8004scan answers in about 5s when healthy and takes
10s or more to fail, and the client retries. A short proxy timeout converts a
slow index into a 502 that the app was already handling.

## Updating

```bash
cd /opt/bazar && git pull --ff-only && npm ci --no-audit --no-fund \
  && NODE_OPTIONS="--max-old-space-size=2048" npm run build \
  && systemctl restart bazar
```
