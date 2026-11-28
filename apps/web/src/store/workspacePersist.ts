export function migrateWorkspaceState(persisted: unknown, version: number): unknown {
  const state = (persisted ?? {}) as Record<string, unknown>;
  const zibeiByProject =
    state.zibeiByProject && typeof state.zibeiByProject === 'object'
      ? (state.zibeiByProject as Record<string, string[]>)
      : {};

  if (version < 2) {
    return {
      activeProjectId: '',
      zibeiByProject,
    };
  }

  if (version < 3) {
    return {
      activeProjectId:
        typeof state.activeProjectId === 'string' ? state.activeProjectId : '',
      zibeiByProject,
    };
  }

  return {
    activeProjectId:
      typeof state.activeProjectId === 'string' ? state.activeProjectId : '',
    zibeiByProject,
  };
}