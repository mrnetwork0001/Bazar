import { toAgentSummary } from '@/lib/a2a/schema';
import { errorResponse, jsonResponse, preflight, resolveIndexedAgent } from '@/lib/a2a/hire-service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/a2a/agents/{id}
 *
 * `id` is the Bazar slug "<chainId>-<tokenId>" (e.g. 56-43129). A bare ERC-8004
 * tokenId and the 8004scan composite id "<chainId>:<registry>:<tokenId>" are
 * also accepted and normalised onto the slug form.
 *
 * 404 here means "not resolvable", not "does not exist" - see the message the
 * resolver builds. A malformed reference is a 400 and an unreachable index is a
 * 503, so the three states stay distinguishable to a machine caller.
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const id = decodeURIComponent(params.id ?? '').trim();
  if (!id) {
    return errorResponse(400, 'VALIDATION_ERROR', 'An agent id is required.', [
      { path: 'id', message: 'Path segment is empty.' },
    ]);
  }

  const resolved = await resolveIndexedAgent(id);
  if (!('ok' in resolved)) {
    return jsonResponse(resolved.body, { status: resolved.status });
  }

  return jsonResponse({ ok: true, data: toAgentSummary(resolved.agent) });
}

export function OPTIONS() {
  return preflight();
}
