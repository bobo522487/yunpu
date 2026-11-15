import { AppError } from "../../lib/errors";

export const organizationNotFound = (): AppError =>
  new AppError("NOT_FOUND", "不存在或无权", 404);

export const forbidden = (message = "无权执行该操作"): AppError =>
  new AppError("FORBIDDEN", message, 403);

export const conflict = (message: string): AppError =>
  new AppError("CONFLICT", message, 409);
