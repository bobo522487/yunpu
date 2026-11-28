import type { ProjectColorTheme, ProjectStatus } from './api';

export const ASSET_COLOR_PALETTES: Record<
  ProjectColorTheme,
  { tileBg: string; darkTileBg: string; fillDark: string; fillLight: string; label: string }
> = {
  sky: {
    tileBg: '#EAF4F7',
    darkTileBg: 'rgba(88, 177, 205, 0.16)',
    fillDark: '#057091',
    fillLight: '#3E9EB8',
    label: '青蓝',
  },
  pink: {
    tileBg: '#F6EAE8',
    darkTileBg: 'rgba(176, 86, 75, 0.16)',
    fillDark: '#7B281E',
    fillLight: '#C05A4C',
    label: '朱砂',
  },
  orange: {
    tileBg: '#F7EFE2',
    darkTileBg: 'rgba(181, 125, 58, 0.16)',
    fillDark: '#734A1A',
    fillLight: '#B8823D',
    label: '琥珀',
  },
  indigo: {
    tileBg: '#EAEDF5',
    darkTileBg: 'rgba(79, 102, 155, 0.18)',
    fillDark: '#2A3B66',
    fillLight: '#5770A8',
    label: '靛蓝',
  },
  emerald: {
    tileBg: '#E9F2EC',
    darkTileBg: 'rgba(69, 128, 96, 0.16)',
    fillDark: '#234D38',
    fillLight: '#4D8B6B',
    label: '竹青',
  },
  violet: {
    tileBg: '#EFEBE7',
    darkTileBg: 'rgba(130, 107, 94, 0.18)',
    fillDark: '#4D3B32',
    fillLight: '#8B7263',
    label: '紫檀',
  },
};

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