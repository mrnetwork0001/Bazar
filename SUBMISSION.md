# Submission

Everything a judge needs, in one file, so nothing has to be hunted for.

**Live:** [usebazar.xyz](https://usebazar.xyz) · **Repo:** [github.com/mrnetwork0001/Bazar](https://github.com/mrnetwork0001/Bazar)

---

## Wallet addresses

Required by the Altana track. Both are on BNB Smart Chain, chain 56.

| Role | Address |
| --- | --- |
| **Altana smart account** (agent wallet) | `0x087Cbf1d70cd8Ce4dA217B9967489CE9a7E47eEE` |
| **Owner EOA** (grants and revokes, client of job #56744) | `0xCd0a2370F2dC12c1802707B7d9aB3fec891E3c02` |
| **Bazar's reference agent** (provider, ERC-8004 #342133) | `0x3a24656F75312b0250Eb377C8f8B08Aa539b867b` |

The Altana account is EIP-7702 delegated and holds two keys: a root passkey with
no expiry, and a session key scoped to six calls with a 0.5 U daily cap.

---

## Onchain evidence

Verifiable without trusting this repository.

| What | Reference |
| --- | --- |
| ERC-8183 job, funded from the EOA, refunded at expiry | job **#56744** |
| ERC-8183 job, funded **by the Altana session key** | job **#56747** |
| Session-key grant (account deployed + two keys registered) | [`0xb11a714e…82a91a`](https://bscscan.com/tx/0xb11a714e06e9816c952c31be3f825ae1a80501e964929253b2676a30af82a91a) |
| Session-key hire — five kernel calls as one intent | [`0xb782373b…9a0577`](https://bscscan.com/tx/0xb782373b544df89c1e84f4560a36a88c3bb9bf82c32513e865f76e92dd9a0577) |
| **Agent-to-agent job**, deliverable binds its report | job **#56762** |
| The provider's `submit` for #56762 | [`0x5d977c7f…92d79c`](https://bscscan.com/tx/0x5d977c7feb3dfe55cdf005a310f78118a4ab2b9c91decdd88be03edeba92d79c) |
| First agent-to-agent job (weaker commitment, see below) | job **#56759** |

Read either job straight off the kernel:

```bash
cast call 0xea4daa3100a767e86fded867729ae7446476eba6 \
  "getJob(uint256)" 56747 --rpc-url https://bsc-dataseed.binance.org
```

Job #56747 returns a client of `0x087Cbf1d…7eEE` — the agent's own wallet, not a
browser account. No wallet prompt was shown at any point; the session key signed
`createJob → registerJob → setBudget → approve → fund` as a single relay intent,
inside a cap the account contract enforced and counted.

The account's own `canExecute` answers the allowlist:

```
true   createJob     true   approve
true   registerJob   true   fund
true   setBudget     true   claimRefund
false  transferFrom  <- control call, deliberately outside the grant
```

The `false` is the part that matters. Six allowed calls prove nothing on their
own — an unrestricted key answers `true` to all six too.

---

## Agent Advantage Report

Required by the TermiX track. **In this repository, not only on the site.**

| | |
| --- | --- |
| **The report** | [`docs/agent-advantage/REPORT.md`](docs/agent-advantage/REPORT.md) |
| **Raw outputs** (11 files) | [`docs/agent-advantage/outputs/`](docs/agent-advantage/outputs/) |
| **Timings** | [`docs/agent-advantage/results.json`](docs/agent-advantage/results.json) |
| **Re-runnable benchmark** | [`scripts/advantage/`](scripts/advantage/) |
| **Rendered in-product** | [usebazar.xyz/advantage](https://usebazar.xyz/advantage) |

Five tasks, each run twice — once through a live endpoint published by an agent
registered in the ERC-8004 Identity Registry, once by hand through public APIs
and a plain RPC. Three trading, two security, against a requirement of three
tasks with at least one from trading, stock or security.

Every request was really sent and every response is attached. **Two of the five
do not go the agent's way and one is a flat failure to answer**, reported at the
same length as the wins — a report where the agent wins five out of five would
only show that its author picked the tasks.

---

## The loop closes: an agent hired an agent

Job **#56762** has no human on either side.

| | |
| --- | --- |
| **Client** | `0x087Cbf1d…7eEE` — the Altana smart account, spending through its session key |
| **Provider** | `0x3a24656F…B867b` — Bazar's reference agent, holding its own ERC-8004 identity (#342133) |
| **Budget** | 0.1 U, escrowed by the kernel |
| **Status** | `2` (Submitted), **4 seconds** after `JobFunded` |
| **Deliverable** | `0x9079920d831afda69fdd2fd20f7a900d1ea5b902054b89234f2afe57637a8fe0` |
| **The report** | [usebazar.xyz/agent/56762.json](https://usebazar.xyz/agent/56762.json) |

The agent runs at [`agent/`](agent/) as a systemd unit. It finds its own jobs
with one filtered `eth_getLogs` — the kernel indexes `provider` on `JobFunded` —
reads the target contract off the chain, and calls `submit`. It assigns no
score, because any weighting of "can mint" against "is upgradeable" would be an
opinion presented as a measurement. #56762 reports on CAKE: owner
`0x73feaa1e…` (MasterChef, not renounced) with `mint(address,uint256)` live in
the deployed bytecode.

### Verify it yourself

```bash
curl -s https://usebazar.xyz/agent/56762.json > m.json
node -e "
import('./agent/src/manifest.js').then(({manifestHash}) =>
  console.log(manifestHash(JSON.parse(require('fs').readFileSync('m.json')))))"
# 0x9079920d831afda69fdd2fd20f7a900d1ea5b902054b89234f2afe57637a8fe0
```

Change one field of the report — flip `ownership.renounced` to `true`, the most
consequential lie the document could tell — and the hash moves to
`0x5f8d12f2…d9eb`. The commitment binds the work.

### The one before it did not, and that is worth saying

Job **#56759** was the first agent-to-agent job and its deliverable was hashed
with `JSON.stringify(manifest, Object.keys(manifest).sort())`. A replacer
*array* filters keys **recursively**, so the report collapsed to
`{"chainId":56}` — the one nested key whose name happened to appear in the
top-level list. That commitment binds the agent, the brief and the chain id and
**none of the report**. Run the same tamper against it and the hash does not
move at all.

It still verifies — [the served file](https://usebazar.xyz/agent/56759.json)
reproduces `0xe8ac7b74…46c5` exactly — it simply proves far less than it looks
like it proves. Fixed in [`agent/src/manifest.js`](agent/src/manifest.js),
which also reproduces an unrelated provider's live deliverable (job #56743)
bit-for-bit from the manifest that provider still serves.


---

## Main track

| Criterion | Where to look |
| --- | --- |
| **Functionality** | [/marketplace](https://usebazar.xyz/marketplace) → any agent → **Hire agent**. The full journey needs no wallet until the review step. |
| **Data Quality** | Any [agent page](https://usebazar.xyz/agents/56-2468): reputation and its component scores, onchain feedback, declared endpoints linked to their own addresses, and the matched category term. |
| **Agent Diversity** | Four shelves, each fetched by searching the index for that category's own terms and keeping only agents whose registration text matches. |

Bazar shows no ROI, SLA, uptime or pricing, because the ERC-8004 registries
publish none of it. Where a figure does not exist the page says so. The
[roadmap](README.md#roadmap) records the known defects in this build rather than
waiting to be asked about them.

---

## Partner tracks

| Track | Surface | Evidence |
| --- | --- | --- |
| **Altana** | [/permissions](https://usebazar.xyz/permissions) | grant + session-key hire above; allowlist probed live by `canExecute`, revocable in one transaction |
| **TermiX** | [/advantage](https://usebazar.xyz/advantage) | the report above |
| **PancakeSwap** | [/pancakeswap](https://usebazar.xyz/pancakeswap) | agents that name the venue in their own registration, quoted; plus the swap route a hirer uses to acquire the settlement token |
| **AltLayer** | everywhere | Bazar runs no indexer — every listing resolves through 8004scan |

---

## Demo video

`demo/remotion/` holds the composition and the narration script. The rendered
file is not committed: it is 84MB of binary that every clone would otherwise
pay for, and the README there records how to reproduce it.
