import { errorResponse, jsonResponse, preflight, processJobIntentRequest } from '@/lib/a2a/hire-service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/a2a/hire
 *
 * Returns an **unsigned but immediately executable ERC-8183 job plan**, not a
 * priced quote. Bazar resolves the agent from the ERC-8004 Identity Registry,
 * encodes `createJob(provider, evaluator, expiredAt, description, hook)` for the
 * AgenticCommerce kernel, and hands back that calldata plus the three calls
 * that follow it - `setBudget`, an ERC-20 `approve` to the kernel, and `fund` -
 * each with its ABI fragment and selector, so the caller never has to
 * hand-write a signature.
 *
 * Nothing is signed, sent or escrowed here, and no amount is quoted: the client
 * chooses the budget, writes it with `setBudget` and locks it with `fund`.
 * `status` stays `"unsigned_intent"` forever - read real job state at
 * `GET /api/v1/a2a/jobs/{jobId}`.
 *
 * 201 Created · 400 VALIDATION_ERROR · 404 AGENT_NOT_FOUND · 503 INDEX_UNAVAILABLE · 500 INTERNAL
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, 'VALIDATION_ERROR', 'Body must be valid JSON with Content-Type: application/json.', [
      { path: '', message: 'Unparseable JSON body.' },
    ]);
  }

  try {
    const result = await processJobIntentRequest(body);
    return jsonResponse(result.body, { status: result.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error while building the job intent.';
    return errorResponse(500, 'INTERNAL', message);
  }
}

/** Friendly hint for agents that probe the endpoint with GET. */
export function GET() {
  return errorResponse(
    405,
    'METHOD_NOT_ALLOWED',
    'Use POST /api/v1/a2a/hire with a JSON body to build an ERC-8183 job intent. See /developers for the schema.',
  );
}

export function OPTIONS() {
  return preflight();
}
