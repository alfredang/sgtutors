import { z } from "zod";
import path from "node:path";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
// Load the repo-root .env regardless of where the server is launched from
dotenv.config({ path: path.resolve(here, "../../.env") });
dotenv.config(); // also allow a local .env / pre-set env vars to win

const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .default("postgres://postgres:postgres@localhost:5433/sgtutors"),
  PORT: z.coerce.number().default(4000),
  APP_URL: z.string().default("http://localhost:5173"),
  JWT_SECRET: z.string().default("dev-tutor-secret"),
  ADMIN_JWT_SECRET: z.string().default("dev-admin-secret"),
  IP_HASH_SALT: z.string().default("dev-salt"),
  UPLOADS_DIR: z.string().default("./uploads"),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  TURNSTILE_SECRET_KEY: z.string().default("1x0000000000000000000000000000000AA"),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_PUBLIC_BASE_URL: z.string().optional(),
  GDRIVE_PARENT_FOLDER_ID: z.string().optional(),
  GDRIVE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  DOCS_RETENTION_MONTHS: z.coerce.number().default(3),
  CLAUDE_CODE_OAUTH_TOKEN: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  INTERVIEW_MODEL: z.string().optional(),
  EMAIL_DEV_MODE: z
    .string()
    .default("true")
    .transform((v) => v !== "false"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default("noreply@sgtutors.local"),
  ADMIN_EMAIL: z.string().default("admin@sgtutors.local"),
  ADMIN_PASSWORD: z.string().default("admin123"),
  NODE_ENV: z.string().default("development"),
});

export const config = envSchema.parse(process.env);

export const uploadsRoot = path.resolve(here, "../..", config.UPLOADS_DIR);
export const publicPhotosDir = path.join(uploadsRoot, "public", "photos");
export const privateDocsDir = path.join(uploadsRoot, "private", "docs");

export function assertInterviewAuth(): string | null {
  if (config.CLAUDE_CODE_OAUTH_TOKEN) return "subscription (CLAUDE_CODE_OAUTH_TOKEN)";
  if (config.ANTHROPIC_API_KEY) return "API key (ANTHROPIC_API_KEY)";
  return null;
}
