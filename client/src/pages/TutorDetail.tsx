import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { VerifiedBadge, UnverifiedBadge, FeaturedBadge } from "../components/Badge";
import { StarRating } from "../components/StarRating";
import { Pagination } from "../components/Pagination";
import { Turnstile } from "../components/Turnstile";
import { GENDER_LABELS, RACE_LABELS, NATIONALITY_LABELS, REGION_LABELS } from "@sgtutors/shared";
import type { PublicTutor, Review, Paginated } from "@sgtutors/shared";
import { ShareButtons } from "../components/ShareButtons";

export function TutorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tutor, setTutor] = useState<PublicTutor | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [reviews, setReviews] = useState<Paginated<Review> | null>(null);
  const [reviewPage, setReviewPage] = useState(1);

  useEffect(() => {
    if (!id) return;
    void api
      .get<PublicTutor>(`/api/tutors/${id}`)
      .then(setTutor)
      .catch(() => setNotFound(true));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    void api
      .get<Paginated<Review>>(`/api/tutors/${id}/reviews?page=${reviewPage}`)
      .then(setReviews)
      .catch(() => {});
  }, [id, reviewPage]);

  if (notFound) {
    return (
      <div className="py-24 text-center text-slate-500">
        This tutor listing is not available.
      </div>
    );
  }
  if (!tutor) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main profile */}
        <div className="space-y-6 lg:col-span-2">
          <div className="card flex flex-col gap-5 sm:flex-row">
            <div className="mx-auto h-44 w-[8.5rem] shrink-0 overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200 sm:mx-0">
              {tutor.photoUrl ? (
                <img
                  src={tutor.photoUrl}
                  alt={tutor.displayName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-5xl font-bold text-slate-300">
                  {tutor.displayName[0]}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900">{tutor.displayName}</h1>
                {tutor.isFeatured && <FeaturedBadge />}
                {tutor.isVerified ? <VerifiedBadge /> : <UnverifiedBadge />}
              </div>
              <div className="mt-2">
                <StarRating rating={tutor.avgRating} count={tutor.reviewCount} size="md" />
              </div>
              <p className="mt-1.5 text-sm text-slate-500">
                {GENDER_LABELS[tutor.gender]} · {RACE_LABELS[tutor.race]} ·{" "}
                {NATIONALITY_LABELS[tutor.nationality]} ·{" "}
                <span className="font-medium text-slate-600">
                  📍 {REGION_LABELS[tutor.region]}
                </span>
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-slate-400">Highest Qualification</dt>
                  <dd className="font-medium text-slate-800">{tutor.highestQualification}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Education</dt>
                  <dd className="font-medium text-slate-800">{tutor.education}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Experience</dt>
                  <dd className="font-medium text-slate-800">{tutor.experienceYears} years</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Students Taught</dt>
                  <dd className="font-medium text-slate-800">{tutor.studentsTaught}</dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                {tutor.linkedinUrl && (
                  <a
                    href={tutor.linkedinUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#0A66C2] px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                    LinkedIn
                  </a>
                )}
                <ShareButtons title={tutor.displayName} />
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="font-semibold text-slate-900">About</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">
              {tutor.profileText}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {tutor.subjects.map((s) => (
                <span key={s.id} className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
                  {s.name}
                </span>
              ))}
              {tutor.levels.map((l) => (
                <span key={l.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  {l.name}
                </span>
              ))}
            </div>
          </div>

          {/* Reviews */}
          <div className="card">
            <h2 className="font-semibold text-slate-900">
              Reviews {reviews ? `(${reviews.total})` : ""}
            </h2>
            {reviews && reviews.items.length > 0 ? (
              <>
                <ul className="mt-4 divide-y divide-slate-100">
                  {reviews.items.map((r) => (
                    <li key={r.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-800">{r.reviewerName}</span>
                        <span className="text-xs text-slate-400">
                          {new Date(r.createdAt).toLocaleDateString("en-SG")}
                        </span>
                      </div>
                      <div className="mt-1">
                        <StarRating rating={r.rating} />
                      </div>
                      <p className="mt-2 text-sm text-slate-600">{r.comment}</p>
                    </li>
                  ))}
                </ul>
                <Pagination
                  page={reviews.page}
                  pageSize={reviews.pageSize}
                  total={reviews.total}
                  onPage={setReviewPage}
                />
              </>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No reviews yet.</p>
            )}
            <ReviewForm tutorId={tutor.id} onSubmitted={() => setReviewPage(1)} />
          </div>
        </div>

        {/* Enquiry sidebar */}
        <div>
          <EnquiryForm tutorId={tutor.id} tutorName={tutor.displayName} />
        </div>
      </div>
    </div>
  );
}

function ReviewForm({ tutorId, onSubmitted }: { tutorId: string; onSubmitted: () => void }) {
  const [name, setName] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setState("busy");
    try {
      await api.post(`/api/tutors/${tutorId}/reviews`, {
        reviewerName: name,
        rating,
        comment,
      });
      setState("done");
      onSubmitted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
      setState("error");
    }
  };

  if (state === "done") {
    return (
      <p className="mt-6 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
        Thank you — your review has been posted.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 border-t border-slate-100 pt-5">
      <h3 className="text-sm font-semibold text-slate-900">Add a review</h3>
      <div className="mt-3 space-y-3">
        <div>
          <label className="label">Your rating</label>
          <StarRating rating={rating} size="md" interactive onChange={setRating} />
        </div>
        <div>
          <label className="label">Your name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} />
        </div>
        <div>
          <label className="label">Comment</label>
          <textarea className="input" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} required minLength={5} maxLength={2000} />
        </div>
        {state === "error" && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-secondary" disabled={state === "busy"}>
          {state === "busy" ? "Posting…" : "Post Review"}
        </button>
      </div>
    </form>
  );
}

function EnquiryForm({ tutorId, tutorName }: { tutorId: string; tutorName: string }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [token, setToken] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) {
      // Invisible Turnstile normally resolves within a second of page load
      setError("Still verifying you're human — please try again in a moment.");
      setState("error");
      return;
    }
    setState("busy");
    try {
      await api.post(`/api/tutors/${tutorId}/enquiries`, {
        ...form,
        turnstileToken: token,
      });
      setState("done");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
      setState("error");
    }
  };

  return (
    <div className="card sticky top-20">
      <h2 className="font-semibold text-slate-900">Enquire with {tutorName}</h2>
      <p className="mt-1 text-xs text-slate-500">
        Your enquiry is emailed to the tutor and our team. Free, no obligation.
      </p>
      {state === "done" ? (
        <div className="mt-4 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-700">
          ✓ Enquiry sent! {tutorName} will contact you shortly.
        </div>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <div>
            <label className="label">Your name</label>
            <input className="input" required minLength={2} value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" required value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label">Mobile (SG)</label>
            <input className="input" type="tel" placeholder="9123 4567" required value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\s/g, "") })} />
          </div>
          <div>
            <label className="label">Message</label>
            <textarea className="input" rows={4} required minLength={10}
              placeholder="e.g. Looking for weekly Sec 3 A-Math lessons in Tampines…"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })} />
          </div>
          <Turnstile onToken={setToken} />
          {state === "error" && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full" disabled={state === "busy"}>
            {state === "busy" ? "Sending…" : "Send Enquiry"}
          </button>
        </form>
      )}
    </div>
  );
}
