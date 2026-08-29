/**
 * The three `OptimisticPolicy` view functions the hire flow reads.
 *
 * Copied VERBATIM out of the official BNB Agent Studio SDK artifact
 * (bnb-chain/bnbagent-sdk, `abis/OptimisticPolicy.json`) - not hand-written.
 * `lib/abi` vendors the four contracts the read path needs; the settlement
 * policy is only read here, on the one surface that has to explain how long a
 * job takes to settle, so the fragment lives beside its single consumer.
 *
 * Why read it at all: the difference between the two chains is the single most
 * important thing a hirer needs to know before committing funds. Mainnet needs
 * three evaluator votes and holds a seven-day dispute window; testnet needs one
 * vote and holds fifteen minutes. Those numbers were measured on 2026-08-28,
 * but they are admin-settable, so the UI reads them live and says nothing at
 * all when the read fails rather than quoting a figure that may have moved.
 */

export const OPTIMISTIC_POLICY_ABI = [
  {
    "inputs": [],
    "name": "activeVoterCount",
    "outputs": [
      {
        "internalType": "uint16",
        "name": "",
        "type": "uint16"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "disputeWindow",
    "outputs": [
      {
        "internalType": "uint64",
        "name": "",
        "type": "uint64"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "voteQuorum",
    "outputs": [
      {
        "internalType": "uint16",
        "name": "",
        "type": "uint16"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;
