import type { CreateProjectPayload, ProjectStatus } from './api';

export function toCreateProjectPayload(values: {
  name: string;
  description: string;
  colorTheme: CreateProjectPayload['colorTheme'];
  status: ProjectStatus;
  surname?: string;
  ancestor?: string;
  hallName?: string;
  originText?: string;
  projectLevel?: number;
}): CreateProjectPayload {
  return {
    name: values.name.trim(),
    status: values.status,
    surname: values.surname?.trim() || undefined,
    ancestor: values.ancestor?.trim() || undefined,
    hallName: values.hallName?.trim() || undefined,
    originText: values.originText?.trim() || undefined,
    description: values.description.trim() || undefined,
    colorTheme: values.colorTheme,
    projectLevel: values.projectLevel ?? 1,
  };
}