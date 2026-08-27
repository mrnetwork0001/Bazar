import { bazarAgentCard, jsonResponse, preflight } from '@/lib/a2a/hire-service';

/**
 * GET /.well-known/agent.json
 * Bazar's own A2A agent card so other agents can discover the router.
 */
export function GET() {
  return jsonResponse(bazarAgentCard(), {
    headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' },
  });
}

export function OPTIONS() {
  return preflight();
}
