export function applyArticleVersionCas(
  current: { version: number } | null,
  expectedVersion: number,
): { ok: true; nextVersion: number } | { ok: false; serverVersion: number } {
  if (!current) return { ok: false, serverVersion: 0 };
  if (current.version !== expectedVersion) return { ok: false, serverVersion: current.version };
  return { ok: true, nextVersion: current.version + 1 };
}