import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters for security"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  FRONTEND_URL: z.string().default("http://localhost:3000"),
  BCRYPT_ROUNDS: z.coerce.number().int().min(8).max(15).default(10),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_AUTH_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  MAIL_HOST: z.string().optional(),
  MAIL_PORT: z.coerce.number().int().positive().optional(),
  MAIL_USER: z.string().optional(),
  MAIL_PASS: z.string().optional(),
  MAIL_FROM: z.string().default("Marketplace <no-reply@marketplace.local>"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    // eslint-disable-next-line no-console
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;

export const corsOrigins = env.FRONTEND_URL.split(",")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);
