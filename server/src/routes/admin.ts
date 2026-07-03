import { Router } from "express";
import bcrypt from "bcryptjs";
import path from "node:path";
import fs from "node:fs";
import { eq, and, desc, ilike, or, count, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  admins,
  tutors,
  tutorSubjects,
  tutorLevels,
  subjects,
  levels,
  verificationDocuments,
  interviewSessions,
  payments,
  appeals,
  enquiries,
  reviews,
} from "../db/schema.js";
import {
  adminAuth,
  setAdminCookie,
  clearAdminCookie,
} from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../middleware/errorHandler.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { loginSchema, VERIFICATION_STATUSES } from "@sgtutors/shared";
import { privateDocsDir } from "../config.js";
import { photoUrlFor } from "../services/storage.js";
import { downloadDriveFile } from "../services/gdrive.js";
import { sendEmail } from "../services/email.js";
import { z } from "zod";

export const adminRouter = Router();

adminRouter.post(
  "/login",
  rateLimit({ windowMs: 900_000, max: 10, keyPrefix: "admin-login" }),
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const [admin] = await db.select().from(admins).where(eq(admins.email, email));
    if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
      throw new HttpError(401, "Invalid credentials");
    }
    setAdminCookie(res, admin.id);
    res.json({ id: admin.id });
  })
);

adminRouter.post("/logout", (_req, res) => {
  clearAdminCookie(res);
  res.json({ ok: true });
});

adminRouter.use(adminAuth);

adminRouter.get("/session", (req, res) => {
  res.json({ adminId: req.adminId });
});

/* ---------------- Tutors ---------------- */

adminRouter.get(
  "/tutors",
  asyncHandler(async (req, res) => {
    const status = req.query.status;
    const q = typeof req.query.q === "string" ? req.query.q.slice(0, 100) : undefined;
    const conditions = [];
    if (
      typeof status === "string" &&
      (VERIFICATION_STATUSES as readonly string[]).includes(status)
    ) {
      conditions.push(eq(tutors.verificationStatus, status as never));
    }
    if (q) {
      conditions.push(
        or(
          ilike(tutors.displayName, `%${q}%`),
          ilike(tutors.fullName, `%${q}%`),
          ilike(tutors.email, `%${q}%`)
        )
      );
    }
    const rows = await db
      .select({
        id: tutors.id,
        fullName: tutors.fullName,
        displayName: tutors.displayName,
        email: tutors.email,
        mobile: tutors.mobile,
        verificationStatus: tutors.verificationStatus,
        featuredUntil: tutors.featuredUntil,
        isActive: tutors.isActive,
        expiresAt: tutors.expiresAt,
        createdAt: tutors.createdAt,
      })
      .from(tutors)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(tutors.createdAt))
      .limit(200);
    res.json(rows);
  })
);

adminRouter.get(
  "/tutors/:id",
  asyncHandler(async (req, res) => {
    const [tutor] = await db.select().from(tutors).where(eq(tutors.id, req.params.id));
    if (!tutor) throw new HttpError(404, "Tutor not found");
    const { passwordHash: _ph, ...safe } = tutor;

    const subs = await db
      .select({ id: subjects.id, name: subjects.name })
      .from(tutorSubjects)
      .innerJoin(subjects, eq(subjects.id, tutorSubjects.subjectId))
      .where(eq(tutorSubjects.tutorId, tutor.id));
    const lvls = await db
      .select({ id: levels.id, name: levels.name })
      .from(tutorLevels)
      .innerJoin(levels, eq(levels.id, tutorLevels.levelId))
      .where(eq(tutorLevels.tutorId, tutor.id));
    const docs = await db
      .select({
        id: verificationDocuments.id,
        docType: verificationDocuments.docType,
        uploadedAt: verificationDocuments.uploadedAt,
      })
      .from(verificationDocuments)
      .where(eq(verificationDocuments.tutorId, tutor.id));
    const interviews = await db
      .select({
        id: interviewSessions.id,
        state: interviewSessions.state,
        subject: interviewSessions.subject,
        score: interviewSessions.score,
        startedAt: interviewSessions.startedAt,
        completedAt: interviewSessions.completedAt,
      })
      .from(interviewSessions)
      .where(eq(interviewSessions.tutorId, tutor.id))
      .orderBy(desc(interviewSessions.startedAt));
    const pays = await db
      .select()
      .from(payments)
      .where(eq(payments.tutorId, tutor.id))
      .orderBy(desc(payments.createdAt));
    const tutorAppeals = await db
      .select()
      .from(appeals)
      .where(eq(appeals.tutorId, tutor.id))
      .orderBy(desc(appeals.createdAt));

    res.json({
      ...safe,
      photoUrl: photoUrlFor(tutor.photoPath),
      subjects: subs,
      levels: lvls,
      documents: docs,
      interviews,
      payments: pays,
      appeals: tutorAppeals,
    });
  })
);

/** The ONLY route that serves files from the private docs directory. */
adminRouter.get(
  "/files/:docId",
  asyncHandler(async (req, res) => {
    const [doc] = await db
      .select()
      .from(verificationDocuments)
      .where(eq(verificationDocuments.id, req.params.docId));
    if (!doc) throw new HttpError(404, "Document not found");
    // Preferred: stream straight from Google Drive (nothing lives on the VPS)
    if (doc.gdriveFileId) {
      const remote = await downloadDriveFile(doc.gdriveFileId);
      if (!remote) throw new HttpError(502, "Could not fetch document from Drive");
      res.setHeader("Content-Type", remote.mimeType);
      remote.stream.pipe(res);
      return;
    }
    // Dev fallback: local disk
    const safeName = path.basename(doc.filePath);
    const fullPath = path.join(privateDocsDir, safeName);
    if (!fs.existsSync(fullPath)) throw new HttpError(404, "File missing on disk");
    res.setHeader(
      "Content-Type",
      safeName.endsWith(".pdf") ? "application/pdf" : "image/*"
    );
    res.sendFile(fullPath);
  })
);

adminRouter.get(
  "/interviews/:id",
  asyncHandler(async (req, res) => {
    const [session] = await db
      .select()
      .from(interviewSessions)
      .where(eq(interviewSessions.id, req.params.id));
    if (!session) throw new HttpError(404, "Interview not found");
    res.json(session);
  })
);

const decisionSchema = z.object({ reason: z.string().trim().max(1000).optional() });

adminRouter.post(
  "/tutors/:id/verify",
  asyncHandler(async (req, res) => {
    const [tutor] = await db
      .update(tutors)
      .set({
        verificationStatus: "verified",
        verifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tutors.id, req.params.id))
      .returning();
    if (!tutor) throw new HttpError(404, "Tutor not found");
    await db
      .update(appeals)
      .set({ resolved: true, outcome: "verified" })
      .where(and(eq(appeals.tutorId, tutor.id), eq(appeals.resolved, false)));
    await sendEmail({
      to: tutor.email,
      subject: "[SG Tutors] You are now a Verified Tutor!",
      text: `Hi ${tutor.displayName},\n\nFollowing your review, you are now a Verified Tutor. The badge is live on your profile.\n\n— SG Tutors`,
    });
    res.json({ ok: true });
  })
);

adminRouter.post(
  "/tutors/:id/reject",
  asyncHandler(async (req, res) => {
    const { reason } = decisionSchema.parse(req.body);
    const [tutor] = await db
      .update(tutors)
      .set({ verificationStatus: "rejected", updatedAt: new Date() })
      .where(eq(tutors.id, req.params.id))
      .returning();
    if (!tutor) throw new HttpError(404, "Tutor not found");
    await db
      .update(appeals)
      .set({ resolved: true, outcome: "rejected", adminNotes: reason ?? null })
      .where(and(eq(appeals.tutorId, tutor.id), eq(appeals.resolved, false)));
    await sendEmail({
      to: tutor.email,
      subject: "[SG Tutors] Verification decision",
      text: `Hi ${tutor.displayName},\n\nWe are unable to verify your profile at this time.${reason ? `\n\nReason: ${reason}` : ""}\n\n— SG Tutors`,
    });
    res.json({ ok: true });
  })
);

const tutorAdminUpdateSchema = z.object({
  isActive: z.boolean().optional(),
});

adminRouter.patch(
  "/tutors/:id",
  asyncHandler(async (req, res) => {
    const input = tutorAdminUpdateSchema.parse(req.body);
    const [tutor] = await db
      .update(tutors)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(tutors.id, req.params.id))
      .returning({ id: tutors.id, isActive: tutors.isActive });
    if (!tutor) throw new HttpError(404, "Tutor not found");
    res.json(tutor);
  })
);

/* ---------------- Appeals ---------------- */

adminRouter.get(
  "/appeals",
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select({
        id: appeals.id,
        tutorId: appeals.tutorId,
        tutorName: tutors.displayName,
        tutorEmail: tutors.email,
        reason: appeals.reason,
        liveInterviewAt: appeals.liveInterviewAt,
        adminNotes: appeals.adminNotes,
        resolved: appeals.resolved,
        outcome: appeals.outcome,
        createdAt: appeals.createdAt,
        interviewSessionId: appeals.interviewSessionId,
      })
      .from(appeals)
      .innerJoin(tutors, eq(tutors.id, appeals.tutorId))
      .orderBy(desc(appeals.createdAt));
    res.json(rows);
  })
);

const appealUpdateSchema = z.object({
  liveInterviewAt: z.string().datetime().optional(),
  adminNotes: z.string().max(2000).optional(),
});

adminRouter.patch(
  "/appeals/:id",
  asyncHandler(async (req, res) => {
    const input = appealUpdateSchema.parse(req.body);
    const [appeal] = await db
      .update(appeals)
      .set({
        ...(input.liveInterviewAt
          ? { liveInterviewAt: new Date(input.liveInterviewAt) }
          : {}),
        ...(input.adminNotes !== undefined ? { adminNotes: input.adminNotes } : {}),
      })
      .where(eq(appeals.id, req.params.id))
      .returning();
    if (!appeal) throw new HttpError(404, "Appeal not found");

    if (input.liveInterviewAt) {
      const [tutor] = await db
        .update(tutors)
        .set({ verificationStatus: "live_interview_scheduled", updatedAt: new Date() })
        .where(eq(tutors.id, appeal.tutorId))
        .returning();
      if (tutor) {
        await sendEmail({
          to: tutor.email,
          subject: "[SG Tutors] Your live verification interview is scheduled",
          text: `Hi ${tutor.displayName},\n\nYour live verification interview is scheduled for ${new Date(input.liveInterviewAt).toLocaleString("en-SG", { timeZone: "Asia/Singapore" })} (Singapore time). We will contact you with the meeting details.\n\n— SG Tutors`,
        });
      }
    }
    res.json(appeal);
  })
);

/* ---------------- Enquiries & Reviews ---------------- */

adminRouter.get(
  "/enquiries",
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select({
        id: enquiries.id,
        tutorId: enquiries.tutorId,
        tutorName: tutors.displayName,
        name: enquiries.name,
        email: enquiries.email,
        phone: enquiries.phone,
        message: enquiries.message,
        emailSent: enquiries.emailSent,
        createdAt: enquiries.createdAt,
      })
      .from(enquiries)
      .innerJoin(tutors, eq(tutors.id, enquiries.tutorId))
      .orderBy(desc(enquiries.createdAt))
      .limit(500);
    res.json(rows);
  })
);

adminRouter.get(
  "/reviews",
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select({
        id: reviews.id,
        tutorId: reviews.tutorId,
        tutorName: tutors.displayName,
        reviewerName: reviews.reviewerName,
        rating: reviews.rating,
        comment: reviews.comment,
        isHidden: reviews.isHidden,
        createdAt: reviews.createdAt,
      })
      .from(reviews)
      .innerJoin(tutors, eq(tutors.id, reviews.tutorId))
      .orderBy(desc(reviews.createdAt))
      .limit(500);
    res.json(rows);
  })
);

adminRouter.patch(
  "/reviews/:id",
  asyncHandler(async (req, res) => {
    const { isHidden } = z.object({ isHidden: z.boolean() }).parse(req.body);
    const [row] = await db
      .update(reviews)
      .set({ isHidden })
      .where(eq(reviews.id, req.params.id))
      .returning({ id: reviews.id, isHidden: reviews.isHidden });
    if (!row) throw new HttpError(404, "Review not found");
    res.json(row);
  })
);

/* ---------------- Stats ---------------- */

adminRouter.get(
  "/stats",
  asyncHandler(async (_req, res) => {
    const [{ totalTutors }] = await db.select({ totalTutors: count() }).from(tutors);
    const [{ verified }] = await db
      .select({ verified: count() })
      .from(tutors)
      .where(eq(tutors.verificationStatus, "verified"));
    const [{ pendingAppeals }] = await db
      .select({ pendingAppeals: count() })
      .from(appeals)
      .where(eq(appeals.resolved, false));
    const [{ totalEnquiries }] = await db
      .select({ totalEnquiries: count() })
      .from(enquiries);
    res.json({
      totalTutors: Number(totalTutors),
      verified: Number(verified),
      pendingAppeals: Number(pendingAppeals),
      totalEnquiries: Number(totalEnquiries),
    });
  })
);

/* ---------------- Overview dashboard ---------------- */

adminRouter.get(
  "/overview",
  asyncHandler(async (_req, res) => {
    // Headline counts
    const countsResult = await db.execute(sql`
      SELECT
        (SELECT count(*) FROM tutors)                                                        AS total_tutors,
        (SELECT count(*) FROM tutors WHERE verification_status = 'verified')                 AS verified_tutors,
        (SELECT count(*) FROM tutors WHERE featured_until IS NOT NULL AND featured_until > now()) AS featured_tutors,
        (SELECT count(*) FROM enquiries)                                                     AS total_enquiries,
        (SELECT count(*) FROM appeals WHERE NOT resolved)                                    AS pending_appeals,
        (SELECT coalesce(sum(amount_cents), 0) FROM payments WHERE status = 'paid')          AS revenue_total_cents,
        (SELECT coalesce(sum(amount_cents), 0) FROM payments
          WHERE status = 'paid' AND paid_at >= date_trunc('month', now()))                   AS revenue_this_month_cents
    `);
    const counts = countsResult.rows[0] as Record<string, string>;

    // Monthly revenue, last 12 months, split by purpose
    const monthlyResult = await db.execute(sql`
      SELECT
        to_char(date_trunc('month', paid_at), 'YYYY-MM') AS month,
        coalesce(sum(amount_cents) FILTER (WHERE purpose = 'verification'), 0) AS verification_cents,
        coalesce(sum(amount_cents) FILTER (WHERE purpose = 'featured'), 0)     AS featured_cents,
        coalesce(sum(amount_cents), 0)                                          AS total_cents
      FROM payments
      WHERE status = 'paid' AND paid_at >= date_trunc('month', now()) - interval '11 months'
      GROUP BY 1 ORDER BY 1
    `);

    // Popular tutors = most enquiries (enquiry data captured per tutor)
    const popularResult = await db.execute(sql`
      SELECT t.id, t.display_name, t.verification_status,
        (t.featured_until IS NOT NULL AND t.featured_until > now()) AS is_featured,
        count(e.id)                                       AS enquiry_count,
        (SELECT count(*) FROM reviews r WHERE r.tutor_id = t.id AND NOT r.is_hidden)         AS review_count,
        (SELECT round(avg(r.rating), 1) FROM reviews r WHERE r.tutor_id = t.id AND NOT r.is_hidden) AS avg_rating
      FROM tutors t
      LEFT JOIN enquiries e ON e.tutor_id = t.id
      GROUP BY t.id
      ORDER BY enquiry_count DESC, review_count DESC
      LIMIT 10
    `);

    // Current featured tutors with expiry
    const featuredResult = await db.execute(sql`
      SELECT id, display_name, featured_until
      FROM tutors
      WHERE featured_until IS NOT NULL AND featured_until > now()
      ORDER BY featured_until ASC
      LIMIT 20
    `);

    // Recently verified tutors
    const verifiedResult = await db.execute(sql`
      SELECT id, display_name, updated_at
      FROM tutors
      WHERE verification_status = 'verified'
      ORDER BY updated_at DESC
      LIMIT 20
    `);

    res.json({
      totals: {
        tutors: Number(counts.total_tutors),
        verified: Number(counts.verified_tutors),
        featured: Number(counts.featured_tutors),
        enquiries: Number(counts.total_enquiries),
        pendingAppeals: Number(counts.pending_appeals),
        revenueTotalCents: Number(counts.revenue_total_cents),
        revenueThisMonthCents: Number(counts.revenue_this_month_cents),
      },
      monthlyRevenue: monthlyResult.rows,
      popularTutors: popularResult.rows,
      featuredTutors: featuredResult.rows,
      verifiedTutors: verifiedResult.rows,
    });
  })
);
