import { Router } from "express";
import { eq, and, desc, sql, count } from "drizzle-orm";
import { db } from "../db/client.js";
import { subjects, levels, reviews, enquiries, tutors } from "../db/schema.js";
import { asyncHandler, HttpError } from "../middleware/errorHandler.js";
import { rateLimit, ipHash, clientIp } from "../middleware/rateLimit.js";
import { searchTutors, getPublicTutor } from "../services/tutorQueries.js";
import { verifyTurnstile } from "../services/turnstile.js";
import { sendEnquiryEmails } from "../services/email.js";
import { reviewSchema, enquirySchema } from "@sgtutors/shared";

export const publicRouter = Router();

publicRouter.get(
  "/subjects",
  asyncHandler(async (_req, res) => {
    const rows = await db.select().from(subjects).orderBy(subjects.category, subjects.name);
    res.json(rows);
  })
);

publicRouter.get(
  "/levels",
  asyncHandler(async (_req, res) => {
    const rows = await db.select().from(levels).orderBy(levels.sortOrder);
    res.json(rows);
  })
);

publicRouter.get(
  "/tutors",
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const result = await searchTutors({
      subjectSlug: typeof req.query.subject === "string" ? req.query.subject : undefined,
      levelSlug: typeof req.query.level === "string" ? req.query.level : undefined,
      gender: typeof req.query.gender === "string" ? req.query.gender : undefined,
      region: typeof req.query.region === "string" ? req.query.region : undefined,
      q: typeof req.query.q === "string" ? req.query.q.slice(0, 100) : undefined,
      page,
      pageSize: 12,
    });
    res.json(result);
  })
);

publicRouter.get(
  "/tutors/featured",
  asyncHandler(async (_req, res) => {
    const result = await searchTutors({
      page: 1,
      pageSize: 8,
      featuredOnly: true,
    });
    res.json(result.items);
  })
);

publicRouter.get(
  "/tutors/:id",
  asyncHandler(async (req, res) => {
    const tutor = await getPublicTutor(req.params.id);
    if (!tutor) throw new HttpError(404, "Tutor not found");
    res.json(tutor);
  })
);

publicRouter.get(
  "/tutors/:id/reviews",
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = 10;
    const items = await db
      .select({
        id: reviews.id,
        reviewerName: reviews.reviewerName,
        rating: reviews.rating,
        comment: reviews.comment,
        createdAt: reviews.createdAt,
      })
      .from(reviews)
      .where(and(eq(reviews.tutorId, req.params.id), eq(reviews.isHidden, false)))
      .orderBy(desc(reviews.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    const [{ total }] = await db
      .select({ total: count() })
      .from(reviews)
      .where(and(eq(reviews.tutorId, req.params.id), eq(reviews.isHidden, false)));
    res.json({ items, page, pageSize, total: Number(total) });
  })
);

publicRouter.post(
  "/tutors/:id/reviews",
  rateLimit({ windowMs: 24 * 3600_000, max: 3, keyPrefix: "review-ip" }),
  asyncHandler(async (req, res) => {
    const input = reviewSchema.parse(req.body);
    const tutor = await getPublicTutor(req.params.id);
    if (!tutor) throw new HttpError(404, "Tutor not found");

    const hash = ipHash(req);
    // One review per IP per tutor per day
    const [{ existing }] = await db
      .select({ existing: count() })
      .from(reviews)
      .where(
        and(
          eq(reviews.tutorId, req.params.id),
          eq(reviews.ipHash, hash),
          sql`${reviews.createdAt} > now() - interval '1 day'`
        )
      );
    if (Number(existing) > 0) {
      throw new HttpError(429, "You have already reviewed this tutor today");
    }

    const [row] = await db
      .insert(reviews)
      .values({
        tutorId: req.params.id,
        reviewerName: input.reviewerName,
        rating: input.rating,
        comment: input.comment,
        ipHash: hash,
      })
      .returning({ id: reviews.id });
    res.status(201).json({ id: row.id });
  })
);

publicRouter.post(
  "/tutors/:id/enquiries",
  rateLimit({ windowMs: 3600_000, max: 5, keyPrefix: "enquiry-ip" }),
  asyncHandler(async (req, res) => {
    const input = enquirySchema.parse(req.body);

    const ok = await verifyTurnstile(input.turnstileToken, clientIp(req));
    if (!ok) throw new HttpError(400, "Captcha verification failed — please retry");

    // Need the tutor's private email for notification: fetch the raw row,
    // but only ever RETURN public data.
    const [tutor] = await db
      .select({
        id: tutors.id,
        email: tutors.email,
        displayName: tutors.displayName,
        isActive: tutors.isActive,
        expiresAt: tutors.expiresAt,
      })
      .from(tutors)
      .where(eq(tutors.id, req.params.id));
    if (!tutor || !tutor.isActive || tutor.expiresAt <= new Date()) {
      throw new HttpError(404, "Tutor not found");
    }

    const emailSent = await sendEnquiryEmails({
      tutorEmail: tutor.email,
      tutorName: tutor.displayName,
      enquirerName: input.name,
      enquirerEmail: input.email,
      enquirerPhone: input.phone,
      message: input.message,
    });

    await db.insert(enquiries).values({
      tutorId: tutor.id,
      name: input.name,
      email: input.email,
      phone: input.phone,
      message: input.message,
      ipHash: ipHash(req),
      emailSent,
    });

    res.status(201).json({ ok: true });
  })
);
