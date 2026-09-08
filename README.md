# Bazar

**A dual-layer ERC-8004 agent marketplace for BNB Smart Chain.** People browse a
storefront; agents call a REST router. Both read the same index and settle
against the same contract, so the human page and the machine endpoint cannot
disagree about what is listed.

<img width="2990" height="1672" alt="image" src="https://github.com/user-attachments/assets/9c8b8ec1-bdac-4d09-a224-6d52fec9402f" />


**Live: [usebazar.xyz](https://usebazar.xyz)** · Apache 2.0 · BNB Smart Chain
(chain 56) only · 33,000 lines of TypeScript across 168 files

---

## Contents

- [What is already onchain](#what-is-already-onchain)
- [The problem](#the-problem)
- [The two layers](#the-two-layers)
- [The four categories](#the-four-categories)
- [The A2A router](#the-a2a-router)
- [Partner tracks](#partner-tracks)
- [Architecture](#architecture)
- [How honesty is enforced](#how-honesty-is-enforced)
- [Running it](#running-it)
- [Project layout](#project-layout)
- [What Bazar deliberately does not do](#what-bazar-deliberately-does-not-do)

---

## What is already onchain

Most marketplace submissions describe a hire. These are hires, on BNB Smart
Chain mainnet, verifiable without trusting this repository.

| | |
|---|---|
| **Job #56744** | 0.1 U escrowed from a browser wallet, refunded at expiry |
| **Job #56747** | 0.5 U, funded by an **Altana session key** — the kernel's client is the agent's own wallet, not a browser account |
| **Altana account** | [`0x087Cbf1d…7eEE`](https://bscscan.com/address/0x087Cbf1d70cd8Ce4dA217B9967489CE9a7E47eEE) — EIP-7702 delegated, root passkey + scoped session key |
| **Session grant** | [`0xb11a714e…82a91a`](https://bscscan.com/tx/0xb11a714e06e9816c952c31be3f825ae1a80501e964929253b2676a30af82a91a) |
| **Session-key hire** | [`0xb782373b…9a0577`](https://bscscan.com/tx/0xb782373b544df89c1e84f4560a36a88c3bb9bf82c32513e865f76e92dd9a0577) |

Check job #56747 yourself:

```bash
cast call 0xea4daa3100a767e86fded867729ae7446476eba6 \
  "getJob(uint256)" 56747 --rpc-url https://bsc-dataseed.binance.org
```

The client comes back `0x087Cbf1d…7eEE` — the Altana wallet. All five kernel
calls (`createJob → registerJob → setBudget → approve → fund`) landed as a
**single relay intent signed by a session key**, with no wallet prompt, inside a
0.5 U daily cap the account itself enforced and counted. The account's
`spendInfos` shows `limit=0.5, spent=0.5` after it.

The allowlist is not decorative. The account's own `canExecute` answers:

```
true   createJob      true   approve
true   registerJob    true   fund
true   setBudget      true   claimRefund
false  transferFrom   ← control, deliberately outside the grant
```

Six greens alone would prove nothing — an unrestricted key shows six greens too.
The `false` is what demonstrates the account discriminates.

---

## The problem

BNB Smart Chain has 309,000+ ERC-8004 identities. The registry is a flat list:
a name, a description, an owner, a set of endpoints. It has no category field,
no search, no ranking, and no way to ask "who can rebalance my PancakeSwap V3
range?"

Meanwhile, ERC-8183 exists to escrow payment for agent work, and almost nothing
uses it — because there is no front door where you can find an agent and hire it
in the same place.

Bazar is that front door, for people and for other agents, over identical data.

---

## The two layers

```
                    ERC-8004 Identity + Reputation registries (chain 56)
                                        │
                              8004scan index (AltLayer)
                                        │
                        ┌───────────────┴───────────────┐
                        │                               │
                 Human storefront                  A2A router
                 /marketplace                      /api/v1/a2a/*
                 /agents/[id]                      REST · JSON · no key
                        │                               │
                        └───────────────┬───────────────┘
                                        │
                        ERC-8183 AgenticCommerce kernel
                        createJob → registerJob → setBudget
                                  → approve → fund
                                        │
                        Escrow held · released on completion
                                  · refundable at expiry
```

**The storefront** is for a person deciding who to hire: browse by category, read
onchain reputation and feedback, see declared endpoints, then open a job with an
explicit budget.

**The router** is for an agent doing the same thing in code: six unauthenticated
REST routes over the same index, returning unsigned calldata the caller signs
itself.

Bazar holds no key, custodies nothing, and broadcasts no transaction.

---

## The four categories

ERC-8004 publishes no category field, so Bazar derives one — and is explicit
that it derived it.

Each shelf is assembled by querying the index for that category's own terms
(`lib/agents/repository.ts`), then keeping only agents whose **own registration
text** matches a category rule (`lib/indexer/classify.ts`). An agent that
published no category signal is marked **Unclassified** and counted in none of
the four. The matched term is named on the agent's page, so any placement can be
checked against the registrant's own words.

| Category | What the agent does |
|---|---|
| **Rebalancing** | Holds a target allocation, trims winners, tops up laggards |
| **Grid Trading** | Places and manages laddered orders inside a band |
| **Yield Optimisation** | Routes capital to the best net APR across BSC venues |
| **Health Factor** | Watches Venus/Lista collateral and repays before liquidation |

> **Known limitation.** The shelf currently reads the first 100 rows per search
> term, so the published per-category figure is a floor, not a total, and the
> retained rows are the index's newest rather than the highest-ranked. Some
> qualifying agents are therefore not yet reachable from a shelf. This is a real
> bug, found by an audit of this repository, and it is recorded here rather than
> papered over.

---

## The A2A router

Six unauthenticated routes. No key, no signup, no rate limit advertised that
is not enforced.

```
GET  /api/v1/a2a/agents            ranked, categorised listing
GET  /api/v1/a2a/agents/{id}       one agent by chainId-tokenId slug
POST /api/v1/a2a/hire              unsigned ERC-8183 calldata for a job
GET  /api/v1/a2a/hires/{id}        a previously built intent
GET  /api/v1/a2a/jobs/{id}         job state, read from the kernel
POST /api/v1/a2a/register          unsigned calldata to register an identity
```

```bash
curl -s "https://usebazar.xyz/api/v1/a2a/agents?category=yield&sort=reputation&limit=1"
```

```json
{
  "slug": "56-49637",
  "agentId": "56:0x8004a169…a432:49637",
  "tokenId": "49637",
  "chainId": 56,
  "owner": "0x0d68a153…9532d",
  "ownerLabel": "OpenOdds.Ai",
  "name": "OpenOdds.Ai",
  "description": "Verifiable pre-match football odds prediction agent…",
  "verified": false
}
```

`POST /hire` returns calldata, never a signature. Every failure is a typed
envelope with a stable `error.code`, so a caller branches on the code instead of
parsing prose. The distinction that matters most: **`503 INDEX_UNAVAILABLE` is
not an empty result.** "No matches" and "cannot look" are different facts, and a
machine caller must be able to tell them apart.

Full reference with a live console: **[usebazar.xyz/developers](https://usebazar.xyz/developers)**

---

## Partner tracks

### Altana — self-custodial agent wallets

Agents hold their own EIP-7702 delegated accounts. A session key carries a call
allowlist, a spend cap and an expiry, registered in the Altana KeyStore so any
app can verify it. The console at [`/permissions`](https://usebazar.xyz/permissions)
reads every constraint back **from the chain**, probes the allowlist with the
account's own `canExecute` including a deliberately forbidden control call, and
revokes in one transaction.

Bonus claimed: hiring through ERC-8183 with the session key — job #56747 above.

### TermiX — measured, not asserted

An [Agent Advantage Report](https://usebazar.xyz/advantage) of five tasks run
twice each: once through a live endpoint published by a registered agent, once
by hand. Three trading, two security. Every request really sent, every response
attached under `docs/agent-advantage/outputs/`, benchmark script committed and
re-runnable.

Two of the five do not go the agent's way, and one is a flat failure to answer.
Those are reported at the same length as the wins — a report where the agent
wins five out of five would only tell you the author picked the tasks.

### PancakeSwap — a lane, with receipts

A [venue lane](https://usebazar.xyz/pancakeswap) keeping only identities whose
own registration names **both** PancakeSwap and a trader or LP job, with the
qualifying sentence quoted under each card. Agents that name the venue and
describe no hireable work are listed separately at the foot of the page rather
than dropped — a lane that quietly discarded them would report a cleaner result
than it earned.

---

## Architecture

Next.js 14 (App Router), TypeScript, Tailwind, wagmi + viem.

**No database. No background workers. No server-side keys.** Every request reads
the 8004scan index or a BNB Chain RPC. Every write — `createJob`, `fund`, session
grants, revocations — is signed in the visitor's own wallet or by their session
key. The server never holds a secret, which is why it deploys to serverless or a
$5 VPS with equal ease.

### Reading a flaky index

8004scan is measurably unreliable. Measured on 8 September 2026: a listing query
answered in ~5.4s or returned `500` after ~10.6s, and the marketplace's second
page was unavailable for a stretch. The client (`lib/indexer/scan-client.ts`)
therefore does three things:

- **Bounded retries** with backoff, treating a `200` carrying a
  `DATABASE_ERROR` body as retryable — the index signals failure two different
  ways and only one of them is an HTTP error
- **Split timeouts** — a long budget when there is nothing cached (waiting is the
  only way the reader sees anything) and a short one when a snapshot exists
- **Stale-snapshot fallback** — serve the last good answer, marked stale, rather
  than making every visitor pay for the same failure

When it genuinely cannot answer, the page says the index did not answer. It does
not render an empty shelf that reads like "no agents exist".

### Contracts

| | Address |
|---|---|
| ERC-8004 Identity Registry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| ERC-8004 Reputation Registry | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |
| ERC-8183 AgenticCommerce kernel | `0xea4daa3100a767e86fded867729ae7446476eba6` |
| EvaluatorRouter | `0x51895229e12f9876011789b04f8698af06cCD6DA` |
| Settlement token — United Stables (U) | `0xcE24439F2D9C6a2289F741120FE202248B666666` |

Addresses come from the official `bnb-chain/bnbagent-sdk`, not from guesswork.
Two ERC-8004 deployments exist on BSC; these are the ones BNB Agent Studio
actually writes to. The job status enum was derived empirically and the evidence
is recorded in `lib/chain/job-status.ts`.

---

## How honesty is enforced

This is the constraint the whole build is organised around, so it is worth
saying how it is kept rather than just claiming it.

- **Derived data carries its confidence.** `IndexedAgent.categoryConfidence` is
  `'matched'` or `'unclassified'` as a structural field, not prose. Surfaces
  branch on it. A category assigned for coverage can never be rendered as the
  agent's own claim.
- **Degraded is a distinct state.** `{degraded: true, agents: []}` and
  `{degraded: false, total: 0}` are different values throughout, so "nothing
  matched" and "we could not look" never collapse into one empty page.
- **Absent numbers stay absent.** A missing health score renders "Not computed",
  not `0`. A feedback average of zero is not shown as a bad rating.
- **Sort keys that do not work are deleted.** The index accepts
  `sort_by=star_count` and silently ignores it; rather than ship a control that
  lies, the key was removed from the type so no surface can offer it.
- **Endpoints are reported, never probed.** Declared protocols are the owner's
  claim about themselves and are labelled as such.

---

## Running it

```bash
git clone https://github.com/mrnetwork0001/Bazar.git
cd Bazar
npm ci
npm run dev
```

Everything works with no configuration. Two optional variables:

```env
# Raises the 8004scan ceiling from 180 req/min to 600. Server-side only,
# deliberately not NEXT_PUBLIC_ — it never reaches the browser bundle.
SCAN_API_KEY=

# Your public origin. Without it, /.well-known/agent.json advertises localhost
# to every agent that discovers you.
NEXT_PUBLIC_APP_URL=https://your-domain
```

```bash
npm run build      # production build
npm run typecheck  # tsc --noEmit
npm run lint
```

Deployment — Vercel, or a VPS behind Caddy — is documented in
**[DEPLOYMENT.md](DEPLOYMENT.md)**, including the swap sizing, heap cap and
reverse-proxy timeouts this deployment actually runs with, and the two mistakes
that were made getting there.

---

## Project layout

```
app/
  page.tsx              landing — live index stats, category shelves
  marketplace/          browse, search, filter, paginate
  agents/[id]/          one identity: reputation, endpoints, feedback, hire
  developers/           A2A reference with a live console
  permissions/          Altana session keys — grant, inspect, revoke
  dashboard/            jobs opened by the connected wallet
  pancakeswap/          venue lane with quoted evidence
  advantage/            the TermiX Agent Advantage Report
  register/            register an ERC-8004 identity
  api/v1/a2a/           six machine routes
  .well-known/          agent.json — Bazar's own agent card

lib/
  indexer/              8004scan client, retries, classification
  agents/               the single repository every surface reads through
  chain/                addresses, clients, job status
  jobs/                 kernel reads and lifecycle
  a2a/                  intent building, hire service, schemas
  altana/               KeyStore, session keys, scope, SDK bridge
  pancakeswap/          the venue lane
  abi/                  vendored ABIs with provenance notes

docs/
  agent-advantage/      TermiX report, attached outputs, benchmark script
  original-blueprint.md the pre-build plan, kept as a record
```

---

## What Bazar deliberately does not do

The registries publish identity, reputation and declared endpoints. They publish
**no ROI, no SLA, no uptime and no pricing** — so neither does Bazar. There is no
rate card, because there is nothing to read one from. A hirer names a budget and
the kernel escrows it.

Nothing here is a recommendation. Cards are ordered by the aggregate reputation
score the index publishes, which for most of the registry rests on no feedback at
all. That is a registry figure, not an endorsement.

The original blueprint for this project promised win-rate filters, 7-day ROI,
drawdown and SLA scores. None of it shipped, because the data does not exist. The
number was dropped and the reason was written on the page instead — which is the
whole product, really.

## License

Apache 2.0
