import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  schemaFilter: ["public", "auth"],
  dbCredentials: {
    url:
      process.env.MIGRATE_DATABASE_URL ??
      process.env.DATABASE_URL ??
      "postgres://postgres:postgres@127.0.0.1:5432/yunpu_dev",
  },
});
