export function sanitizeRedirectPath(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return undefined;
  return trimmed;
}

export function parseInviteSearch(search: Record<string, unknown>): {
  invite?: string;
} {
  const raw = search.invite;
  if (typeof raw === 'string' && raw.trim()) {
    return { invite: raw.trim() };
  }
  return {};
}
