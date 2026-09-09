/**
 * The listener.
 *
 * ERC-8004 gives an agent an identity. It does not tell that agent it has been
 * hired: the AgenticCommerce kernel emits an event, and unless something is
 * watching, the job sits funded until it expires and the client claims a refund.
 * That is what happened to Bazar's job #56744 - the escrow worked perfectly and
 * the agent never found out.
 *
 * This closes that loop. `provider` is an indexed topic on JobFunded, so
 * discovery is a filtered eth_getLogs rather than a scan of the whole kernel:
 * one cheap query returns exactly the jobs addressed to this agent.
 *
 * The kernel accepts submit() only from job.provider - verified by eth_call
 * against a live funded job, where the client, the evaluator and an unrelated
 * account all revert Unauthorized(). So this process holds its own key and is
 * the only thing that can answer its own jobs.
 */

import { createPublicClient, createWalletClient, http, parseAbi, toHex, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bsc } from 'viem/chains';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { inspectToken, addressFromBrief } from './check.js';
import { buildManifest, manifestHash } from './manifest.js';

/* --------------------------------- config -------------------------------- */

for (const line of existsSync(new URL('../.env', import.meta.url))
  ? readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')
  : []) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const KERNEL = '0xea4daa3100a767e86fded867729ae7446476eba6';
// Two endpoints, because they are not interchangeable. Measured 2026-09-09:
// bsc-dataseed.binance.org and defibit both refuse eth_getLogs over any range,
// even 500 blocks, while publicnode serves 2000 happily. Contract reads and
// writes go to the primary; log discovery goes to the one that answers.
const RPC = process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org';
const LOGS_RPC = process.env.BSC_LOGS_RPC_URL || 'https://bsc-rpc.publicnode.com';
const BASE_URL = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
const KEY = process.env.AGENT_PRIVATE_KEY;
const ONCE = process.argv.includes('--once');
/** Blocks per getLogs window. BSC public nodes refuse much more than this. */
const WINDOW = 2000n;
const POLL_MS = 15_000;
const STATE = new URL('../state.json', import.meta.url);
const REPORTS = new URL('../reports/', import.meta.url);

if (!KEY) {
  console.error('AGENT_PRIVATE_KEY is not set. See .env.example.');
  process.exit(1);
}

const account = privateKeyToAccount(KEY);
const pub = createPublicClient({ chain: bsc, transport: http(RPC) });
const logsClient = createPublicClient({ chain: bsc, transport: http(LOGS_RPC) });
const wallet = createWalletClient({ account, chain: bsc, transport: http(RPC) });

const KERNEL_ABI = parseAbi([
  'event JobFunded(uint256 indexed jobId, address indexed client, address indexed provider, uint256 budget)',
  'function submit(uint256 jobId, bytes32 deliverable, bytes optParams)',
  'struct Job { uint256 id; address client; address provider; address evaluator; string description; uint256 budget; uint256 expiredAt; uint8 status; address hook; }',
  'function getJob(uint256) view returns (Job)',
]);

/* --------------------------------- state --------------------------------- */

const loadState = () => {
  try {
    return JSON.parse(readFileSync(STATE, 'utf8'));
  } catch {
    return { lastBlock: null, answered: [] };
  }
};
const saveState = (s) => writeFileSync(STATE, JSON.stringify(s, null, 2));

/* ------------------------------- the work -------------------------------- */

/**
 * Turn one funded job into a submitted deliverable.
 *
 * The hash committed onchain is keccak256 over the canonical JSON of the whole
 * report, so a client can fetch the report later and prove it is the one that
 * was promised. `optParams` carries the URL; the hash carries the content.
 */
async function answer(job, jobId) {
  const target = addressFromBrief(job.description);
  const report = target
    ? await inspectToken(target)
    : {
        ok: false,
        error:
          'No contract address found in the brief. This agent reports on a BEP-20 contract; include its address and it will read ownership, upgradeability and administrative functions off the chain.',
      };

  const manifest = buildManifest({
    jobId,
    chainId: 56,
    contracts: {
      commerce: KERNEL,
      router: job.evaluator,
      policy: '0x9C01845705b3078Aa2e8cfF7520a6376FD766dE5',
    },
    report,
    agent: account.address,
    brief: job.description,
  });
  const deliverable = manifestHash(manifest);

  mkdirSync(REPORTS, { recursive: true });
  writeFileSync(new URL(`${jobId}.json`, REPORTS), JSON.stringify(manifest, null, 2));

  const optParams = toHex(
    JSON.stringify({ deliverable_url: `${BASE_URL}/${jobId}.json`, sha3: deliverable }),
  );

  console.log(`  submitting job ${jobId} - deliverable ${deliverable.slice(0, 18)}…`);
  const hash = await wallet.writeContract({
    address: KERNEL,
    abi: KERNEL_ABI,
    functionName: 'submit',
    args: [jobId, deliverable, optParams],
  });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  console.log(`  ${receipt.status} - https://bscscan.com/tx/${hash}`);
  return receipt.status === 'success';
}

/* -------------------------------- the loop ------------------------------- */

async function sweep() {
  const state = loadState();
  const head = await logsClient.getBlockNumber();
  // First run looks back one window rather than to genesis; anything older is
  // past its deadline anyway.
  let from = state.lastBlock ? BigInt(state.lastBlock) + 1n : head - WINDOW;

  while (from <= head) {
    const to = from + WINDOW - 1n > head ? head : from + WINDOW - 1n;
    let logs = [];
    try {
      logs = await logsClient.getLogs({
        address: KERNEL,
        event: KERNEL_ABI[0],
        // The whole reason this is cheap: the kernel indexes provider.
        args: { provider: account.address },
        fromBlock: from,
        toBlock: to,
      });
    } catch (err) {
      console.error(`  getLogs ${from}-${to} failed: ${String(err).split('\n')[0]}`);
      break;
    }

    for (const log of logs) {
      const jobId = log.args.jobId;
      if (state.answered.includes(jobId.toString())) continue;
      console.log(`job ${jobId} funded for this agent`);
      try {
        const job = await pub.readContract({ address: KERNEL, abi: KERNEL_ABI, functionName: 'getJob', args: [jobId] });
        // Only FUNDED(1) can be submitted against; anything else was handled
        // while this process was not looking.
        if (Number(job.status) !== 1) {
          console.log(`  status ${job.status}, not FUNDED - skipping`);
          state.answered.push(jobId.toString());
          continue;
        }
        if (await answer(job, jobId)) state.answered.push(jobId.toString());
      } catch (err) {
        console.error(`  job ${jobId} failed: ${String(err).split('\n')[0]}`);
      }
    }

    state.lastBlock = to.toString();
    saveState(state);
    from = to + 1n;
  }
}

const balance = await pub.getBalance({ address: account.address });
console.log(`bazar-safety-agent  ${account.address}`);
console.log(`balance ${formatEther(balance)} BNB  ·  watching kernel ${KERNEL}`);
if (balance === 0n) console.log('WARNING: no BNB. Discovery works; submit() will fail until this address is funded.');

await sweep();
if (!ONCE) {
  console.log(`polling every ${POLL_MS / 1000}s`);
  setInterval(() => sweep().catch((e) => console.error(String(e).split('\n')[0])), POLL_MS);
}
