import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useAuth } from "../lib/auth";

type Mode = "password" | "otp" | "forgot";

export function LoginPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const finish = async () => {
    await refresh();
    navigate("/dashboard");
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const submitPassword = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await api.post("/api/auth/tutor/login", { email, password });
      await finish();
    });
  };

  const sendCode = (purpose: "otp" | "forgot") =>
    run(async () => {
      await api.post(
        purpose === "otp"
          ? "/api/auth/tutor/otp/request"
          : "/api/auth/tutor/password/forgot",
        { email }
      );
      setCodeSent(true);
      setInfo(
        "If this email is registered, a 6-digit code has been sent. It expires in 10 minutes."
      );
    });

  const submitOtp = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await api.post("/api/auth/tutor/otp/verify", { email, code });
      await finish();
    });
  };

  const submitReset = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await api.post("/api/auth/tutor/password/reset", {
        email,
        code,
        newPassword,
      });
      await finish();
    });
  };

  const demoLogin = (demoEmail: string, demoPassword: string) =>
    run(async () => {
      await api.post("/api/auth/tutor/login", {
        email: demoEmail,
        password: demoPassword,
      });
      await finish();
    });

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setInfo(null);
    setCode("");
    setCodeSent(false);
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-center text-3xl font-bold text-slate-900">Tutor Login</h1>

      <div className="card mt-8">
        {/* Mode tabs */}
        {mode !== "forgot" && (
          <div className="mb-5 grid grid-cols-2 rounded-lg bg-slate-100 p-1">
            {(["password", "otp"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                className={`rounded-md py-1.5 text-sm font-medium transition ${mode === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                onClick={() => switchMode(m)}
              >
                {m === "password" ? "Password" : "Email OTP"}
              </button>
            ))}
          </div>
        )}

        {mode === "password" && (
          <form onSubmit={submitPassword} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="text-right">
              <button
                type="button"
                className="text-sm font-medium text-brand-600 hover:underline"
                onClick={() => switchMode("forgot")}
              >
                Forgot password?
              </button>
            </div>
            {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <button className="btn-primary w-full" disabled={busy}>
              {busy ? "Logging in…" : "Log In"}
            </button>
          </form>
        )}

        {mode === "otp" && (
          <form onSubmit={submitOtp} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <div className="flex gap-2">
                <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                <button
                  type="button"
                  className="btn-secondary shrink-0"
                  disabled={busy || !email}
                  onClick={() => void sendCode("otp")}
                >
                  {codeSent ? "Resend" : "Send code"}
                </button>
              </div>
            </div>
            {codeSent && (
              <div>
                <label className="label">6-digit code</label>
                <input
                  className="input text-center text-lg tracking-[0.5em]"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                />
              </div>
            )}
            {info && <p className="rounded-lg bg-brand-50 p-3 text-sm text-brand-700">{info}</p>}
            {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            {codeSent && (
              <button className="btn-primary w-full" disabled={busy || code.length !== 6}>
                {busy ? "Verifying…" : "Log In with Code"}
              </button>
            )}
          </form>
        )}

        {mode === "forgot" && (
          <form onSubmit={submitReset} className="space-y-4">
            <h2 className="font-semibold text-slate-900">Reset your password</h2>
            <div>
              <label className="label">Email</label>
              <div className="flex gap-2">
                <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                <button
                  type="button"
                  className="btn-secondary shrink-0"
                  disabled={busy || !email}
                  onClick={() => void sendCode("forgot")}
                >
                  {codeSent ? "Resend" : "Send code"}
                </button>
              </div>
            </div>
            {codeSent && (
              <>
                <div>
                  <label className="label">6-digit code</label>
                  <input
                    className="input text-center text-lg tracking-[0.5em]"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
                <div>
                  <label className="label">New password (min 8 characters)</label>
                  <input className="input" type="password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                </div>
              </>
            )}
            {info && <p className="rounded-lg bg-brand-50 p-3 text-sm text-brand-700">{info}</p>}
            {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            {codeSent && (
              <button className="btn-primary w-full" disabled={busy || code.length !== 6}>
                {busy ? "Resetting…" : "Reset Password & Log In"}
              </button>
            )}
            <button
              type="button"
              className="w-full text-sm font-medium text-slate-500 hover:text-slate-700"
              onClick={() => switchMode("password")}
            >
              ← Back to login
            </button>
          </form>
        )}
      </div>

      {/* Demo logins for testing */}
      <div className="card mt-4 border-dashed">
        <h3 className="text-sm font-semibold text-slate-700">Demo logins (testing)</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            className="btn-secondary text-xs"
            disabled={busy}
            onClick={() => void demoLogin("mock.tutor1@sgtutors.local", "mocktutor123")}
          >
            ★ Featured verified tutor
          </button>
          <button
            type="button"
            className="btn-secondary text-xs"
            disabled={busy}
            onClick={() => void demoLogin("mock.tutor21@sgtutors.local", "mocktutor123")}
          >
            Unverified tutor
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Password for all demo tutors: <code>mocktutor123</code>. Admin demo:{" "}
          <Link to="/admin/login" className="text-brand-600 hover:underline">
            /admin/login
          </Link>{" "}
          (admin@sgtutors.local / admin123)
        </p>
      </div>

      <p className="mt-4 text-center text-sm text-slate-500">
        Not listed yet?{" "}
        <Link to="/signup" className="font-semibold text-brand-600 hover:underline">
          List yourself free
        </Link>
      </p>
    </div>
  );
}
