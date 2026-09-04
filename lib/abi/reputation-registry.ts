/**
 * ERC-8004 Reputation Registry, trimmed to what Bazar reads.
 *
 * Copied from the canonical erc-8004/erc-8004-contracts ABI, not hand-written.
 * Bazar only ever reads here: feedback is given by clients directly, and Bazar
 * neither writes nor brokers it.
 */
export const REPUTATION_REGISTRY_ABI = [
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "agentId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "clientAddress",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "uint64",
        "name": "feedbackIndex",
        "type": "uint64"
      }
    ],
    "name": "FeedbackRevoked",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "agentId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "clientAddress",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint64",
        "name": "feedbackIndex",
        "type": "uint64"
      },
      {
        "indexed": false,
        "internalType": "int128",
        "name": "value",
        "type": "int128"
      },
      {
        "indexed": false,
        "internalType": "uint8",
        "name": "valueDecimals",
        "type": "uint8"
      },
      {
        "indexed": true,
        "internalType": "string",
        "name": "indexedTag1",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "tag1",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "tag2",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "endpoint",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "feedbackURI",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "feedbackHash",
        "type": "bytes32"
      }
    ],
    "name": "NewFeedback",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "agentId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "clientAddress",
        "type": "address"
      }
    ],
    "name": "getLastIndex",
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
    "inputs": [
      {
        "internalType": "uint256",
        "name": "agentId",
        "type": "uint256"
      },
      {
        "internalType": "address[]",
        "name": "clientAddresses",
        "type": "address[]"
      },
      {
        "internalType": "string",
        "name": "tag1",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "tag2",
        "type": "string"
      }
    ],
    "name": "getSummary",
    "outputs": [
      {
        "internalType": "uint64",
        "name": "count",
        "type": "uint64"
      },
      {
        "internalType": "int128",
        "name": "summaryValue",
        "type": "int128"
      },
      {
        "internalType": "uint8",
        "name": "summaryValueDecimals",
        "type": "uint8"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "agentId",
        "type": "uint256"
      },
      {
        "internalType": "address[]",
        "name": "clientAddresses",
        "type": "address[]"
      },
      {
        "internalType": "string",
        "name": "tag1",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "tag2",
        "type": "string"
      },
      {
        "internalType": "bool",
        "name": "includeRevoked",
        "type": "bool"
      }
    ],
    "name": "readAllFeedback",
    "outputs": [
      {
        "internalType": "address[]",
        "name": "clients",
        "type": "address[]"
      },
      {
        "internalType": "uint64[]",
        "name": "feedbackIndexes",
        "type": "uint64[]"
      },
      {
        "internalType": "int128[]",
        "name": "values",
        "type": "int128[]"
      },
      {
        "internalType": "uint8[]",
        "name": "valueDecimals",
        "type": "uint8[]"
      },
      {
        "internalType": "string[]",
        "name": "tag1s",
        "type": "string[]"
      },
      {
        "internalType": "string[]",
        "name": "tag2s",
        "type": "string[]"
      },
      {
        "internalType": "bool[]",
        "name": "revokedStatuses",
        "type": "bool[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "agentId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "clientAddress",
        "type": "address"
      },
      {
        "internalType": "uint64",
        "name": "feedbackIndex",
        "type": "uint64"
      }
    ],
    "name": "readFeedback",
    "outputs": [
      {
        "internalType": "int128",
        "name": "value",
        "type": "int128"
      },
      {
        "internalType": "uint8",
        "name": "valueDecimals",
        "type": "uint8"
      },
      {
        "internalType": "string",
        "name": "tag1",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "tag2",
        "type": "string"
      },
      {
        "internalType": "bool",
        "name": "isRevoked",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;
