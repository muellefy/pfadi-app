const MAX_ENTRIES = 2000;
type Entry = { at: number; value: Promise<unknown>; ok: boolean; refreshing: boolean };
const store = new Map<string, Entry>();

/**
 * Keeps the result of `fn` for `ttlMs`; calls that arrive while it runs share it.
 * Failures are dropped so the next call retries.
 *
 * With `staleMs`, an expired result is still served for that long while a fresh one
 * loads in the background (stale-while-revalidate), so nobody waits for the refresh.
 * If the refresh fails, the old result is dropped: the next call waits and sees the error.
 *
 * shortcut: in-process, oldest-first eviction — fine for one container with a few camps.
 */
export function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>, staleMs = 0): Promise<T> {
  const hit = store.get(key);
  const age = hit ? Date.now() - hit.at : Infinity;
  if (hit && age < ttlMs) return hit.value as Promise<T>;
  if (hit && hit.ok && age < ttlMs + staleMs) {
    if (!hit.refreshing) {
      hit.refreshing = true;
      const next = fn();
      next.then(
        () => { if (store.get(key) === hit) put(key, next, true); },
        () => { if (store.get(key) === hit) store.delete(key); },
      );
    }
    return hit.value as Promise<T>;
  }
  const value = fn();
  put(key, value, false);
  value.then(
    () => { const e = store.get(key); if (e?.value === value) e.ok = true; },
    () => { if (store.get(key)?.value === value) store.delete(key); },
  );
  return value;
}

function put(key: string, value: Promise<unknown>, ok: boolean) {
  store.delete(key);
  store.set(key, { at: Date.now(), value, ok, refreshing: false });
  if (store.size > MAX_ENTRIES) store.delete(store.keys().next().value!);
}

/** Drops every entry whose key matches, e.g. after the app itself changed a file. */
export function forget(match: (key: string) => boolean) {
  for (const key of [...store.keys()]) if (match(key)) store.delete(key);
}
