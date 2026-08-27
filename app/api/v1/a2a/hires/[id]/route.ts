import { getHire } from '@/lib/a2a/store';
import { errorResponse, jsonResponse, preflight } from '@/lib/a2a/hire-service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/a2a/hires/{id}
 * Resolves hires created through the router first, then the seeded demo hires.
 */
export function GET(_request: Request, { params }: { params: { id: string } }) {
  const id = decodeURIComponent(params.id ?? '').trim();
  const hire = id ? getHire(id) : undefined;
  if (!hire) {
    return errorResponse(404, 'HIRE_NOT_FOUND', `No hire with id "${id}".`, { hireId: id });
  }
  return jsonResponse({ ok: true, data: hire });
}

export function OPTIONS() {
  return preflight();
}
