import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client.js";
import { leads } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { asyncHandler, HttpError } from "../middleware/errorHandler.js";
import { rateLimit, ipHash } from "../middleware/rateLimit.js";
import { sendEmail } from "../services/email.js";
import { config } from "../config.js";

export const leadsRouter = Router();

const rateGuideSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  // PDPA: consent must be affirmative — a false value is a validation failure,
  // not a silently-stored "no".
  consent: z.literal(true, {
    message: "Consent is required to receive the guide",
  }),
});

const GUIDE_PATH = "/guides/singapore-tuition-rate-guide.pdf";

/**
 * Lead magnet capture — "Singapore Tuition Rate Guide".
 *
 * Rate-limited per IP because it is an unauthenticated, email-sending endpoint.
 * Re-submitting a known address re-sends the guide but does not duplicate the
 * row, and never resurrects an unsubscribed address.
 */
leadsRouter.post(
  "/rate-guide",
  rateLimit({ windowMs: 3_600_000, max: 5, keyPrefix: "lead-rate-guide" }),
  asyncHandler(async (req, res) => {
    const input = rateGuideSchema.parse(req.body);
    const now = new Date();
    const origin = (config.PUBLIC_SITE_URL || config.APP_URL).replace(/\/$/, "");

    const [existing] = await db.select().from(leads).where(eq(leads.email, input.email));

    if (existing?.unsubscribedAt) {
      // Honour the withdrawal: don't re-subscribe, don't email, don't reveal
      // the address's status to an anonymous caller.
      throw new HttpError(
        403,
        "This address has unsubscribed. Contact us if you'd like to resubscribe."
      );
    }

    if (existing) {
      await db
        .update(leads)
        .set({ consent: true, consentAt: now })
        .where(eq(leads.id, existing.id));
    } else {
      await db.insert(leads).values({
        email: input.email,
        source: "rate-guide",
        consent: true,
        consentAt: now,
        ipHash: ipHash(req),
      });
    }

    await sendEmail({
      to: input.email,
      subject: "Your 2026 Singapore Tuition Rate Guide",
      text: [
        "Thanks for requesting the 2026 Singapore Tuition Rate Guide.",
        "",
        `Download it here: ${origin}${GUIDE_PATH}`,
        "",
        "Inside: hourly rate ranges for every level from P1 to JC2, how part-time,",
        "full-time and ex-MOE tutor rates compare, and five questions worth asking",
        "a tutor before you commit.",
        "",
        `Browse verified tutors: ${origin}/tutors`,
        "",
        "You're receiving this because you requested the guide on SG Tutors.",
        `Unsubscribe: ${origin}/api/leads/unsubscribe?email=${encodeURIComponent(input.email)}`,
      ].join("\n"),
      html: `
        <p>Hi there,</p>
        <p>Thanks for requesting the <strong>2026 Singapore Tuition Rate Guide</strong>.
        You can download it here:</p>
        <p><a href="${origin}${GUIDE_PATH}">Download the rate guide (PDF)</a></p>
        <p>Inside you'll find hourly rate ranges for every level from P1 to JC2, how
        part-time, full-time and ex-MOE tutor rates compare, and five questions worth
        asking a tutor before you commit.</p>
        <p>When you're ready, you can <a href="${origin}/tutors">browse verified tutors</a>
        — enquiring is always free.</p>
        <p style="color:#64748b;font-size:12px">
          You're receiving this because you requested the guide on SG Tutors.
          <a href="${origin}/api/leads/unsubscribe?email=${encodeURIComponent(input.email)}">Unsubscribe</a>
        </p>
      `,
    });

    res.json({ ok: true });
  })
);

/**
 * One-click unsubscribe. GET so it works straight from an email client.
 * Idempotent, and deliberately returns the same page for unknown addresses so
 * the endpoint can't be used to test whether an address is on the list.
 */
leadsRouter.get(
  "/unsubscribe",
  rateLimit({ windowMs: 3_600_000, max: 30, keyPrefix: "lead-unsub" }),
  asyncHandler(async (req, res) => {
    const email = z.string().trim().toLowerCase().email().safeParse(req.query.email);
    if (email.success) {
      await db
        .update(leads)
        .set({ unsubscribedAt: new Date(), consent: false })
        .where(eq(leads.email, email.data));
    }
    res
      .type("html")
      .send(
        `<!doctype html><meta charset="utf-8"><title>Unsubscribed — SG Tutors</title>` +
          `<div style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem">` +
          `<h1 style="font-size:1.25rem">You've been unsubscribed</h1>` +
          `<p style="color:#475569">You won't receive further marketing email from SG Tutors. ` +
          `Enquiry and account emails are unaffected.</p>` +
          `<p><a href="${(config.PUBLIC_SITE_URL || config.APP_URL).replace(/\/$/, "")}/">Back to SG Tutors</a></p></div>`
      );
  })
);
