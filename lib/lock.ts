const tails = new Map<string, Promise<unknown>>();

/**
 * Runs `fn` only after every earlier call with the same key has finished.
 * shortcut: in-process only — correct while the app runs as one container.
 */
export function serialize<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = tails.get(key) ?? Promise.resolve();
  const run = prev.catch(() => {}).then(fn);
  const tail = run.catch(() => {});
  tails.set(key, tail);
  tail.then(() => { if (tails.get(key) === tail) tails.delete(key); });
  return run;
}
