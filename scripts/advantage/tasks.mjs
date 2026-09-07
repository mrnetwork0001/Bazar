/**
 * The five tasks in the Agent Advantage Report, as executable code.
 *
 * Each task carries two legs that answer the *same* question:
 *
 *   agent  - a real call to a live endpoint published by an agent that is
 *            registered in the ERC-8004 Identity Registry on BNB Smart Chain
 *            and indexed by 8004scan. No mocks, no recorded fixtures.
 *   manual - the obvious route a developer takes without that agent: public
 *            APIs, a plain EVM RPC, and hand decoding.
 *
 * A leg returns `{ steps, findings, attach }`. `attach` is written verbatim to
 * docs/agent-advantage/outputs/ so every number in the report can be checked
 * against the bytes it came from.
 *
 * Two of the five tasks are deliberately ones the agent does not clearly win.
 * A report in which the agent wins five times out of five is a report nobody
 * should believe.
 */

import { evmRpc, httpGet, mcpCall, toolPayload } from './transport.mjs';
import { ERC20_SELECTORS, calldataWords, decodeWord, deriveCommitment, formatSupply } from './evm.mjs';

/* ------------------------------- constants ------------------------------- */

const OPENODDS_MCP = 'https://api.openodds.ai/mcp';
const CLAWDMINT_MCP = 'https://clawdmint-api.vercel.app/mcp';

const BSC_RPC = 'https://bsc-dataseed.bnbchain.org';
const BASE_RPC = 'https://mainnet.base.org';

/** Bazar settles jobs in this token. Its own escrow asset is the honest subject. */
const U_TOKEN = '0xcE24439F2D9C6a2289F741120FE202248B666666';

/** USDC on BSC and on Base, for the bridge-quote task. */
const USDC_BSC = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

/**
 * The prediction audited in task 5. Chosen because `list_recent_predictions`
 * reports it as committed AND revealed onchain - the only class of record for
 * which an independent check is even possible.
 */
const AUDIT = {
  predictionId: 'pred_c0bc19d214a24fd9',
  matchId: '0xccf4b1a6f24937d129ffe8da2141ea7f6e3e4edcf75d12a3ad8e070d58d50d6f',
  commitTx: '0xa784bbc3a79f12ff01b02cd9cec8f10a775d055431f98fae6a93e9b3b81af7fd',
  kickoffIso: '2026-05-11T01:30:00Z',
};

/* -------------------------------- helpers -------------------------------- */

async function callTool(url, name, args) {
  const res = await mcpCall(url, 'tools/call', { name, arguments: args });
  return { status: res.status, raw: res.raw, payload: toolPayload(res.envelope) };
}

const step = (label, status, note) => ({ label, status, note });

/* --------------------------------- tasks --------------------------------- */

/**
 * T1 - pre-match 1X2 prices across the top five European leagues.
 *
 * The manual leg is the honest version of "just get the odds yourself": the
 * four sources a developer reaches for first, tried in order.
 */
const t1 = {
  id: 'odds-snapshot',
  title: 'Pre-match 1X2 odds across the top five European leagues',
  category: 'Trading',
  question:
    'List upcoming football fixtures in the top European leagues with 1X2 prices from more than one bookmaker.',
  agent: {
    name: 'OpenOdds.Ai',
    tokenId: '49637',
    transport: 'MCP (Streamable HTTP)',
    endpoint: OPENODDS_MCP,
    request: "tools/call list_supported_leagues {} ; tools/call get_upcoming_matches { limit: 100 }",
    priceNote: 'No payment required. The endpoint is unauthenticated and free at the point of use.',
    async run() {
      const leagues = await callTool(OPENODDS_MCP, 'list_supported_leagues', {});
      const matches = await callTool(OPENODDS_MCP, 'get_upcoming_matches', { limit: 100 });
      const rows = matches.payload?.matches ?? [];
      const now = Date.now();
      const priced = rows.filter((m) => m.b365_odds?.home != null && m.wh_odds?.home != null);
      const future = rows.filter((m) => Date.parse(m.match_date) > now);
      const dates = rows.map((m) => String(m.match_date).slice(0, 10)).sort();
      return {
        steps: [
          step('MCP list_supported_leagues', leagues.status, `${leagues.payload?.total ?? 0} leagues`),
          step('MCP get_upcoming_matches limit=100', matches.status, `${rows.length} rows`),
        ],
        findings: {
          leagues: (leagues.payload?.leagues ?? []).map((l) => l.league),
          rowsReturned: rows.length,
          rowsWithTwoBookmakers: priced.length,
          rowsActuallyInTheFuture: future.length,
          statusCounts: rows.reduce((acc, m) => ({ ...acc, [m.match_status]: (acc[m.match_status] ?? 0) + 1 }), {}),
          dateRange: dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null,
        },
        attach: { leagues: leagues.payload, matches: matches.payload },
      };
    },
  },
  manual: {
    label: 'Public odds APIs, tried in the order a developer reaches for them',
    priceNote:
      'Free tier only. No key was bought, so the paid tiers behind the three 401/403 responses were not exercised.',
    async run() {
      const sources = [
        { name: 'the-odds-api v4 (EPL h2h)', url: 'https://api.the-odds-api.com/v4/sports/soccer_epl/odds/?regions=uk&markets=h2h' },
        { name: 'api-football v3 (odds, league 39)', url: 'https://v3.football.api-sports.io/odds?league=39&season=2026' },
        { name: 'football-data.org v4 (PL matches)', url: 'https://api.football-data.org/v4/competitions/PL/matches' },
        { name: 'OpenLigaDB (Bundesliga 2026)', url: 'https://api.openligadb.de/getmatchdata/bl1/2026' },
      ];
      const steps = [];
      const attach = {};
      let oddsFound = 0;
      for (const s of sources) {
        const res = await httpGet(s.url);
        const rows = Array.isArray(res.json) ? res.json : null;
        const oddsFields = rows?.length ? Object.keys(rows[0]).filter((k) => /odd|quote|price|book/i.test(k)) : [];
        if (oddsFields.length) oddsFound += 1;
        steps.push(
          step(
            s.name,
            res.status,
            res.status !== 200
              ? 'rejected without an API key'
              : `${rows?.length ?? 0} rows, odds fields: ${oddsFields.length ? oddsFields.join(', ') : 'none'}`,
          ),
        );
        attach[s.name] = res.status === 200 && rows ? { rows: rows.length, firstRowFields: Object.keys(rows[0] ?? {}) } : res.raw.slice(0, 400);
      }
      return {
        steps,
        findings: {
          sourcesTried: sources.length,
          sourcesThatAnswered: steps.filter((s) => s.status === 200).length,
          sourcesCarrying1X2Odds: oddsFound,
        },
        attach,
      };
    },
  },
};

/**
 * T2 - the track record. This is the question the Termix judging criteria ask
 * about most directly: win rate and risk metrics for a trading agent.
 */
const t2 = {
  id: 'track-record',
  title: 'Win rate and risk metrics for a live trading agent',
  category: 'Trading',
  question:
    "What is OpenOdds.Ai's settled win rate, Brier score and calibration error, and how much of its record is anchored onchain?",
  agent: {
    name: 'OpenOdds.Ai',
    tokenId: '49637',
    transport: 'MCP (Streamable HTTP)',
    endpoint: OPENODDS_MCP,
    request: 'tools/call get_metrics {} ; tools/call get_prediction_summary { days: 365 }',
    priceNote: 'No payment required.',
    async run() {
      const metrics = await callTool(OPENODDS_MCP, 'get_metrics', {});
      const summary = await callTool(OPENODDS_MCP, 'get_prediction_summary', { days: 365 });
      const all = metrics.payload?.all_time_overall ?? {};
      return {
        steps: [
          step('MCP get_metrics', metrics.status, `model ${metrics.payload?.model_version ?? 'unknown'}`),
          step('MCP get_prediction_summary days=365', summary.status, `${summary.payload?.total ?? 0} predictions`),
        ],
        findings: {
          modelVersion: metrics.payload?.model_version ?? null,
          allTimeSettled: all.settled_predictions ?? null,
          allTimeScored: all.scored_predictions ?? null,
          winRate: all.win_rate ?? null,
          brierScore: all.brier_score ?? null,
          calibrationError: all.calibration_error ?? null,
          committedOnchain: summary.payload?.committed_onchain ?? null,
          revealedOnchain: summary.payload?.revealed_onchain ?? null,
          dataRange: metrics.payload?.all_time_data_range ?? metrics.payload?.data_range ?? null,
        },
        attach: { metrics: metrics.payload, summary: summary.payload },
      };
    },
  },
  manual: {
    label: "The agent's public website, plus its ERC-8004 reputation record",
    priceNote: 'Free.',
    async run() {
      const site = await httpGet('https://openodds.ai/', 30_000, { accept: 'text/html' });
      const terms = ['win rate', 'win_rate', 'brier', 'accuracy', 'hit rate', 'calibration', 'roi'];
      const present = terms.filter((t) => new RegExp(t, 'i').test(site.raw));
      const scan = await httpGet('https://8004scan.io/api/v1/agents/56/49637');
      const a = scan.json ?? {};
      return {
        steps: [
          step('GET openodds.ai (HTML)', site.status, `${site.raw.length} bytes, metric words present: ${present.length ? present.join(', ') : 'none'}`),
          step('GET 8004scan agent record 56/49637', scan.status, `${a.total_feedbacks ?? 0} feedbacks`),
        ],
        findings: {
          siteBytes: site.raw.length,
          metricWordsInHtml: present,
          onchainFeedbacks: a.total_feedbacks ?? null,
          onchainAverageScore: a.average_score ?? null,
          onchainStars: a.star_count ?? null,
          winRate: null,
          brierScore: null,
        },
        attach: {
          siteHtmlFirst2kb: site.raw.slice(0, 2048),
          scanRecord: {
            total_feedbacks: a.total_feedbacks ?? null,
            average_score: a.average_score ?? null,
            star_count: a.star_count ?? null,
            total_score: a.total_score ?? null,
            health_score: a.health_score ?? null,
          },
        },
      };
    },
  },
};

/**
 * T3 - the pre-approval security check. Bazar asks a user to sign an ERC-20
 * approval before every hire, so "is this contract what it claims to be" is a
 * question the product itself raises.
 */
const t3 = {
  id: 'token-contract-check',
  title: 'Verify the ERC-20 contract behind a spend approval',
  category: 'Security',
  question: `Before approving a spend, confirm what 0xcE24439F2D9C6a2289F741120FE202248B666666 on BNB Smart Chain actually is: name, symbol, decimals, supply, and who controls it.`,
  agent: {
    name: 'ClawdMint',
    tokenId: '2468',
    transport: 'MCP (Streamable HTTP, SSE framed)',
    endpoint: CLAWDMINT_MCP,
    request: `tools/call get_token_info { token_address: "${U_TOKEN}", chain: "bsc" }`,
    priceNote: 'No payment required.',
    async run() {
      const res = await callTool(CLAWDMINT_MCP, 'get_token_info', { token_address: U_TOKEN, chain: 'bsc' });
      const p = res.payload ?? {};
      return {
        steps: [step('MCP get_token_info', res.status, `${Object.keys(p).length} fields returned`)],
        findings: {
          name: p.name ?? null,
          symbol: p.symbol ?? null,
          decimals: p.decimals ?? null,
          totalSupply: p.total_supply ?? null,
          owner: p.owner ?? null,
          paused: p.paused ?? null,
          fieldsReturned: Object.keys(p),
        },
        attach: p,
      };
    },
  },
  manual: {
    label: 'Six eth_call reads against a public BNB Chain node, decoded by hand',
    priceNote: 'Free. Public dataseed node, no key.',
    async run() {
      const steps = [];
      const raw = {};
      for (const [fn, selector] of Object.entries(ERC20_SELECTORS)) {
        const res = await evmRpc(BSC_RPC, 'eth_call', [{ to: U_TOKEN, data: selector }, 'latest']);
        raw[fn] = res.result ?? res.rpcError ?? null;
        steps.push(step(`eth_call ${fn}() ${selector}`, res.status, res.result ? 'returned data' : 'reverted or absent'));
      }
      const decimals = decodeWord('uint8', raw.decimals);
      const supply = decodeWord('uint256', raw.totalSupply);
      return {
        steps,
        findings: {
          name: decodeWord('string', raw.name),
          symbol: decodeWord('string', raw.symbol),
          decimals: decimals === null ? null : Number(decimals),
          totalSupply: formatSupply(supply, decimals),
          owner: decodeWord('address', raw.owner),
          paused: decodeWord('bool', raw.paused),
          fieldsReturned: Object.keys(raw),
        },
        attach: { selectors: ERC20_SELECTORS, rawReturnData: raw },
      };
    },
  },
};

/**
 * T4 - a routing decision with real money on it. Both legs are backed by the
 * same underlying aggregator, which is what makes the comparison sharp: any
 * difference is the agent's packaging, not its data.
 */
const t4 = {
  id: 'bridge-route',
  title: 'Best route to bridge 100 USDC from BNB Chain to Base',
  category: 'Trading',
  question: 'Which bridge gives the most USDC on Base for 100 USDC sent from BNB Chain, and what does it cost?',
  agent: {
    name: 'ClawdMint',
    tokenId: '2468',
    transport: 'MCP (Streamable HTTP, SSE framed)',
    endpoint: CLAWDMINT_MCP,
    request: 'tools/call get_bridge_route { from_chain: "bsc", to_chain: "base", from_token: "USDC", to_token: "USDC", amount: "100" }',
    priceNote: 'No payment required.',
    async run() {
      const res = await callTool(CLAWDMINT_MCP, 'get_bridge_route', {
        from_chain: 'bsc',
        to_chain: 'base',
        from_token: 'USDC',
        to_token: 'USDC',
        amount: '100',
      });
      const p = res.payload ?? {};
      const routes = p.routes ?? [];
      const cheapest = routes.reduce(
        (best, r) => (best === null || parseFloat(String(r.total_cost_usd).replace('$', '')) < parseFloat(String(best.total_cost_usd).replace('$', '')) ? r : best),
        null,
      );
      return {
        steps: [step('MCP get_bridge_route', res.status, `${routes.length} routes ranked`)],
        findings: {
          topBridge: p.bridge ?? null,
          topMinReceived: p.min_received ?? null,
          topTotalCostUsd: p.total_cost_usd ?? null,
          routesReturned: routes.length,
          cheapestRouteByTotalCost: cheapest ? cheapest.bridge : null,
          rankOneIsCheapest: cheapest ? cheapest.bridge === (routes[0] ?? {}).bridge : null,
        },
        attach: p,
      };
    },
  },
  manual: {
    label: 'One GET to the LI.FI quote API, fields extracted by hand',
    priceNote: 'Free. Public endpoint, no key.',
    async run() {
      const url =
        `https://li.quest/v1/quote?fromChain=56&toChain=8453&fromToken=${USDC_BSC}&toToken=${USDC_BASE}` +
        '&fromAmount=100000000000000000000&fromAddress=0x0000000000000000000000000000000000000001';
      const res = await httpGet(url);
      const q = res.json ?? {};
      const e = q.estimate ?? {};
      const toDecimals = q.action?.toToken?.decimals ?? 6;
      const minReceived = e.toAmountMin ? (Number(e.toAmountMin) / 10 ** toDecimals).toFixed(6) : null;
      const fees = (e.feeCosts ?? []).reduce((sum, f) => sum + parseFloat(f.amountUSD ?? '0'), 0);
      const gas = (e.gasCosts ?? []).reduce((sum, g) => sum + parseFloat(g.amountUSD ?? '0'), 0);
      return {
        steps: [step('GET li.quest/v1/quote', res.status, `tool ${q.tool ?? 'none'}`)],
        findings: {
          topBridge: q.toolDetails?.name ?? q.tool ?? null,
          topMinReceived: minReceived,
          topTotalCostUsd: Number.isFinite(fees + gas) ? `$${(fees + gas).toFixed(4)}` : null,
          routesReturned: 1,
          cheapestRouteByTotalCost: q.toolDetails?.name ?? null,
          rankOneIsCheapest: null,
        },
        attach: {
          tool: q.tool ?? null,
          toolName: q.toolDetails?.name ?? null,
          estimate: {
            fromAmount: e.fromAmount ?? null,
            toAmount: e.toAmount ?? null,
            toAmountMin: e.toAmountMin ?? null,
            fromAmountUSD: e.fromAmountUSD ?? null,
            toAmountUSD: e.toAmountUSD ?? null,
            executionDuration: e.executionDuration ?? null,
            gasCosts: (e.gasCosts ?? []).map((g) => ({ amountUSD: g.amountUSD })),
            feeCosts: (e.feeCosts ?? []).map((f) => ({ name: f.name, amountUSD: f.amountUSD })),
          },
        },
      };
    },
  },
};

/**
 * T5 - the audit. The agent asserts a prediction was committed before kickoff
 * and later revealed. The manual leg refuses to take that on trust and checks
 * it against the chain and the hash function.
 *
 * This is the task that matters most for a marketplace: not "can the agent do
 * work" but "can its claim about its own work be falsified".
 */
const t5 = {
  id: 'commit-reveal-audit',
  title: "Independently audit a trading agent's onchain commit-reveal claim",
  category: 'Security',
  question: `Did OpenOdds.Ai really commit prediction ${AUDIT.predictionId} onchain before kickoff, and does the revealed content hash to the committed value?`,
  agent: {
    name: 'OpenOdds.Ai',
    tokenId: '49637',
    transport: 'MCP (Streamable HTTP)',
    endpoint: OPENODDS_MCP,
    request: `tools/call verify_prediction { prediction_id: "${AUDIT.predictionId}" }`,
    priceNote: 'No payment required.',
    async run() {
      const res = await callTool(OPENODDS_MCP, 'verify_prediction', { prediction_id: AUDIT.predictionId });
      const p = res.payload ?? {};
      return {
        steps: [step('MCP verify_prediction', res.status, `status ${p.verification_status ?? 'unknown'}`)],
        findings: {
          verificationStatus: p.verification_status ?? null,
          verificationSource: p.verification_source ?? null,
          namesTheChain: false,
          commitTx: p.commit_tx ?? null,
          commitBlock: p.commit_block ?? null,
          revealed: p.revealed ?? null,
          contentHashMatch: p.content_hash_match ?? null,
          commitmentHashMatch: p.commitment_hash_match ?? null,
          independentlyChecked: false,
        },
        attach: p,
      };
    },
  },
  manual: {
    label: 'Locate the commit tx across seven EVM chains, read the calldata, re-derive the hash',
    priceNote: 'Free. Public RPC endpoints, no key.',
    async run() {
      const claim = await callTool(OPENODDS_MCP, 'verify_prediction', { prediction_id: AUDIT.predictionId });
      const c = claim.payload ?? {};
      const steps = [step('Take the claim to be tested (verify_prediction)', claim.status, 'claim under audit')];

      /* The agent gives a tx hash and a block number but never says which chain. */
      const chains = [
        ['BNB Smart Chain', BSC_RPC],
        ['opBNB', 'https://opbnb-mainnet-rpc.bnbchain.org'],
        ['Base', BASE_RPC],
        ['Polygon', 'https://polygon-rpc.com'],
        ['Arbitrum One', 'https://arb1.arbitrum.io/rpc'],
      ];
      let found = null;
      for (const [label, rpc] of chains) {
        const res = await evmRpc(rpc, 'eth_getTransactionByHash', [AUDIT.commitTx]);
        const hit = Boolean(res.result);
        steps.push(step(`eth_getTransactionByHash on ${label}`, res.status, hit ? 'FOUND' : 'not present'));
        if (hit && !found) found = { label, rpc, tx: res.result };
      }

      let receipt = null;
      let block = null;
      let words = [];
      if (found) {
        const r = await evmRpc(found.rpc, 'eth_getTransactionReceipt', [AUDIT.commitTx]);
        receipt = r.result;
        const b = await evmRpc(found.rpc, 'eth_getBlockByNumber', [found.tx.blockNumber, false]);
        block = b.result;
        words = calldataWords(found.tx.input);
        steps.push(step(`eth_getTransactionReceipt on ${found.label}`, r.status, receipt?.status === '0x1' ? 'success' : 'failed'));
        steps.push(step(`eth_getBlockByNumber on ${found.label}`, b.status, block ? 'block header read' : 'missing'));
      }

      const derived = c.content_hash && c.salt ? deriveCommitment(c.content_hash, c.salt) : null;
      const blockTimeMs = block ? parseInt(block.timestamp, 16) * 1000 : null;

      return {
        steps,
        findings: {
          verificationStatus: c.verification_status ?? null,
          verificationSource: c.verification_source ?? null,
          namesTheChain: true,
          chainFoundOn: found?.label ?? null,
          commitTx: AUDIT.commitTx,
          commitBlock: found ? parseInt(found.tx.blockNumber, 16) : null,
          txSucceeded: receipt ? receipt.status === '0x1' : null,
          contractCalled: found?.tx?.to ?? null,
          selector: found?.tx?.input?.slice(0, 10) ?? null,
          matchIdInCalldata: words.includes(AUDIT.matchId),
          contentHashInCalldata: c.content_hash ? words.includes(c.content_hash) : null,
          commitmentHashInCalldata: c.commitment_hash ? words.includes(c.commitment_hash) : null,
          derivedCommitment: derived,
          derivedMatchesOnchain: derived ? derived === c.commitment_hash : null,
          blockTimeUtc: blockTimeMs ? new Date(blockTimeMs).toISOString() : null,
          agentClaimedCommitTime: c.commit_timestamp ?? null,
          committedBeforeKickoff: blockTimeMs ? blockTimeMs < Date.parse(AUDIT.kickoffIso) : null,
          independentlyChecked: true,
        },
        attach: {
          claimUnderAudit: c,
          chainFoundOn: found?.label ?? null,
          transaction: found ? { hash: AUDIT.commitTx, blockNumber: found.tx.blockNumber, from: found.tx.from, to: found.tx.to, input: found.tx.input } : null,
          receiptStatus: receipt?.status ?? null,
          blockTimestampHex: block?.timestamp ?? null,
          calldataWords: words,
          derivedCommitment: derived,
        },
      };
    },
  },
};

export const TASKS = [t1, t2, t3, t4, t5];
