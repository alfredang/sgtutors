import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { CameraCapture } from "../components/CameraCapture";
import { useAuth } from "../lib/auth";
import {
  tutorSignupSchema,
  GENDERS,
  RACES,
  NATIONALITIES,
  REGIONS,
  GENDER_LABELS,
  RACE_LABELS,
  NATIONALITY_LABELS,
  REGION_LABELS,
  type Subject,
  type Level,
} from "@sgtutors/shared";

const STEPS = ["Account", "Tutor Profile", "Photo"] as const;

interface FormState {
  fullName: string;
  displayName: string;
  gender: string;
  race: string;
  nationality: string;
  address: string;
  region: string;
  linkedinUrl: string;
  nric: string;
  dob: string;
  mobile: string;
  email: string;
  password: string;
  profileText: string;
  highestQualification: string;
  education: string;
  studentsTaught: string;
  experienceYears: string;
  subjectIds: number[];
  levelIds: number[];
}

const empty: FormState = {
  fullName: "",
  displayName: "",
  gender: "male",
  race: "chinese",
  nationality: "singaporean",
  address: "",
  region: "central",
  linkedinUrl: "",
  nric: "",
  dob: "",
  mobile: "",
  email: "",
  password: "",
  profileText: "",
  highestQualification: "",
  education: "",
  studentsTaught: "0",
  experienceYears: "0",
  subjectIds: [],
  levelIds: [],
};

export function SignupPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(empty);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api.get<Subject[]>("/api/subjects").then(setSubjects).catch(() => {});
    void api.get<Level[]>("/api/levels").then(setLevels).catch(() => {});
  }, []);

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const validateStep = (): string | null => {
    const parsed = tutorSignupSchema.safeParse({
      ...form,
      studentsTaught: Number(form.studentsTaught),
      experienceYears: Number(form.experienceYears),
    });
    if (parsed.success) return null;
    const stepFields: Record<number, string[]> = {
      0: [
        "fullName",
        "displayName",
        "gender",
        "race",
        "nationality",
        "nric",
        "dob",
        "mobile",
        "email",
        "password",
        "address",
        "region",
      ],
      1: [
        "profileText",
        "highestQualification",
        "education",
        "studentsTaught",
        "experienceYears",
        "subjectIds",
        "levelIds",
        "linkedinUrl",
      ],
    };
    const relevant = parsed.error.issues.find((i) =>
      stepFields[step]?.includes(String(i.path[0]))
    );
    if (!relevant) return null;
    const fieldLabel: Record<string, string> = {
      fullName: "Full name",
      displayName: "Display name",
      nric: "NRIC",
      gender: "Gender",
      race: "Race",
      nationality: "Nationality",
      address: "Address",
      region: "Location",
      linkedinUrl: "LinkedIn URL",
      dob: "Date of birth",
      mobile: "Mobile",
      email: "Email",
      password: "Password",
      profileText: "Short profile",
      highestQualification: "Highest qualification",
      education: "Education",
      studentsTaught: "Students taught",
      experienceYears: "Experience",
      subjectIds: "Subjects",
      levelIds: "Levels",
    };
    return `${fieldLabel[String(relevant.path[0])] ?? relevant.path[0]}: ${relevant.message}`;
  };

  const next = () => {
    const err = validateStep();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep((s) => s + 1);
  };

  const submit = async () => {
    if (!photo) {
      setError("Please take your profile photo first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      for (const [k, v] of Object.entries(form)) {
        if (k === "subjectIds" || k === "levelIds") {
          fd.append(k, JSON.stringify(v));
        } else {
          fd.append(k, String(v));
        }
      }
      fd.append(
        "photo",
        photo,
        photo.type === "image/webp" ? "photo.webp" : "photo.jpg"
      );
      await api.postForm("/api/auth/tutor/signup", fd);
      await refresh();
      navigate("/dashboard?welcome=1");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Signup failed — please retry");
    } finally {
      setBusy(false);
    }
  };

  const toggle = (key: "subjectIds" | "levelIds", id: number) => {
    const list = form[key];
    set({ [key]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] } as Partial<FormState>);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-bold text-slate-900">List yourself as a tutor</h1>
      <p className="mt-1 text-slate-500">
        Free for one year. Your NRIC, date of birth and contact details are{" "}
        <strong>never shown publicly</strong> — they are used only for verification.
      </p>

      {/* Stepper */}
      <ol className="mt-8 flex items-center gap-2">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                i < step
                  ? "bg-brand-600 text-white"
                  : i === step
                    ? "bg-brand-100 text-brand-700 ring-2 ring-brand-600"
                    : "bg-slate-100 text-slate-400"
              }`}
            >
              {i < step ? "✓" : i + 1}
            </span>
            <span className={`hidden text-sm sm:block ${i === step ? "font-semibold text-slate-900" : "text-slate-400"}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && <div className="h-px flex-1 bg-slate-200" />}
          </li>
        ))}
      </ol>

      <div className="card mt-6">
        {step === 0 && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Full name (as per NRIC) *</label>
                <input className="input" value={form.fullName} onChange={(e) => set({ fullName: e.target.value })} />
              </div>
              <div>
                <label className="label">Display name (shown publicly) *</label>
                <input className="input" value={form.displayName} onChange={(e) => set({ displayName: e.target.value })} placeholder="e.g. Mr Tan / Sarah L." />
              </div>
              <div>
                <label className="label">NRIC / FIN *</label>
                <input className="input uppercase" value={form.nric} maxLength={9} onChange={(e) => set({ nric: e.target.value.toUpperCase() })} placeholder="S1234567D" />
                <p className="mt-1 text-xs text-slate-400">Used for identity verification only. Never displayed.</p>
              </div>
              <div>
                <label className="label">Date of birth *</label>
                <input className="input" type="date" value={form.dob} onChange={(e) => set({ dob: e.target.value })} />
              </div>
              <div>
                <label className="label">Mobile *</label>
                <input className="input" type="tel" value={form.mobile} onChange={(e) => set({ mobile: e.target.value.replace(/\s/g, "") })} placeholder="91234567" />
              </div>
              <div>
                <label className="label">Email *</label>
                <input className="input" type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="label">Gender *</label>
                <select className="input" value={form.gender} onChange={(e) => set({ gender: e.target.value })}>
                  {GENDERS.map((g) => (
                    <option key={g} value={g}>{GENDER_LABELS[g]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Race *</label>
                <select className="input" value={form.race} onChange={(e) => set({ race: e.target.value })}>
                  {RACES.map((r) => (
                    <option key={r} value={r}>{RACE_LABELS[r]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Nationality *</label>
                <select className="input" value={form.nationality} onChange={(e) => set({ nationality: e.target.value })}>
                  {NATIONALITIES.map((n) => (
                    <option key={n} value={n}>{NATIONALITY_LABELS[n]}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Home address *</label>
                <input className="input" value={form.address} onChange={(e) => set({ address: e.target.value })} placeholder="Blk 123 Ang Mo Kio Ave 3 #05-67 S560123" />
                <p className="mt-1 text-xs text-slate-400">Kept private. Only your general location below is shown.</p>
              </div>
              <div>
                <label className="label">Location shown publicly *</label>
                <select className="input" value={form.region} onChange={(e) => set({ region: e.target.value })}>
                  {REGIONS.map((r) => (
                    <option key={r} value={r}>{REGION_LABELS[r]}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Password (min 8 characters) *</label>
              <input className="input" type="password" value={form.password} onChange={(e) => set({ password: e.target.value })} />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="label">
                Short profile * <span className="font-normal text-slate-400">({form.profileText.length}/1000)</span>
              </label>
              <textarea
                className="input"
                rows={5}
                maxLength={1000}
                value={form.profileText}
                onChange={(e) => set({ profileText: e.target.value })}
                placeholder="Tell students and parents about your teaching style, track record and specialities…"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Highest qualification *</label>
                <input className="input" value={form.highestQualification} onChange={(e) => set({ highestQualification: e.target.value })} placeholder="e.g. BSc Mathematics (NUS)" />
              </div>
              <div>
                <label className="label">Education *</label>
                <input className="input" value={form.education} onChange={(e) => set({ education: e.target.value })} placeholder="e.g. Currently Year 2 Mathematics, NUS; Hwa Chong JC" />
              </div>
              <div>
                <label className="label">Students tutored so far *</label>
                <input className="input" type="number" min={0} value={form.studentsTaught} onChange={(e) => set({ studentsTaught: e.target.value })} />
              </div>
              <div>
                <label className="label">Years of tutoring experience *</label>
                <input className="input" type="number" min={0} value={form.experienceYears} onChange={(e) => set({ experienceYears: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label">LinkedIn profile <span className="font-normal text-slate-400">(optional — shown once you're verified)</span></label>
              <input className="input" type="url" value={form.linkedinUrl} onChange={(e) => set({ linkedinUrl: e.target.value })} placeholder="https://www.linkedin.com/in/yourname" />
            </div>
            <div>
              <label className="label">Subjects you teach * (select all that apply)</label>
              <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto rounded-lg border border-slate-200 p-3">
                {subjects.map((s) => (
                  <label
                    key={s.id}
                    className={`cursor-pointer rounded-full border px-3 py-1 text-sm ${form.subjectIds.includes(s.id) ? "border-brand-600 bg-brand-50 font-medium text-brand-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={form.subjectIds.includes(s.id)}
                      onChange={() => toggle("subjectIds", s.id)}
                    />
                    {s.name}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Levels you teach *</label>
              <div className="flex flex-wrap gap-2">
                {levels.map((l) => (
                  <label
                    key={l.id}
                    className={`cursor-pointer rounded-full border px-3 py-1 text-sm ${form.levelIds.includes(l.id) ? "border-brand-600 bg-brand-50 font-medium text-brand-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={form.levelIds.includes(l.id)}
                      onChange={() => toggle("levelIds", l.id)}
                    />
                    {l.name}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="mb-4 text-sm text-slate-600">
              Take a live photo with your camera. We automatically remove the
              background and produce a passport-style photo on white — this becomes
              your public profile picture.
            </p>
            <CameraCapture onPhoto={setPhoto} />
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
        )}

        <div className="mt-6 flex items-center justify-between">
          {step > 0 ? (
            <button type="button" className="btn-secondary" onClick={() => setStep(step - 1)}>
              ← Back
            </button>
          ) : (
            <span />
          )}
          {step < STEPS.length - 1 ? (
            <button type="button" className="btn-primary" onClick={next}>
              Continue →
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={submit} disabled={busy || !photo}>
              {busy ? "Creating your listing…" : "Create My Listing"}
            </button>
          )}
        </div>
      </div>

      <p className="mt-4 text-center text-sm text-slate-500">
        Already listed?{" "}
        <Link to="/login" className="font-semibold text-brand-600 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
