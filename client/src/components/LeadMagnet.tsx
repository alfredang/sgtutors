import { useState } from "react";
import { api } from "../api/client";

/**
 * Lead magnet — "Singapore Tuition Rate Guide" email capture.
 *
 * Sits between browsing and enquiring: a parent who isn't ready to pick a tutor
 * yet can still convert. PDPA requires explicit, unbundled consent with a stated
 * purpose, so the checkbox is unticked by default and the purpose is spelled out.
 */
export function LeadMagnet() {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) return;
    setState("sending");
    setError("");
    try {
      await api.post("/api/leads/rate-guide", { email, consent });
      setState("done");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <div className="overflow-hidden rounded-3xl bg-brand-gradient p-[1.5px] shadow-lift">
        <div className="grid items-center gap-8 rounded-[calc(1.5rem-1px)] bg-white p-8 sm:p-10 lg:grid-cols-2">
          <div>
            <span className="eyebrow">Free download</span>
            <h2 className="mt-2 font-display text-2xl font-extrabold text-slate-900 sm:text-3xl">
              The 2026 Singapore{" "}
              <span className="text-gradient">Tuition Rate Guide</span>
            </h2>
            <p className="mt-3 text-slate-600">
              What parents actually pay per hour — broken down by level (P1–JC2), by
              subject, and by tutor type. Know the going rate before you enquire, so
              you can tell a fair quote from an inflated one.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              {[
                "Hourly rate ranges for every level, from P1 to JC2",
                "Part-time vs full-time vs ex-MOE tutor rates compared",
                "5 questions to ask a tutor before you commit",
              ].map((point) => (
                <li key={point} className="flex items-start gap-2">
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="mt-0.5 h-4 w-4 shrink-0 text-grass-600"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {point}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl bg-slate-50 p-6">
            {state === "done" ? (
              <div className="py-6 text-center" role="status">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-grass-100 text-grass-700">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-7 w-7">
                    <path d="M3 4a2 2 0 0 0-2 2v1.161l8.441 4.221a1.25 1.25 0 0 0 1.118 0L19 7.162V6a2 2 0 0 0-2-2H3Z" />
                    <path d="m19 8.839-7.77 3.885a2.75 2.75 0 0 1-2.46 0L1 8.839V14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.839Z" />
                  </svg>
                </div>
                <h3 className="mt-3 font-display text-lg font-bold text-slate-900">
                  Check your inbox
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  We've sent the rate guide to <strong>{email}</strong>.
                </p>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label htmlFor="lead-email" className="label">
                    Email address
                  </label>
                  <input
                    id="lead-email"
                    type="email"
                    required
                    autoComplete="email"
                    className="input bg-white"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                {/* PDPA: unticked by default, purpose stated, withdrawal explained. */}
                <label className="flex items-start gap-2.5 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    required
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  <span>
                    I agree to receive the rate guide and occasional tutoring tips from
                    SG Tutors by email. I can unsubscribe at any time using the link in
                    any email.
                  </span>
                </label>

                {state === "error" && (
                  <p className="text-sm font-medium text-coral-600" role="alert">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  className="btn-accent w-full"
                  disabled={state === "sending" || !consent}
                >
                  {state === "sending" ? "Sending…" : "Email me the free guide"}
                </button>

                <p className="text-center text-[11px] text-slate-500">
                  No spam. We never sell your data.{" "}
                  <a href="/privacy" className="underline hover:text-brand-600">
                    Privacy Policy
                  </a>
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
