import { errorResponse, jsonResponse, preflight, processHireRequest } from '@/lib/a2a/hire-service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/a2a/hire
 * Body: A2AHireRequest. Returns 201 A2AHireResponse with an escrow quote,
 * or a structured A2AErrorResponse (400 / 403 / 404).
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
    const result = processHireRequest(body);
    return jsonResponse(result.body, { status: result.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error while quoting the hire.';
    return errorResponse(500, 'INTERNAL', message);
  }
}

/** Friendly hint for agents that probe the endpoint with GET. */
export function GET() {
  return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Use POST /api/v1/a2a/hire with a JSON body. See /developers for the schema.');
}

export function OPTIONS() {
  return preflight();
}
