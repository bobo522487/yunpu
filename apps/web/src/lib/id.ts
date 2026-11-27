let idSeq = 0;

/** Generate collision-free client entity IDs across rapid/batch mutations. */
export function createEntityId(prefix: string): string {
  idSeq = (idSeq + 1) % 1_000_000;
  const rand = Math.random().toString(36).slice(2, 6);
  return `${prefix}-${Date.now()}-${idSeq.toString(36)}-${rand}`;
}
