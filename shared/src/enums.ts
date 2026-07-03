export const VERIFICATION_STATUSES = [
  "unverified",
  "payment_pending",
  "docs_pending",
  "interview_pending",
  "interview_failed",
  "appeal_requested",
  "live_interview_scheduled",
  "verified",
  "rejected",
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const PAYMENT_PURPOSES = ["verification", "featured"] as const;
export type PaymentPurpose = (typeof PAYMENT_PURPOSES)[number];

export const PAYMENT_STATUSES = ["pending", "paid", "failed", "expired"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const INTERVIEW_STATES = [
  "in_progress",
  "completed",
  "expired",
  "abandoned",
] as const;
export type InterviewState = (typeof INTERVIEW_STATES)[number];

export const DOC_TYPES = [
  "nric_front",
  "nric_back",
  "qualification_cert",
  "cv",
] as const;
export type DocType = (typeof DOC_TYPES)[number];

/** Documents that must be present before the AI interview unlocks. CV is optional. */
export const REQUIRED_DOC_TYPES: readonly DocType[] = [
  "nric_front",
  "nric_back",
  "qualification_cert",
];

export const GENDERS = ["male", "female"] as const;
export type Gender = (typeof GENDERS)[number];

export const RACES = ["chinese", "malay", "indian", "eurasian", "others"] as const;
export type Race = (typeof RACES)[number];

export const NATIONALITIES = [
  "singaporean",
  "singapore_pr",
  "malaysian",
  "others",
] as const;
export type Nationality = (typeof NATIONALITIES)[number];

export const GENDER_LABELS: Record<Gender, string> = {
  male: "Male",
  female: "Female",
};

export const RACE_LABELS: Record<Race, string> = {
  chinese: "Chinese",
  malay: "Malay",
  indian: "Indian",
  eurasian: "Eurasian",
  others: "Others",
};

export const NATIONALITY_LABELS: Record<Nationality, string> = {
  singaporean: "Singaporean",
  singapore_pr: "Singapore PR",
  malaysian: "Malaysian",
  others: "Others",
};

export const REGIONS = [
  "north",
  "north_east",
  "north_west",
  "east",
  "west",
  "central",
] as const;
export type Region = (typeof REGIONS)[number];

export const REGION_LABELS: Record<Region, string> = {
  north: "North",
  north_east: "North-East",
  north_west: "North-West",
  east: "East",
  west: "West",
  central: "Central",
};

export const VERIFICATION_FEE_CENTS = 5000; // S$50
export const FEATURED_FEE_CENTS = 10000; // S$100
export const INTERVIEW_DURATION_MS = 10 * 60 * 1000; // 10 minutes
export const INTERVIEW_QUESTION_COUNT = 8;
export const INTERVIEW_PASS_SCORE = 70;
