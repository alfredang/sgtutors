import crypto from "node:crypto";
import { and, eq, desc } from "drizzle-orm";
import { db } from "../db/client.js";
import { loginOtps, tutors } from "../db/schema.js";
import { sendEmail } from "./email.js";
import { config } from "../config.js";

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function hashCode(code: string): string {
  return crypto
    .createHash("sha256")
    .update(code + config.IP_HASH_SALT)
    .digest("hex");
}

/**
 * Issue a 6-digit one-time code to a tutor's email. Silently no-ops when the
 * email is unknown (no account enumeration) — callers always return 200.
 */
export async function requestOtp(
  email: string,
  purpose: "login" | "reset"
): Promise<void> {
  const [tutor] = await db
    .select({ id: tutors.id, displayName: tutors.displayName })
    .from(tutors)
    .where(eq(tutors.email, email));
  if (!tutor) return;

  const code = String(crypto.randomInt(100000, 1000000));
  await db.insert(loginOtps).values({
    email,
    codeHash: hashCode(code),
    purpose,
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });

  await sendEmail({
    to: email,
    subject:
      purpose === "login"
        ? "[SG Tutors] Your login code"
        : "[SG Tutors] Reset your password",
    text: `Hi ${tutor.displayName},\n\nYour one-time code is: ${code}\n\nIt expires in 10 minutes. If you did not request this, you can ignore this email.\n\n— SG Tutors`,
  });
}

/** Verify and consume a one-time code. Returns the tutor id, or null. */
export async function verifyOtp(
  email: string,
  code: string,
  purpose: "login" | "reset"
): Promise<string | null> {
  const [row] = await db
    .select()
    .from(loginOtps)
    .where(
      and(
        eq(loginOtps.email, email),
        eq(loginOtps.purpose, purpose),
        eq(loginOtps.consumed, false)
      )
    )
    .orderBy(desc(loginOtps.createdAt))
    .limit(1);

  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  if (row.attempts >= MAX_ATTEMPTS) return null;

  if (row.codeHash !== hashCode(code)) {
    await db
      .update(loginOtps)
      .set({ attempts: row.attempts + 1 })
      .where(eq(loginOtps.id, row.id));
    return null;
  }

  await db.update(loginOtps).set({ consumed: true }).where(eq(loginOtps.id, row.id));
  const [tutor] = await db
    .select({ id: tutors.id })
    .from(tutors)
    .where(eq(tutors.email, email));
  return tutor?.id ?? null;
}
