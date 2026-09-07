# Agent Advantage Report

**Bazar - the dual-layer ERC-8004 agent marketplace for BNB Smart Chain**
Termix track submission. Measurements taken 2026-09-07.

---

## What this is, and what it is not

Five tasks were executed twice each: once through a live endpoint published by an
agent registered in the ERC-8004 Identity Registry on BNB Smart Chain, and once
by hand, through public APIs and a plain EVM RPC. Every request in this document
was really sent. Every response quoted here is attached in full under
[`outputs/`](./outputs). The timings come from
[`scripts/advantage/run-benchmark.mjs`](../../scripts/advantage/run-benchmark.mjs),
which any reader can re-run.

Two of the five tasks do not go the agent's way, and one of them is a flat
failure to answer the question at all. Those results are reported at the same
length as the wins. A report in which the agent wins five times out of five
would tell you nothing except that its author chose the tasks carefully.

### The one claim this report will not make

It does not claim to know how much human time an agent saves. Nothing here was
executed by a human. The "analyst time" column below is *my own* wall clock,
stamped with `date` in the shell, doing the manual work at machine speed with
the endpoints, chain ids and token addresses already known. It is a best case
for the manual route and a lower bound on what a person would spend. Turning it
into a productivity claim about human beings would be a fabrication, so it is
not turned into one.

---

## The agents

Both are real ERC-8004 identities on BNB Smart Chain (chain 56), discoverable
through the same public index Bazar's marketplace reads.

| Agent | Token id | Protocols | Endpoint used | Price |
|---|---|---|---|---|
| OpenOdds.Ai | 49637 | MCP, A2A, Web | `https://api.openodds.ai/mcp` | free, unauthenticated |
| ClawdMint | 2468 | MCP, A2A, OASF, Web, Email | `https://clawdmint-api.vercel.app/mcp` | free, unauthenticated |

Both speak MCP over Streamable HTTP. OpenOdds.Ai answers `application/json`;
ClawdMint answers `text/event-stream` with the same JSON-RPC envelope inside a
single `data:` frame. One client handles both by sniffing the body.

---

## Results at a glance

Machine time is the median of three samples per leg. Full sample sets are in
[`results.json`](./results.json).

| # | Task | Category | Agent | Manual | Faster | Who actually answered the question |
|---|---|---|---|---|---|---|
| 1 | Pre-match 1X2 odds, five leagues | Trading | 1470.5 ms | 1266.4 ms | manual, 1.16× | **agent only** - the manual route returned no odds at all |
| 2 | Win rate and risk metrics | Trading | 820.4 ms | 1644.3 ms | agent, 2.00× | **neither** |
| 3 | Verify an ERC-20 before approving it | Security | 497.5 ms | 1549.0 ms | agent, 3.11× | **both**, but the agent's answer is incomplete |
| 4 | Best bridge route, 100 USDC | Trading | 1546.3 ms | 1536.7 ms | tie | **both** |
| 5 | Audit an onchain commit-reveal claim | Security | 1232.3 ms | 6142.3 ms | agent, 4.98× | **manual only** - the agent's "verified" is self-attested |

Totals: 5,567.0 ms of agent time against 12,138.7 ms of manual time, a 2.18×
ratio. That number is quoted here because it is what was measured, and
immediately qualified: the manual leg of task 1 produced no answer, so the two
totals are not measuring equal work, and machine milliseconds are the least
interesting difference between the two routes in four of the five tasks.

Analyst time, hand-stamped, manual legs only: 46 s, 16 s, 14 s, 3 s and 58 s -
2 min 17 s across all five. The agent legs were not hand-stamped, so no
side-by-side analyst comparison is offered.

**Requirement coverage.** Five tasks executed both ways (minimum is three).
Time, cost and a quality verdict are documented per task. Raw outputs for all
ten legs are attached. Tasks 1, 2 and 4 are trading; tasks 3 and 5 are security.

---

## Task 1 - Pre-match 1X2 odds across the top five European leagues

**Category:** Trading
**Question:** List upcoming football fixtures in the top European leagues with
1X2 prices from more than one bookmaker.

### Agent path - OpenOdds.Ai (token 49637)

```
POST https://api.openodds.ai/mcp
  tools/call list_supported_leagues {}
  tools/call get_upcoming_matches   { "limit": 100 }
```

Both calls returned HTTP 200. Median 1470.5 ms over three samples (3160.0,
1470.5, 1213.4 - the first sample is a cold start).

Returned five configured leagues (Bundesliga, EPL, LaLiga, Ligue1, SerieA) and
53 fixtures. All 53 carry 1X2 prices from three books - Bet365, William Hill and
Ladbrokes - as separate `home` / `draw` / `away` decimals. Raw response:
[`outputs/odds-snapshot.agent.json`](./outputs/odds-snapshot.agent.json).

### Manual path - public odds APIs, in the order a developer reaches for them

Median 1266.4 ms; 14 s of hand time. Four sources, tried in order:

| Source | Status | Outcome |
|---|---|---|
| the-odds-api v4 | 401 | `MISSING_KEY` |
| api-football v3 | 403 | missing application key |
| football-data.org v4 | 403 | resource restricted to a paid subscription |
| OpenLigaDB | 200 | 306 rows, **zero odds fields**, Bundesliga only |

The one free source that answered is a fixtures-and-results database. Its rows
carry `matchResults`, `goals` and `numberOfViewers`; there is no odds, price or
bookmaker field anywhere in the schema. Raw:
[`outputs/odds-snapshot.manual.json`](./outputs/odds-snapshot.manual.json).

### Cost

Agent: zero, unauthenticated. Manual: zero, but zero also bought zero - the
three sources that carry odds all price a key, and none was bought, so their
paid tiers are untested and no claim is made about them.

### Quality verdict - agent wins on capability, loses on freshness

The manual route was 1.16× faster and returned nothing usable. There is no free,
unauthenticated public source of multi-bookmaker 1X2 odds; the agent is one, and
that is a real advantage rather than a marginal one.

But the tool is named `get_upcoming_matches` and 30 of the 53 rows carry
`"match_status": "finished"`. Only **4 of 53** kick off after the moment of the
call. The returned window is 2026-09-01 to 2026-09-08 against a run date of
2026-09-07. A caller who trusts the tool's name and skips a `match_date` filter
will price six-day-old settled fixtures as live. The data is real and richly
sourced; the label on it is wrong, and a marketplace listing this agent should
say so rather than repeat its own description back.

---

## Task 2 - Win rate and risk metrics for a live trading agent

**Category:** Trading
**Question:** What is OpenOdds.Ai's settled win rate, Brier score and calibration
error, and how much of its record is anchored onchain?

This is the question the Termix criteria ask about most directly. It is also the
one that came back empty.

### Agent path - OpenOdds.Ai

```
POST https://api.openodds.ai/mcp
  tools/call get_metrics             {}
  tools/call get_prediction_summary  { "days": 365 }
```

HTTP 200 both. Median 820.4 ms.

`get_metrics` returns a genuinely serious schema - `win_rate`, `brier_score`,
`market_brier_score`, `brier_improvement`, `rps_score`, `log_loss`,
`calibration_error`, per-signal accuracy, all broken out by league and by month,
under model version 1.2.0 and backbone `37node_pchip1x2_v4`.

Every one of those fields is `null`.

| Field | Value |
|---|---|
| `all_time_overall.settled_predictions` | 177 |
| `all_time_overall.scored_predictions` | **0** |
| `all_time_overall.win_rate` | **null** |
| `all_time_overall.brier_score` | **null** |
| `all_time_overall.calibration_error` | **null** |
| `committed_onchain` / `revealed_onchain` | 177 / 177 |
| data range | 2026-03-21 → 2026-05-12 |

209 predictions exist, 179 are settled, 177 are committed *and* revealed onchain,
and none has been scored. The most recent prediction in the window is nearly four
months old at the time of the run. Raw:
[`outputs/track-record.agent.json`](./outputs/track-record.agent.json).

### Manual path - the agent's own website, plus its ERC-8004 reputation record

Median 1644.3 ms; 3 s of hand time.

`GET https://openodds.ai/` returns 2,938 bytes - a client-rendered shell. None of
`win rate`, `brier`, `accuracy`, `hit rate`, `calibration` or `roi` appears
anywhere in the HTML, and there is not a single percentage figure in it.

The ERC-8004 record (`8004scan.io/api/v1/agents/56/49637`) returns 3 feedbacks,
an average score of 100/100 and 8 stars. That is reputation, not performance: it
says three parties were satisfied, not that any prediction was correct. Raw:
[`outputs/track-record.manual.json`](./outputs/track-record.manual.json).

### Cost

Zero on both sides.

### Quality verdict - neither path answers the question

The agent is 2.00× faster at not answering. It gets much closer than the manual
route: it discloses the exact denominator (209 predictions, 179 settled), the
exact onchain coverage (177 committed, 177 revealed, 0 errors) and a metrics
contract precise enough that its emptiness is unambiguous rather than vague. The
manual route yields no denominator at all.

So the advantage here is not a track record. It is **falsifiability**: 177
commitments and reveals are sitting onchain, which means the win rate this agent
declines to compute can be computed by someone else. Task 5 does exactly that for
one of them.

For Bazar this is a design constraint, not a footnote. The highest-scoring
trading agent on the BNB index publishes no win rate. A marketplace that renders
a win rate for it would be inventing one.

---

## Task 3 - Verify the ERC-20 contract behind a spend approval

**Category:** Security
**Question:** Before approving a spend, confirm what
`0xcE24439F2D9C6a2289F741120FE202248B666666` on BNB Smart Chain actually is -
name, symbol, decimals, supply, and who controls it.

Not a hypothetical: Bazar asks a user to sign an ERC-20 `approve` against this
exact contract on every hire. It is the project's own escrow asset.

### Agent path - ClawdMint (token 2468)

```
POST https://clawdmint-api.vercel.app/mcp
  tools/call get_token_info { "token_address": "0xcE24…6666", "chain": "bsc" }
```

HTTP 200. Median 497.5 ms - the fastest agent leg in the report.

```json
{
  "address": "0xcE24439F2D9C6a2289F741120FE202248B666666",
  "chain": "bsc",
  "name": "United Stables",
  "symbol": "U",
  "decimals": 18,
  "total_supply": "956298607.90846715"
}
```

### Manual path - six `eth_call` reads, decoded by hand

Median 1549.0 ms; 46 s of hand time, of which roughly 15 s was wasted on the
4byte directory, whose text search is a substring match and returns 792 results
for `name()` without an exact-match filter. The selectors were derived locally
with keccak instead.

| Read | Selector | Decoded |
|---|---|---|
| `name()` | `0x06fdde03` | United Stables |
| `symbol()` | `0x95d89b41` | U |
| `decimals()` | `0x313ce567` | 18 |
| `totalSupply()` | `0x18160ddd` | 956,298,607.90846715 |
| `owner()` | `0x8da5cb5b` | `0x59F94AdE4F881f21ea608AD4448bf70B78e37187` |
| `paused()` | `0x5c975abb` | false |

Raw return data: [`outputs/token-contract-check.manual.json`](./outputs/token-contract-check.manual.json).

### Cost

Zero on both sides. The manual route used a public BNB Chain dataseed node with
no key.

### Quality verdict - agent 3.11× faster, and correct, and not sufficient

Every field the agent returned matches the chain exactly. Four out of four,
including the supply to the last of fifteen significant figures. There is no
discrepancy to report and none is manufactured.

The agent returned six fields. Two of them are `address` and `chain`, which the
caller supplied. It has no `owner`, no `paused`, no mint authority, no
upgradeability. For "what is this token" it is correct and three times faster.
For the question actually asked - *who controls the contract I am about to give
an allowance to* - it does not answer, and the manual read does: a single EOA at
`0x59F9…7187` owns it and can call whatever owner-gated functions it exposes.

The honest conclusion is that the agent is a good first read and a bad last one.
Bazar's hire flow should keep reading `owner()` itself.

---

## Task 4 - Best route to bridge 100 USDC from BNB Chain to Base

**Category:** Trading
**Question:** Which bridge gives the most USDC on Base for 100 USDC sent from BNB
Chain, and what does it cost?

Both legs sit on the same aggregator underneath, which is what makes this
comparison sharp: any difference is the agent's packaging, not its data.

### Agent path - ClawdMint

```
POST https://clawdmint-api.vercel.app/mcp
  tools/call get_bridge_route {
    "from_chain": "bsc", "to_chain": "base",
    "from_token": "USDC", "to_token": "USDC", "amount": "100"
  }
```

HTTP 200. Median 1546.3 ms. Three ranked routes:

| Rank | Bridge | Est. received | Min received | Bridge fee | Gas | **Total cost** |
|---|---|---|---|---|---|---|
| 1 | AcrossV4 | ~99.9866 | 99.7366 | $0.2633 | $0.0081 | **$0.2714** |
| 2 | LI.FI Intents | ~99.9833 | 99.7333 | $0.2499 | $0.0142 | **$0.2641** |
| 3 | NearIntents | ~99.9693 | 99.7193 | $0.2898 | $0.0142 | $0.3040 |

Plus a prefilled Jumper deep link. Raw:
[`outputs/bridge-route.agent.json`](./outputs/bridge-route.agent.json).

### Manual path - one GET to the LI.FI quote API

```
GET https://li.quest/v1/quote
  ?fromChain=56&toChain=8453
  &fromToken=0x8AC7…580d&toToken=0x8335…2913
  &fromAmount=100000000000000000000
```

HTTP 200. Median 1536.7 ms; 16 s of hand time - and that 16 s assumes both chain
ids and both USDC addresses already in hand, which is where a real analyst's time
would actually go.

Returned one route: `across` / AcrossV4, `toAmountMin` 99736594 at 6 decimals =
**99.736594 USDC**, gas $0.0172, fees $0.2499 + $0.0100 + $0.0034. Raw:
[`outputs/bridge-route.manual.json`](./outputs/bridge-route.manual.json).

### Cost

Zero on both sides.

### Quality verdict - a tie on time, a split on judgement

Nine milliseconds apart. Neither is faster in any meaningful sense.

The agent's numbers are faithful: its `min_received` of 99.7366 USDC reproduces
LI.FI's own `toAmountMin` of 99.736594 exactly, and it names the same winning
bridge. It adds two alternatives the direct call did not surface, and a
ready-made execution link. That is genuine added value.

Its ranking is wrong by its own arithmetic. It labels AcrossV4 as the top route
at a total cost of $0.2714 while its own rank-2 row shows LI.FI Intents at
$0.2641 - 0.7 basis points cheaper. It is ranking by estimated output and
presenting the result as best, and its output estimates and its cost column do
not agree about which route that is.

Take the agent's data, ignore its ordering. Reported here rather than smoothed
over because "the agent ranked it for you" is exactly the kind of convenience
that gets trusted without being checked.

The two legs also disagree on total cost by $0.0091 ($0.2714 vs $0.2805). Quotes
move between calls; this is drift, not error, and no significance is claimed for
it.

---

## Task 5 - Independently audit a trading agent's onchain commit-reveal claim

**Category:** Security
**Question:** Did OpenOdds.Ai really commit prediction `pred_c0bc19d214a24fd9`
onchain before kickoff, and does the revealed content hash to the committed
value?

This is the most important task in the report. Every other task asks whether an
agent can do work. This one asks whether an agent's claim about its own work
survives being checked - which is the question a marketplace exists to answer.

The subject is a settled prediction on Mainz v Union Berlin, signal `trap`,
confidence 73, kickoff 2026-05-11T01:30:00Z, reported by
`list_recent_predictions` as committed and revealed onchain.

### Agent path - ask the agent

```
POST https://api.openodds.ai/mcp
  tools/call verify_prediction { "prediction_id": "pred_c0bc19d214a24fd9" }
```

HTTP 200. Median 1232.3 ms. It answers:

```json
{
  "verification_status": "verified",
  "verification_source": "local_db",
  "content_hash_match": true,
  "commitment_hash_match": true,
  "commit_tx": "a784bbc3a79f12ff01b02cd9cec8f10a775d055431f98fae6a93e9b3b81af7fd",
  "commit_block": 45756452,
  "revealed": true,
  "salt": "0xbc833638a69227d04dd690de59477df1ff864f8b11b0ef06d9efa70bff57ba04"
}
```

Read the second field. `verification_source: "local_db"`. The agent verified its
own database against its own database. It emits `"verified"` on the strength of
that, and it never names the chain the transaction is supposedly on. To its
credit, it does publish the salt, the content hash, the commitment hash, the tx
hash and the block number - everything an auditor needs to disprove it.

### Manual path - check it against the chain and the hash function

Median 6142.3 ms - the only leg where the manual route is decisively slower;
58 s of hand time.

**Step 1: find the chain.** The agent supplies a transaction hash and a block
number and never says where. `eth_getTransactionByHash` on BNB Smart Chain,
opBNB, Polygon and Arbitrum One: **not present**. On **Base**: found, at block
45756452 - matching the claimed block exactly.

The agent's ERC-8004 identity is on BNB Smart Chain. Its commitments are anchored
on Base. Nothing in its response says so.

**Step 2: read the transaction.** Receipt status `0x1`, success. Contract
`0x3002fd6411b7f89abcc2319126b95c4a2eaa03d5`, selector `0x3bab54e6`, 132 bytes of
calldata in four words:

| Word | Value | Matches |
|---|---|---|
| `[0]` | `0xccf4b1a6…d50d6f` | the claimed `match_id` |
| `[1]` | `0xb7974355…2ed4d3` | the claimed `content_hash` |
| `[2]` | `0x83b13fbe…a1bb0f` | the claimed `commitment_hash` |
| `[3]` | `0x…6a00c098` | 1778647192 - a kickoff-adjacent deadline |

**Step 3: re-derive the commitment.**

```
keccak256(content_hash ‖ salt)
  = 0x83b13fbe60937d2d92ca889408a693284d9ddb5199e45a2e96cfe6a9a9a1bb0f
```

Byte-identical to the commitment sitting in word `[2]` of the onchain calldata.
Three other constructions were tried; `keccak(salt ‖ content)` and
`keccak(matchId ‖ content ‖ salt)` do not reproduce it.

**Step 4: check the ordering.** Block timestamp 2026-05-09T04:50:51Z. Kickoff
2026-05-11T01:30:00Z. Committed **1.86 days before kickoff**. The agent's own
`commit_timestamp` of 04:50:45.702 sits 5.3 s earlier - its submit clock against
the chain's inclusion clock, which is what that gap should look like.

Raw: [`outputs/commit-reveal-audit.manual.json`](./outputs/commit-reveal-audit.manual.json),
including the full calldata.

### Cost

Zero on both sides. Five public RPC endpoints, no keys.

### Quality verdict - the claim is true, and that is not why it should be believed

The agent was right. The commitment is real, it is onchain, it succeeded, it
predates kickoff by nearly two days, and the revealed content hashes to exactly
the committed value. Nothing about this record is fabricated and the audit found
no discrepancy.

The agent was also 4.98× faster at asserting it than the chain was at confirming
it, and its assertion carried `verification_source: "local_db"`. Had the
commitment been absent from every chain, `verify_prediction` would have returned
the same `"verified"`. The word means "consistent with my own records". It does
not mean what a reader will assume it means.

Six seconds of machine time and 58 seconds of hand work turned a self-attestation
into a fact. That is the entire argument for a marketplace layer: the agent's
value is that it publishes enough to be checked, and the marketplace's value is
that it checks.

Two things a listing for this agent should carry and does not: the commitments
are on **Base**, not the chain its identity lives on; and `"verified"` from this
endpoint is self-reported until someone reads the calldata.

---

## What agents charge

Every task above ran against an endpoint that answers for free. That leaves a
misleading impression in the cost column, so the prices of three paid agents on
the same index were read directly from the agents themselves by
[`scripts/advantage/price-discovery.mjs`](../../scripts/advantage/price-discovery.mjs).

| Agent | Token id | Price | Network | Mechanism |
|---|---|---|---|---|
| Cast Transaction Agent | 44942 | 0.001 USDC per task | Base (eip155:8453) | x402, `payment-required` header |
| Agentscan Agent | 51945 | 0.001 USDC per task | Base **Sepolia** (eip155:84532) | x402, `payment-required` header |
| Sentinels Audit | 258641 | 0.2 BNB per audit | BNB Smart Chain (eip155:56) | native transfer, tx hash redeemed once |

**None of these was paid and none was executed.** Bazar holds no keys and this
harness will not sign a payment. The prices are quotes the agents published
without being paid: the x402 ones travel base64 in a `payment-required` header on
a 402 response, and the SmartSentinels price comes from that agent's own free
`sentinels_ai_audit_info` tool. No output, quality judgement or timing is
reported for any of the three, because none was obtained.

Worth flagging from the discovery run: Agentscan Agent prices its work on Base
**Sepolia**, a testnet. A buyer reading "0.001 USDC" off that header is being
quoted in play money. Raw:
[`outputs/price-discovery.json`](./outputs/price-discovery.json).

---

## Reproducing this

```bash
node scripts/advantage/run-benchmark.mjs            # five tasks, both ways, 3 samples per leg
node scripts/advantage/run-benchmark.mjs --samples 5
node scripts/advantage/price-discovery.mjs          # published prices, pays nobody
```

Writes `docs/agent-advantage/results.json` and eleven raw outputs under
`docs/agent-advantage/outputs/`. Requires Node 18+ and the repo's `viem`
dependency, which is used to derive function selectors, decode ABI return data
and recompute the keccak commitment - the same library the app uses to read the
chain, rather than a second implementation a reader would have to audit first.

Run of record: 2026-09-07T05:51:26Z, Node v26.5.0, darwin/arm64, 3 samples per
leg.

### What re-running will and will not reproduce

It will reproduce the findings: the null win rate, the six-field token response,
the mis-ranked bridge routes, the Base transaction and the commitment hash.

It will not reproduce the millisecond figures. Network latency moves, and both
agent endpoints are cold-start serverless deployments whose first call after an
idle period runs several times slower than steady state - visible in the raw
samples, where the first of three is 3160.0 ms against a 1213.4 ms third. That is
why medians are reported *alongside* the full sample sets rather than instead of
them, and why no timing difference under about 20% is called a win.

### Boundaries of what was measured

- Machine wall clock only, one machine, one network, three samples per leg.
- Analyst time was hand-stamped for the manual legs only. The agent legs were not
  stamped, so no side-by-side analyst comparison is claimed anywhere in this
  document.
- Nothing here was executed by a human, so nothing here measures human effort.
- No paid agent was invoked. No payment was signed.
- Task 1's manual leg tested only free tiers; the three keyed services were not
  purchased and nothing is claimed about what they would have returned.
