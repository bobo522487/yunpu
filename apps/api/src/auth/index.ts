import { createDb, authAccount, authSession, authUser, authVerification } from "@yunpu/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { config } from "../config";
import { uuidv7 } from "../lib/ids";

const env = config();
const authDatabase = createDb(env.AUTH_DATABASE_URL);

export const authDb = authDatabase.db;
export const authPool = authDatabase.pool;

export const auth = betterAuth({
  appName: "yunpu",
  baseURL: env.BETTER_AUTH_URL,
  basePath: "/api/v1/auth",
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.BETTER_AUTH_URL],
  database: drizzleAdapter(authDatabase.db, {
    provider: "pg",
    schema: {
      user: authUser,
      session: authSession,
      account: authAccount,
      verification: authVerification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: false,
  },
  session: {
    expiresIn: 604800,
    updateAge: 86400,
    cookieCache: {
      enabled: false,
    },
  },
  advanced: {
    database: {
      generateId: () => uuidv7(),
    },
  },
});
