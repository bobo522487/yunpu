/**
 * Pure hydration-gate predicate for async-persisted stores (IndexedDB).
 * Prevents cold-start seed initialization from overwriting existing persisted records
 * before Zustand finish rehydrating from IndexedDB.
 */
export function shouldInitializeProjectSeed(params: {
  hasHydrated: boolean;
  projectId: string | undefined | null;
  existingEntry: unknown;
}): boolean {
  if (!params.hasHydrated) return false;
  if (!params.projectId) return false;
  return params.existingEntry === undefined;
}
