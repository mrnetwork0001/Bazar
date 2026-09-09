/**
 * Registers this agent's own ERC-8004 identity.
 *
 * `register(string agentURI)` mints the ERC-721 to msg.sender, so running this
 * from the agent's key means the agent owns its own identity - which is the
 * point. Nobody holds it on its behalf.
 *
 * The card is a base64 data URI rather than a hosted URL. A hosted card is a
 * link that can rot; a data URI is the registration itself, and the registry is
 * the only thing that has to stay up for it to resolve.
 *
 * Two things in the description are deliberate. It says plainly that this agent
 * is operated by Bazar - a marketplace listing its own agent without saying so
 * is the one move that would undermine everything else on the site. And it
 * makes no category claim: Bazar files agents by the terms in their own
 * registration text, and a contract-safety agent is none of rebalancing, grid
 * trading, yield or health factor. It will list as Unclassified, correctly.
 */

import { createWalletClient, createPublicClient, http, parseAbi, formatEther, decodeEventLog } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bsc } from 'viem/chains';
import { readFileSync, existsSync } from 'node:fs';

for (const line of existsSync(new URL('../.env', import.meta.url))
  ? readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')
  : []) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';
const RPC = process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org';
const BASE = (process.env.PUBLIC_BASE_URL || 'https://usebazar.xyz/agent').replace(/\/$/, '');

const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY);
const pub = createPublicClient({ chain: bsc, transport: http(RPC) });
const wallet = createWalletClient({ account, chain: bsc, transport: http(RPC) });

const ABI = parseAbi([
  'function register(string agentURI) returns (uint256 agentId)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
]);

const card = {
  name: 'Bazar Contract Safety',
  description:
    'Reads a BEP-20 contract on BNB Smart Chain and reports what its deployer can still do: ownership and whether it is renounced, EIP-1967 upgradeability, and which administrative functions (mint, pause, blacklist, fee changes) are present in the deployed bytecode. Every field is read from chain state. No score is assigned, because any weighting of those facts would be an opinion presented as a measurement. Hireable through ERC-8183 escrow; the deliverable is a keccak256 commitment to the full report. Operated by Bazar as a reference implementation of the provider side.',
  url: BASE,
  version: '1.0.0',
  services: [{ name: 'Web', endpoint: BASE }],
  skills: [
    {
      id: 'contract-safety',
      description:
        'Given a BEP-20 address, report ownership, upgradeability and administrative functions read from chain state.',
      examples: [{ address: '0xcE24439F2D9C6a2289F741120FE202248B666666' }],
    },
  ],
  registrations: [{ agentRegistry: `eip155:56:${REGISTRY}` }],
};

const uri = `data:application/json;base64,${Buffer.from(JSON.stringify(card)).toString('base64')}`;

console.log(`registering ${account.address}`);
console.log(`card ${uri.length} bytes`);
const balance = await pub.getBalance({ address: account.address });
console.log(`balance ${formatEther(balance)} BNB`);

const hash = await wallet.writeContract({ address: REGISTRY, abi: ABI, functionName: 'register', args: [uri] });
console.log(`sent ${hash}`);
const receipt = await pub.waitForTransactionReceipt({ hash });
console.log(`${receipt.status} in block ${receipt.blockNumber}`);

for (const log of receipt.logs) {
  try {
    const ev = decodeEventLog({ abi: ABI, data: log.data, topics: log.topics });
    if (ev.eventName === 'Transfer') {
      console.log(`\nTOKEN ID ${ev.args.tokenId}`);
      console.log(`https://usebazar.xyz/agents/56-${ev.args.tokenId}`);
      console.log(`https://bscscan.com/tx/${hash}`);
    }
  } catch {
    /* other logs in the receipt are not ours to decode */
  }
}
