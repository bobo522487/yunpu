import { z } from "zod";

const pairedDatabaseName = {
  development: "yunpu_dev",
  test: "yunpu_test",
} as const;

const appDatabaseUser = "genealogy_app";

const envFields = [
  "YUNPU_ENV",
  "DATABASE_URL",
  "PORT",
  "S3_ENDPOINT",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "YUNPU_CAPABILITY_TOKEN",
] as const;

function databaseTarget(databaseUrl: string): { user: string; name: string } | undefined {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    return undefined;
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    return undefined;
  }

  let user: string;
  let name: string;
  try {
    user = decodeURIComponent(url.username);
    name = decodeURIComponent(url.pathname.replace(/^\/+/, "").split("/")[0] ?? "");
  } catch {
    return undefined;
  }

  if (user.length === 0 || name.length === 0) {
    return undefined;
  }

  return { user, name };
}

function databaseUrlAllowed(databaseUrl: string): boolean {
  const target = databaseTarget(databaseUrl);
  if (!target || target.name === "yunpu_prod" || target.user !== appDatabaseUser) {
    return false;
  }

  const yunpuEnv = process.env.YUNPU_ENV;
  if (yunpuEnv !== "development" && yunpuEnv !== "test") {
    return false;
  }

  return target.name === pairedDatabaseName[yunpuEnv];
}

const envSchema = z.object({
  YUNPU_ENV: z.enum(["development", "test"]),
  DATABASE_URL: z.string().min(1).superRefine((databaseUrl, ctx) => {
    if (!databaseUrlAllowed(databaseUrl)) {
      ctx.addIssue({
        code: "custom",
        message: "DATABASE_URL must use user genealogy_app and the database paired with YUNPU_ENV",
      });
    }
  }),
  PORT: z.coerce.number().int().min(1).max(65535),
  S3_ENDPOINT: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  YUNPU_CAPABILITY_TOKEN: z.string().min(1),
});

export type AppEnv = z.infer<typeof envSchema>;

function failingFieldNames(error: z.ZodError): string[] {
  const found = new Set<string>();
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string") {
      found.add(field);
    }
  }
  return envFields.filter((field) => found.has(field));
}

export function parseEnv(): AppEnv {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error(failingFieldNames(parsed.error).join("\n"));
    process.exit(1);
  }
  return parsed.data;
}
