import { AppError } from "@yunpu/shared";

export type DatabaseError = {
  code?: string;
  constraint?: string;
};

export function extractDatabaseError(
  error: unknown,
): DatabaseError | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 5; depth += 1) {
    if (typeof current === "object" && current !== null) {
      const candidate = current as DatabaseError & {
        cause?: unknown;
      };
      if (typeof candidate.code === "string" && candidate.code.length > 0) {
        return candidate;
      }
      current = candidate.cause;
      continue;
    }
    break;
  }
  return undefined;
}

export function hasErrorMessagePattern(
  error: unknown,
  pattern: RegExp,
): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5; depth += 1) {
    if (typeof current === "object" && current !== null) {
      const candidate = current as { message?: unknown; cause?: unknown };
      if (
        typeof candidate.message === "string" &&
        pattern.test(candidate.message)
      ) {
        return true;
      }
      current = candidate.cause;
      continue;
    }
    break;
  }
  return false;
}

/**
 * Translate recognized PostgreSQL / domain constraint errors into AppError.
 * Returns null for RLS write rejections (42501) and unexpected failures so
 * callers let them surface to the global error handler with full stack logs.
 */
export function tryMapDatabaseError(error: unknown): AppError | null {
  const dbError = extractDatabaseError(error);
  if (!dbError?.code) {
    return null;
  }

  switch (dbError.code) {
    case "23505":
      if (dbError.constraint === "user_email_unique") {
        return new AppError("CONFLICT", "该邮箱已注册");
      }
      if (dbError.constraint === "uk_person_relation_kind") {
        return new AppError("CONFLICT", "这条关系已存在");
      }
      if (
        dbError.constraint === "uq_folder_project_name" ||
        dbError.constraint === "uq_folder_project_kind_name"
      ) {
        return new AppError("CONFLICT", "同项目下分组名称已存在");
      }
      if (dbError.constraint === "uq_person_name_kind_value") {
        return new AppError("CONFLICT", "该人物已存在相同类型的名号");
      }
      return new AppError("CONFLICT", "记录已存在");
    case "23001":
      if (dbError.constraint === "fk_organization_owner") {
        return new AppError("CONFLICT", "不能移除组织所有者");
      }
      return new AppError("CONFLICT", "记录仍被引用");
    case "23503":
      if (dbError.constraint === "fk_organization_owner") {
        return new AppError("CONFLICT", "不能移除组织所有者");
      }
      return new AppError("CONFLICT", "关联记录不存在或仍被引用");
    case "22P02":
    case "22007":
      return new AppError("VALIDATION", "输入格式不合法");
    case "23514":
      if (dbError.constraint === "ck_person_life_years") {
        return new AppError("VALIDATION", "年份与在世状态不一致", 400, {
          constraint: dbError.constraint,
        });
      }
      return new AppError("VALIDATION", "输入不符合约束");
    case "GX011":
      return new AppError("PARENT_LIMIT", "同类型父母边已达上限", 409, {
        sqlstate: dbError.code,
      });
    case "GX012":
      return new AppError("CONFLICT", "组织已归档，无法写入", 409, {
        sqlstate: dbError.code,
      });
    case "GX013":
      return new AppError("CONFLICT", "不能修改所有者角色");
    case "GX014":
      return new AppError("CONFLICT", "不能跨越不同谱系图建立人物关系", 409, {
        sqlstate: dbError.code,
      });
    case "GX001":
      return new AppError("CYCLE_DETECTED", "会形成祖先环路", 409, {
        sqlstate: dbError.code,
      });
    case "GX005":
      return new AppError("NOT_FOUND", "目标不存在或已失效", 404, {
        sqlstate: dbError.code,
      });
    case "GX006":
      return new AppError("FORBIDDEN", "无权执行该操作");
    case "GX008":
      return new AppError("UNAUTHORIZED", "请求缺少认证上下文");
    case "GX009":
      return new AppError("FORBIDDEN", "邀请邮箱与当前账号不匹配", 403, {
        sqlstate: dbError.code,
      });
    case "GX010":
      return new AppError("CONFLICT", "操作已被并发请求抢先，请重试", 409, {
        sqlstate: dbError.code,
      });
    case "55P03":
    case "57014":
      return new AppError("UNAVAILABLE", "系统繁忙，请重试");
    default:
      return null;
  }
}

export function mapDatabaseError(error: unknown): AppError {
  return (
    tryMapDatabaseError(error) ?? new AppError("INTERNAL", "服务器内部错误")
  );
}

/** Shared error factories. HTTP contract: code + status + message stay byte-identical. */
export function notFound(): AppError {
  return new AppError("NOT_FOUND", "不存在或无权");
}

export function forbidden(message = "无权执行该操作"): AppError {
  return new AppError("FORBIDDEN", message);
}

export function conflict(message: string): AppError {
  return new AppError("CONFLICT", message);
}

export function validationError(details: Record<string, unknown>): AppError {
  return new AppError("VALIDATION", "请求参数不合法", 400, details);
}

export function cycleDetected(): AppError {
  return new AppError("CYCLE_DETECTED", "会形成祖先环路");
}

export function parentLimit(): AppError {
  return new AppError("PARENT_LIMIT", "同类型父母边已达上限");
}

export function versionConflict(
  message = "人物已被他人修改，请刷新后重试",
): AppError {
  return new AppError("VERSION_CONFLICT", message);
}

export { AppError };
