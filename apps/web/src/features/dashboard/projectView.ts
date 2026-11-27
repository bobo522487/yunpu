import type { ProjectStatus } from './api';

export function surnameOf(
  project: { surname?: string | null } | undefined,
): string {
  return project?.surname?.trim() ?? '';
}

export function statusLabel(status: ProjectStatus): string {
  switch (status) {
    case 'planning':
      return '筹备中';
    case 'in_progress':
      return '进行中';
    case 'completed':
      return '已完成';
    default:
      return status;
  }
}

export function formatProjectUpdatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleDateString();
}