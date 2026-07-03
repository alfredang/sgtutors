import type {
  VerificationStatus,
  InterviewState,
  DocType,
  Gender,
  Race,
  Nationality,
  Region,
} from "./enums.js";

/** Public-safe tutor shape. NEVER include NRIC, DOB, email, mobile, full_name. */
export interface PublicTutor {
  id: string;
  displayName: string;
  gender: Gender;
  race: Race;
  nationality: Nationality;
  /** Coarse location only (e.g. "north_west") — real address is never public. */
  region: Region;
  /** Populated only while the tutor is verified. */
  linkedinUrl: string | null;
  photoUrl: string | null;
  subjects: { id: number; name: string; slug: string }[];
  levels: { id: number; name: string; slug: string }[];
  highestQualification: string;
  education: string;
  profileText: string;
  studentsTaught: number;
  experienceYears: number;
  avgRating: number | null;
  reviewCount: number;
  isVerified: boolean;
  isFeatured: boolean;
}

/** Tutor's own view of their record (owner-only; excludes password hash). */
export interface TutorSelf extends Omit<PublicTutor, "avgRating" | "reviewCount"> {
  fullName: string;
  nric: string;
  dob: string;
  email: string;
  mobile: string;
  address: string;
  verificationStatus: VerificationStatus;
  featuredUntil: string | null;
  isActive: boolean;
  expiresAt: string;
  createdAt: string;
}

export interface Review {
  id: string;
  reviewerName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface Subject {
  id: number;
  name: string;
  slug: string;
  category: string;
}

export interface Level {
  id: number;
  name: string;
  slug: string;
  sortOrder: number;
}

export interface InterviewTurn {
  role: "interviewer" | "tutor";
  qNo: number;
  text: string;
  atMs: number;
  pasteFlag?: boolean;
}

export interface InterviewStatus {
  id: string;
  state: InterviewState;
  questionCount: number;
  currentQuestion: string | null;
  remainingSeconds: number;
  score: number | null;
  passed: boolean | null;
}

export interface VerificationDocInfo {
  id: string;
  docType: DocType;
  uploadedAt: string;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
