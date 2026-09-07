#!/usr/bin/env node
/**
 * What the paid agents charge - discovered, not guessed.
 *
 *   node scripts/advantage/price-discovery.mjs
 *
 * Every task in REPORT.md was executed against an agent that answers for free,
 * because Bazar holds no keys and this harness will not sign a payment on a
 * user's behalf. That leaves a hole in the cost column: it would be easy to
 * conclude from the report alone that agent services are simply free. They are
 * not, and two of the agents indexed on BNB Smart Chain publish their prices
 * in-band, in a machine-readable form, without being paid anything.
 *
 * This script reads those published prices and writes them to
 * docs/agent-advantage/outputs/price-discovery.json. It does not pay anyone
 * and it does not execute a paid task. Nothing here is an estimate: an x402
 * `payment-required` header is the agent's own quote, and the SmartSentinels
 * price comes from that agent's own free info tool.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { mcpCall, toolPayload } from './transport.mjs';

const OUTPUTS = path.resolve(import.meta.dirname, '..', '..', 'docs', 'agent-advantage', 'outputs');

/**
 * An x402 challenge. The quote travels base64 in the `payment-required`
 * header, so a caller learns the price by being refused once.
 */
async function x402Quote(label, tokenId, url) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
  });
  const header = res.headers.get('payment-required');
  let quote = null;
  if (header) {
    try {
      quote = JSON.parse(Buffer.from(header, 'base64').toString('utf8'));
    } catch {
      quote = null;
    }
  }
  const accept = quote?.accepts?.[0] ?? null;
  return {
    agent: label,
    tokenId,
    endpoint: url,
    status: res.status,
    scheme: 'x402',
    network: accept?.network ?? null,
    asset: accept?.asset ?? null,
    /* x402 amounts are in the asset's smallest unit. USDC carries 6 decimals. */
    amountRaw: accept?.amount ?? null,
    amountHuman: accept?.amount ? `${Number(accept.amount) / 1e6} USDC` : null,
    payTo: accept?.payTo ?? null,
    quote,
    executed: false,
    whyNot: 'Bazar holds no keys. Paying would require signing from a funded wallet, which this harness will not do.',
  };
}

/** SmartSentinels prices its audit through a free MCP tool rather than a header. */
async function sentinelsQuote() {
  const url = 'https://smartsentinels.net/api/audit-mcp';
  const list = await mcpCall(url, 'tools/list', {});
  const tools = list.envelope?.result?.tools ?? [];
  /*
   * Match on the leading "Paid (...)" price tag, not a bare /paid/: the free
   * info tool's own description mentions "a paid ... call" and would otherwise
   * be picked up as the priced one.
   */
  const paid = tools.find((t) => /^Paid \(/.test(t.description ?? ''));
  const info = await mcpCall(url, 'tools/call', { name: 'sentinels_ai_audit_info', arguments: {} });
  return {
    agent: 'Sentinels Audit',
    tokenId: '258641',
    endpoint: url,
    status: list.status,
    scheme: 'native BNB transfer, tx hash redeemed once',
    network: 'eip155:56',
    asset: 'BNB',
    amountRaw: null,
    amountHuman: paid ? (paid.description.match(/Paid \(([^)]+)\)/)?.[1] ?? null) : null,
    payTo: paid?.inputSchema?.properties?.paymentTxHash?.description?.match(/0x[0-9a-fA-F]{40}/)?.[0] ?? null,
    quote: toolPayload(info.envelope),
    executed: false,
    whyNot: 'The audit costs 0.2 BNB. No such payment was made, so no audit was run and none is reported.',
  };
}

async function main() {
  await mkdir(OUTPUTS, { recursive: true });
  const rows = [
    await x402Quote('Cast Transaction Agent', '44942', 'https://aliasai.io/cast/'),
    await x402Quote('Agentscan Agent', '51945', 'https://aliasai.io/agentscan/'),
    await sentinelsQuote(),
  ];
  const doc = {
    generatedAt: new Date().toISOString(),
    note: 'Published prices, read from the agents themselves. Nothing here was paid for and no paid task was executed.',
    agents: rows,
  };
  await writeFile(path.join(OUTPUTS, 'price-discovery.json'), `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  for (const r of rows) {
    process.stdout.write(`${r.agent.padEnd(24)} ${String(r.status).padEnd(4)} ${r.amountHuman ?? 'no quote'} on ${r.network ?? '?'}\n`);
  }
}

main().catch((cause) => {
  console.error(cause);
  process.exit(1);
});
