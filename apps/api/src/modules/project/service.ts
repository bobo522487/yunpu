import { requireMember, requireProjectMember } from "../../access";
import {
  type TxDatabase,
  withTenantTransaction,
} from "../../db/with-tenant-transaction";
import {
  AppError,
  notFound,
  validationError,
  versionConflict,
} from "../../lib/errors";
import { createLineageInTx } from "../lineage/service";
import {
  type CreateProjectValues,
  casUpdateProject,
  deleteProject,
  getProject,
  insertProject,
  isOrganizationArchived,
  listProjects,
  type ProjectRecord,
  type UpdateProjectValues,
} from "./queries";

export async function createProjectInTx(
  db: TxDatabase,
  organizationId: string,
  values: CreateProjectValues,
  options?: { skipStarterLineage?: boolean },
): Promise<ProjectRecord> {
  const created = await insertProject(db, organizationId, values);
  const ancestorName = values.ancestor?.trim();
  if (!options?.skipStarterLineage && ancestorName) {
    await createLineageInTx(db, organizationId, created.id, {
      name: `${values.name}主世系`,
      surname: values.surname,
      hallName: values.hallName,
      progenitor: ancestorName,
      seq: 0,
    });
  }
  return created;
}

export async function listProjectsForOrg(
  userId: string,
  organizationId: string,
  options: { cursor?: string; limit?: number },
): Promise<{ items: ProjectRecord[]; nextCursor: string | null }> {
  return withTenantTransaction({ userId, readOnly: true }, async (db) => {
    await requireMember(db, organizationId, userId, null);
    return listProjects(db, organizationId, {
      cursor: options.cursor,
      limit: options.limit ?? 50,
    });
  });
}

export async function createProject(
  userId: string,
  organizationId: string,
  values: CreateProjectValues,
): Promise<ProjectRecord> {
  return withTenantTransaction({ userId }, async (db) => {
    await requireMember(db, organizationId, userId, "editor");
    return createProjectInTx(db, organizationId, values);
  });
}

export const SUPPORTED_IMAGE_MIME_TO_EXT = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
} as const;

export type SupportedImageExt =
  (typeof SUPPORTED_IMAGE_MIME_TO_EXT)[keyof typeof SUPPORTED_IMAGE_MIME_TO_EXT];

const EXT_TO_IMAGE_CONTENT_TYPE: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const GIF87A_MAGIC = [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] as const;
const GIF89A_MAGIC = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] as const;
const RIFF_MAGIC = [0x52, 0x49, 0x46, 0x46] as const;
const WEBP_MAGIC = [0x57, 0x45, 0x42, 0x50] as const;

function matchesBytesAt(
  bytes: Uint8Array,
  offset: number,
  expected: readonly number[],
): boolean {
  if (bytes.length < offset + expected.length) return false;
  for (let i = 0; i < expected.length; i += 1) {
    if (bytes[offset + i] !== expected[i]) return false;
  }
  return true;
}

/**
 * Inspect leading magic bytes to identify real PNG/JPEG/WEBP/GIF payloads.
 * Returns null for unrecognized or truncated payloads.
 */
export function detectImageExtension(
  bytes: Uint8Array,
): SupportedImageExt | null {
  if (matchesBytesAt(bytes, 0, PNG_MAGIC)) {
    return "png";
  }
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "jpg";
  }
  if (
    matchesBytesAt(bytes, 0, GIF87A_MAGIC) ||
    matchesBytesAt(bytes, 0, GIF89A_MAGIC)
  ) {
    return "gif";
  }
  if (
    bytes.length >= 12 &&
    matchesBytesAt(bytes, 0, RIFF_MAGIC) &&
    matchesBytesAt(bytes, 8, WEBP_MAGIC)
  ) {
    return "webp";
  }
  return null;
}

export function resolveDeclaredImageType(rawContentType: string | undefined): {
  ext: SupportedImageExt;
  contentType: string;
} {
  const mime = (rawContentType ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  const ext =
    SUPPORTED_IMAGE_MIME_TO_EXT[
      mime as keyof typeof SUPPORTED_IMAGE_MIME_TO_EXT
    ];
  if (!ext) {
    throw validationError({
      contentType: "仅支持 PNG、JPEG、WEBP 或 GIF 图片",
    });
  }
  return { ext, contentType: mime };
}

export function assertValidImageMagicBytes(
  body: Uint8Array,
  expectedExt: SupportedImageExt,
): SupportedImageExt {
  const detected = detectImageExtension(body);
  if (!detected) {
    throw validationError({
      body: "文件内容不是有效的 PNG、JPEG、WEBP 或 GIF 图片",
    });
  }
  if (detected !== expectedExt) {
    throw validationError({
      body: "图片文件头签名与 Content-Type 不匹配",
    });
  }
  return detected;
}

export function buildMediaResponseHeaders(
  fileName: string,
): Record<string, string> {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const contentType =
    EXT_TO_IMAGE_CONTENT_TYPE[ext] ?? "application/octet-stream";
  return {
    "content-type": contentType,
    "cache-control": "private, max-age=31536000, immutable",
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'none'; sandbox",
    "content-disposition": `inline; filename="${fileName}"`,
  };
}

export async function assertProjectMediaAccess(
  userId: string,
  projectId: string,
  mode: "read" | "write",
): Promise<{ organizationId: string }> {
  return withTenantTransaction({ userId, readOnly: true }, async (db) => {
    const { organizationId } = await requireProjectMember(
      db,
      projectId,
      userId,
      mode === "write" ? "editor" : null,
    );
    if (
      mode === "write" &&
      (await isOrganizationArchived(db, organizationId))
    ) {
      throw new AppError("CONFLICT", "组织已归档，无法写入", 409, {
        sqlstate: "GX012",
      });
    }
    return { organizationId };
  });
}

export async function getProjectById(
  userId: string,
  projectId: string,
): Promise<ProjectRecord> {
  return withTenantTransaction({ userId, readOnly: true }, async (db) => {
    const existing = await getProject(db, projectId);
    // RLS 已把非本组织的行过滤掉；成员即可读（C3：project.read 全角色）。
    if (!existing) throw notFound();
    return existing;
  });
}

export async function updateProject(
  userId: string,
  projectId: string,
  expectedVersion: number,
  values: UpdateProjectValues,
): Promise<ProjectRecord> {
  return withTenantTransaction({ userId }, async (db) => {
    const { organizationId } = await requireProjectMember(
      db,
      projectId,
      userId,
      "editor",
    );
    const updated = await casUpdateProject(
      db,
      projectId,
      organizationId,
      expectedVersion,
      values,
    );
    if (!updated) {
      throw versionConflict("项目已被他人修改，请刷新后重试");
    }
    return updated;
  });
}

export async function removeProject(
  userId: string,
  projectId: string,
): Promise<void> {
  await withTenantTransaction({ userId }, async (db) => {
    const { organizationId } = await requireProjectMember(
      db,
      projectId,
      userId,
      "admin",
    );
    const deleted = await deleteProject(db, projectId, organizationId);
    if (!deleted) throw notFound();
  });
}
