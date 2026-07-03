import { Link } from "react-router-dom";
import { GENDER_LABELS, RACE_LABELS, REGION_LABELS } from "@sgtutors/shared";
import type { PublicTutor } from "@sgtutors/shared";
import { VerifiedBadge, UnverifiedBadge, FeaturedBadge } from "./Badge";
import { StarRating } from "./StarRating";

export function TutorCard({ tutor }: { tutor: PublicTutor }) {
  return (
    <Link
      to={`/tutors/${tutor.id}`}
      className="card group flex gap-4 transition hover:border-brand-500 hover:shadow-md"
    >
      <div className="h-24 w-[4.7rem] shrink-0 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200">
        {tutor.photoUrl ? (
          <img
            src={tutor.photoUrl}
            alt={tutor.displayName}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-2xl font-bold text-slate-300">
            {tutor.displayName[0]}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 className="truncate font-semibold text-slate-900 group-hover:text-brand-700">
            {tutor.displayName}
          </h3>
          {tutor.isFeatured && <FeaturedBadge small />}
          {tutor.isVerified ? <VerifiedBadge small /> : <UnverifiedBadge small />}
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {GENDER_LABELS[tutor.gender]} · {RACE_LABELS[tutor.race]} · 📍{" "}
          {REGION_LABELS[tutor.region]}
        </p>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {tutor.highestQualification}
        </p>
        <div className="mt-1">
          <StarRating rating={tutor.avgRating} count={tutor.reviewCount} />
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {tutor.subjects.slice(0, 3).map((s) => (
            <span
              key={s.id}
              className="rounded bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-700"
            >
              {s.name}
            </span>
          ))}
          {tutor.subjects.length > 3 && (
            <span className="text-[11px] text-slate-400">
              +{tutor.subjects.length - 3} more
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {tutor.experienceYears} yrs experience · {tutor.studentsTaught} students taught
        </p>
      </div>
    </Link>
  );
}
