import { AppError } from "@yunpu/shared";

type DatabaseError = {
  code?: string;
  constraint?: string;
};

function asDatabaseError(error: unknown): DatabaseError | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 5; depth += 1) {
    if (typeof current === "object" && current !== null) {
      const candidate = current as DatabaseError & { cause?: unknown };
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
      if (dbError.constraint?.includes("email")) {
        return new AppError("CONFLICT", "该邮箱已注册", 409);
      }
      return new AppError("CONFLICT", "记录已存在", 409);
    case "23503":
    case "23001":
      if (dbError.constraint === "fk_organization_owner") {
        return new AppError("CONFLICT", "不能移除组织所有者", 409);
      }
      return new AppError("CONFLICT", "记录仍被引用", 409);
    case "23514":
      return new AppError("VALIDATION", "输入不符合约束", 400);
    case "GX005":
      return new AppError("NOT_FOUND", "目标不存在或已失效", 404);
    case "GX006":
      return new AppError("FORBIDDEN", "无权执行该操作", 403);
    case "GX008":
      return new AppError("UNAUTHORIZED", "请求缺少认证上下文", 401);
    case "GX009":
      return new AppError("FORBIDDEN", "邀请邮箱与当前账号不匹配", 403);
    case "GX010":
      return new AppError("CONFLICT", "操作已被并发请求抢先，请重试", 409);
    case "55P03":
    case "57014":
      return new AppError("INTERNAL", "系统繁忙，请重试", 503);
    default:
      return new AppError("INTERNAL", "服务器内部错误", 500);
  }
}

export { AppError };
