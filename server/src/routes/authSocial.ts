import { Router, type Response } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { OAuth2Client } from "google-auth-library";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { db } from "../db/client.js";
import { tutors } from "../db/schema.js";
import { setTutorCookie } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../middleware/errorHandler.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { config } from "../config.js";

export const authSocialRouter = Router();

/**
 * Social sign-in for tutor accounts.
 *
 * Both providers are verified the same way — the client obtains an ID token
 * (Google Identity Services on web; the native Google/Apple SDKs in the iOS
 * app) and POSTs it here. We verify the signature and audience server-side,
 * so a forged token can't mint a session.
 *
 * IMPORTANT: this signs in or links an EXISTING account. It deliberately does
 * not create tutor records, because a tutor listing requires NRIC, DOB, mobile,
 * a passport photo and subject/level selections that OAuth cannot supply — a
 * social-created account would be an unusable half-listing. New tutors are sent
 * to the full signup form.
 */

const tokenSchema = z.object({
  idToken: z.string().min(10),
});

const googleClient = new OAuth2Client();
const appleJwks = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

/** Accept tokens from the web client and the iOS app (different audiences). */
function googleAudiences(): string[] {
  return [config.GOOGLE_CLIENT_ID, config.GOOGLE_IOS_CLIENT_ID].filter(
    (v): v is string => Boolean(v)
  );
}

interface SocialIdentity {
  sub: string;
  email: string | null;
  emailVerified: boolean;
}

async function verifyGoogle(idToken: string): Promise<SocialIdentity> {
  const audience = googleAudiences();
  if (audience.length === 0) {
    throw new HttpError(503, "Google sign-in is not configured");
  }
  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken, audience });
    payload = ticket.getPayload();
  } catch {
    throw new HttpError(401, "Invalid Google token");
  }
  if (!payload?.sub) throw new HttpError(401, "Invalid Google token");
  return {
    sub: payload.sub,
    email: payload.email ?? null,
    emailVerified: payload.email_verified === true,
  };
}

async function verifyApple(idToken: string): Promise<SocialIdentity> {
  const audience = [config.APPLE_CLIENT_ID].filter((v): v is string => Boolean(v));
  if (audience.length === 0) {
    throw new HttpError(503, "Apple sign-in is not configured");
  }
  let payload;
  try {
    ({ payload } = await jwtVerify(idToken, appleJwks, {
      issuer: "https://appleid.apple.com",
      audience,
    }));
  } catch {
    throw new HttpError(401, "Invalid Apple token");
  }
  if (!payload.sub) throw new HttpError(401, "Invalid Apple token");
  return {
    sub: payload.sub,
    email: typeof payload.email === "string" ? payload.email : null,
    // Apple sends this as a string or boolean depending on the flow.
    emailVerified:
      payload.email_verified === true || payload.email_verified === "true",
  };
}

/**
 * Resolve an identity to a tutor session.
 *
 * Match order: provider subject id first (the stable identifier), then a
 * *verified* email as a one-time link. An unverified email is never used to
 * match — otherwise anyone who can mint a token claiming someone's address
 * could take over their account.
 */
async function signInWithIdentity(
  identity: SocialIdentity,
  provider: "google" | "apple",
  res: Response
) {
  const subColumn = provider === "google" ? tutors.googleSub : tutors.appleSub;

  const [bySub] = await db.select().from(tutors).where(eq(subColumn, identity.sub));
  if (bySub) {
    setTutorCookie(res, bySub.id);
    return { id: bySub.id, linked: false };
  }

  if (identity.email && identity.emailVerified) {
    const [byEmail] = await db
      .select()
      .from(tutors)
      .where(eq(tutors.email, identity.email.toLowerCase()));
    if (byEmail) {
      await db
        .update(tutors)
        .set(
          provider === "google"
            ? { googleSub: identity.sub, updatedAt: new Date() }
            : { appleSub: identity.sub, updatedAt: new Date() }
        )
        .where(eq(tutors.id, byEmail.id));
      setTutorCookie(res, byEmail.id);
      return { id: byEmail.id, linked: true };
    }
  }

  // No account — the client should route the user into the full signup form.
  throw new HttpError(
    404,
    "No tutor account matches this sign-in. Please complete the free signup form first."
  );
}

authSocialRouter.post(
  "/google",
  rateLimit({ windowMs: 900_000, max: 20, keyPrefix: "social-google" }),
  asyncHandler(async (req, res) => {
    const { idToken } = tokenSchema.parse(req.body);
    const identity = await verifyGoogle(idToken);
    res.json(await signInWithIdentity(identity, "google", res));
  })
);

authSocialRouter.post(
  "/apple",
  rateLimit({ windowMs: 900_000, max: 20, keyPrefix: "social-apple" }),
  asyncHandler(async (req, res) => {
    const { idToken } = tokenSchema.parse(req.body);
    const identity = await verifyApple(idToken);
    res.json(await signInWithIdentity(identity, "apple", res));
  })
);

/** Which providers the client should render buttons for. */
authSocialRouter.get("/providers", (_req, res) => {
  res.json({
    google: Boolean(config.GOOGLE_CLIENT_ID),
    apple: Boolean(config.APPLE_CLIENT_ID),
    googleClientId: config.GOOGLE_CLIENT_ID ?? null,
  });
});
