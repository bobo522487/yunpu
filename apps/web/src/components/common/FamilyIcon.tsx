import { useState } from 'react';
import { cn } from '@/lib/utils';

export type FamilyIconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export type FamilyIconProject = {
  id?: string | null;
  name?: string | null;
  surname?: string | null;
  iconKey?: string | null;
};

type FamilyIconProps = {
  project?: FamilyIconProject | null;
  size?: FamilyIconSize;
  className?: string;
};

const SIZE_CLASSES: Record<
  FamilyIconSize,
  { box: string; inset: string; text: string }
> = {
  xs: {
    box: 'h-[18px] w-[18px] rounded-[5px]',
    inset: 'inset-[1.5px] rounded-[3.5px]',
    text: 'text-[10px]',
  },
  sm: {
    box: 'h-[22px] w-[22px] rounded-[6px]',
    inset: 'inset-[1.5px] rounded-[4.5px]',
    text: 'text-[11px]',
  },
  md: {
    box: 'h-[34px] w-[34px] rounded-[9px]',
    inset: 'inset-[2.5px] rounded-[6.5px]',
    text: 'text-[16px]',
  },
  lg: {
    box: 'h-12 w-12 rounded-xl',
    inset: 'inset-[3px] rounded-[9px]',
    text: 'text-[22px]',
  },
  xl: {
    box: 'h-14 w-14 rounded-[14px]',
    inset: 'inset-[3.5px] rounded-[10.5px]',
    text: 'text-[26px]',
  },
};

export function resolveFamilySealChar(
  project?: Pick<FamilyIconProject, 'surname' | 'name'> | null,
): string {
  const candidate = project?.surname?.trim() || project?.name?.trim() || '';
  return Array.from(candidate)[0] || '谱';
}

export function resolveFamilyIconUrl(
  projectId?: string | null,
  iconKey?: string | null,
): string | null {
  const trimmedKey = iconKey?.trim();
  if (!trimmedKey) return null;
  if (
    trimmedKey.startsWith('/api/') ||
    trimmedKey.startsWith('blob:') ||
    trimmedKey.startsWith('data:')
  ) {
    return trimmedKey;
  }
  const trimmedProjectId = projectId?.trim();
  if (!trimmedProjectId) return null;
  return `/api/v1/projects/${trimmedProjectId}/media/${encodeURIComponent(trimmedKey)}`;
}

export function FamilyIcon({
  project,
  size = 'md',
  className,
}: FamilyIconProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const styles = SIZE_CLASSES[size];
  const iconUrl = resolveFamilyIconUrl(project?.id, project?.iconKey);
  const showImage = Boolean(iconUrl && failedUrl !== iconUrl);

  if (showImage && iconUrl) {
    return (
      <span
        data-testid="family-icon"
        data-icon-kind="image"
        className={cn(
          'relative inline-flex shrink-0 items-center justify-center overflow-hidden bg-muted select-none',
          styles.box,
          className,
        )}
      >
        <img
          src={iconUrl}
          alt={project?.name ? `${project.name}图标` : '家族图标'}
          onError={() => setFailedUrl(iconUrl)}
          className="h-full w-full object-cover"
        />
      </span>
    );
  }

  const sealChar = resolveFamilySealChar(project);

  return (
    <span
      data-testid="family-icon"
      data-icon-kind="seal"
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden bg-primary text-primary-foreground select-none',
        styles.box,
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute border border-primary-foreground/28',
          styles.inset,
        )}
      />
      <span
        className={cn(
          'relative font-serif font-bold leading-none text-primary-foreground',
          styles.text,
        )}
      >
        {sealChar}
      </span>
    </span>
  );
}
