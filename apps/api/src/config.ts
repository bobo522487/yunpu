import { type AppEnv, parseEnv } from "./env";

let cached: AppEnv | undefined;

export function config(): AppEnv {
  if (!cached) cached = parseEnv();
  return cached;
}
