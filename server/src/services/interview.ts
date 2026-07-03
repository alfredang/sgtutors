import { query } from "@anthropic-ai/claude-agent-sdk";
import { and, eq, desc } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  interviewSessions,
  tutors,
  payments,
  tutorSubjects,
  subjects,
  tutorLevels,
  levels,
} from "../db/schema.js";
import { config } from "../config.js";
import { HttpError } from "../middleware/errorHandler.js";
import { sendEmail } from "./email.js";
import {
  INTERVIEW_DURATION_MS,
  INTERVIEW_QUESTION_COUNT,
  INTERVIEW_PASS_SCORE,
  type InterviewTurn,
  type InterviewStatus,
} from "@sgtutors/shared";

const MAX_SESSIONS_PER_PAYMENT = 2;

/* ------------------------------------------------------------------ */
/* Claude Agent SDK plumbing                                           */
/* ------------------------------------------------------------------ */

async function askClaude(prompt: string, systemPrompt: string): Promise<string> {
  const stream = query({
    prompt,
    options: {
      systemPrompt,
      tools: [],
      allowedTools: [],
      maxTurns: 1,
      ...(config.INTERVIEW_MODEL ? { model: config.INTERVIEW_MODEL } : {}),
    },
  });
  for await (const message of stream) {
    if (message.type === "result") {
      if (message.subtype === "success") return message.result;
      throw new Error(`Claude query failed: ${message.subtype}`);
    }
  }
  throw new Error("Claude query produced no result");
}

/** Extract the first JSON object from a model response, retrying once. */
async function askClaudeJson<T>(
  prompt: string,
  systemPrompt: string
): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await askClaude(
      attempt === 0
        ? prompt
        : `${prompt}\n\nIMPORTANT: Your previous reply was not valid JSON. Reply with ONLY the JSON object, no markdown fences, no commentary.`,
      systemPrompt
    );
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        /* retry */
      }
    }
  }
  throw new HttpError(502, "AI interviewer returned an unreadable response");
}

/* ------------------------------------------------------------------ */
/* Prompts                                                             */
/* ------------------------------------------------------------------ */

const INTERVIEWER_SYSTEM = `You are a strict but fair subject-matter examiner conducting a tutor certification interview for a Singapore tuition marketplace. You assess whether the candidate genuinely has the subject mastery needed to tutor students. You ask one question at a time, progressively harder, grounded in the Singapore curriculum (MOE syllabus, O-Level/A-Level/PSLE where relevant). Questions must require real subject knowledge — never answerable with generic filler. Keep each question concise (max 3 sentences). Always reply with ONLY a JSON object, no markdown.`;

const SCORER_SYSTEM = `You are the chief examiner scoring a tutor certification interview transcript for a Singapore tuition marketplace. Score strictly: generic, evasive, or off-topic answers earn low marks; correct, precise, pedagogically aware answers earn high marks. Answers that do not address the specific question asked earn near-zero for that question. Always reply with ONLY a JSON object, no markdown.`;

function questionPrompt(opts: {
  subject: string;
  levels: string[];
  qNo: number;
  transcript: InterviewTurn[];
}): string {
  const history = opts.transcript
    .map((t) => `${t.role === "interviewer" ? `Q${t.qNo}` : `A${t.qNo}`}: ${t.text}`)
    .join("\n");
  return [
    `Subject under examination: ${opts.subject}`,
    `Teaching levels claimed: ${opts.levels.join(", ") || "unspecified"}`,
    `You are about to ask question ${opts.qNo} of ${INTERVIEW_QUESTION_COUNT}. Difficulty should increase with the question number: early questions test fundamentals, later questions test deep mastery and teaching ability (e.g. "how would you explain X to a struggling student", common misconceptions, exam techniques).`,
    history ? `Interview so far:\n${history}` : `This is the first question.`,
    ``,
    `Reply with ONLY this JSON: {"next_question": "<your question ${opts.qNo}>"}`,
  ].join("\n");
}

function scoringPrompt(opts: {
  subject: string;
  levels: string[];
  transcript: InterviewTurn[];
  timedOut: boolean;
}): string {
  const history = opts.transcript
    .map((t) => `${t.role === "interviewer" ? `Q${t.qNo}` : `A${t.qNo}`}: ${t.text}`)
    .join("\n");
  return [
    `Subject: ${opts.subject}. Levels claimed: ${opts.levels.join(", ")}.`,
    `The interview had ${INTERVIEW_QUESTION_COUNT} planned questions. ${
      opts.timedOut
        ? "The candidate ran out of time; unanswered questions score 0."
        : ""
    }`,
    `Transcript:`,
    history,
    ``,
    `Score the candidate out of 100 overall (pass mark is ${INTERVIEW_PASS_SCORE}). Distribute marks across the questions asked. Unanswered questions get 0.`,
    `Reply with ONLY this JSON:`,
    `{"score": <0-100 integer>, "per_question": [{"q": <number>, "marks_out_of": <number>, "awarded": <number>, "rationale": "<1 sentence>"}], "summary": "<2-3 sentence overall assessment>"}`,
  ].join("\n");
}

/* ------------------------------------------------------------------ */
/* Session lifecycle                                                   */
/* ------------------------------------------------------------------ */

async function tutorSubjectAndLevels(tutorId: string) {
  const subs = await db
    .select({ name: subjects.name })
    .from(tutorSubjects)
    .innerJoin(subjects, eq(subjects.id, tutorSubjects.subjectId))
    .where(eq(tutorSubjects.tutorId, tutorId));
  const lvls = await db
    .select({ name: levels.name })
    .from(tutorLevels)
    .innerJoin(levels, eq(levels.id, tutorLevels.levelId))
    .where(eq(tutorLevels.tutorId, tutorId));
  return {
    subject: subs[0]?.name ?? "General Teaching",
    allSubjects: subs.map((s) => s.name),
    levels: lvls.map((l) => l.name),
  };
}

export async function startInterview(tutorId: string): Promise<{
  sessionId: string;
  question: string;
  qNo: number;
  remainingSeconds: number;
}> {
  const [tutor] = await db.select().from(tutors).where(eq(tutors.id, tutorId));
  if (!tutor) throw new HttpError(404, "Tutor not found");
  if (tutor.verificationStatus !== "interview_pending") {
    throw new HttpError(
      409,
      `Interview not available in status '${tutor.verificationStatus}'`
    );
  }

  const [payment] = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.tutorId, tutorId),
        eq(payments.purpose, "verification"),
        eq(payments.status, "paid")
      )
    )
    .orderBy(desc(payments.createdAt))
    .limit(1);
  if (!payment) throw new HttpError(402, "No paid verification found");

  const existing = await db
    .select()
    .from(interviewSessions)
    .where(eq(interviewSessions.paymentId, payment.id))
    .orderBy(desc(interviewSessions.startedAt));

  // Resume a live session instead of creating a new one
  const live = existing.find((s) => s.state === "in_progress");
  if (live) {
    const finalized = await finalizeIfExpired(live.id);
    if (!finalized) {
      const transcript = live.transcript as InterviewTurn[];
      const lastQ = [...transcript].reverse().find((t) => t.role === "interviewer");
      return {
        sessionId: live.id,
        question: lastQ?.text ?? "",
        qNo: live.questionCount,
        remainingSeconds: Math.max(
          0,
          Math.floor((live.deadlineAt.getTime() - Date.now()) / 1000)
        ),
      };
    }
  }

  const attemptsUsed = existing.filter((s) => s.state !== "abandoned").length;
  if (attemptsUsed >= MAX_SESSIONS_PER_PAYMENT) {
    throw new HttpError(409, "Maximum interview attempts reached for this payment");
  }
  const completed = existing.find((s) => s.state === "completed");
  if (completed) {
    throw new HttpError(409, "Interview already completed for this payment");
  }

  const { subject, levels: lvls } = await tutorSubjectAndLevels(tutorId);

  const { next_question } = await askClaudeJson<{ next_question: string }>(
    questionPrompt({ subject, levels: lvls, qNo: 1, transcript: [] }),
    INTERVIEWER_SYSTEM
  );

  const transcript: InterviewTurn[] = [
    { role: "interviewer", qNo: 1, text: next_question, atMs: 0 },
  ];
  const deadlineAt = new Date(Date.now() + INTERVIEW_DURATION_MS);
  const [session] = await db
    .insert(interviewSessions)
    .values({
      tutorId,
      paymentId: payment.id,
      subject,
      deadlineAt,
      transcript,
      questionCount: 1,
    })
    .returning();

  return {
    sessionId: session.id,
    question: next_question,
    qNo: 1,
    remainingSeconds: Math.floor(INTERVIEW_DURATION_MS / 1000),
  };
}

export async function answerInterview(
  tutorId: string,
  sessionId: string,
  answer: string,
  pasteFlag: boolean
): Promise<
  | { done: false; question: string; qNo: number; remainingSeconds: number }
  | { done: true; score: number; passed: boolean; summary: string }
> {
  const [session] = await db
    .select()
    .from(interviewSessions)
    .where(
      and(eq(interviewSessions.id, sessionId), eq(interviewSessions.tutorId, tutorId))
    );
  if (!session) throw new HttpError(404, "Interview session not found");
  if (session.state !== "in_progress") {
    throw new HttpError(410, `Interview is ${session.state}`);
  }

  const transcript = session.transcript as InterviewTurn[];
  const elapsedMs = Date.now() - session.startedAt.getTime();

  // Server-side timer is the single source of truth
  if (Date.now() >= session.deadlineAt.getTime()) {
    const result = await finalizeSession(session.id, "expired");
    return {
      done: true,
      score: result.score,
      passed: result.passed,
      summary: result.summary,
    };
  }

  transcript.push({
    role: "tutor",
    qNo: session.questionCount,
    text: answer,
    atMs: elapsedMs,
    pasteFlag,
  });

  const { levels: lvls } = await tutorSubjectAndLevels(tutorId);

  if (session.questionCount >= INTERVIEW_QUESTION_COUNT) {
    await db
      .update(interviewSessions)
      .set({ transcript })
      .where(eq(interviewSessions.id, session.id));
    const result = await finalizeSession(session.id, "completed");
    return {
      done: true,
      score: result.score,
      passed: result.passed,
      summary: result.summary,
    };
  }

  const nextQNo = session.questionCount + 1;
  const { next_question } = await askClaudeJson<{ next_question: string }>(
    questionPrompt({
      subject: session.subject,
      levels: lvls,
      qNo: nextQNo,
      transcript,
    }),
    INTERVIEWER_SYSTEM
  );
  transcript.push({
    role: "interviewer",
    qNo: nextQNo,
    text: next_question,
    atMs: Date.now() - session.startedAt.getTime(),
  });

  await db
    .update(interviewSessions)
    .set({ transcript, questionCount: nextQNo })
    .where(eq(interviewSessions.id, session.id));

  return {
    done: false,
    question: next_question,
    qNo: nextQNo,
    remainingSeconds: Math.max(
      0,
      Math.floor((session.deadlineAt.getTime() - Date.now()) / 1000)
    ),
  };
}

interface ScoreResult {
  score: number;
  passed: boolean;
  summary: string;
}

async function finalizeSession(
  sessionId: string,
  endState: "completed" | "expired"
): Promise<ScoreResult> {
  const [session] = await db
    .select()
    .from(interviewSessions)
    .where(eq(interviewSessions.id, sessionId));
  if (!session) throw new HttpError(404, "Session not found");
  if (session.state !== "in_progress" && session.score !== null) {
    return {
      score: session.score,
      passed: session.score >= INTERVIEW_PASS_SCORE,
      summary: "Interview already scored",
    };
  }

  const transcript = session.transcript as InterviewTurn[];
  const { levels: lvls } = await tutorSubjectAndLevels(session.tutorId);

  const answered = transcript.some((t) => t.role === "tutor");
  let scored: {
    score: number;
    per_question: unknown[];
    summary: string;
  };
  if (!answered) {
    scored = {
      score: 0,
      per_question: [],
      summary: "No answers were given before the interview ended.",
    };
  } else {
    scored = await askClaudeJson(
      scoringPrompt({
        subject: session.subject,
        levels: lvls,
        transcript,
        timedOut: endState === "expired",
      }),
      SCORER_SYSTEM
    );
  }

  const score = Math.max(0, Math.min(100, Math.round(Number(scored.score) || 0)));
  const passed = score >= INTERVIEW_PASS_SCORE;

  // Suspicious-speed flags for the admin view
  const flags: string[] = [];
  const tutorTurns = transcript.filter((t) => t.role === "tutor");
  for (const t of tutorTurns) {
    if (t.pasteFlag) flags.push(`Q${t.qNo}: answer was pasted`);
  }

  await db
    .update(interviewSessions)
    .set({
      state: endState,
      completedAt: new Date(),
      score,
      scoreBreakdown: { ...scored, flags },
    })
    .where(eq(interviewSessions.id, sessionId));

  const [tutor] = await db
    .select()
    .from(tutors)
    .where(eq(tutors.id, session.tutorId));
  if (tutor && tutor.verificationStatus === "interview_pending") {
    await db
      .update(tutors)
      .set({
        verificationStatus: passed ? "verified" : "interview_failed",
        ...(passed ? { verifiedAt: new Date() } : {}),
        updatedAt: new Date(),
      })
      .where(eq(tutors.id, tutor.id));
    await sendEmail({
      to: tutor.email,
      subject: passed
        ? "[SG Tutors] Congratulations — you are now a Verified Tutor!"
        : "[SG Tutors] Interview result",
      text: passed
        ? `Hi ${tutor.displayName},\n\nYou scored ${score}/100 in your AI interview and are now a Verified Tutor. The verified badge is live on your profile.\n\n— SG Tutors`
        : `Hi ${tutor.displayName},\n\nYou scored ${score}/100 in your AI interview (pass mark ${INTERVIEW_PASS_SCORE}). You may submit an appeal from your dashboard — our team will arrange a live interview with you.\n\n— SG Tutors`,
    });
  }

  return { score, passed, summary: scored.summary };
}

/** Lazy sweep: finalize an in_progress session found past its deadline. */
export async function finalizeIfExpired(sessionId: string): Promise<boolean> {
  const [session] = await db
    .select()
    .from(interviewSessions)
    .where(eq(interviewSessions.id, sessionId));
  if (!session || session.state !== "in_progress") return false;
  if (Date.now() < session.deadlineAt.getTime()) return false;
  await finalizeSession(sessionId, "expired");
  return true;
}

export async function getInterviewStatus(
  tutorId: string,
  sessionId: string
): Promise<InterviewStatus> {
  await finalizeIfExpired(sessionId);
  const [session] = await db
    .select()
    .from(interviewSessions)
    .where(
      and(eq(interviewSessions.id, sessionId), eq(interviewSessions.tutorId, tutorId))
    );
  if (!session) throw new HttpError(404, "Interview session not found");
  const transcript = session.transcript as InterviewTurn[];
  const lastQ = [...transcript].reverse().find((t) => t.role === "interviewer");
  return {
    id: session.id,
    state: session.state,
    questionCount: session.questionCount,
    currentQuestion: session.state === "in_progress" ? (lastQ?.text ?? null) : null,
    remainingSeconds: Math.max(
      0,
      Math.floor((session.deadlineAt.getTime() - Date.now()) / 1000)
    ),
    score: session.score,
    passed: session.score === null ? null : session.score >= INTERVIEW_PASS_SCORE,
  };
}
