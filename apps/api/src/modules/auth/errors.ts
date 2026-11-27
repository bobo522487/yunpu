import { AppError } from "../../lib/errors";

export const unauthorized = (): AppError =>
  new AppError("UNAUTHORIZED", "需要登录");

type AuthErrorRecord = {
  statusCode?: unknown;
  status?: unknown;
  body?: { code?: string };
};

function authErrorInfo(error: unknown): { status: number; code?: string } {
  const record =
    typeof error === "object" && error !== null
      ? (error as AuthErrorRecord)
      : undefined;
  return {
    status: Number(record?.statusCode ?? record?.status),
    code: record?.body?.code,
  };
}

export function mapSignUpError(error: unknown): AppError {
  const { status } = authErrorInfo(error);
  if (status === 409 || status === 422) {
    return new AppError("CONFLICT", "该邮箱已注册");
  }
  if (status === 400) {
    return new AppError("VALIDATION", "注册信息不合法");
  }
  return new AppError("INTERNAL", "注册失败");
}

/** Returns undefined for outages so the original failure stays loud. */
export function mapSignInError(error: unknown): AppError | undefined {
  const { status } = authErrorInfo(error);
  if (status === 400 || status === 401 || status === 422) {
    return new AppError("UNAUTHORIZED", "邮箱或密码错误");
  }
  return undefined;
}

export function mapBetterAuthError(error: unknown, fallback: string): AppError {
  const { status, code } = authErrorInfo(error);
  if (code === "INVALID_PASSWORD") {
    return new AppError("VALIDATION", "当前密码不正确");
  }
  if (status === 400) {
    return new AppError("VALIDATION", fallback);
  }
  if (status === 401) {
    return unauthorized();
  }
  return new AppError("INTERNAL", fallback);
}
