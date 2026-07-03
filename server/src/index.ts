import express from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { config, publicPhotosDir, privateDocsDir, assertInterviewAuth } from "./config.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { publicRouter } from "./routes/publicApi.js";
import { authTutorRouter } from "./routes/authTutor.js";
import { tutorRouter } from "./routes/tutor.js";
import { adminRouter } from "./routes/admin.js";
import { stripeWebhookRouter } from "./routes/stripeWebhook.js";
import { startRetentionSweeper } from "./services/retention.js";

const app = express();
app.disable("x-powered-by");

// Stripe webhook needs the raw body — mount before the JSON parser
app.use("/api/webhooks", stripeWebhookRouter);

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// Public photo files (passport photos only; NRIC/cert docs are NOT here)
fs.mkdirSync(publicPhotosDir, { recursive: true });
fs.mkdirSync(privateDocsDir, { recursive: true });
app.use(
  "/api/uploads/photos",
  express.static(publicPhotosDir, { maxAge: "7d", index: false, dotfiles: "deny" })
);

app.use("/api", publicRouter);
app.use("/api/auth/tutor", authTutorRouter);
app.use("/api/tutor", tutorRouter);
app.use("/api/admin", adminRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Production: serve the built client
const here = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(here, "../../client/dist");
if (config.NODE_ENV === "production" && fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
}

app.use(errorHandler);

// PDPA: erase verification docs N months after verification (default 3)
startRetentionSweeper();

app.listen(config.PORT, () => {
  console.log(`SG Tutors API listening on http://localhost:${config.PORT}`);
  const interviewAuth = assertInterviewAuth();
  if (interviewAuth) {
    console.log(`AI interview auth: ${interviewAuth}`);
  } else {
    console.warn(
      "WARNING: no CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY set — the Agent SDK will fall back to the local `claude` CLI login if available; AI interviews may fail otherwise."
    );
  }
  if (!config.STRIPE_SECRET_KEY) {
    console.warn("WARNING: STRIPE_SECRET_KEY not set — payment routes return 503.");
  }
});
