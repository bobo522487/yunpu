import { useMemo } from 'react';
import type { ProjectArticleSeedContext } from '../features/articles/types';
import { surnameOf } from '../features/dashboard/projectView';
import { parsePlaceText } from '../features/place-input';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { useProjectId } from './useProjectId';

export function useActiveProject() {
  const projectId = useProjectId();
  const projects = useWorkspaceStore((s) => s.projects);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  const project = useMemo(
    () =>
      projects.find((p) => p.id === projectId) ||
      projects.find((p) => p.organizationId === activeWorkspaceId) ||
      projects[0],
    [projects, projectId, activeWorkspaceId],
  );

  const surname = surnameOf(project);

  const articleSeedContext = useMemo<ProjectArticleSeedContext>(
    () => ({
      familyName: project?.name,
      surname: surname || undefined,
      hallName: project?.hallName ?? undefined,
      ancestor: project?.ancestor ?? undefined,
      region: parsePlaceText(project?.originText ?? undefined),
    }),
    [
      project?.name,
      surname,
      project?.hallName,
      project?.ancestor,
      project?.originText,
    ],
  );

  return {
    projectId,
    project,
    surname,
    articleSeedContext,
  };
}
