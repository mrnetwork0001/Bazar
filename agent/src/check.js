/**
 * The work this agent actually does: a contract-safety report on a BEP-20 token.
 *
 * Every field below is read from the chain. Nothing is inferred from a name, a
 * logo or a listing, and nothing is scored by a model - the same discipline the
 * marketplace applies to agent listings, applied to the agent's own output.
 *
 * The report answers one question a person asks before approving a token:
 * what can the deployer still do to me? That is answerable from bytecode and
 * storage, and it is answerable exactly, so it is worth answering exactly.
 */

import { createPublicClient, http, parseAbi, formatUnits, getAddress } from 'viem';
import { bsc } from 'viem/chains';

const RPC = process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org';

const ERC20 = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function owner() view returns (address)',
  'function getOwner() view returns (address)',
]);

/**
 * Selectors worth knowing about before you approve a token.
 *
 * Presence in the deployed bytecode is evidence the function exists; it is NOT
 * evidence it will be used, and the report says so. A mint function on a token
 * with a renounced owner is a different risk from the same function behind a
 * live owner, so the two facts are reported together and never collapsed into
 * a single score.
 */
const SELECTORS = [
  ['mint(address,uint256)', '0x40c10f19', 'Supply can be increased by whoever holds the mint role.'],
  ['burnFrom(address,uint256)', '0x79cc6790', 'Balances can be burned from an address other than the caller.'],
  ['pause()', '0x8456cb59', 'Transfers can be halted.'],
  ['blacklist(address)', '0xf9f92be4', 'An address can be blocked from transacting.'],
  ['setFees(uint256,uint256)', '0x1a8a4f11', 'Transfer fees can be changed after launch.'],
  ['setMaxTxAmount(uint256)', '0xec28438a', 'A per-transaction cap can be imposed.'],
  ['excludeFromFee(address)', '0x437823ec', 'Fee exemptions can be granted selectively.'],
];

const ZERO = '0x0000000000000000000000000000000000000000';
/** EIP-1967 implementation slot: keccak256("eip1967.proxy.implementation") - 1 */
const EIP1967_IMPL = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';

export async function inspectToken(rawAddress) {
  const client = createPublicClient({ chain: bsc, transport: http(RPC) });

  let address;
  try {
    address = getAddress(rawAddress);
  } catch {
    return { ok: false, error: `Not a valid address: ${rawAddress}` };
  }

  const code = await client.getBytecode({ address });
  if (!code || code === '0x') {
    return {
      ok: false,
      error: 'No contract at this address on BNB Smart Chain. It is an EOA or an undeployed address.',
      address,
    };
  }

  const read = async (fn) => {
    try {
      return await client.readContract({ address, abi: ERC20, functionName: fn });
    } catch {
      return null;
    }
  };

  const [name, symbol, decimals, totalSupply] = await Promise.all([
    read('name'),
    read('symbol'),
    read('decimals'),
    read('totalSupply'),
  ]);

  // Two conventions in the wild; BEP-20 specifies getOwner(), OpenZeppelin uses owner().
  const owner = (await read('owner')) ?? (await read('getOwner'));

  // A proxy means today's bytecode is not a promise about tomorrow's.
  const implSlot = await client.getStorageAt({ address, slot: EIP1967_IMPL });
  const implementation =
    implSlot && implSlot !== `0x${'0'.repeat(64)}` ? getAddress(`0x${implSlot.slice(-40)}`) : null;

  const found = SELECTORS.filter(([, sel]) => code.includes(sel.slice(2))).map(([sig, sel, meaning]) => ({
    signature: sig,
    selector: sel,
    meaning,
  }));

  const ownerRenounced = owner === ZERO;
  const isProxy = implementation !== null;

  /*
   * Deliberately not a score out of 100.
   *
   * A single number would have to weigh "can mint" against "is upgradeable"
   * against "owner renounced", and any weighting is an opinion presented as a
   * measurement. The report states what is true and lets the reader weigh it -
   * which is also the only honest thing to put behind a hash.
   */
  const observations = [];
  if (isProxy) {
    observations.push(
      `Upgradeable. An EIP-1967 proxy pointing at ${implementation}. The logic can be replaced, so nothing below is permanent.`,
    );
  }
  if (owner && !ownerRenounced) {
    observations.push(`Owned by ${owner}. Any owner-gated function below is live.`);
  }
  if (ownerRenounced) {
    observations.push('Ownership renounced to the zero address. Owner-gated functions cannot be called.');
  }
  if (owner === null) {
    observations.push('No owner() or getOwner() responded. Access control, if any, is not exposed by that convention.');
  }
  for (const f of found) observations.push(`${f.signature} is present in the bytecode. ${f.meaning}`);
  if (!found.length) {
    observations.push('None of the checked administrative functions are present in the bytecode.');
  }

  return {
    ok: true,
    address,
    chainId: 56,
    token: {
      name: name ?? null,
      symbol: symbol ?? null,
      decimals: decimals ?? null,
      totalSupply:
        totalSupply !== null && decimals !== null
          ? formatUnits(totalSupply, Number(decimals))
          : totalSupply !== null
            ? totalSupply.toString()
            : null,
    },
    ownership: { owner: owner ?? null, renounced: ownerRenounced },
    upgradeable: { isProxy, implementation },
    administrativeFunctions: found,
    observations,
    method:
      'Every field is read from BNB Smart Chain: contract bytecode, EIP-1967 storage slot, and standard BEP-20 views. Selector presence proves a function exists in the deployed code; it does not prove intent to use it. No score is assigned, because any weighting of these facts would be an opinion presented as a measurement.',
  };
}

/** Pull the first plausible 0x address out of a free-text or JSON brief. */
export function addressFromBrief(brief) {
  if (!brief) return null;
  try {
    const parsed = JSON.parse(brief);
    for (const k of ['address', 'token', 'contract', 'target']) {
      if (typeof parsed[k] === 'string' && /^0x[0-9a-fA-F]{40}$/.test(parsed[k])) return parsed[k];
    }
  } catch {
    /* free text is the common case, not an error */
  }
  const m = brief.match(/0x[0-9a-fA-F]{40}/);
  return m ? m[0] : null;
}

// Allow a direct run for testing: node src/check.js 0x...
if (process.argv[1]?.endsWith('check.js')) {
  const target = process.argv[2];
  if (!target) {
    console.error('usage: node src/check.js <token address>');
    process.exit(1);
  }
  inspectToken(target).then((r) => console.log(JSON.stringify(r, null, 2)));
}
