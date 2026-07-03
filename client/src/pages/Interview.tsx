import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { INTERVIEW_QUESTION_COUNT, INTERVIEW_PASS_SCORE } from "@sgtutors/shared";

interface ChatMsg {
  role: "interviewer" | "tutor";
  text: string;
}

type Phase = "intro" | "starting" | "active" | "scoring" | "result" | "error";

interface FinalResult {
  score: number;
  passed: boolean;
  summary: string;
}

export function InterviewPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("intro");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [qNo, setQNo] = useState(0);
  const [answer, setAnswer] = useState("");
  const [pasted, setPasted] = useState(false);
  const [remaining, setRemaining] = useState(600);
  const [result, setResult] = useState<FinalResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const deadlineRef = useRef<number>(0);

  // Cosmetic countdown; the server clock is authoritative
  useEffect(() => {
    if (phase !== "active") return;
    const t = setInterval(() => {
      const left = Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000));
      setRemaining(left);
    }, 500);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, phase]);

  const start = async () => {
    setPhase("starting");
    setError(null);
    try {
      const r = await api.post<{
        sessionId: string;
        question: string;
        qNo: number;
        remainingSeconds: number;
      }>("/api/tutor/interview/start");
      setSessionId(r.sessionId);
      setMessages([{ role: "interviewer", text: r.question }]);
      setQNo(r.qNo);
      deadlineRef.current = Date.now() + r.remainingSeconds * 1000;
      setRemaining(r.remainingSeconds);
      setPhase("active");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not start the interview");
      setPhase("error");
    }
  };

  const send = async () => {
    if (!sessionId || !answer.trim() || sending) return;
    const text = answer.trim();
    setSending(true);
    setMessages((m) => [...m, { role: "tutor", text }]);
    setAnswer("");
    const wasLast = qNo >= INTERVIEW_QUESTION_COUNT;
    if (wasLast) setPhase("scoring");
    try {
      const r = await api.post<
        | { done: false; question: string; qNo: number; remainingSeconds: number }
        | { done: true; score: number; passed: boolean; summary: string }
      >(`/api/tutor/interview/${sessionId}/answer`, {
        answer: text,
        pasteFlag: pasted,
      });
      setPasted(false);
      if (r.done) {
        setResult(r);
        setPhase("result");
      } else {
        setMessages((m) => [...m, { role: "interviewer", text: r.question }]);
        setQNo(r.qNo);
        deadlineRef.current = Date.now() + r.remainingSeconds * 1000;
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 410) {
        // Deadline passed server-side
        setError("Time is up — your interview has been submitted for scoring.");
        setPhase("error");
      } else {
        setError(err instanceof ApiError ? err.message : "Something went wrong");
        setPhase("error");
      }
    } finally {
      setSending(false);
    }
  };

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">AI Verification Interview</h1>

      {phase === "intro" && (
        <div className="card mt-6">
          <h2 className="font-semibold text-slate-900">Before you start</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">
            <li>You will answer <strong>{INTERVIEW_QUESTION_COUNT} questions</strong> on your primary subject.</li>
            <li>You have <strong>10 minutes total</strong>. The timer starts immediately and cannot be paused.</li>
            <li>You need <strong>{INTERVIEW_PASS_SCORE}%</strong> to pass and earn the Verified badge.</li>
            <li>Answer in your own words — pasted answers are flagged for review.</li>
            <li>If the time runs out, unanswered questions score zero.</li>
            <li>If you fail, you may appeal for a live interview with our team.</li>
          </ul>
          <div className="mt-5 flex gap-3">
            <button className="btn-primary" onClick={start}>
              I'm ready — start the interview
            </button>
            <button className="btn-secondary" onClick={() => navigate("/dashboard")}>
              Back to dashboard
            </button>
          </div>
        </div>
      )}

      {phase === "starting" && (
        <div className="card mt-6 flex flex-col items-center gap-3 py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
          <p className="text-sm text-slate-600">Your examiner is preparing the first question…</p>
        </div>
      )}

      {(phase === "active" || phase === "scoring") && (
        <div className="card mt-6 p-0">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <span className="text-sm font-medium text-slate-600">
              Question {Math.min(qNo, INTERVIEW_QUESTION_COUNT)} of {INTERVIEW_QUESTION_COUNT}
            </span>
            <span
              className={`rounded-full px-3 py-1 text-sm font-bold tabular-nums ${remaining <= 60 ? "bg-red-50 text-red-600" : "bg-brand-50 text-brand-700"}`}
            >
              {mins}:{secs.toString().padStart(2, "0")}
            </span>
          </div>

          {/* Chat */}
          <div className="max-h-[50vh] space-y-3 overflow-y-auto px-5 py-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "tutor" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm ${
                    m.role === "tutor"
                      ? "rounded-br-sm bg-brand-600 text-white"
                      : "rounded-bl-sm bg-slate-100 text-slate-800"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {phase === "scoring" && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
                Scoring your interview…
              </div>
            )}
            {sending && phase === "active" && (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-transparent" />
                Examiner is thinking…
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          {phase === "active" && (
            <div className="border-t border-slate-100 p-4">
              <textarea
                className="input"
                rows={3}
                placeholder="Type your answer…"
                value={answer}
                disabled={sending || remaining <= 0}
                onChange={(e) => setAnswer(e.target.value)}
                onPaste={() => setPasted(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send();
                }}
              />
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-slate-400">Ctrl/Cmd+Enter to send</span>
                <button
                  className="btn-primary"
                  onClick={send}
                  disabled={sending || !answer.trim() || remaining <= 0}
                >
                  {qNo >= INTERVIEW_QUESTION_COUNT ? "Submit final answer" : "Send answer"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {phase === "result" && result && (
        <div className="card mt-6 text-center">
          <div
            className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full text-2xl font-extrabold ${
              result.passed ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
            }`}
          >
            {result.score}
          </div>
          <h2 className="mt-4 text-xl font-bold text-slate-900">
            {result.passed ? "Congratulations — you passed!" : "Not quite this time"}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">{result.summary}</p>
          <p className="mt-2 text-sm text-slate-500">
            {result.passed
              ? "The Verified badge is now live on your profile."
              : `You needed ${INTERVIEW_PASS_SCORE}/100. You can appeal from your dashboard for a live interview.`}
          </p>
          <button className="btn-primary mt-5" onClick={() => navigate("/dashboard")}>
            Back to dashboard
          </button>
        </div>
      )}

      {phase === "error" && (
        <div className="card mt-6">
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
          <button className="btn-secondary mt-4" onClick={() => navigate("/dashboard")}>
            Back to dashboard
          </button>
        </div>
      )}
    </div>
  );
}
