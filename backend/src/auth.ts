import "dotenv/config";
import { betterAuth } from "better-auth";
import { getPool } from "./adapters/database/PostgresPool";

const trustedOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS || process.env.BETTER_AUTH_URL || "http://127.0.0.1:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const auth = betterAuth({
  database: getPool(),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24
  }
});

export type AuthSession = Awaited<ReturnType<typeof auth.api.getSession>>;
