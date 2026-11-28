import { useParams } from '@tanstack/react-router';
import { useWorkspaceStore } from '../store/useWorkspaceStore';

/**
 * Resolve the active project ID from route params first, falling back to
 * workspace store selection or the first available project.
 */
export function useProjectId(): string {
  const params = useParams({ strict: false }) as { projectId?: string };
  const activeProjectId = useWorkspaceStore((s) => s.activeProjectId);
  return params.projectId || activeProjectId;
}
