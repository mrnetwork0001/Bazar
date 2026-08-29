import { errorResponse, jsonResponse, preflight } from '@/lib/a2a/hire-service';
import { fetchJobView, parseJobChainId, parseJobId } from '@/lib/a2a/job-view';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/a2a/jobs/{id}?chainId=56
 *
 * Reads one ERC-8183 job off the live AgenticCommerce kernel with
 * `getJob(uint256)` and returns it. This is the authoritative state, not a
 * Bazar record: the router keeps no job database, runs no log listener and
 * caches nothing here.
 *
 * The three failure modes stay distinct, because an agent has to branch on them:
 *   404 JOB_NOT_FOUND     the kernel answered, and the id has never been issued
 *   503 CHAIN_UNAVAILABLE the RPC could not be reached or refused the request
 *   502 CHAIN_READ_FAILED the node answered but the call reverted or would not decode
 *
 * 200 OK · 400 VALIDATION_ERROR · 404 · 502 · 503
 */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const idParse = parseJobId(decodeURIComponent(params.id ?? ''));
  if (!idParse.ok) {
    return errorResponse(400, 'VALIDATION_ERROR', idParse.message, [{ path: 'id', message: idParse.message }]);
  }

  const chainParse = parseJobChainId(new URL(request.url).searchParams.get('chainId'));
  if (!chainParse.ok) {
    return errorResponse(400, 'VALIDATION_ERROR', chainParse.message, [
      { path: 'chainId', message: chainParse.message },
    ]);
  }

  const result = await fetchJobView(chainParse.chainId, idParse.jobId);
  if (!result.ok) {
    return errorResponse(result.status, result.code, result.message, result.details);
  }

  return jsonResponse(result);
}

export function OPTIONS() {
  return preflight();
}
