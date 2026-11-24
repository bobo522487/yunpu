import { AppError } from "../../lib/errors";

export const personNotFound = (): AppError =>
  new AppError("NOT_FOUND", "不存在或无权", 404);

export const forbidden = (message = "无权执行该操作"): AppError =>
  new AppError("FORBIDDEN", message, 403);

export const cycleDetected = (): AppError =>
  new AppError("CYCLE_DETECTED", "会形成祖先环路", 409);

export const parentLimit = (): AppError =>
  new AppError("PARENT_LIMIT", "同类型父母边已达上限", 409);

export const versionConflict = (): AppError =>
  new AppError("VERSION_CONFLICT", "人物已被他人修改，请刷新后重试", 409);

export const conflict = (message: string): AppError =>
  new AppError("CONFLICT", message, 409);

export const validationError = (details: Record<string, unknown>): AppError =>
  new AppError("VALIDATION", "请求参数不合法", 400, details);
