import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useAuth } from "../lib/auth";
import { VerifiedBadge, UnverifiedBadge, FeaturedBadge } from "../components/Badge";
import type { TutorSelf, VerificationStatus, DocType } from "@sgtutors/shared";
import { DOC_TYPES } from "@sgtutors/shared";

type Me = TutorSelf & { documents: { id: string; docType: DocType; uploadedAt: string }[] };

interface VerifStatus {
  status: VerificationStatus;
  nextStep: string;
  documentsUploaded: DocType[];
  latestInterview: { id: string; state: string; score: number | null } | null;
}

const DOC_LABELS: Record<DocType, string> = {
  nric_front: "NRIC (front)",
  nric_back: "NRIC (back)",
  qualification_cert: "Highest qualification certificate",
  cv: "CV / résumé (optional)",
};

export function DashboardPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [params] = useSearchParams();
  const [me, setMe] = useState<Me | null>(null);
  const [verif, setVerif] = useState<VerifStatus | null>(null);
  const [flash, setFlash] = useState<string | null>(
    params.get("welcome")
      ? "Welcome to SG Tutors! Your listing is live for one year."
      : params.get("payment") === "success"
        ? "Payment received — thank you!"
        : null
  );

  const load = useCallback(async () => {
    const sessionId = params.get("session_id");
    const statusUrl = sessionId
      ? `/api/tutor/verification/status?session_id=${encodeURIComponent(sessionId)}`
      : "/api/tutor/verification/status";
    const [meData, verifData] = await Promise.all([
      api.get<Me>("/api/tutor/me"),
      api.get<VerifStatus>(statusUrl),
    ]);
    setMe(meData);
    setVerif(verifData);
  }, [params]);

  useEffect(() => {
    void load().catch(() => navigate("/login"));
  }, [load, navigate]);

  if (!me || !verif) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  const expiry = new Date(me.expiresAt);
  const daysLeft = Math.ceil((expiry.getTime() - Date.now()) / 86_400_000);
  const expired = daysLeft <= 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Dashboard</h1>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-slate-600">{me.displayName}</span>
            {me.isFeatured && <FeaturedBadge small />}
            {me.isVerified ? <VerifiedBadge small /> : <UnverifiedBadge small />}
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={`/tutors/${me.id}`} className="btn-secondary">
            View public profile
          </Link>
          <button
            className="btn-secondary"
            onClick={async () => {
              await logout();
              navigate("/");
            }}
          >
            Log out
          </button>
        </div>
      </div>

      {flash && (
        <div className="mt-4 flex items-center justify-between rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
          {flash}
          <button onClick={() => setFlash(null)} className="font-bold">✕</button>
        </div>
      )}

      {/* Listing expiry */}
      <div className={`card mt-6 ${expired ? "border-red-300 bg-red-50" : ""}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900">Listing status</h2>
            {expired ? (
              <p className="mt-1 text-sm font-medium text-red-700">
                Your listing has expired and is hidden from search. Renew to reactivate it.
              </p>
            ) : (
              <p className="mt-1 text-sm text-slate-600">
                Active until <strong>{expiry.toLocaleDateString("en-SG")}</strong>{" "}
                ({daysLeft} days left). Listings last one year — renew any time.
              </p>
            )}
          </div>
          <RenewButton onRenewed={load} />
        </div>
      </div>

      {/* Verification */}
      <VerificationCard me={me} verif={verif} onChange={load} />

      {/* Featured upsell */}
      <FeaturedCard me={me} />

      {/* Profile editor */}
      <ProfileEditor me={me} onSaved={load} />
    </div>
  );
}

function RenewButton({ onRenewed }: { onRenewed: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn-primary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await api.post("/api/tutor/renew");
          await onRenewed();
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Renewing…" : "Renew for 1 year (free)"}
    </button>
  );
}

const VERIF_STEPS: { key: string; label: string }[] = [
  { key: "pay", label: "Pay S$50" },
  { key: "docs", label: "Upload documents" },
  { key: "interview", label: "AI interview" },
  { key: "badge", label: "Verified badge" },
];

function stepIndex(status: VerificationStatus): number {
  switch (status) {
    case "unverified":
    case "payment_pending":
      return 0;
    case "docs_pending":
      return 1;
    case "interview_pending":
    case "interview_failed":
    case "appeal_requested":
    case "live_interview_scheduled":
      return 2;
    case "verified":
      return 4;
    default:
      return 0;
  }
}

function VerificationCard({
  me,
  verif,
  onChange,
}: {
  me: Me;
  verif: VerifStatus;
  onChange: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const current = stepIndex(verif.status);

  const payNow = async () => {
    setBusy(true);
    setError(null);
    try {
      const { url } = await api.post<{ url: string }>("/api/tutor/verification/checkout");
      window.location.href = url;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not start payment");
      setBusy(false);
    }
  };

  return (
    <div className="card mt-6">
      <h2 className="font-semibold text-slate-900">Verification</h2>
      <p className="mt-1 text-sm text-slate-500">
        Verified tutors get the green badge, priority in search and access to
        Featured placement. One-time S$50 fee (non-refundable).
      </p>

      {/* Progress */}
      <ol className="mt-5 flex items-center gap-1">
        {VERIF_STEPS.map((s, i) => (
          <li key={s.key} className="flex flex-1 items-center gap-1">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                i < current
                  ? "bg-emerald-500 text-white"
                  : i === current
                    ? "bg-brand-600 text-white"
                    : "bg-slate-100 text-slate-400"
              }`}
            >
              {i < current ? "✓" : i + 1}
            </span>
            <span className={`hidden text-xs sm:block ${i === current ? "font-semibold text-slate-800" : "text-slate-400"}`}>
              {s.label}
            </span>
            {i < VERIF_STEPS.length - 1 && <div className="h-px flex-1 bg-slate-200" />}
          </li>
        ))}
      </ol>

      <div className="mt-5">
        {verif.status === "unverified" && (
          <button className="btn-primary" onClick={payNow} disabled={busy}>
            {busy ? "Redirecting to payment…" : "Get Verified — S$50"}
          </button>
        )}
        {verif.status === "payment_pending" && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-slate-600">
              Payment not completed yet.
            </p>
            <button className="btn-primary" onClick={payNow} disabled={busy}>
              {busy ? "Redirecting…" : "Complete payment"}
            </button>
          </div>
        )}
        {verif.status === "docs_pending" && (
          <DocUpload uploaded={verif.documentsUploaded} onChange={onChange} />
        )}
        {verif.status === "interview_pending" && (
          <div>
            <p className="text-sm text-slate-600">
              Documents received. Final step: a <strong>10-minute AI interview</strong>{" "}
              with 8 questions on{" "}
              <strong>{me.subjects[0]?.name ?? "your subject"}</strong>. You need{" "}
              <strong>70%</strong> to pass. Make sure you have 10 uninterrupted minutes
              before you start — the timer cannot be paused.
            </p>
            <button className="btn-primary mt-3" onClick={() => navigate("/dashboard/interview")}>
              Start AI Interview
            </button>
          </div>
        )}
        {verif.status === "interview_failed" && (
          <AppealForm
            score={verif.latestInterview?.score ?? null}
            onSubmitted={onChange}
          />
        )}
        {verif.status === "appeal_requested" && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            Your appeal has been received. Our team will contact you to schedule a
            live interview.
          </p>
        )}
        {verif.status === "live_interview_scheduled" && (
          <p className="rounded-lg bg-brand-50 p-3 text-sm text-brand-700">
            Your live interview has been scheduled — check your email for details.
          </p>
        )}
        {verif.status === "verified" && (
          <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
            ✓ You are a Verified Tutor. The badge is live on your profile.
          </p>
        )}
        {verif.status === "rejected" && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            Your verification was not successful. Contact support for details.
          </p>
        )}
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}

function DocUpload({
  uploaded,
  onChange,
}: {
  uploaded: DocType[];
  onChange: () => Promise<void>;
}) {
  const [files, setFiles] = useState<Partial<Record<DocType, File>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const fd = new FormData();
    let any = false;
    for (const dt of DOC_TYPES) {
      const f = files[dt];
      if (f) {
        fd.append(dt, f);
        any = true;
      }
    }
    if (!any) {
      setError("Choose at least one file to upload.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.postForm("/api/tutor/verification/documents", fd);
      await onChange();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <p className="text-sm text-slate-600">
        Upload your NRIC (front and back) and highest qualification certificate
        (JPEG, PNG, WebP, PDF or Word, max 8 MB each). A CV is optional. Documents
        are archived privately, reviewed only by our admin team, and erased 3
        months after you are verified.
      </p>
      <div className="mt-3 space-y-3">
        {DOC_TYPES.map((dt) => (
          <div key={dt} className="flex flex-wrap items-center gap-3">
            <span className="w-64 text-sm font-medium text-slate-700">
              {DOC_LABELS[dt]}
              {uploaded.includes(dt) && (
                <span className="ml-2 text-xs font-semibold text-emerald-600">✓ uploaded</span>
              )}
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand-700 hover:file:bg-brand-100"
              onChange={(e) =>
                setFiles((f) => ({ ...f, [dt]: e.target.files?.[0] }))
              }
            />
          </div>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <button className="btn-primary mt-4" disabled={busy}>
        {busy ? "Uploading…" : "Upload documents"}
      </button>
    </form>
  );
}

function AppealForm({
  score,
  onSubmitted,
}: {
  score: number | null;
  onSubmitted: () => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
        You scored {score ?? "below 70"}/100 in the AI interview (pass mark 70). You
        may appeal — our team will arrange a <strong>live interview</strong> with you.
      </p>
      <form
        className="mt-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await api.post("/api/tutor/appeal", { reason });
            await onSubmitted();
          } catch (err) {
            setError(err instanceof ApiError ? err.message : "Appeal failed");
            setBusy(false);
          }
        }}
      >
        <label className="label">Why should we re-assess you? (min 20 characters)</label>
        <textarea
          className="input"
          rows={3}
          minLength={20}
          maxLength={2000}
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <button className="btn-primary mt-3" disabled={busy}>
          {busy ? "Submitting…" : "Submit appeal"}
        </button>
      </form>
    </div>
  );
}

function FeaturedCard({ me }: { me: Me }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (me.isFeatured) {
    return (
      <div className="card mt-6 border-amber-200 bg-amber-50/50">
        <h2 className="font-semibold text-slate-900">★ Featured Tutor</h2>
        <p className="mt-1 text-sm text-slate-600">
          You are featured until{" "}
          <strong>{new Date(me.featuredUntil!).toLocaleDateString("en-SG")}</strong>.
          Your profile appears at the top of search results and on the homepage.
        </p>
      </div>
    );
  }

  return (
    <div className="card mt-6">
      <h2 className="font-semibold text-slate-900">★ Become a Featured Tutor</h2>
      <p className="mt-1 text-sm text-slate-500">
        Featured tutors appear at the top of every search and on the homepage for
        3 months. S$100, available to verified tutors.
      </p>
      <button
        className="btn-primary mt-3"
        disabled={busy || !me.isVerified}
        title={me.isVerified ? "" : "Get verified first"}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const { url } = await api.post<{ url: string }>("/api/tutor/featured/checkout");
            window.location.href = url;
          } catch (err) {
            setError(err instanceof ApiError ? err.message : "Could not start payment");
            setBusy(false);
          }
        }}
      >
        {busy ? "Redirecting…" : "Get Featured — S$100 / 3 months"}
      </button>
      {!me.isVerified && (
        <p className="mt-2 text-xs text-slate-400">
          Only verified tutors can be featured — complete verification first.
        </p>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

function ProfileEditor({ me, onSaved }: { me: Me; onSaved: () => Promise<void> }) {
  const [profileText, setProfileText] = useState(me.profileText);
  const [displayName, setDisplayName] = useState(me.displayName);
  const [highestQualification, setHighestQualification] = useState(me.highestQualification);
  const [education, setEducation] = useState(me.education);
  const [studentsTaught, setStudentsTaught] = useState(String(me.studentsTaught));
  const [experienceYears, setExperienceYears] = useState(String(me.experienceYears));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="card mt-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        setSaved(false);
        try {
          await api.patch("/api/tutor/profile", {
            displayName,
            profileText,
            highestQualification,
            education,
            studentsTaught: Number(studentsTaught),
            experienceYears: Number(experienceYears),
          });
          await onSaved();
          setSaved(true);
        } catch (err) {
          setError(err instanceof ApiError ? err.message : "Save failed");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="font-semibold text-slate-900">Edit profile</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Display name</label>
          <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div>
          <label className="label">Highest qualification</label>
          <input className="input" value={highestQualification} onChange={(e) => setHighestQualification(e.target.value)} />
        </div>
        <div>
          <label className="label">Education</label>
          <input className="input" value={education} onChange={(e) => setEducation(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Students taught</label>
            <input className="input" type="number" min={0} value={studentsTaught} onChange={(e) => setStudentsTaught(e.target.value)} />
          </div>
          <div>
            <label className="label">Years exp.</label>
            <input className="input" type="number" min={0} value={experienceYears} onChange={(e) => setExperienceYears(e.target.value)} />
          </div>
        </div>
      </div>
      <div className="mt-4">
        <label className="label">
          Short profile ({profileText.length}/1000)
        </label>
        <textarea className="input" rows={4} maxLength={1000} value={profileText} onChange={(e) => setProfileText(e.target.value)} />
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {saved && <p className="mt-3 text-sm text-emerald-600">✓ Profile saved</p>}
      <button className="btn-primary mt-4" disabled={busy}>
        {busy ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
