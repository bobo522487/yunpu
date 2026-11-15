/**
 * Strip clan surname from person names to match traditional Chinese genealogy conventions
 * e.g., "陈元英" -> "元英", "刘邦" -> "邦", "元英" -> "元英"
 */
export function stripSurname(name?: string, clanSurname: string = ''): string {
  if (!name) return '';
  const trimmed = name.trim();

  if (clanSurname && trimmed.startsWith(clanSurname) && trimmed.length > clanSurname.length) {
    return trimmed.slice(clanSurname.length);
  }

  return trimmed;
}

export function formatGivenName(name?: string, clanSurname: string = ''): string {
  return stripSurname(name, clanSurname);
}
