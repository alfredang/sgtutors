import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { VERIFICATION_STATUSES, type VerificationStatus, type InterviewTurn } from "@sgtutors/shared";

/* ---------- types for admin payloads ---------- */

interface AdminTutorRow {
  id: string;
  fullName: string;
  displayName: string;
  email: string;
  mobile: string;
  verificationStatus: VerificationStatus;
  featuredUntil: string | null;
  isActive: boolean;
  expiresAt: string;
  createdAt: string;
}

interface AdminTutorDetail extends AdminTutorRow {
  nric: string;
  dob: string;
  profileText: string;
  highestQualification: string;
  education: string;
  studentsTaught: number;
  experienceYears: number;
  photoUrl: string | null;
  subjects: { id: number; name: string }[];
  levels: { id: number; name: string }[];
  documents: { id: string; docType: string; uploadedAt: string }[];
  interviews: {
    id: string;
    state: string;
    subject: string;
    score: number | null;
    startedAt: string;
    completedAt: string | null;
  }[];
  payments: {
    id: string;
    purpose: string;
    amountCents: number;
    status: string;
    paidAt: string | null;
    createdAt: string;
  }[];
  appeals: AdminAppeal[];
}

interface AdminAppeal {
  id: string;
  tutorId: string;
  tutorName?: string;
  tutorEmail?: string;
  reason: string;
  liveInterviewAt: string | null;
  adminNotes: string | null;
  resolved: boolean;
  outcome: string | null;
  createdAt: string;
  interviewSessionId: string | null;
}

interface AdminEnquiry {
  id: string;
  tutorName: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  emailSent: boolean;
  createdAt: string;
}

interface AdminReview {
  id: string;
  tutorName: string;
  reviewerName: string;
  rating: number;
  comment: string;
  isHidden: boolean;
  createdAt: string;
}

interface InterviewDetail {
  id: string;
  subject: string;
  state: string;
  score: number | null;
  scoreBreakdown: {
    per_question?: { q: number; marks_out_of: number; awarded: number; rationale: string }[];
    summary?: string;
    flags?: string[];
  } | null;
  transcript: InterviewTurn[];
}

type Tab = "overview" | "tutors" | "appeals" | "enquiries" | "reviews";

interface Overview {
  totals: {
    tutors: number;
    verified: number;
    featured: number;
    enquiries: number;
    pendingAppeals: number;
    revenueTotalCents: number;
    revenueThisMonthCents: number;
  };
  monthlyRevenue: {
    month: string;
    verification_cents: string;
    featured_cents: string;
    total_cents: string;
  }[];
  popularTutors: {
    id: string;
    display_name: string;
    verification_status: string;
    is_featured: boolean;
    enquiry_count: string;
    review_count: string;
    avg_rating: string | null;
  }[];
  featuredTutors: { id: string; display_name: string; featured_until: string }[];
  verifiedTutors: { id: string; display_name: string; updated_at: string }[];
}

const sgd = (cents: number) =>
  `S$${(cents / 100).toLocaleString("en-SG", { maximumFractionDigits: 0 })}`;

const STATUS_COLORS: Record<string, string> = {
  verified: "bg-emerald-50 text-emerald-700",
  interview_failed: "bg-red-50 text-red-700",
  rejected: "bg-red-50 text-red-700",
  appeal_requested: "bg-amber-50 text-amber-700",
  live_interview_scheduled: "bg-amber-50 text-amber-700",
  unverified: "bg-slate-100 text-slate-500",
};

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status] ?? "bg-brand-50 text-brand-700"}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

export function AdminPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("overview");
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    api
      .get("/api/admin/session")
      .then(() => setAuthed(true))
      .catch(() => navigate("/admin/login"));
  }, [navigate]);

  if (!authed) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <h1 className="font-bold text-slate-900">SG Tutors — Admin</h1>
          <button
            className="btn-secondary py-1.5"
            onClick={async () => {
              await api.post("/api/admin/logout").catch(() => {});
              navigate("/admin/login");
            }}
          >
            Log out
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
          {(["overview", "tutors", "appeals", "enquiries", "reviews"] as Tab[]).map((t) => (
            <button
              key={t}
              className={`px-4 py-2 text-sm font-medium capitalize ${tab === t ? "border-b-2 border-brand-600 text-brand-700" : "text-slate-500 hover:text-slate-800"}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {tab === "overview" && <OverviewTab />}
          {tab === "tutors" && <TutorsTab />}
          {tab === "appeals" && <AppealsTab />}
          {tab === "enquiries" && <EnquiriesTab />}
          {tab === "reviews" && <ReviewsTab />}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Overview ---------------- */

function OverviewTab() {
  const [data, setData] = useState<Overview | null>(null);

  useEffect(() => {
    void api.get<Overview>("/api/admin/overview").then(setData).catch(() => {});
  }, []);

  if (!data) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  const { totals } = data;
  const maxMonthly = Math.max(1, ...data.monthlyRevenue.map((m) => Number(m.total_cents)));

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <StatCard label="Total revenue" value={sgd(totals.revenueTotalCents)} tone="text-slate-900" />
        <StatCard label="Revenue this month" value={sgd(totals.revenueThisMonthCents)} tone="text-brand-600" />
        <StatCard label="Tutors" value={String(totals.tutors)} tone="text-slate-900" />
        <StatCard label="Verified" value={String(totals.verified)} tone="text-emerald-600" />
        <StatCard label="Featured" value={String(totals.featured)} tone="text-amber-600" />
        <StatCard label="Enquiries" value={String(totals.enquiries)} tone="text-brand-600" />
      </div>

      {/* Monthly revenue chart */}
      <div className="card">
        <h3 className="font-semibold text-slate-900">Monthly revenue (last 12 months)</h3>
        {data.monthlyRevenue.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">No paid transactions yet.</p>
        ) : (
          <div className="mt-4 flex h-48 items-end gap-2">
            {data.monthlyRevenue.map((m) => {
              const v = Number(m.verification_cents);
              const f = Number(m.featured_cents);
              const total = Number(m.total_cents);
              return (
                <div key={m.month} className="group relative flex flex-1 flex-col items-center justify-end gap-1 self-stretch">
                  <div className="pointer-events-none absolute -top-1 z-10 hidden -translate-y-full whitespace-nowrap rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs text-white group-hover:block">
                    <div className="font-semibold">{m.month}: {sgd(total)}</div>
                    <div className="text-slate-300">Verification {sgd(v)} · Featured {sgd(f)}</div>
                  </div>
                  <div className="flex w-full max-w-12 flex-col justify-end overflow-hidden rounded-t" style={{ height: `${Math.max(3, (total / maxMonthly) * 100)}%` }}>
                    <div className="w-full bg-amber-400" style={{ height: `${total ? (f / total) * 100 : 0}%` }} />
                    <div className="w-full flex-1 bg-brand-500" />
                  </div>
                  <span className="text-[10px] text-slate-400">{m.month.slice(5)}</span>
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-3 flex gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-brand-500" /> Verification (S$50)</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-amber-400" /> Featured (S$100)</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Popular tutors by enquiries */}
        <div className="card p-0">
          <h3 className="border-b border-slate-100 px-5 py-3 font-semibold text-slate-900">
            Popular tutors <span className="text-xs font-normal text-slate-400">(by enquiries)</span>
          </h3>
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="px-5 py-2">Tutor</th>
                <th className="px-3 py-2 text-right">Enquiries</th>
                <th className="px-3 py-2 text-right">Reviews</th>
                <th className="px-5 py-2 text-right">Rating</th>
              </tr>
            </thead>
            <tbody>
              {data.popularTutors.map((t, i) => (
                <tr key={t.id} className="border-t border-slate-50">
                  <td className="px-5 py-2.5">
                    <span className="mr-2 text-xs font-bold text-slate-300">#{i + 1}</span>
                    <span className="font-medium text-slate-800">{t.display_name}</span>
                    {t.verification_status === "verified" && <span className="ml-1.5 text-emerald-500">✓</span>}
                    {t.is_featured && <span className="ml-1 text-amber-500">★</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-brand-600">{t.enquiry_count}</td>
                  <td className="px-3 py-2.5 text-right">{t.review_count}</td>
                  <td className="px-5 py-2.5 text-right">{t.avg_rating ?? "—"}</td>
                </tr>
              ))}
              {data.popularTutors.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-6 text-center text-slate-400">No tutors yet</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-6">
          {/* Featured tutors */}
          <div className="card">
            <h3 className="font-semibold text-slate-900">★ Featured tutors</h3>
            {data.featuredTutors.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">None currently featured.</p>
            ) : (
              <ul className="mt-2 divide-y divide-slate-50">
                {data.featuredTutors.map((t) => (
                  <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="font-medium text-slate-800">{t.display_name}</span>
                    <span className="text-xs text-slate-400">
                      until {new Date(t.featured_until).toLocaleDateString("en-SG")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Verified tutors */}
          <div className="card">
            <h3 className="font-semibold text-slate-900">✓ Recently verified</h3>
            {data.verifiedTutors.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">No verified tutors yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-slate-50">
                {data.verifiedTutors.map((t) => (
                  <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="font-medium text-slate-800">{t.display_name}</span>
                    <span className="text-xs text-slate-400">
                      {new Date(t.updated_at).toLocaleDateString("en-SG")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="card py-4 text-center">
      <div className={`text-xl font-bold ${tone}`}>{value}</div>
      <div className="mt-0.5 text-xs text-slate-500">{label}</div>
    </div>
  );
}

/* ---------------- Tutors ---------------- */

function TutorsTab() {
  const [rows, setRows] = useState<AdminTutorRow[]>([]);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (q) params.set("q", q);
    setRows(await api.get<AdminTutorRow[]>(`/api/admin/tutors?${params}`));
  }, [status, q]);

  useEffect(() => {
    void load().catch(() => {});
  }, [load]);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <select className="input w-56" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {VERIFICATION_STATUSES.map((s) => (
            <option key={s} value={s}>{s.replaceAll("_", " ")}</option>
          ))}
        </select>
        <input className="input w-64" placeholder="Search name/email…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="card mt-4 overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">Tutor</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Expires</th>
              <th className="px-4 py-3">Active</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr
                key={t.id}
                className="cursor-pointer border-b border-slate-50 hover:bg-slate-50"
                onClick={() => setSelected(t.id)}
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">{t.displayName}</div>
                  <div className="text-xs text-slate-400">{t.fullName}</div>
                </td>
                <td className="px-4 py-3">
                  <div>{t.email}</div>
                  <div className="text-xs text-slate-400">{t.mobile}</div>
                </td>
                <td className="px-4 py-3"><StatusPill status={t.verificationStatus} /></td>
                <td className="px-4 py-3 text-xs">{new Date(t.expiresAt).toLocaleDateString("en-SG")}</td>
                <td className="px-4 py-3">{t.isActive ? "✓" : "✕"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No tutors found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <TutorDrawer id={selected} onClose={() => setSelected(null)} onChanged={load} />
      )}
    </div>
  );
}

function TutorDrawer({
  id,
  onClose,
  onChanged,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [tutor, setTutor] = useState<AdminTutorDetail | null>(null);
  const [interview, setInterview] = useState<InterviewDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setTutor(await api.get<AdminTutorDetail>(`/api/admin/tutors/${id}`));
  }, [id]);

  useEffect(() => {
    void load().catch(() => {});
  }, [load]);

  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      await load();
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed");
    }
  };

  if (!tutor) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="flex gap-4">
            {tutor.photoUrl && (
              <img src={tutor.photoUrl} alt="" className="h-24 w-[4.7rem] rounded-lg object-cover ring-1 ring-slate-200" />
            )}
            <div>
              <h2 className="text-xl font-bold text-slate-900">{tutor.displayName}</h2>
              <StatusPill status={tutor.verificationStatus} />
            </div>
          </div>
          <button className="text-2xl text-slate-400 hover:text-slate-700" onClick={onClose}>×</button>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-4 text-sm">
          <div><dt className="text-slate-400">Full name (NRIC)</dt><dd className="font-medium">{tutor.fullName}</dd></div>
          <div><dt className="text-slate-400">NRIC</dt><dd className="font-medium">{tutor.nric}</dd></div>
          <div><dt className="text-slate-400">DOB</dt><dd className="font-medium">{tutor.dob}</dd></div>
          <div><dt className="text-slate-400">Mobile</dt><dd className="font-medium">{tutor.mobile}</dd></div>
          <div className="col-span-2"><dt className="text-slate-400">Email</dt><dd className="font-medium">{tutor.email}</dd></div>
          <div><dt className="text-slate-400">Qualification</dt><dd className="font-medium">{tutor.highestQualification}</dd></div>
          <div><dt className="text-slate-400">Education</dt><dd className="font-medium">{tutor.education}</dd></div>
          <div className="col-span-2">
            <dt className="text-slate-400">Subjects / Levels</dt>
            <dd className="font-medium">
              {tutor.subjects.map((s) => s.name).join(", ")} · {tutor.levels.map((l) => l.name).join(", ")}
            </dd>
          </div>
        </dl>

        {/* Documents */}
        <h3 className="mt-6 font-semibold text-slate-900">Verification documents</h3>
        {tutor.documents.length === 0 ? (
          <p className="mt-1 text-sm text-slate-400">None uploaded.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {tutor.documents.map((d) => (
              <li key={d.id}>
                <a
                  className="text-sm font-medium text-brand-600 hover:underline"
                  href={`/api/admin/files/${d.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {d.docType.replaceAll("_", " ")} →
                </a>
                <span className="ml-2 text-xs text-slate-400">
                  {new Date(d.uploadedAt).toLocaleString("en-SG")}
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* Interviews */}
        <h3 className="mt-6 font-semibold text-slate-900">AI interviews</h3>
        {tutor.interviews.length === 0 ? (
          <p className="mt-1 text-sm text-slate-400">None taken.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {tutor.interviews.map((iv) => (
              <li key={iv.id} className="flex items-center gap-2 text-sm">
                <StatusPill status={iv.state} />
                <span>{iv.subject}</span>
                <span className="font-semibold">{iv.score !== null ? `${iv.score}/100` : "—"}</span>
                <button
                  className="text-brand-600 hover:underline"
                  onClick={async () =>
                    setInterview(await api.get<InterviewDetail>(`/api/admin/interviews/${iv.id}`))
                  }
                >
                  transcript →
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Payments */}
        <h3 className="mt-6 font-semibold text-slate-900">Payments</h3>
        {tutor.payments.length === 0 ? (
          <p className="mt-1 text-sm text-slate-400">None.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {tutor.payments.map((p) => (
              <li key={p.id} className="flex gap-2">
                <StatusPill status={p.status} />
                <span>{p.purpose}</span>
                <span className="font-medium">S${(p.amountCents / 100).toFixed(0)}</span>
                <span className="text-xs text-slate-400">
                  {new Date(p.createdAt).toLocaleString("en-SG")}
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* Actions */}
        <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <button className="btn-primary" onClick={() => act(() => api.post(`/api/admin/tutors/${tutor.id}/verify`))}>
            Verify tutor
          </button>
          <button
            className="btn-secondary text-red-600"
            onClick={() => {
              const reason = window.prompt("Rejection reason (optional):") ?? undefined;
              void act(() => api.post(`/api/admin/tutors/${tutor.id}/reject`, { reason }));
            }}
          >
            Reject
          </button>
          <button
            className="btn-secondary"
            onClick={() => act(() => api.patch(`/api/admin/tutors/${tutor.id}`, { isActive: !tutor.isActive }))}
          >
            {tutor.isActive ? "Deactivate listing" : "Reactivate listing"}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        {interview && (
          <TranscriptModal interview={interview} onClose={() => setInterview(null)} />
        )}
      </div>
    </div>
  );
}

function TranscriptModal({
  interview,
  onClose,
}: {
  interview: InterviewDetail;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900">
            Interview transcript — {interview.subject}{" "}
            {interview.score !== null && (
              <span className={interview.score >= 70 ? "text-emerald-600" : "text-red-600"}>
                ({interview.score}/100)
              </span>
            )}
          </h3>
          <button className="text-2xl text-slate-400" onClick={onClose}>×</button>
        </div>
        {interview.scoreBreakdown?.flags && interview.scoreBreakdown.flags.length > 0 && (
          <div className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            <strong>Flags:</strong> {interview.scoreBreakdown.flags.join("; ")}
          </div>
        )}
        <div className="mt-4 space-y-2">
          {interview.transcript.map((t, i) => (
            <div key={i} className={`rounded-lg p-3 text-sm ${t.role === "interviewer" ? "bg-slate-50" : "bg-brand-50"}`}>
              <div className="mb-1 text-xs font-semibold text-slate-400">
                {t.role === "interviewer" ? `Question ${t.qNo}` : `Answer ${t.qNo}`}
                {t.pasteFlag && <span className="ml-2 text-amber-600">⚠ pasted</span>}
                <span className="ml-2 font-normal">at {(t.atMs / 1000).toFixed(0)}s</span>
              </div>
              {t.text}
            </div>
          ))}
        </div>
        {interview.scoreBreakdown?.per_question && (
          <div className="mt-4 border-t border-slate-100 pt-3">
            <h4 className="text-sm font-semibold text-slate-900">Marking</h4>
            <ul className="mt-2 space-y-1 text-xs text-slate-600">
              {interview.scoreBreakdown.per_question.map((pq) => (
                <li key={pq.q}>
                  <strong>Q{pq.q}:</strong> {pq.awarded}/{pq.marks_out_of} — {pq.rationale}
                </li>
              ))}
            </ul>
            {interview.scoreBreakdown.summary && (
              <p className="mt-2 text-xs italic text-slate-500">{interview.scoreBreakdown.summary}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Appeals ---------------- */

function AppealsTab() {
  const [rows, setRows] = useState<AdminAppeal[]>([]);
  const load = useCallback(async () => {
    setRows(await api.get<AdminAppeal[]>("/api/admin/appeals"));
  }, []);
  useEffect(() => {
    void load().catch(() => {});
  }, [load]);

  return (
    <div className="space-y-3">
      {rows.length === 0 && <p className="py-8 text-center text-slate-400">No appeals.</p>}
      {rows.map((a) => (
        <AppealCard key={a.id} appeal={a} onChanged={load} />
      ))}
    </div>
  );
}

function AppealCard({ appeal, onChanged }: { appeal: AdminAppeal; onChanged: () => Promise<void> }) {
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-semibold text-slate-900">{appeal.tutorName}</span>
          <span className="ml-2 text-sm text-slate-400">{appeal.tutorEmail}</span>
        </div>
        {appeal.resolved ? (
          <StatusPill status={appeal.outcome ?? "resolved"} />
        ) : appeal.liveInterviewAt ? (
          <span className="text-sm font-medium text-amber-700">
            Live interview: {new Date(appeal.liveInterviewAt).toLocaleString("en-SG")}
          </span>
        ) : (
          <StatusPill status="appeal_requested" />
        )}
      </div>
      <p className="mt-2 text-sm text-slate-600">{appeal.reason}</p>
      {!appeal.resolved && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <input
            type="datetime-local"
            className="input w-60"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
          />
          <button
            className="btn-primary"
            disabled={!when || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api.patch(`/api/admin/appeals/${appeal.id}`, {
                  liveInterviewAt: new Date(when).toISOString(),
                });
                await onChanged();
              } finally {
                setBusy(false);
              }
            }}
          >
            Schedule live interview
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------- Enquiries ---------------- */

function EnquiriesTab() {
  const [rows, setRows] = useState<AdminEnquiry[]>([]);
  useEffect(() => {
    void api.get<AdminEnquiry[]>("/api/admin/enquiries").then(setRows).catch(() => {});
  }, []);
  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-100 text-xs uppercase text-slate-400">
          <tr>
            <th className="px-4 py-3">When</th>
            <th className="px-4 py-3">Tutor</th>
            <th className="px-4 py-3">From</th>
            <th className="px-4 py-3">Message</th>
            <th className="px-4 py-3">Email</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id} className="border-b border-slate-50 align-top">
              <td className="whitespace-nowrap px-4 py-3 text-xs">{new Date(e.createdAt).toLocaleString("en-SG")}</td>
              <td className="px-4 py-3 font-medium">{e.tutorName}</td>
              <td className="px-4 py-3">
                <div>{e.name}</div>
                <div className="text-xs text-slate-400">{e.email} · {e.phone}</div>
              </td>
              <td className="max-w-md px-4 py-3 text-slate-600">{e.message}</td>
              <td className="px-4 py-3">{e.emailSent ? "✓ sent" : "✕ failed"}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No enquiries yet</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Reviews ---------------- */

function ReviewsTab() {
  const [rows, setRows] = useState<AdminReview[]>([]);
  const load = useCallback(async () => {
    setRows(await api.get<AdminReview[]>("/api/admin/reviews"));
  }, []);
  useEffect(() => {
    void load().catch(() => {});
  }, [load]);

  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-100 text-xs uppercase text-slate-400">
          <tr>
            <th className="px-4 py-3">Tutor</th>
            <th className="px-4 py-3">Reviewer</th>
            <th className="px-4 py-3">Rating</th>
            <th className="px-4 py-3">Comment</th>
            <th className="px-4 py-3">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={`border-b border-slate-50 ${r.isHidden ? "opacity-50" : ""}`}>
              <td className="px-4 py-3 font-medium">{r.tutorName}</td>
              <td className="px-4 py-3">{r.reviewerName}</td>
              <td className="px-4 py-3">{"★".repeat(r.rating)}</td>
              <td className="max-w-md px-4 py-3 text-slate-600">{r.comment}</td>
              <td className="px-4 py-3">
                <button
                  className="text-sm font-medium text-brand-600 hover:underline"
                  onClick={async () => {
                    await api.patch(`/api/admin/reviews/${r.id}`, { isHidden: !r.isHidden });
                    await load();
                  }}
                >
                  {r.isHidden ? "Unhide" : "Hide"}
                </button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No reviews yet</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
