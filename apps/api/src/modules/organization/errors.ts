import { AppError } from "../../lib/errors";

export const organizationNotFound = (): AppError =>
  new AppError("NOT_FOUND", "不存在或无权", 404);
