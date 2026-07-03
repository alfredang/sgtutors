import Stripe from "stripe";
import { eq, and, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { payments, stripeEvents, tutors } from "../db/schema.js";
import { config } from "../config.js";
import { HttpError } from "../middleware/errorHandler.js";
import { sendEmail } from "./email.js";
import {
  VERIFICATION_FEE_CENTS,
  FEATURED_FEE_CENTS,
  type PaymentPurpose,
} from "@sgtutors/shared";

export const stripe = config.STRIPE_SECRET_KEY
  ? new Stripe(config.STRIPE_SECRET_KEY)
  : null;

function requireStripe(): Stripe {
  if (!stripe) {
    throw new HttpError(
      503,
      "Payments are not configured (STRIPE_SECRET_KEY missing)"
    );
  }
  return stripe;
}

export async function createCheckout(opts: {
  tutorId: string;
  purpose: PaymentPurpose;
}): Promise<{ url: string; sessionId: string }> {
  const s = requireStripe();
  const isVerification = opts.purpose === "verification";
  const amount = isVerification ? VERIFICATION_FEE_CENTS : FEATURED_FEE_CENTS;

  let session: Stripe.Checkout.Session;
  try {
    session = await s.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card", "paynow"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "sgd",
          unit_amount: amount,
          product_data: {
            name: isVerification
              ? "Tutor Verification Fee (one-time, non-refundable)"
              : "Featured Listing (3 months)",
          },
        },
      },
    ],
    metadata: { tutor_id: opts.tutorId, purpose: opts.purpose },
    success_url: `${config.APP_URL}/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.APP_URL}/dashboard?payment=cancelled`,
    });
  } catch (err) {
    console.error("Stripe checkout creation failed:", err);
    throw new HttpError(
      502,
      "Payment provider is unavailable — check the Stripe configuration or try again later"
    );
  }

  if (!session.url) throw new HttpError(500, "Stripe did not return a checkout URL");

  await db.insert(payments).values({
    tutorId: opts.tutorId,
    purpose: opts.purpose,
    amountCents: amount,
    stripeSessionId: session.id,
    status: "pending",
  });

  return { url: session.url, sessionId: session.id };
}

/**
 * Idempotent fulfilment. Safe to call from the webhook AND from the
 * success-page fallback — the guarded payments-status UPDATE ensures the
 * side effects run exactly once per session.
 */
export async function fulfillCheckoutSession(
  sessionId: string,
  paymentIntent: string | null
): Promise<void> {
  await db.transaction(async (tx) => {
    const updated = await tx
      .update(payments)
      .set({
        status: "paid",
        paidAt: new Date(),
        stripePaymentIntent: paymentIntent,
      })
      .where(
        and(eq(payments.stripeSessionId, sessionId), eq(payments.status, "pending"))
      )
      .returning();

    if (updated.length === 0) return; // already fulfilled or unknown session
    const payment = updated[0];

    if (payment.purpose === "verification") {
      await tx
        .update(tutors)
        .set({ verificationStatus: "docs_pending", updatedAt: new Date() })
        .where(
          and(
            eq(tutors.id, payment.tutorId),
            eq(tutors.verificationStatus, "payment_pending")
          )
        );
    } else if (payment.purpose === "featured") {
      await tx
        .update(tutors)
        .set({
          featuredUntil: sql`greatest(coalesce(${tutors.featuredUntil}, now()), now()) + interval '3 months'`,
          updatedAt: new Date(),
        })
        .where(eq(tutors.id, payment.tutorId));
    }
  });

  // Notify the tutor (outside the transaction; failure is non-fatal)
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.stripeSessionId, sessionId));
  if (payment) {
    const [tutor] = await db
      .select({ email: tutors.email, displayName: tutors.displayName })
      .from(tutors)
      .where(eq(tutors.id, payment.tutorId));
    if (tutor) {
      const subject =
        payment.purpose === "verification"
          ? "Payment received — next step: upload your documents"
          : "You are now a Featured Tutor!";
      const text =
        payment.purpose === "verification"
          ? `Hi ${tutor.displayName},\n\nWe received your S$50 verification payment. Log in to your dashboard to upload your NRIC (front and back) and highest qualification certificate, then complete the 10-minute AI interview.\n\n— SG Tutors`
          : `Hi ${tutor.displayName},\n\nYour S$100 payment was received. Your profile is now featured for 3 months and will appear at the top of search results.\n\n— SG Tutors`;
      await sendEmail({ to: tutor.email, subject: `[SG Tutors] ${subject}`, text });
    }
  }
}

export async function markPaymentFailed(sessionId: string): Promise<void> {
  await db
    .update(payments)
    .set({ status: "failed" })
    .where(
      and(eq(payments.stripeSessionId, sessionId), eq(payments.status, "pending"))
    );
}

/** Webhook event dedupe: returns true if this event was not seen before. */
export async function recordStripeEvent(eventId: string): Promise<boolean> {
  const inserted = await db
    .insert(stripeEvents)
    .values({ eventId })
    .onConflictDoNothing()
    .returning();
  return inserted.length > 0;
}

/** Success-page fallback for dev without `stripe listen`. */
export async function reconcileSession(sessionId: string): Promise<void> {
  const s = requireStripe();
  const session = await s.checkout.sessions.retrieve(sessionId);
  if (session.payment_status === "paid") {
    await fulfillCheckoutSession(
      session.id,
      typeof session.payment_intent === "string" ? session.payment_intent : null
    );
  }
}
