# SG Tutors — Product Marketing Context

Shared context for the installed marketing/design skills (`seo-audit`, `lead-magnets`,
`ui-ux-pro-max`, `design-taste-frontend`). Skills read this file before asking setup
questions — keep it accurate, it is the single source of product truth for them.

## What this is

**SG Tutors** — a two-sided tutor marketplace for Singapore. Tutors list themselves free
for one year, pay **S$50** to get verified (document checks + a 10-minute AI interview
scored by Claude), and pay **S$100 / 3 months** for featured placement. Parents and
students search by subject, level, gender and location, read reviews, and enquire directly.

- Web: React 18 + Vite + TypeScript + Tailwind (client-rendered SPA)
- API: Express + Drizzle + PostgreSQL 16
- iOS: **Tertiary SGTutors** — https://apps.apple.com/sg/app/tertiary-sgtutors/id6787160558
- Operator: Tertiary Infotech Academy Pte Ltd

## Audiences

| Segment | Who | Wants | Converts by |
|---|---|---|---|
| **Parents** (primary) | Singapore parents of P1–JC2 students | A trustworthy tutor near them, fast | Enquiry form on a tutor profile |
| **Students** | JC / poly / uni, self-serving | Subject-specific help, price clarity | Enquiry form |
| **Tutors** (supply) | Undergrads, MOE-trained, full-time tutors | Students, credibility, visibility | Free signup → S$50 verification → S$100 featured |

Revenue comes from the **tutor** side; discovery traffic comes from the **parent** side.
SEO and lead magnets should serve parents, because parent volume is what makes tutor
verification and featured placement worth buying.

## Positioning

**Trust is the product.** Anyone can list tutors; the differentiator is that a verified
tutor has passed identity checks, qualification review, and a subject-knowledge interview.
Lead with verification, not with "cheapest" or "largest database".

Voice: clear, warm, concrete, Singapore-local. Use real terms parents search for — PSLE,
O-Level, A-Level, IP, IB, Sec 3 A-Math, JC H2 Math. Avoid hype and avoid edtech jargon.

## SEO context (for `seo-audit`)

- **Site type**: two-sided local marketplace, Singapore-only (`en-SG`).
- **Goal**: organic parent traffic → tutor profile → enquiry.
- **Priority keyword shapes**:
  - `{subject} tuition singapore` — e.g. "secondary math tuition singapore"
  - `{level} {subject} tutor` — "jc h2 chemistry tutor", "psle english tutor"
  - `tuition in {region}` — "math tuition in tampines"
  - long tail: "how much does tuition cost in singapore"
- **Known baseline problems** (as of this file's writing):
  - Client-rendered SPA — one static `<title>`/description in `client/index.html` for all
    10 routes; crawlers see no per-route metadata.
  - No canonical tags, no Open Graph / Twitter cards, no `sitemap.xml`, no `robots.txt`.
  - No structured data. High-value targets: `Person` for tutor profiles, `Review` /
    `AggregateRating` for ratings, `FAQPage` for the home FAQ, `Organization` sitewide.
  - Tutor profile pages are the money pages and are entirely unindexed as a result.
- **Constraint**: PII is whitelisted server-side — NRIC, DOB, address, phone and email are
  **never** exposed publicly, only a coarse region. Never propose SEO content that would
  surface a tutor's personal data, and never put real tutor names/photos in schema markup
  beyond what the public profile already shows.

## Lead magnet context (for `lead-magnets`)

- **The ask today is too big**: the only conversion is "enquire about this specific tutor",
  which requires a parent to have already chosen someone. There is no low-commitment first step.
- **Capture we can offer**: email (we already run SMTP for enquiries/OTP) and the existing
  Turnstile-protected form pattern is reusable.
- **Fit ideas, ranked by fit to what the product already knows**:
  1. **Tuition rate guide** — real market rates by level and subject. We have the data shape
     for it and parents search this constantly.
  2. **Subject/level checklists** — "PSLE Math: what your child must master by P6".
  3. **Tutor shortlist by email** — parent picks subject + level, we email 5 matching verified
     tutors. Converts to enquiries directly and uses live inventory.
- **Compliance**: Singapore PDPA. Any email capture needs explicit consent, a stated purpose,
  and an unsubscribe path. Do not add tracking that shares parent data with third parties.

## Design context (for `ui-ux-pro-max` / `design-taste-frontend`)

- **Current state**: light/white theme, indigo `brand` scale (50/100/500/600/700) in
  `client/tailwind.config.js`; component classes `.btn-primary`, `.btn-secondary`, `.input`,
  `.label`, `.card` in `client/src/index.css`. Mobile-first.
- **Direction requested**: keep it light, make it more colorful and delightful — warmer accent
  colors, more depth and personality, without losing the trustworthy feel a marketplace
  handling payments and identity documents needs.
- **Featured tutor cards must be visually distinct** — a featured listing is a paid S$100
  placement, so it should read as premium at a glance, not just carry a small badge.
- **Hard constraints**:
  - Contrast ≥ 4.5:1 for body text; do not remove focus rings.
  - Touch targets ≥ 44×44px.
  - Never display tutor PII beyond the public whitelist (name, photo, coarse region,
    qualifications, subjects, ratings).
  - Trust signals (verified badge, review counts) must stay prominent — they are the product.
