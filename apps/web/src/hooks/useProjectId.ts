import { useParams } from '@tanstack/react-router';
import { useWorkspaceStore } from '../store/useWorkspaceStore';

/**
 * Resolve the active project ID from route params first, falling back to
 * workspace store selection or the first available project.
 */
export function useProjectId(): string {
  const params = useParams({ strict: false }) as { projectId?: string };
  const activeProjectId = useWorkspaceStore((s) => s.activeProjectId);
  const firstProjectId = useWorkspaceStore((s) => s.projects[0]?.id ?? '');
  return params.projectId || activeProjectId || firstProjectId;
}
