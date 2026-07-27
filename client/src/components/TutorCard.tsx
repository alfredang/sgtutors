import { Link } from "react-router-dom";
import { GENDER_LABELS, RACE_LABELS, REGION_LABELS } from "@sgtutors/shared";
import type { PublicTutor } from "@sgtutors/shared";
import { VerifiedBadge, UnverifiedBadge, FeaturedBadge } from "./Badge";
import { StarRating } from "./StarRating";

/** Rotating chip palette so subject tags read as varied categories, not one blue wall. */
const CHIP_STYLES = [
  "bg-brand-50 text-brand-700 ring-brand-100",
  "bg-coral-50 text-coral-700 ring-coral-100",
  "bg-sky-50 text-sky-700 ring-sky-100",
  "bg-grass-50 text-grass-700 ring-grass-100",
];

export function TutorCard({ tutor }: { tutor: PublicTutor }) {
  const featured = tutor.isFeatured;

  return (
    <Link
      to={`/tutors/${tutor.id}`}
      aria-label={`View ${tutor.displayName}'s tutor profile`}
      className={
        featured
          ? "card-featured group flex gap-4 transition duration-200 hover:-translate-y-1"
          : "card card-hover group flex gap-4"
      }
    >
      {featured && (
        <span className="absolute -top-2.5 left-4 inline-flex items-center gap-1 rounded-full bg-sunny-gradient px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
            <path
              fillRule="evenodd"
              d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z"
              clipRule="evenodd"
            />
          </svg>
          Top Pick
        </span>
      )}

      <div
        className={`${featured ? "h-28 w-[5.5rem] ring-2 ring-sunny-300" : "h-24 w-[4.7rem] ring-1 ring-slate-200"} mt-1 shrink-0 overflow-hidden rounded-xl bg-slate-100 transition group-hover:ring-brand-300`}
      >
        {tutor.photoUrl ? (
          <img
            src={tutor.photoUrl}
            alt={`${tutor.displayName}, ${tutor.highestQualification}`}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            loading="lazy"
            width={featured ? 88 : 75}
            height={featured ? 112 : 96}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-brand-gradient text-2xl font-extrabold text-white">
            {tutor.displayName[0]}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <h3
            className={`truncate font-display font-bold text-slate-900 group-hover:text-brand-700 ${featured ? "text-lg" : ""}`}
          >
            {tutor.displayName}
          </h3>
          {featured && <FeaturedBadge small />}
          {tutor.isVerified ? <VerifiedBadge small /> : <UnverifiedBadge small />}
        </div>

        <p className="mt-0.5 truncate text-xs text-slate-500">
          {GENDER_LABELS[tutor.gender]} · {RACE_LABELS[tutor.race]} ·{" "}
          <span aria-hidden="true">📍</span> {REGION_LABELS[tutor.region]}
        </p>
        <p className="mt-0.5 truncate text-xs font-medium text-slate-600">
          {tutor.highestQualification}
        </p>

        <div className="mt-1">
          <StarRating rating={tutor.avgRating} count={tutor.reviewCount} />
        </div>

        <div className="mt-1.5 flex flex-wrap gap-1">
          {tutor.subjects.slice(0, 3).map((s, i) => (
            <span
              key={s.id}
              className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ${CHIP_STYLES[i % CHIP_STYLES.length]}`}
            >
              {s.name}
            </span>
          ))}
          {tutor.subjects.length > 3 && (
            <span className="text-[11px] font-medium text-slate-400">
              +{tutor.subjects.length - 3} more
            </span>
          )}
        </div>

        <p className="mt-1 text-xs text-slate-500">
          <span className="font-semibold text-slate-700">{tutor.experienceYears} yrs</span>{" "}
          experience ·{" "}
          <span className="font-semibold text-slate-700">{tutor.studentsTaught}</span> students
          taught
        </p>
      </div>
    </Link>
  );
}
