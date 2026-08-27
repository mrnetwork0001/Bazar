/**
 * In-memory hire store for the A2A router.
 *
 * Hires created through POST /api/v1/a2a/hire live in a module-level Map that
 * is merged with the seeded `HIRES` for lookups. The Map is attached to
 * `globalThis` so it survives Next.js dev-server module reloads. This is a demo
 * store; the production router persists hires keyed by the on-chain hireId.
 */
import type { Hire } from '@/lib/types';
import { HIRES } from '@/lib/data/hires';

type HireStore = Map<string, Hire>;

const STORE_KEY = '__bazarA2AHireStore__';

function store(): HireStore {
  const g = globalThis as unknown as Record<string, HireStore | undefined>;
  if (!g[STORE_KEY]) g[STORE_KEY] = new Map<string, Hire>();
  return g[STORE_KEY] as HireStore;
}

export function saveHire(hire: Hire): Hire {
  store().set(hire.id, hire);
  return hire;
}

/** Looks up a hire created via the API first, then the seeded demo hires. */
export function getHire(id: string): Hire | undefined {
  return store().get(id) ?? HIRES.find((h) => h.id === id);
}

/** API-created hires (newest first) followed by the seeded demo hires. */
export function listHires(): Hire[] {
  const created = Array.from(store().values()).reverse();
  const createdIds = new Set(created.map((h) => h.id));
  return [...created, ...HIRES.filter((h) => !createdIds.has(h.id))];
}

export function countCreatedHires(): number {
  return store().size;
}
