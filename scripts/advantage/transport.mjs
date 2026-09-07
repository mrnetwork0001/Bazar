/**
 * Transport helpers for the Agent Advantage benchmark.
 *
 * Transport carries no dependencies of its own - `fetch` and `performance` are
 * both in the Node 18+ standard library. The one third-party import in the
 * harness is `viem`, in `evm.mjs`, and it is the same library the app itself
 * uses to read the chain: re-deriving a commitment hash with a hand-rolled
 * keccak would be a second implementation for a judge to audit before they
 * could trust the first.
 *
 * Every function here returns the raw bytes it received alongside the parsed
 * value. The report attaches raw responses, so nothing may be discarded on the
 * way through - a summary the harness produced but cannot show you is exactly
 * the sort of unfalsifiable claim this track is built to punish.
 */

/** Wall-clock milliseconds around one awaited call. */
export async function timed(fn) {
  const started = performance.now();
  let value = null;
  let error = null;
  try {
    value = await fn();
  } catch (cause) {
    error = cause instanceof Error ? cause.message : String(cause);
  }
  return { ms: Math.round((performance.now() - started) * 10) / 10, value, error };
}

/**
 * One JSON-RPC call to a Streamable-HTTP MCP server.
 *
 * Both content types seen in the wild are handled. api.openodds.ai answers
 * `application/json`; clawdmint-api.vercel.app answers `text/event-stream`
 * with the same JSON-RPC envelope inside a single `data:` frame. Sending
 * `Accept: application/json, text/event-stream` and sniffing the body is what
 * lets one client talk to both without a per-server switch.
 */
export async function mcpCall(url, method, params, timeoutMs = 60_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: controller.signal,
    });
    const raw = await res.text();
    return { status: res.status, raw, envelope: parseRpc(raw) };
  } finally {
    clearTimeout(timer);
  }
}

function parseRpc(raw) {
  const body = raw.startsWith('event:') || raw.includes('\ndata: ')
    ? raw.split(/\r?\n/).filter((l) => l.startsWith('data: ')).map((l) => l.slice(6)).join('')
    : raw;
  if (!body.trim()) return null;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

/**
 * MCP tool results arrive as `content: [{ type: 'text', text: '<json>' }]`.
 * The text is a JSON document in every server measured here, but that is a
 * convention rather than a guarantee, so a non-JSON body is returned as the
 * string it is instead of being coerced into a shape it does not have.
 */
export function toolPayload(envelope) {
  const text = envelope?.result?.content?.[0]?.text;
  if (typeof text !== 'string') return envelope?.result ?? envelope ?? null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Plain HTTP GET, used by every manual leg. */
export async function httpGet(url, timeoutMs = 30_000, headers = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { accept: 'application/json', ...headers }, signal: controller.signal });
    const raw = await res.text();
    let json = null;
    try {
      json = JSON.parse(raw);
    } catch {
      /* HTML and error pages are kept as text on purpose. */
    }
    return { status: res.status, raw, json };
  } finally {
    clearTimeout(timer);
  }
}

/** One JSON-RPC call to an EVM node. */
export async function evmRpc(url, method, params, timeoutMs = 30_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: controller.signal,
    });
    const raw = await res.text();
    let json = null;
    try {
      json = JSON.parse(raw);
    } catch {
      /* keep the raw body */
    }
    return { status: res.status, raw, json, result: json?.result ?? null, rpcError: json?.error ?? null };
  } finally {
    clearTimeout(timer);
  }
}

/** Median of a numeric sample set, to one decimal place. */
export function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  const m = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return Math.round(m * 10) / 10;
}
