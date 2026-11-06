const MAX_ENTRIES = 100;
const store = new Map<string, { until: number; value: Promise<unknown> }>();

/**
 * Keeps the result of `fn` for `ttlMs`; calls that arrive while it runs share it.
 * Failures are dropped so the next call retries.
 * shortcut: in-process, oldest-first eviction — fine for one container with a few camps.
 */
export function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.until > Date.now()) return hit.value as Promise<T>;
  const value = fn();
  store.delete(key);
  store.set(key, { until: Date.now() + ttlMs, value });
  value.catch(() => { if (store.get(key)?.value === value) store.delete(key); });
  if (store.size > MAX_ENTRIES) store.delete(store.keys().next().value!);
  return value;
}
