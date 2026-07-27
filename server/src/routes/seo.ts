import { Router } from "express";
import { db } from "../db/client.js";
import { tutors } from "../db/schema.js";
import { eq, and, gt } from "drizzle-orm";
import { config } from "../config.js";

export const seoRouter = Router();

/** Public site origin used in absolute sitemap URLs. */
function siteOrigin() {
  return (config.PUBLIC_SITE_URL || config.APP_URL).replace(/\/$/, "");
}

function xmlEscape(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface UrlEntry {
  loc: string;
  changefreq: string;
  priority: string;
  lastmod?: string;
}

/**
 * Dynamic sitemap — static marketing routes plus every live tutor profile.
 * Generated on request so newly listed tutors are discoverable without a rebuild.
 * Only listings that are publicly visible are included; private/expired ones
 * are excluded so we never advertise a 404 or a hidden profile.
 */
seoRouter.get("/sitemap.xml", async (_req, res, next) => {
  try {
    const origin = siteOrigin();

    const staticUrls: UrlEntry[] = [
      { loc: "/", changefreq: "daily", priority: "1.0" },
      { loc: "/tutors", changefreq: "daily", priority: "0.9" },
      { loc: "/signup", changefreq: "monthly", priority: "0.7" },
      { loc: "/privacy", changefreq: "yearly", priority: "0.3" },
    ];

    // Same visibility gate the public search uses: active and not expired.
    const rows = await db
      .select({ id: tutors.id, updatedAt: tutors.updatedAt })
      .from(tutors)
      .where(and(eq(tutors.isActive, true), gt(tutors.expiresAt, new Date())));

    const tutorUrls: UrlEntry[] = rows.map((t) => ({
      loc: `/tutors/${t.id}`,
      changefreq: "weekly",
      priority: "0.8",
      lastmod: t.updatedAt ? new Date(t.updatedAt).toISOString().slice(0, 10) : undefined,
    }));

    const body = [...staticUrls, ...tutorUrls]
      .map(
        (u) =>
          `  <url>\n    <loc>${xmlEscape(origin + u.loc)}</loc>\n` +
          (u.lastmod ? `    <lastmod>${u.lastmod}</lastmod>\n` : "") +
          `    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
      )
      .join("\n");

    res.type("application/xml").send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`
    );
  } catch (err) {
    next(err);
  }
});
