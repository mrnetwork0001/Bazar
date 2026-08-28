/**
 * In-memory job-intent store for the A2A router.
 *
 * Intents created through POST /api/v1/a2a/hire live in a module-level Map that
 * is attached to `globalThis` so it survives Next.js dev-server module reloads.
 *
 * What this store is NOT: a record of anything that happened on chain. Bazar
 * does not run an ERC-8183 log listener, so a stored intent stays
 * `unsigned_intent` forever - even after the client has funded and settled the
 * job. It exists so a caller can re-read the exact calldata Bazar handed back.
 * It is deliberately not seeded with example rows: every entry here is a real
 * intent this process generated.
 */
import type { A2AJobIntent } from './schema';

type IntentStore = Map<string, A2AJobIntent>;

const STORE_KEY = '__bazarA2AIntentStore__';
/** Bounded so a long-lived process cannot grow without limit. */
const MAX_ENTRIES = 500;

function store(): IntentStore {
  const g = globalThis as unknown as Record<string, IntentStore | undefined>;
  if (!g[STORE_KEY]) g[STORE_KEY] = new Map<string, A2AJobIntent>();
  return g[STORE_KEY] as IntentStore;
}

export function saveIntent(intent: A2AJobIntent): A2AJobIntent {
  const s = store();
  // Re-inserting moves the key to the end, so the oldest entry is evicted first.
  s.delete(intent.id);
  s.set(intent.id, intent);
  while (s.size > MAX_ENTRIES) {
    const oldest = s.keys().next();
    if (oldest.done) break;
    s.delete(oldest.value);
  }
  return intent;
}

export function getIntent(id: string): A2AJobIntent | undefined {
  return store().get(id);
}

/** Intents created in this process, newest first. */
export function listIntents(): A2AJobIntent[] {
  return Array.from(store().values()).reverse();
}

export function countIntents(): number {
  return store().size;
}
