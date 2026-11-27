export interface MediaObjectSummary {
  key: string;
  lastModified?: Date;
  size?: number;
}

export interface MediaGcOptions {
  prefix?: string;
  gracePeriodMs: number;
  now?: Date;
  dryRun: boolean;
  listObjects: (prefix: string) => Promise<MediaObjectSummary[]>;
  listReferencedKeys: () => Promise<Set<string>>;
  deleteObjects: (keys: string[]) => Promise<string[]>;
}

export interface MediaGcReport {
  prefix: string;
  dryRun: boolean;
  gracePeriodMs: number;
  scannedCount: number;
  referencedCount: number;
  activeCount: number;
  withinGraceCount: number;
  orphanCandidateKeys: string[];
  deletedKeys: string[];
}

const PROJECT_MEDIA_URL_RE = /^\/api\/v1\/projects\/([^/]+)\/media\/([^/?#]+)$/;

/**
 * Normalize a DB `person.avatar_key` value into its canonical S3 object key.
 */
export function toProjectMediaObjectKey(
  projectId: string,
  avatarKey: string,
): string | null {
  const trimmed = avatarKey.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.startsWith("projects/")) return trimmed;

  const urlMatch = PROJECT_MEDIA_URL_RE.exec(trimmed);
  if (urlMatch?.[1] && urlMatch[2]) {
    try {
      return `projects/${urlMatch[1]}/${decodeURIComponent(urlMatch[2])}`;
    } catch {
      return `projects/${urlMatch[1]}/${urlMatch[2]}`;
    }
  }

  return `projects/${projectId}/${trimmed}`;
}

/**
 * Reconcile S3 objects under `projects/` against live DB references and delete
 * only unreferenced objects older than the configured grace period.
 */
export async function runMediaReconciliationGc(
  options: MediaGcOptions,
): Promise<MediaGcReport> {
  const prefix = options.prefix ?? "projects/";
  if (!prefix.startsWith("projects/")) {
    throw new Error(
      `media GC prefix must stay within "projects/": got "${prefix}"`,
    );
  }
  if (!Number.isFinite(options.gracePeriodMs) || options.gracePeriodMs < 0) {
    throw new Error(
      `media GC gracePeriodMs must be a non-negative finite number: got ${options.gracePeriodMs}`,
    );
  }

  const nowMs = (options.now ?? new Date()).getTime();
  // List S3 before querying DB so objects uploaded concurrently during the run
  // are either outside the snapshot or protected by the grace period.
  const objects = await options.listObjects(prefix);
  const referencedKeys = await options.listReferencedKeys();

  let activeCount = 0;
  let withinGraceCount = 0;
  const orphanCandidateKeys: string[] = [];

  for (const obj of objects) {
    if (referencedKeys.has(obj.key)) {
      activeCount += 1;
      continue;
    }
    if (!obj.lastModified) {
      withinGraceCount += 1;
      continue;
    }
    const ageMs = nowMs - obj.lastModified.getTime();
    if (ageMs < options.gracePeriodMs) {
      withinGraceCount += 1;
      continue;
    }
    orphanCandidateKeys.push(obj.key);
  }

  const deletedKeys =
    !options.dryRun && orphanCandidateKeys.length > 0
      ? await options.deleteObjects(orphanCandidateKeys)
      : [];

  return {
    prefix,
    dryRun: options.dryRun,
    gracePeriodMs: options.gracePeriodMs,
    scannedCount: objects.length,
    referencedCount: referencedKeys.size,
    activeCount,
    withinGraceCount,
    orphanCandidateKeys,
    deletedKeys,
  };
}
