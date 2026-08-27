import { getAgent } from '@/lib/data/agents';
import { errorResponse, jsonResponse, preflight } from '@/lib/a2a/hire-service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/a2a/agents/{id}
 * `id` may be the Bazar slug ("whalewatch-bsc") or the ERC-8004 tokenId ("8841").
 */
export function GET(_request: Request, { params }: { params: { id: string } }) {
  const id = decodeURIComponent(params.id ?? '').trim();
  const agent = id ? getAgent(id) : undefined;
  if (!agent) {
    return errorResponse(404, 'AGENT_NOT_FOUND', `No ERC-8004 agent matches "${id}" on Bazar.`, { agentId: id });
  }
  return jsonResponse({ ok: true, data: agent });
}

export function OPTIONS() {
  return preflight();
}
