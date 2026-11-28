export type LineageGender = 'male' | 'female' | 'unknown';

export interface MiniMapNodeLike {
  id: string;
  type?: string;
  data?: {
    person?: {
      generation?: number;
    };
  };
}

const TOP_STRIPE_CLASSES: Record<LineageGender, string> = {
  female: 'border-t-lineage-female',
  unknown: 'border-t-lineage-unknown',
  male: 'border-t-lineage-male',
};

const GENDER_BAR_CLASSES: Record<LineageGender, string> = {
  female: 'bg-lineage-female',
  unknown: 'bg-lineage-unknown',
  male: 'bg-lineage-male',
};

const AVATAR_TONE_CLASSES: Record<LineageGender, string> = {
  female:
    'bg-lineage-female/12 text-lineage-female-fg border-lineage-female/25 dark:bg-lineage-female/15 dark:border-lineage-female/30',
  unknown:
    'bg-lineage-unknown/16 text-lineage-unknown-fg border-lineage-unknown/30 dark:bg-lineage-unknown/22 dark:border-lineage-unknown/35',
  male: 'bg-lineage-male/12 text-lineage-male-fg border-lineage-male/25 dark:bg-lineage-male/15 dark:border-lineage-male/30',
};

const FOCUS_BG_CLASSES: Record<LineageGender, string> = {
  female: 'bg-lineage-female/10 dark:bg-lineage-female/18',
  unknown: 'bg-lineage-unknown/14 dark:bg-lineage-unknown/22',
  male: 'bg-lineage-male/10 dark:bg-lineage-male/18',
};

const CARD_SURFACE_CLASSES: Record<LineageGender, string> = {
  female:
    'border-lineage-female/25 bg-lineage-female/[0.06] dark:bg-lineage-female/[0.09]',
  male: 'border-lineage-male/25 bg-lineage-male/[0.06] dark:bg-lineage-male/[0.09]',
  unknown: 'border-border bg-[var(--surface-subtle)]',
};

/** Returns the top border accent utility class for a PersonNode card by gender. */
export function getGenderTopStripeClass(gender: LineageGender): string {
  return TOP_STRIPE_CLASSES[gender] ?? TOP_STRIPE_CLASSES.unknown;
}

/** Returns the vertical bar fill utility class for a Person row by gender. */
export function getGenderBarClass(gender: LineageGender): string {
  return GENDER_BAR_CLASSES[gender] ?? GENDER_BAR_CLASSES.unknown;
}

/** Returns the fallback avatar badge utility classes for a Person by gender. */
export function getGenderAvatarToneClass(gender: LineageGender): string {
  return AVATAR_TONE_CLASSES[gender] ?? AVATAR_TONE_CLASSES.unknown;
}

/** Returns the highlighted row background utility classes for the focused Person. */
export function getGenderFocusBgClass(gender: LineageGender): string {
  return FOCUS_BG_CLASSES[gender] ?? FOCUS_BG_CLASSES.unknown;
}

/** Returns the soft card container border and background classes for a Person card in modals. */
export function getGenderCardSurfaceClass(gender: LineageGender): string {
  return CARD_SURFACE_CLASSES[gender] ?? CARD_SURFACE_CLASSES.unknown;
}

/** Resolves MiniMap node fill using CSS preset tokens so system theme stays in sync. */
export function resolveMiniMapNodeColor(
  node: MiniMapNodeLike,
  selectedPersonId?: string | null
): string {
  if (node.type === 'union') return 'var(--lineage-edge)';
  if (selectedPersonId && node.id === selectedPersonId) {
    return 'var(--primary)';
  }
  const generation = node.data?.person?.generation || 1;
  if (generation === 1) return 'var(--lineage-progenitor-bg)';
  return 'var(--lineage-minimap-node)';
}
