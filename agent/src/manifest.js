/**
 * The deliverable manifest, in the shape the ecosystem already verifies.
 *
 * The kernel never checks the bytes32 a provider submits - an empty optParams
 * and an arbitrary hash both pass simulation - so any convention would "work"
 * onchain while being unverifiable by anyone else. That is the failure mode
 * worth avoiding: a commitment nobody but its author can check is decoration.
 *
 * So this follows what other providers on this deployment actually do:
 *
 *   deliverable = keccak256(canonical_json(manifest))
 *   manifest    = { version, job_id, chain_id, contracts, response, metadata }
 *   canonical   = keys sorted recursively, no whitespace
 *                 (python json.dumps(sort_keys=True, separators=(",",":")))
 *
 * Verified rather than assumed: this implementation reproduces job #56743's
 * onchain deliverable 0x0aaf233c…44ee bit-for-bit from the manifest that
 * provider still serves - a different team, a different stack, the same hash.
 *
 * One subtlety worth keeping. A server may serve extra fields beside the six
 * (job #56720's adds "success": true). Hashing the served bytes then fails
 * while hashing the projection succeeds, so both producing and verifying must
 * project onto the schema first and never hash the raw response body.
 */

import { keccak256, toHex } from 'viem';

export const MANIFEST_FIELDS = ['version', 'job_id', 'chain_id', 'contracts', 'response', 'metadata'];

/** Recursively key-sorted. `JSON.stringify` already emits `,` and `:` with no spaces. */
function canonicalise(value) {
  if (Array.isArray(value)) return value.map(canonicalise);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, canonicalise(value[k])]),
    );
  }
  return value;
}

/** The exact bytes the hash is taken over. Exported so a verifier can diff them. */
export function canonicalJson(manifest) {
  const projected = Object.fromEntries(
    MANIFEST_FIELDS.filter((f) => f in manifest).map((f) => [f, manifest[f]]),
  );
  return JSON.stringify(canonicalise(projected));
}

export function manifestHash(manifest) {
  return keccak256(toHex(canonicalJson(manifest)));
}

/**
 * Build the manifest for one answered job.
 *
 * `response.content` is the report as a JSON string rather than an object,
 * matching what the other providers publish - the manifest carries a payload,
 * it does not merge one.
 */
export function buildManifest({ jobId, chainId, contracts, report, agent, brief }) {
  return {
    version: '1.0',
    job_id: Number(jobId),
    chain_id: chainId,
    contracts,
    response: {
      content: JSON.stringify(report),
      content_type: 'application/json',
    },
    metadata: {
      agent,
      agent_name: 'Bazar Contract Safety',
      brief,
      // No timestamp: it would make the hash unreproducible from the served
      // manifest, which is the one property this whole scheme exists to have.
      method: 'Read from BNB Smart Chain state. No score assigned.',
    },
  };
}
