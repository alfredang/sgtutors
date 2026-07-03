import { Router } from "express";
import bcrypt from "bcryptjs";
import multer from "multer";
import { eq, or } from "drizzle-orm";
import { db } from "../db/client.js";
import { tutors, tutorSubjects, tutorLevels } from "../db/schema.js";
import {
  setTutorCookie,
  clearTutorCookie,
  tutorAuth,
} from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../middleware/errorHandler.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { tutorSignupSchema, loginSchema } from "@sgtutors/shared";
import { storeProfilePhoto } from "../services/storage.js";
import { requestOtp, verifyOtp } from "../services/otp.js";
import { z } from "zod";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const authTutorRouter = Router();

authTutorRouter.post(
  "/signup",
  rateLimit({ windowMs: 3600_000, max: 10, keyPrefix: "signup" }),
  upload.single("photo"),
  asyncHandler(async (req, res) => {
    const body = {
      ...req.body,
      subjectIds: JSON.parse(req.body.subjectIds ?? "[]"),
      levelIds: JSON.parse(req.body.levelIds ?? "[]"),
    };
    const input = tutorSignupSchema.parse(body);
    if (!req.file) throw new HttpError(400, "Profile photo is required");

    const existing = await db
      .select({ id: tutors.id, email: tutors.email, nric: tutors.nric })
      .from(tutors)
      .where(or(eq(tutors.email, input.email), eq(tutors.nric, input.nric)));
    if (existing.length > 0) {
      throw new HttpError(
        409,
        existing[0].email === input.email
          ? "An account with this email already exists"
          : "An account with this NRIC already exists"
      );
    }

    const photoPath = await storeProfilePhoto(req.file);
    const passwordHash = await bcrypt.hash(input.password, 12);
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    const [tutor] = await db
      .insert(tutors)
      .values({
        fullName: input.fullName,
        displayName: input.displayName,
        gender: input.gender,
        race: input.race,
        nationality: input.nationality,
        address: input.address,
        region: input.region,
        linkedinUrl: input.linkedinUrl ?? null,
        nric: input.nric,
        dob: input.dob,
        mobile: input.mobile,
        email: input.email,
        passwordHash,
        profileText: input.profileText,
        highestQualification: input.highestQualification,
        education: input.education,
        studentsTaught: input.studentsTaught,
        experienceYears: input.experienceYears,
        photoPath,
        expiresAt,
      })
      .returning({ id: tutors.id });

    if (input.subjectIds.length) {
      await db
        .insert(tutorSubjects)
        .values(input.subjectIds.map((subjectId) => ({ tutorId: tutor.id, subjectId })))
        .onConflictDoNothing();
    }
    if (input.levelIds.length) {
      await db
        .insert(tutorLevels)
        .values(input.levelIds.map((levelId) => ({ tutorId: tutor.id, levelId })))
        .onConflictDoNothing();
    }

    setTutorCookie(res, tutor.id);
    res.status(201).json({ id: tutor.id });
  })
);

authTutorRouter.post(
  "/login",
  rateLimit({ windowMs: 900_000, max: 20, keyPrefix: "tutor-login" }),
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const [tutor] = await db.select().from(tutors).where(eq(tutors.email, email));
    if (!tutor || !(await bcrypt.compare(password, tutor.passwordHash))) {
      throw new HttpError(401, "Invalid email or password");
    }
    setTutorCookie(res, tutor.id);
    res.json({ id: tutor.id });
  })
);

/* ---------------- OTP login & password reset ---------------- */

const emailOnlySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});
const otpVerifySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  code: z.string().trim().regex(/^\d{6}$/, "Code must be 6 digits"),
});
const passwordResetSchema = otpVerifySchema.extend({
  newPassword: z.string().min(8).max(100),
});

authTutorRouter.post(
  "/otp/request",
  rateLimit({ windowMs: 900_000, max: 5, keyPrefix: "otp-req" }),
  asyncHandler(async (req, res) => {
    const { email } = emailOnlySchema.parse(req.body);
    await requestOtp(email, "login");
    // Always 200 — never reveal whether the email exists
    res.json({ ok: true });
  })
);

authTutorRouter.post(
  "/otp/verify",
  rateLimit({ windowMs: 900_000, max: 15, keyPrefix: "otp-verify" }),
  asyncHandler(async (req, res) => {
    const { email, code } = otpVerifySchema.parse(req.body);
    const tutorId = await verifyOtp(email, code, "login");
    if (!tutorId) throw new HttpError(401, "Invalid or expired code");
    setTutorCookie(res, tutorId);
    res.json({ id: tutorId });
  })
);

authTutorRouter.post(
  "/password/forgot",
  rateLimit({ windowMs: 900_000, max: 5, keyPrefix: "pw-forgot" }),
  asyncHandler(async (req, res) => {
    const { email } = emailOnlySchema.parse(req.body);
    await requestOtp(email, "reset");
    res.json({ ok: true });
  })
);

authTutorRouter.post(
  "/password/reset",
  rateLimit({ windowMs: 900_000, max: 10, keyPrefix: "pw-reset" }),
  asyncHandler(async (req, res) => {
    const { email, code, newPassword } = passwordResetSchema.parse(req.body);
    const tutorId = await verifyOtp(email, code, "reset");
    if (!tutorId) throw new HttpError(401, "Invalid or expired code");
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await db
      .update(tutors)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(tutors.id, tutorId));
    setTutorCookie(res, tutorId);
    res.json({ ok: true });
  })
);

authTutorRouter.post("/logout", (_req, res) => {
  clearTutorCookie(res);
  res.json({ ok: true });
});

authTutorRouter.get(
  "/session",
  tutorAuth,
  asyncHandler(async (req, res) => {
    res.json({ tutorId: req.tutorId });
  })
);
