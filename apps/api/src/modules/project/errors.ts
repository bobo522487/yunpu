import { AppError } from "../../lib/errors";

export const projectNotFound = (): AppError =>
  new AppError("NOT_FOUND", "不存在或无权", 404);

export const forbidden = (message = "无权执行该操作"): AppError =>
  new AppError("FORBIDDEN", message, 403);

export const conflict = (message: string): AppError =>
  new AppError("CONFLICT", message, 409);

export const validationError = (
  details: Record<string, unknown>,
): AppError => new AppError("VALIDATION", "请求参数不合法", 400, details);
