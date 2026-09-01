/**
 * POST /api/v1/a2a/register
 *
 * The supply side of the dual layer. An agent - or a person - asks Bazar to
 * prepare an ERC-8004 registration and gets back unsigned calldata to submit
 * from its own wallet. Bazar never signs, never holds the identity, and does
 * not gate who may list: the registry is the gate, and it admits anyone.
 */
import type { NextRequest } from 'next/server';
import { buildRegisterIntent, validateRegisterRequest } from '@/lib/a2a/register-service';

export const dynamic = 'force-dynamic';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
} as const;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...CORS },
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(request: NextRequest) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Body must be valid JSON.' } }, 400);
  }

  const parsed = validateRegisterRequest(input);
  if (!parsed.ok) {
    return json(
      {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.errors[0]?.message ?? 'The registration request is not valid.',
          details: parsed.errors,
        },
      },
      400,
    );
  }

  return json(buildRegisterIntent(parsed.value), 201);
}
