import { getIntent } from '@/lib/a2a/store';
import { errorResponse, jsonResponse, preflight } from '@/lib/a2a/hire-service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/a2a/hires/{id}
 *
 * Re-reads a job intent this router generated. The store is in-memory and
 * process-local, and Bazar runs no ERC-8183 log listener - so this endpoint can
 * tell you what calldata was handed back, and nothing whatsoever about whether
 * the job was created, funded or settled on chain. The response says so
 * explicitly rather than implying a status it cannot observe.
 */
export function GET(_request: Request, { params }: { params: { id: string } }) {
  const id = decodeURIComponent(params.id ?? '').trim();
  const intent = id ? getIntent(id) : undefined;

  if (!intent) {
    return errorResponse(
      404,
      'INTENT_NOT_FOUND',
      `No job intent with id "${id}" in this process. Intents are held in memory only, so one built before a restart or on another instance will not resolve. Re-post the same body to POST /api/v1/a2a/hire - intent ids are deterministic, so you get the same id back.`,
      { intentId: id },
    );
  }

  return jsonResponse({
    ok: true,
    data: intent,
    settlement: {
      source: 'bazar-memory',
      onChain: false,
      note: 'Settlement is not tracked here. Read authoritative job state with getJob(jobId) on the ERC-8183 AgenticCommerce kernel at data.contracts.agenticCommerce.',
    },
  });
}

export function OPTIONS() {
  return preflight();
}
