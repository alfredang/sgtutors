import { useEffect } from "react";

const SITE_NAME = "SG Tutors";
const DEFAULT_OG = "/og-image.png";

/** Public origin — configurable so staging doesn't emit production canonicals. */
export const SITE_ORIGIN =
  import.meta.env.VITE_SITE_ORIGIN?.replace(/\/$/, "") ||
  (typeof window !== "undefined" ? window.location.origin : "");

function upsertMeta(selector: string, attrs: Record<string, string>) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    document.head.appendChild(el);
  }
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export interface SeoProps {
  title: string;
  description: string;
  /** Path only, e.g. "/tutors" — origin is prepended. */
  path?: string;
  image?: string;
  /** Set on pages that must not be indexed (dashboards, admin, interview). */
  noindex?: boolean;
  /** JSON-LD objects rendered into a single script tag. */
  jsonLd?: object | object[];
}

/**
 * Per-route document head for this client-rendered SPA.
 *
 * NOTE: this fixes metadata for crawlers that execute JS (Google) and for
 * social/link unfurlers that read the served HTML *only* if the page is
 * prerendered. Non-JS unfurlers (WhatsApp, Telegram, Slack) still see the
 * static tags in index.html — see docs/SEO.md for the prerender follow-up.
 */
export function Seo({ title, description, path, image, noindex, jsonLd }: SeoProps) {
  useEffect(() => {
    const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
    document.title = fullTitle;

    upsertMeta('meta[name="description"]', { name: "description", content: description });

    const url = path ? `${SITE_ORIGIN}${path}` : SITE_ORIGIN;
    upsertLink("canonical", url);

    upsertMeta('meta[name="robots"]', {
      name: "robots",
      content: noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large",
    });

    const ogImage = `${SITE_ORIGIN}${image ?? DEFAULT_OG}`;
    const og: Record<string, string> = {
      "og:title": fullTitle,
      "og:description": description,
      "og:type": "website",
      "og:url": url,
      "og:site_name": SITE_NAME,
      "og:locale": "en_SG",
      "og:image": ogImage,
    };
    for (const [property, content] of Object.entries(og)) {
      upsertMeta(`meta[property="${property}"]`, { property, content });
    }

    const twitter: Record<string, string> = {
      "twitter:card": "summary_large_image",
      "twitter:title": fullTitle,
      "twitter:description": description,
      "twitter:image": ogImage,
    };
    for (const [name, content] of Object.entries(twitter)) {
      upsertMeta(`meta[name="${name}"]`, { name, content });
    }
  }, [title, description, path, image, noindex]);

  useEffect(() => {
    if (!jsonLd) return;
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.dataset.seo = "route";
    script.textContent = JSON.stringify(jsonLd);
    document.head.appendChild(script);
    return () => {
      script.remove();
    };
  }, [jsonLd]);

  return null;
}

/** Sitewide Organization schema — rendered once from App. */
export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_ORIGIN,
    logo: `${SITE_ORIGIN}/og-image.png`,
    areaServed: { "@type": "Country", name: "Singapore" },
    parentOrganization: {
      "@type": "Organization",
      name: "Tertiary Infotech Academy Pte Ltd",
      url: "https://www.tertiaryinfotech.com/",
    },
  };
}

export function faqSchema(faqs: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_ORIGIN,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_ORIGIN}/tutors?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * Person schema for a tutor profile.
 * Only ever fed the public whitelist — no NRIC/DOB/address/phone/email.
 */
export function tutorSchema(t: {
  id: string;
  displayName: string;
  photoUrl?: string | null;
  highestQualification: string;
  subjects: { name: string }[];
  avgRating?: number | null;
  reviewCount?: number;
  region?: string;
}) {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: t.displayName,
    url: `${SITE_ORIGIN}/tutors/${t.id}`,
    jobTitle: "Private Tutor",
    hasCredential: t.highestQualification,
    knowsAbout: t.subjects.map((s) => s.name),
    areaServed: { "@type": "Place", name: t.region ?? "Singapore" },
  };
  if (t.photoUrl) schema.image = t.photoUrl;
  if (t.avgRating && t.reviewCount) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: t.avgRating,
      reviewCount: t.reviewCount,
      bestRating: 5,
      worstRating: 1,
    };
  }
  return schema;
}
