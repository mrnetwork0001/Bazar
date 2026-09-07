/**
 * The chain-reading half of the manual legs.
 *
 * `viem` is imported rather than reimplemented. It is already a first-class
 * dependency of the app, and a hand-rolled keccak inside a benchmark would
 * give a judge a second implementation to audit before they could trust the
 * first - the opposite of what a checkable measurement is for.
 */

import { decodeAbiParameters, encodePacked, formatUnits, keccak256, toFunctionSelector } from 'viem';

/** The four selectors a manual ERC-20 read needs, derived rather than pasted. */
export const ERC20_SELECTORS = {
  name: toFunctionSelector('function name() returns (string)'),
  symbol: toFunctionSelector('function symbol() returns (string)'),
  decimals: toFunctionSelector('function decimals() returns (uint8)'),
  totalSupply: toFunctionSelector('function totalSupply() returns (uint256)'),
  owner: toFunctionSelector('function owner() returns (address)'),
  paused: toFunctionSelector('function paused() returns (bool)'),
};

export function decodeWord(type, hex) {
  if (typeof hex !== 'string' || hex === '0x') return null;
  try {
    return decodeAbiParameters([{ type }], hex)[0];
  } catch {
    return null;
  }
}

export function formatSupply(raw, decimals) {
  if (raw === null || decimals === null) return null;
  return formatUnits(raw, Number(decimals));
}

/** Split calldata after the selector into its 32-byte words. */
export function calldataWords(input) {
  const words = [];
  for (let i = 10; i + 64 <= input.length; i += 64) words.push(`0x${input.slice(i, i + 64)}`);
  return words;
}

/**
 * The commit-reveal scheme OpenOdds.Ai anchors onchain.
 *
 * The agent does not publish its construction, so this is the derivation that
 * was found to reproduce the onchain commitment from the revealed content hash
 * and salt. `encodePacked` of two bytes32 values is byte-identical to their
 * ABI encoding, so this covers both readings of the scheme.
 */
export function deriveCommitment(contentHash, salt) {
  return keccak256(encodePacked(['bytes32', 'bytes32'], [contentHash, salt]));
}
