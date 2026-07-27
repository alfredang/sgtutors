import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { TutorCard } from "../components/TutorCard";
import { LeadMagnet } from "../components/LeadMagnet";
import { Seo, faqSchema, websiteSchema } from "../components/Seo";
import type { PublicTutor, Subject, Level, Paginated } from "@sgtutors/shared";

/** Rotating chip colours so the subject strip reads as varied categories. */
const SUBJECT_CHIPS = [
  "border-brand-200 bg-brand-50 text-brand-700 hover:border-brand-400",
  "border-coral-200 bg-coral-50 text-coral-700 hover:border-coral-400",
  "border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-400",
  "border-grass-200 bg-grass-50 text-grass-700 hover:border-grass-400",
  "border-sunny-200 bg-sunny-50 text-sunny-800 hover:border-sunny-400",
];

const LEVEL_TILES = [
  "text-brand-700 hover:bg-brand-50",
  "text-coral-700 hover:bg-coral-50",
  "text-sky-700 hover:bg-sky-50",
  "text-grass-700 hover:bg-grass-50",
];

/**
 * Home FAQ — also the source for the FAQPage JSON-LD in seo.ts.
 * Answers must stay factually true to the product; they are indexed.
 */
export const HOME_FAQS = [
  {
    q: "How much does tuition cost in Singapore?",
    a: "Rates vary by level and tutor experience — part-time tutors typically charge less than full-time or ex-MOE tutors, and rates rise from primary to JC level. Each tutor on SG Tutors sets and displays their own rate, so you can compare before enquiring. Enquiring is always free.",
  },
  {
    q: "What does the verified badge actually mean?",
    a: "A verified tutor has passed three checks: identity (NRIC), qualification review (their highest certificate), and a subject-knowledge interview of 8 questions scored by AI, with a pass mark of 70%. Tutors who fail can appeal for a live interview with our team.",
  },
  {
    q: "Is it free to contact a tutor?",
    a: "Yes. Searching tutors and sending an enquiry is completely free for students and parents. We charge tutors, not families.",
  },
  {
    q: "How do I find a tutor near me?",
    a: "Use the region filter on the search page to narrow tutors to your area of Singapore — North, North-East, East, West or Central. You can combine this with subject and level filters.",
  },
  {
    q: "Is my personal data safe?",
    a: "Yes. Tutor NRIC numbers, dates of birth, addresses, phone numbers and email addresses are never displayed publicly — only a coarse region is shown. Verification documents are deleted three months after verification.",
  },
];

const VERIFY_STEPS = [
  {
    n: 1,
    title: "Pay S$50 fee",
    desc: "One-time, non-refundable verification fee via card or PayNow.",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
    ),
  },
  {
    n: 2,
    title: "Upload documents",
    desc: "NRIC front & back plus your highest qualification certificate — reviewed privately, never shown publicly.",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    ),
  },
  {
    n: 3,
    title: "10-min AI interview",
    desc: "Answer 8 subject questions from our AI examiner. Score 70% or above to pass. Failed? You can appeal for a live interview.",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
    ),
  },
  {
    n: 4,
    title: "Verified badge",
    desc: "Pass and the green verified badge goes live instantly — plus you unlock Featured placement.",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
    ),
  },
];

export function HomePage() {
  const navigate = useNavigate();
  const [featured, setFeatured] = useState<PublicTutor[]>([]);
  const [recent, setRecent] = useState<PublicTutor[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [totalTutors, setTotalTutors] = useState<number | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    void api.get<PublicTutor[]>("/api/tutors/featured").then(setFeatured).catch(() => {});
    void api
      .get<Paginated<PublicTutor>>("/api/tutors?page=1")
      .then((r) => {
        setRecent(r.items);
        setTotalTutors(r.total);
      })
      .catch(() => {});
    void api.get<Subject[]>("/api/subjects").then(setSubjects).catch(() => {});
    void api.get<Level[]>("/api/levels").then(setLevels).catch(() => {});
  }, []);

  /* Stats are derived from live API data — never invented marketing numbers. */
  const trustStats = [
    {
      value: totalTutors === null ? "—" : `${totalTutors}`,
      label: "Tutors listed",
      color: "text-brand-600",
    },
    {
      value: subjects.length ? `${subjects.length}` : "—",
      label: "Subjects covered",
      color: "text-coral-600",
    },
    { value: "8 Qs", label: "AI interview to pass", color: "text-sky-600" },
    { value: "S$0", label: "To enquire", color: "text-grass-600" },
  ];

  return (
    <div>
      <Seo
        title="Find Trusted, Verified Tutors in Singapore"
        description="Search verified private tutors in Singapore by subject, level and region. Every verified tutor passed identity checks, qualification review and a subject-knowledge interview. Free to enquire."
        path="/"
        jsonLd={[websiteSchema(), faqSchema(HOME_FAQS)]}
      />

      {/* Hero */}
      <section className="relative overflow-hidden bg-mesh-soft">
        <div className="relative mx-auto max-w-6xl px-4 py-16 text-center sm:py-24">
          <span className="inline-flex animate-fade-up items-center gap-2 rounded-full border border-brand-100 bg-white/80 px-4 py-1.5 text-sm font-semibold text-brand-700 shadow-sm backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-grass-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-grass-500" />
            </span>
            Every tutor identity-checked &amp; interviewed
          </span>

          <h1 className="mx-auto mt-6 max-w-3xl font-display text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">
            Find a <span className="text-gradient">trusted tutor</span> in Singapore
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
            Every verified tutor has passed identity checks, qualification review and
            a subject-knowledge interview. Search by subject and level — enquire for free.
          </p>

          <form
            className="mx-auto mt-8 flex max-w-xl flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              navigate(`/tutors${q ? `?q=${encodeURIComponent(q)}` : ""}`);
            }}
            role="search"
          >
            <label htmlFor="hero-search" className="sr-only">
              Search tutors by subject or level
            </label>
            <input
              id="hero-search"
              className="input flex-1 bg-white shadow-sm sm:py-3"
              placeholder="Try 'H2 Mathematics' or 'Physics'…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button className="btn-primary shrink-0 sm:px-7">Search Tutors</button>
          </form>

          <p className="mt-4 text-sm text-slate-600">
            Are you a tutor?{" "}
            <Link to="/signup" className="font-semibold text-brand-600 underline-offset-2 hover:underline">
              List yourself free
            </Link>{" "}
            — your listing stays live for a full year.
          </p>

          {/* Trust stats — social proof above the fold. */}
          <dl className="mx-auto mt-12 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
            {trustStats.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-white bg-white/70 px-3 py-4 shadow-sm backdrop-blur"
              >
                <dt className="sr-only">{s.label}</dt>
                <dd>
                  <div className={`font-display text-2xl font-extrabold ${s.color}`}>{s.value}</div>
                  <div className="mt-0.5 text-xs font-medium text-slate-600">{s.label}</div>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Featured tutors */}
      {featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-12">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-900">★ Featured Tutors</h2>
            <Link to="/tutors" className="text-sm font-semibold text-brand-600 hover:underline">
              View all →
            </Link>
          </div>
          <div className="grid gap-4 pt-3 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((t) => (
              <TutorCard key={t.id} tutor={t} />
            ))}
          </div>
        </section>
      )}

      {/* Popular subjects strip (full list lives in the nav dropdown) */}
      <section id="subjects" className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="section-title">Popular Subjects</h2>
          <span className="text-sm text-slate-500">
            Full list under “Browse by Subject” in the menu
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {subjects.slice(0, 12).map((s, i) => (
            <Link
              key={s.id}
              to={`/tutors?subject=${s.slug}`}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition duration-200 hover:-translate-y-0.5 hover:shadow-sm ${SUBJECT_CHIPS[i % SUBJECT_CHIPS.length]}`}
            >
              {s.name}
            </Link>
          ))}
        </div>
      </section>

      {/* Levels */}
      <section id="levels" className="mx-auto max-w-6xl px-4 py-6">
        <h2 className="mb-6 section-title">Browse by Level</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {levels.map((l, i) => (
            <Link
              key={l.id}
              to={`/tutors?level=${l.slug}`}
              className={`card card-hover flex items-center justify-center gap-2 py-5 text-center font-display font-bold ${LEVEL_TILES[i % LEVEL_TILES.length]}`}
            >
              {l.name}
            </Link>
          ))}
        </div>
      </section>

      {/* How verification works */}
      <section id="how-verification-works" className="bg-slate-50 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">
            How Tutor Verification Works
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-slate-600">
            The green ✓ badge means we checked the tutor's identity, qualifications
            and real subject knowledge — not just a form submission.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {VERIFY_STEPS.map((step, i) => (
              <div key={step.n} className="relative">
                {i < VERIFY_STEPS.length - 1 && (
                  <div className="absolute left-full top-8 hidden w-6 -translate-x-3 border-t-2 border-dashed border-brand-200 lg:block" />
                )}
                <div className="card h-full text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                    <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      {step.icon}
                    </svg>
                  </div>
                  <div className="mt-3 text-xs font-bold uppercase tracking-wide text-brand-600">
                    Step {step.n}
                  </div>
                  <h3 className="mt-1 font-semibold text-slate-900">{step.title}</h3>
                  <p className="mt-2 text-sm text-slate-500">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link to="/signup" className="btn-primary">
              Start free — get verified when you're ready
            </Link>
          </div>
        </div>
      </section>

      {/* Recent tutors */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900">Our Tutors</h2>
          <Link to="/tutors" className="text-sm font-semibold text-brand-600 hover:underline">
            View all →
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="py-8 text-center text-slate-500">
            No tutors listed yet — be the first!
          </p>
        ) : (
          <div className="grid gap-4 pt-3 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((t) => (
              <TutorCard key={t.id} tutor={t} />
            ))}
          </div>
        )}
      </section>

      {/* Lead magnet — low-commitment capture for parents not ready to enquire. */}
      <LeadMagnet />

      {/* FAQ — mirrored into FAQPage JSON-LD for rich results. */}
      <section id="faq" className="mx-auto max-w-3xl px-4 py-12">
        <h2 className="section-title text-center">Frequently Asked Questions</h2>
        <div className="mt-8 space-y-3">
          {HOME_FAQS.map((f) => (
            <details
              key={f.q}
              className="card group overflow-hidden transition hover:border-brand-300"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display font-bold text-slate-900">
                {f.q}
                <span className="shrink-0 text-brand-500 transition group-open:rotate-45" aria-hidden="true">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                    <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
                  </svg>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
