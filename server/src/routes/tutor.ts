import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  tutors,
  tutorSubjects,
  tutorLevels,
  subjects,
  levels,
  payments,
  verificationDocuments,
  interviewSessions,
  appeals,
} from "../db/schema.js";
import { tutorAuth } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../middleware/errorHandler.js";
import {
  tutorProfileUpdateSchema,
  appealSchema,
  interviewAnswerSchema,
  DOC_TYPES,
  REQUIRED_DOC_TYPES,
  type TutorSelf,
  type DocType,
} from "@sgtutors/shared";
import { ensureTutorFolder, uploadDocToDrive } from "../services/gdrive.js";
import { createCheckout, reconcileSession } from "../services/stripe.js";
import {
  startInterview,
  answerInterview,
  getInterviewStatus,
} from "../services/interview.js";
import {
  storeProfilePhoto,
  photoUrlFor,
  deleteProfilePhoto,
} from "../services/storage.js";
import { isDriveConfigured } from "../services/gdrive.js";
import { privateDocsDir } from "../config.js";
import { sendEmail } from "../services/email.js";
import { config } from "../config.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

export const tutorRouter = Router();
tutorRouter.use(tutorAuth);

async function loadTutor(tutorId: string) {
  const [tutor] = await db.select().from(tutors).where(eq(tutors.id, tutorId));
  if (!tutor) throw new HttpError(404, "Tutor not found");
  return tutor;
}

tutorRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    const t = await loadTutor(req.tutorId!);
    const subs = await db
      .select({ id: subjects.id, name: subjects.name, slug: subjects.slug })
      .from(tutorSubjects)
      .innerJoin(subjects, eq(subjects.id, tutorSubjects.subjectId))
      .where(eq(tutorSubjects.tutorId, t.id));
    const lvls = await db
      .select({ id: levels.id, name: levels.name, slug: levels.slug })
      .from(tutorLevels)
      .innerJoin(levels, eq(levels.id, tutorLevels.levelId))
      .where(eq(tutorLevels.tutorId, t.id));
    const docs = await db
      .select({
        id: verificationDocuments.id,
        docType: verificationDocuments.docType,
        uploadedAt: verificationDocuments.uploadedAt,
      })
      .from(verificationDocuments)
      .where(eq(verificationDocuments.tutorId, t.id));

    const me: TutorSelf & { documents: typeof docs } = {
      id: t.id,
      fullName: t.fullName,
      displayName: t.displayName,
      gender: t.gender,
      race: t.race,
      nationality: t.nationality,
      region: t.region,
      address: t.address,
      linkedinUrl: t.linkedinUrl,
      nric: t.nric,
      dob: t.dob,
      email: t.email,
      mobile: t.mobile,
      photoUrl: photoUrlFor(t.photoPath),
      subjects: subs,
      levels: lvls,
      highestQualification: t.highestQualification,
      education: t.education,
      profileText: t.profileText,
      studentsTaught: t.studentsTaught,
      experienceYears: t.experienceYears,
      isVerified: t.verificationStatus === "verified",
      isFeatured: t.featuredUntil !== null && t.featuredUntil > new Date(),
      verificationStatus: t.verificationStatus,
      featuredUntil: t.featuredUntil?.toISOString() ?? null,
      isActive: t.isActive,
      expiresAt: t.expiresAt.toISOString(),
      createdAt: t.createdAt.toISOString(),
      documents: docs,
    };
    res.json(me);
  })
);

tutorRouter.patch(
  "/profile",
  asyncHandler(async (req, res) => {
    const input = tutorProfileUpdateSchema.parse(req.body);
    const { subjectIds, levelIds, ...fields } = input;

    if (Object.keys(fields).length > 0) {
      await db
        .update(tutors)
        .set({ ...fields, updatedAt: new Date() })
        .where(eq(tutors.id, req.tutorId!));
    }
    if (subjectIds) {
      await db.delete(tutorSubjects).where(eq(tutorSubjects.tutorId, req.tutorId!));
      if (subjectIds.length) {
        await db
          .insert(tutorSubjects)
          .values(subjectIds.map((subjectId) => ({ tutorId: req.tutorId!, subjectId })));
      }
    }
    if (levelIds) {
      await db.delete(tutorLevels).where(eq(tutorLevels.tutorId, req.tutorId!));
      if (levelIds.length) {
        await db
          .insert(tutorLevels)
          .values(levelIds.map((levelId) => ({ tutorId: req.tutorId!, levelId })));
      }
    }
    res.json({ ok: true });
  })
);

tutorRouter.post(
  "/photo",
  upload.single("photo"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, "Photo file required");
    const t = await loadTutor(req.tutorId!);
    const photoPath = await storeProfilePhoto(req.file);
    await db
      .update(tutors)
      .set({ photoPath, updatedAt: new Date() })
      .where(eq(tutors.id, req.tutorId!));
    if (t.photoPath) await deleteProfilePhoto(t.photoPath);
    res.json({ photoUrl: photoUrlFor(photoPath) });
  })
);

tutorRouter.post(
  "/renew",
  asyncHandler(async (req, res) => {
    const [updated] = await db
      .update(tutors)
      .set({
        expiresAt: sql`greatest(${tutors.expiresAt}, now()) + interval '1 year'`,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(tutors.id, req.tutorId!))
      .returning({ expiresAt: tutors.expiresAt });
    res.json({ expiresAt: updated.expiresAt.toISOString() });
  })
);

/* ---------------- Verification ---------------- */

tutorRouter.post(
  "/verification/checkout",
  asyncHandler(async (req, res) => {
    const t = await loadTutor(req.tutorId!);
    if (t.verificationStatus === "verified") {
      throw new HttpError(409, "You are already verified");
    }
    if (!["unverified", "payment_pending", "rejected"].includes(t.verificationStatus)) {
      throw new HttpError(
        409,
        "Verification is already in progress — check your dashboard for the next step"
      );
    }
    const paid = await db
      .select({ id: payments.id })
      .from(payments)
      .where(
        and(
          eq(payments.tutorId, t.id),
          eq(payments.purpose, "verification"),
          eq(payments.status, "paid")
        )
      );
    if (paid.length > 0 && t.verificationStatus !== "rejected") {
      throw new HttpError(409, "Verification fee already paid");
    }
    const { url } = await createCheckout({ tutorId: t.id, purpose: "verification" });
    await db
      .update(tutors)
      .set({ verificationStatus: "payment_pending", updatedAt: new Date() })
      .where(eq(tutors.id, t.id));
    res.json({ url });
  })
);

tutorRouter.post(
  "/verification/documents",
  upload.fields(DOC_TYPES.map((t) => ({ name: t, maxCount: 1 }))),
  asyncHandler(async (req, res) => {
    const t = await loadTutor(req.tutorId!);
    if (!["docs_pending", "interview_pending"].includes(t.verificationStatus)) {
      throw new HttpError(
        409,
        "Document upload is only available after the verification fee is paid"
      );
    }
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    if (!files || Object.keys(files).length === 0) {
      throw new HttpError(400, "At least one document file is required");
    }

    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    const extFor = (mime: string) =>
      mime === "application/pdf"
        ? ".pdf"
        : mime === "application/msword"
          ? ".doc"
          : mime.endsWith("wordprocessingml.document")
            ? ".docx"
            : ".img";
    // Archive to the tutor's Google Drive subfolder when Drive is configured;
    // files touch the local disk ONLY as a dev fallback when Drive is absent.
    const driveOn = isDriveConfigured();
    if (!driveOn) fs.mkdirSync(privateDocsDir, { recursive: true });
    const folderId =
      t.gdriveFolderId ?? (await ensureTutorFolder(t.fullName, t.id));
    if (folderId && !t.gdriveFolderId) {
      await db
        .update(tutors)
        .set({ gdriveFolderId: folderId })
        .where(eq(tutors.id, t.id));
    }

    for (const docType of DOC_TYPES) {
      const file = files[docType]?.[0];
      if (!file) continue;
      if (!allowed.includes(file.mimetype)) {
        throw new HttpError(
          400,
          `${docType}: only JPEG, PNG, WebP, PDF or Word documents allowed`
        );
      }
      const ext = extFor(file.mimetype);
      let name = "";
      let gdriveFileId: string | null = null;
      if (driveOn && folderId) {
        gdriveFileId = await uploadDocToDrive({
          folderId,
          fileName: `${docType}${ext}`,
          mimeType: file.mimetype,
          buffer: file.buffer,
        });
        if (!gdriveFileId) {
          throw new HttpError(502, "Document archive is unavailable — please retry");
        }
      } else {
        // Dev fallback: local disk
        name = `${req.tutorId}-${docType}-${crypto.randomUUID()}${ext}`;
        fs.writeFileSync(path.join(privateDocsDir, name), file.buffer);
      }

      await db
        .insert(verificationDocuments)
        .values({
          tutorId: t.id,
          docType: docType as DocType,
          filePath: name,
          gdriveFileId,
        })
        .onConflictDoUpdate({
          target: [verificationDocuments.tutorId, verificationDocuments.docType],
          set: { filePath: name, gdriveFileId, uploadedAt: new Date() },
        });
    }

    const uploaded = await db
      .select({ docType: verificationDocuments.docType })
      .from(verificationDocuments)
      .where(eq(verificationDocuments.tutorId, t.id));
    const complete = REQUIRED_DOC_TYPES.every((d) =>
      uploaded.some((u) => u.docType === d)
    );

    if (complete && t.verificationStatus === "docs_pending") {
      await db
        .update(tutors)
        .set({ verificationStatus: "interview_pending", updatedAt: new Date() })
        .where(eq(tutors.id, t.id));
    }

    res.json({
      uploaded: uploaded.map((u) => u.docType),
      complete,
      nextStep: complete ? "interview" : "upload_remaining_documents",
    });
  })
);

tutorRouter.get(
  "/verification/status",
  asyncHandler(async (req, res) => {
    // Reconcile a just-completed Stripe session (success-page fallback)
    const sessionId = req.query.session_id;
    if (typeof sessionId === "string" && sessionId.startsWith("cs_")) {
      await reconcileSession(sessionId).catch(() => {});
    }
    const t = await loadTutor(req.tutorId!);
    const docs = await db
      .select({ docType: verificationDocuments.docType })
      .from(verificationDocuments)
      .where(eq(verificationDocuments.tutorId, t.id));
    const [latestInterview] = await db
      .select({
        id: interviewSessions.id,
        state: interviewSessions.state,
        score: interviewSessions.score,
      })
      .from(interviewSessions)
      .where(eq(interviewSessions.tutorId, t.id))
      .orderBy(desc(interviewSessions.startedAt))
      .limit(1);

    const nextStepMap: Record<string, string> = {
      unverified: "pay_verification_fee",
      payment_pending: "complete_payment",
      docs_pending: "upload_documents",
      interview_pending: "take_interview",
      interview_failed: "appeal_or_accept",
      appeal_requested: "await_admin",
      live_interview_scheduled: "attend_live_interview",
      verified: "done",
      rejected: "contact_support",
    };

    res.json({
      status: t.verificationStatus,
      nextStep: nextStepMap[t.verificationStatus],
      documentsUploaded: docs.map((d) => d.docType),
      latestInterview: latestInterview ?? null,
    });
  })
);

/* ---------------- Interview ---------------- */

tutorRouter.post(
  "/interview/start",
  asyncHandler(async (req, res) => {
    const result = await startInterview(req.tutorId!);
    res.json(result);
  })
);

tutorRouter.post(
  "/interview/:id/answer",
  asyncHandler(async (req, res) => {
    const { answer, pasteFlag } = interviewAnswerSchema.parse(req.body);
    const result = await answerInterview(
      req.tutorId!,
      req.params.id,
      answer,
      pasteFlag
    );
    res.json(result);
  })
);

tutorRouter.get(
  "/interview/:id",
  asyncHandler(async (req, res) => {
    res.json(await getInterviewStatus(req.tutorId!, req.params.id));
  })
);

/* ---------------- Appeal ---------------- */

tutorRouter.post(
  "/appeal",
  asyncHandler(async (req, res) => {
    const { reason } = appealSchema.parse(req.body);
    const t = await loadTutor(req.tutorId!);
    if (t.verificationStatus !== "interview_failed") {
      throw new HttpError(409, "Appeals are only available after a failed interview");
    }
    const [latestInterview] = await db
      .select({ id: interviewSessions.id })
      .from(interviewSessions)
      .where(eq(interviewSessions.tutorId, t.id))
      .orderBy(desc(interviewSessions.startedAt))
      .limit(1);

    await db.insert(appeals).values({
      tutorId: t.id,
      interviewSessionId: latestInterview?.id ?? null,
      reason,
    });
    await db
      .update(tutors)
      .set({ verificationStatus: "appeal_requested", updatedAt: new Date() })
      .where(eq(tutors.id, t.id));

    await sendEmail({
      to: config.ADMIN_EMAIL,
      subject: `[SG Tutors] Verification appeal from ${t.displayName}`,
      text: `Tutor ${t.displayName} (${t.email}) has appealed their failed AI interview.\n\nReason:\n${reason}\n\nReview it in the admin dashboard and schedule a live interview.`,
    });
    res.status(201).json({ ok: true });
  })
);

/* ---------------- Featured ---------------- */

tutorRouter.post(
  "/featured/checkout",
  asyncHandler(async (req, res) => {
    const t = await loadTutor(req.tutorId!);
    if (t.verificationStatus !== "verified") {
      throw new HttpError(403, "Only verified tutors can be featured");
    }
    const { url } = await createCheckout({ tutorId: t.id, purpose: "featured" });
    res.json({ url });
  })
);
