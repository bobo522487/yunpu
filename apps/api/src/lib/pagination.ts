import { validationError } from "./errors";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;

export function parseTimestampUuidCursor(raw: string): {
  timestamp: string;
  id: string;
} {
  const parts = raw.split("|");
  const timestamp = parts[0];
  const id = parts[1];
  if (
    parts.length !== 2 ||
    !timestamp ||
    !id ||
    !ISO_TIMESTAMP_PATTERN.test(timestamp) ||
    Number.isNaN(Date.parse(timestamp)) ||
    !UUID_PATTERN.test(id)
  ) {
    throw validationError({ cursor: "游标格式不合法" });
  }
  return { timestamp, id };
}

export function parseUuidCursor(raw: string): string {
  if (!UUID_PATTERN.test(raw)) {
    throw validationError({ cursor: "游标格式不合法" });
  }
  return raw;
}

export function sliceCursorPage<T>(
  rows: T[],
  limit: number,
  cursorOf: (last: T) => string,
): { items: T[]; nextCursor: string | null } {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: hasMore && last ? cursorOf(last) : null,
  };
}
