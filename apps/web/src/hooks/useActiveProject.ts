import { useMemo } from 'react';
import type { ProjectArticleSeedContext } from '../features/articles/types';
import { useProjectQuery } from '../features/dashboard/queries';
import { surnameOf } from '../features/dashboard/projectView';
import { parsePlaceText } from '../features/place-input';
import { useProjectId } from './useProjectId';

export function useActiveProject() {
  const projectId = useProjectId();
  const projectQuery = useProjectQuery(projectId);
  const project = projectQuery.data;

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
