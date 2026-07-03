import type { PublicTutor, Gender, Race, Nationality, Region } from "@sgtutors/shared";
import { photoUrlFor } from "./storage.js";

/**
 * THE privacy chokepoint. Every public API response containing a tutor MUST
 * be built through this whitelist. Never spread a raw tutor row into a
 * public response — NRIC, DOB, email, mobile, full name and password hash
 * must never leave the server except to the owner or an admin.
 */
export interface TutorRowForPublic {
  id: string;
  displayName: string;
  gender: string;
  race: string;
  nationality: string;
  region: string;
  linkedinUrl: string | null;
  photoPath: string | null;
  highestQualification: string;
  education: string;
  profileText: string;
  studentsTaught: number;
  experienceYears: number;
  verificationStatus: string;
  featuredUntil: Date | null;
  subjects: { id: number; name: string; slug: string }[];
  levels: { id: number; name: string; slug: string }[];
  avgRating: number | null;
  reviewCount: number;
}

export function toPublicTutor(row: TutorRowForPublic): PublicTutor {
  return {
    id: row.id,
    displayName: row.displayName,
    gender: row.gender as Gender,
    race: row.race as Race,
    nationality: row.nationality as Nationality,
    region: row.region as Region,
    // LinkedIn is a verified-tutor perk — hidden for everyone else
    linkedinUrl:
      row.verificationStatus === "verified" ? row.linkedinUrl : null,
    photoUrl: photoUrlFor(row.photoPath),
    subjects: row.subjects,
    levels: row.levels,
    highestQualification: row.highestQualification,
    education: row.education,
    profileText: row.profileText,
    studentsTaught: row.studentsTaught,
    experienceYears: row.experienceYears,
    avgRating: row.avgRating === null ? null : Math.round(row.avgRating * 10) / 10,
    reviewCount: row.reviewCount,
    isVerified: row.verificationStatus === "verified",
    isFeatured: row.featuredUntil !== null && row.featuredUntil > new Date(),
  };
}
