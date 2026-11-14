import { AppError } from "../../lib/errors";

export const unauthorized = (): AppError =>
  new AppError("UNAUTHORIZED", "需要登录", 401);
