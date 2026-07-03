import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  date,
  boolean,
  integer,
  serial,
  timestamp,
  jsonb,
  char,
  primaryKey,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const verificationStatusEnum = pgEnum("verification_status", [
  "unverified",
  "payment_pending",
  "docs_pending",
  "interview_pending",
  "interview_failed",
  "appeal_requested",
  "live_interview_scheduled",
  "verified",
  "rejected",
]);

export const paymentPurposeEnum = pgEnum("payment_purpose", [
  "verification",
  "featured",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "paid",
  "failed",
  "expired",
]);

export const interviewStateEnum = pgEnum("interview_state", [
  "in_progress",
  "completed",
  "expired",
  "abandoned",
]);

export const genderEnum = pgEnum("gender", ["male", "female"]);

export const raceEnum = pgEnum("race", [
  "chinese",
  "malay",
  "indian",
  "eurasian",
  "others",
]);

export const nationalityEnum = pgEnum("nationality", [
  "singaporean",
  "singapore_pr",
  "malaysian",
  "others",
]);

export const regionEnum = pgEnum("region", [
  "north",
  "north_east",
  "north_west",
  "east",
  "west",
  "central",
]);

export const docTypeEnum = pgEnum("doc_type", [
  "nric_front",
  "nric_back",
  "qualification_cert",
  "cv",
]);

export const subjects = pgTable("subjects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  category: text("category").notNull(),
});

export const levels = pgTable("levels", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  sortOrder: integer("sort_order").notNull(),
});

export const tutors = pgTable(
  "tutors",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    // PRIVATE — never exposed via public API
    fullName: text("full_name").notNull(),
    nric: text("nric").notNull().unique(),
    dob: date("dob").notNull(),
    email: text("email").notNull().unique(),
    mobile: text("mobile").notNull(),
    address: text("address").notNull().default(""),
    passwordHash: text("password_hash").notNull(),
    // PUBLIC
    displayName: text("display_name").notNull(),
    gender: genderEnum("gender").notNull().default("male"),
    race: raceEnum("race").notNull().default("others"),
    nationality: nationalityEnum("nationality").notNull().default("singaporean"),
    // Public coarse location only — the full address above is never exposed
    region: regionEnum("region").notNull().default("central"),
    // Displayed publicly only while the tutor is verified
    linkedinUrl: text("linkedin_url"),
    profileText: varchar("profile_text", { length: 1000 }).notNull(),
    highestQualification: text("highest_qualification").notNull(),
    education: text("education").notNull(),
    studentsTaught: integer("students_taught").notNull().default(0),
    experienceYears: integer("experience_years").notNull().default(0),
    photoPath: text("photo_path"),
    // STATE
    verificationStatus: verificationStatusEnum("verification_status")
      .notNull()
      .default("unverified"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    // Google Drive subfolder (named after the tutor) holding verification docs
    gdriveFolderId: text("gdrive_folder_id"),
    // When the 3-month retention sweep erased the verification documents
    docsPurgedAt: timestamp("docs_purged_at", { withTimezone: true }),
    featuredUntil: timestamp("featured_until", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("tutors_search_idx").on(t.isActive, t.expiresAt),
    index("tutors_featured_idx").on(t.featuredUntil),
  ]
);

export const tutorSubjects = pgTable(
  "tutor_subjects",
  {
    tutorId: uuid("tutor_id")
      .notNull()
      .references(() => tutors.id, { onDelete: "cascade" }),
    subjectId: integer("subject_id")
      .notNull()
      .references(() => subjects.id),
  },
  (t) => [
    primaryKey({ columns: [t.tutorId, t.subjectId] }),
    index("tutor_subjects_subject_idx").on(t.subjectId),
  ]
);

export const tutorLevels = pgTable(
  "tutor_levels",
  {
    tutorId: uuid("tutor_id")
      .notNull()
      .references(() => tutors.id, { onDelete: "cascade" }),
    levelId: integer("level_id")
      .notNull()
      .references(() => levels.id),
  },
  (t) => [
    primaryKey({ columns: [t.tutorId, t.levelId] }),
    index("tutor_levels_level_idx").on(t.levelId),
  ]
);

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tutorId: uuid("tutor_id")
      .notNull()
      .references(() => tutors.id, { onDelete: "cascade" }),
    reviewerName: text("reviewer_name").notNull(),
    rating: integer("rating").notNull(),
    comment: varchar("comment", { length: 2000 }).notNull(),
    ipHash: text("ip_hash").notNull(),
    isHidden: boolean("is_hidden").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("reviews_tutor_idx").on(t.tutorId, t.createdAt)]
);

export const enquiries = pgTable(
  "enquiries",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tutorId: uuid("tutor_id")
      .notNull()
      .references(() => tutors.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    message: varchar("message", { length: 3000 }).notNull(),
    ipHash: text("ip_hash").notNull(),
    emailSent: boolean("email_sent").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("enquiries_tutor_idx").on(t.tutorId, t.createdAt)]
);

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tutorId: uuid("tutor_id")
    .notNull()
    .references(() => tutors.id),
  purpose: paymentPurposeEnum("purpose").notNull(),
  amountCents: integer("amount_cents").notNull(),
  currency: char("currency", { length: 3 }).notNull().default("SGD"),
  stripeSessionId: text("stripe_session_id").notNull().unique(),
  stripePaymentIntent: text("stripe_payment_intent"),
  status: paymentStatusEnum("status").notNull().default("pending"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const stripeEvents = pgTable("stripe_events", {
  eventId: text("event_id").primaryKey(),
  processedAt: timestamp("processed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const verificationDocuments = pgTable(
  "verification_documents",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tutorId: uuid("tutor_id")
      .notNull()
      .references(() => tutors.id, { onDelete: "cascade" }),
    docType: docTypeEnum("doc_type").notNull(),
    filePath: text("file_path").notNull(),
    gdriveFileId: text("gdrive_file_id"),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("verification_documents_tutor_doc_unique").on(t.tutorId, t.docType)]
);

export const interviewSessions = pgTable(
  "interview_sessions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tutorId: uuid("tutor_id")
      .notNull()
      .references(() => tutors.id),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id),
    subject: text("subject").notNull(),
    state: interviewStateEnum("state").notNull().default("in_progress"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    transcript: jsonb("transcript").notNull().default([]),
    score: integer("score"),
    scoreBreakdown: jsonb("score_breakdown"),
    questionCount: integer("question_count").notNull().default(0),
  },
  (t) => [index("interview_tutor_idx").on(t.tutorId)]
);

export const appeals = pgTable("appeals", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tutorId: uuid("tutor_id")
    .notNull()
    .references(() => tutors.id),
  interviewSessionId: uuid("interview_session_id").references(
    () => interviewSessions.id
  ),
  reason: varchar("reason", { length: 2000 }).notNull(),
  liveInterviewAt: timestamp("live_interview_at", { withTimezone: true }),
  adminNotes: text("admin_notes"),
  resolved: boolean("resolved").notNull().default(false),
  outcome: text("outcome"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const otpPurposeEnum = pgEnum("otp_purpose", ["login", "reset"]);

export const loginOtps = pgTable(
  "login_otps",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    email: text("email").notNull(),
    codeHash: text("code_hash").notNull(),
    purpose: otpPurposeEnum("purpose").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumed: boolean("consumed").notNull().default(false),
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("login_otps_email_idx").on(t.email, t.purpose)]
);

export const admins = pgTable("admins", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
