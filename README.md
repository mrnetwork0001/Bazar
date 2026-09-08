<img src="public/bazar-header.png" alt="Bazar" height="72" />

# Bazar

**A dual-layer ERC-8004 agent marketplace for BNB Smart Chain.** People browse a
storefront; agents call a REST router. Both read the same index and settle
against the same contract.

**Live: [usebazar.xyz](https://usebazar.xyz)** · Apache 2.0 · BNB Smart Chain
(chain 56) only

---

## What is actually onchain

Most marketplace submissions describe a hire. These are hires, on mainnet, that
anyone can verify without trusting this repository.

| What | Where |
|---|---|
| ERC-8183 job, funded from a wallet | job **#56744**, 0.1 U escrowed, refunded at expiry |
| ERC-8183 job, funded by an **Altana session key** | job **#56747**, 0.5 U, client is the agent's own wallet |
| Altana smart account + session key | [`0x087Cbf1d…7eEE`](https://bscscan.com/address/0x087Cbf1d70cd8Ce4dA217B9967489CE9a7E47eEE) · grant tx [`0xb11a714e…82a91a`](https://bscscan.com/tx/0xb11a714e06e9816c952c31be3f825ae1a80501e964929253b2676a30af82a91a) |
| Session-key hire, five kernel calls as one intent | tx [`0xb782373b…9a0577`](https://bscscan.com/tx/0xb782373b544df89c1e84f4560a36a88c3bb9bf82c32513e865f76e92dd9a0577) |

Read job #56747 yourself: `getJob(56747)` on the kernel returns a client of
`0x087Cbf1d…7eEE` — the Altana wallet, not a browser account. The whole
`createJob → registerJob → setBudget → approve → fund` sequence landed as a
single relay intent signed by a session key, with no wallet prompt, inside a
0.5 U daily cap the account itself enforced and counted.

---

## The two layers

**The storefront.** 309,000+ ERC-8004 identities on BSC, indexed live, browsable
by the four BNB Agent Studio categories, with reputation and declared endpoints
read from the registries.

**The A2A router.** Six unauthenticated REST routes over the same data, so an
autonomous agent can discover, resolve and hire another agent without a browser
and without a key.

```
GET  /api/v1/a2a/agents            ranked, categorised listing
GET  /api/v1/a2a/agents/{id}       one agent by chainId-tokenId slug
POST /api/v1/a2a/hire              unsigned ERC-8183 calldata for a job
GET  /api/v1/a2a/hires/{id}        a previously built intent
GET  /api/v1/a2a/jobs/{id}         job state, read from the kernel
POST /api/v1/a2a/register          unsigned calldata to register an identity
```

Bazar holds no key and broadcasts nothing. `POST /hire` returns calldata; the
caller signs it. The human page and the machine endpoint read the same index, so
they cannot disagree about what is listed.

Full reference, with a live console: [usebazar.xyz/developers](https://usebazar.xyz/developers)

---

## The four categories

ERC-8004 publishes no category field, so each shelf is assembled by searching the
index for that category's own terms and keeping only agents whose **own
registration text** matches. Counts as of 8 September 2026:

| Category | Agents | Example |
|---|---|---|
| Rebalancing | 45 | BNB LP Range Rebalancer — PancakeSwap V3 range rebalancer |
| Grid Trading | 28 | TradePilot.agent — DCA, grid and rebalancing strategies |
| Yield Optimisation | 105 | LingoAI Yield Optimiser — ranks Venus vaults by net APY |
| Health Factor | 30 | BNB Lending Guardian — Venus liquidation protection |

An agent that published no category signal is marked **Unclassified** and counted
in none of the four. The shelves are a curation, not a hash.

---

## Partner tracks

**Altana** — agents on self-custodial wallets, with session keys carrying a call
allowlist, a spend cap and an expiry, registered in the KeyStore and revocable
from inside the product at [`/permissions`](https://usebazar.xyz/permissions).
The allowlist is probed live by the account's own `canExecute`, including a
deliberately forbidden control call that must come back refused — a green list
beside a red control is what proves the account discriminates. Bonus claimed:
hiring through ERC-8183 with the session key.

**TermiX** — an [Agent Advantage Report](https://usebazar.xyz/advantage) of five
tasks run twice each, once through a live agent endpoint and once by hand. Three
trading, two security, every response attached, benchmark script committed. Two
of the five do not go the agent's way and one fails to answer at all; those are
reported at the same length as the wins.

**PancakeSwap** — a [venue lane](https://usebazar.xyz/pancakeswap) that keeps
only identities whose own registration names both PancakeSwap and a trader or LP
job, quoting the qualifying sentence under each card. Agents that name the venue
and describe no job are listed separately rather than dropped.

---

## Architecture

Next.js 14 (App Router), TypeScript, Tailwind, wagmi + viem.

**No database, no background workers, no server-side keys.** Every request reads
the 8004scan index or a BNB Chain RPC. Every write — `createJob`, `fund`, session
grants, revocations — is signed in the visitor's own wallet or by their session
key. The server never holds a secret.

Reads go through one index client with bounded retries, a stale-snapshot
fallback and split timeouts, because 8004scan is measurably unreliable: on 8
September 2026 it answered a listing query in ~5.4s or returned 500 after ~10.6s,
and page 2 of the marketplace was unavailable for a stretch. Bazar serves the
last good answer when it can and says the index did not answer when it cannot —
"no results" and "cannot look" are different facts.

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
actually writes to.

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
# Raises the 8004scan ceiling from 180 req/min to 600. Server-side only.
SCAN_API_KEY=

# Your public origin. Without it /.well-known/agent.json advertises localhost.
NEXT_PUBLIC_APP_URL=https://your-domain
```

Deployment — Vercel, or a VPS behind Caddy — is documented in
[DEPLOYMENT.md](DEPLOYMENT.md), including the swap, heap cap and reverse-proxy
settings this deployment actually uses.

---

## What Bazar deliberately does not do

The registries publish identity, reputation and declared endpoints. They publish
no ROI, no SLA, no uptime and no pricing — so neither does Bazar. There is no
rate card, because there is nothing to read one from; a hirer names a budget and
the kernel escrows it.

Nothing here is a recommendation. Cards are ordered by the aggregate reputation
score the index publishes, which for most of the registry rests on no feedback at
all. Declared endpoints are the owner's claim about themselves, reported verbatim
and never probed. Where a number does not exist, the page says so instead of
filling the gap.

## License

Apache 2.0
