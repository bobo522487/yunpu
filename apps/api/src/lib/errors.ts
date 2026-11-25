import { AppError } from "@yunpu/shared";

type DatabaseError = {
  code?: string;
  constraint?: string;
};

function asDatabaseError(error: unknown): DatabaseError | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 5; depth += 1) {
    if (typeof current === "object" && current !== null) {
      const candidate = current as DatabaseError & {
        cause?: unknown;
        message?: unknown;
      };
      if (candidate.code) return candidate;
      current = candidate.cause;
      continue;
    }
    break;
  }
  return undefined;
}

export function mapDatabaseError(error: unknown): AppError {
  const dbError = asDatabaseError(error);
  if (!dbError?.code) {
    return new AppError("INTERNAL", "服务器内部错误", 500);
  }

  switch (dbError.code) {
    case "23505":
      if (dbError.constraint === "user_email_unique") {
        return new AppError("CONFLICT", "该邮箱已注册", 409);
      }
      return new AppError("CONFLICT", "记录已存在", 409);
    case "23001":
      return new AppError("CONFLICT", "记录仍被引用", 409);
    case "23503":
      if (dbError.constraint === "fk_organization_owner") {
        return new AppError("CONFLICT", "不能移除组织所有者", 409);
      }
      return new AppError("CONFLICT", "关联记录不存在或仍被引用", 409);
    case "22P02":
      return new AppError("VALIDATION", "输入格式不合法", 400);
    case "23514":
      if (dbError.constraint === "ck_person_life_years") {
        return new AppError("VALIDATION", "年份与在世状态不一致", 400, {
          constraint: dbError.constraint,
        });
      }
      return new AppError("VALIDATION", "输入不符合约束", 400);
    case "GX011":
      return new AppError("PARENT_LIMIT", "同类型父母边已达上限", 409, {
        sqlstate: dbError.code,
      });
    case "GX012":
      return new AppError("CONFLICT", "组织已归档，无法写入", 409, {
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
      return new AppError("FORBIDDEN", "无权执行该操作", 403);
    case "GX008":
      return new AppError("UNAUTHORIZED", "请求缺少认证上下文", 401);
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
      return new AppError("UNAVAILABLE", "系统繁忙，请重试", 503);
    default:
      return new AppError("INTERNAL", "服务器内部错误", 500);
  }
}

/** Shared error factories. HTTP contract: code + status + message stay byte-identical. */
export function notFound(): AppError {
  return new AppError("NOT_FOUND", "不存在或无权", 404);
}

export function forbidden(message = "无权执行该操作"): AppError {
  return new AppError("FORBIDDEN", message, 403);
}

export function conflict(message: string): AppError {
  return new AppError("CONFLICT", message, 409);
}

export function validationError(details: Record<string, unknown>): AppError {
  return new AppError("VALIDATION", "请求参数不合法", 400, details);
}

export function cycleDetected(): AppError {
  return new AppError("CYCLE_DETECTED", "会形成祖先环路", 409);
}

export function parentLimit(): AppError {
  return new AppError("PARENT_LIMIT", "同类型父母边已达上限", 409);
}

export function versionConflict(): AppError {
  return new AppError(
    "VERSION_CONFLICT",
    "人物已被他人修改，请刷新后重试",
    409,
  );
}

export { AppError };
