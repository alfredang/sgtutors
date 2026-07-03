import { Router, raw } from "express";
import type Stripe from "stripe";
import { config } from "../config.js";
import {
  stripe,
  recordStripeEvent,
  fulfillCheckoutSession,
  markPaymentFailed,
} from "../services/stripe.js";

export const stripeWebhookRouter = Router();

/**
 * Mounted BEFORE express.json() — signature verification needs the raw body.
 */
stripeWebhookRouter.post(
  "/stripe",
  raw({ type: "application/json" }),
  async (req, res) => {
    if (!stripe || !config.STRIPE_WEBHOOK_SECRET) {
      return res.status(503).json({ error: "Stripe not configured" });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        req.headers["stripe-signature"] as string,
        config.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("Stripe webhook signature verification failed:", err);
      return res.status(400).json({ error: "Invalid signature" });
    }

    try {
      const fresh = await recordStripeEvent(event.id);
      if (!fresh) return res.json({ received: true, duplicate: true });

      switch (event.type) {
        case "checkout.session.completed":
        case "checkout.session.async_payment_succeeded": {
          const session = event.data.object as Stripe.Checkout.Session;
          // PayNow completes asynchronously; only fulfil once actually paid
          if (session.payment_status === "paid") {
            await fulfillCheckoutSession(
              session.id,
              typeof session.payment_intent === "string"
                ? session.payment_intent
                : null
            );
          }
          break;
        }
        case "checkout.session.async_payment_failed": {
          const session = event.data.object as Stripe.Checkout.Session;
          await markPaymentFailed(session.id);
          break;
        }
        case "checkout.session.expired": {
          const session = event.data.object as Stripe.Checkout.Session;
          await markPaymentFailed(session.id);
          break;
        }
        default:
          break;
      }
      res.json({ received: true });
    } catch (err) {
      console.error("Stripe webhook processing error:", err);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  }
);
