import { sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { toPublicTutor, type TutorRowForPublic } from "./sanitize.js";
import type { PublicTutor, Paginated } from "@sgtutors/shared";

interface SearchOpts {
  subjectSlug?: string;
  gender?: string;
  region?: string;
  levelSlug?: string;
  q?: string;
  page: number;
  pageSize: number;
  featuredOnly?: boolean;
}

interface RawRow {
  id: string;
  display_name: string;
  gender: string;
  race: string;
  nationality: string;
  region: string;
  linkedin_url: string | null;
  photo_path: string | null;
  highest_qualification: string;
  education: string;
  profile_text: string;
  students_taught: number;
  experience_years: number;
  verification_status: string;
  featured_until: Date | null;
  subjects: { id: number; name: string; slug: string }[] | null;
  levels: { id: number; name: string; slug: string }[] | null;
  avg_rating: string | null;
  review_count: string;
  total: string;
}

function rowToPublic(r: RawRow): PublicTutor {
  const row: TutorRowForPublic = {
    id: r.id,
    displayName: r.display_name,
    gender: r.gender,
    race: r.race,
    nationality: r.nationality,
    region: r.region,
    linkedinUrl: r.linkedin_url,
    photoPath: r.photo_path,
    highestQualification: r.highest_qualification,
    education: r.education,
    profileText: r.profile_text,
    studentsTaught: r.students_taught,
    experienceYears: r.experience_years,
    verificationStatus: r.verification_status,
    featuredUntil: r.featured_until ? new Date(r.featured_until) : null,
    subjects: r.subjects ?? [],
    levels: r.levels ?? [],
    avgRating: r.avg_rating === null ? null : Number(r.avg_rating),
    reviewCount: Number(r.review_count),
  };
  return toPublicTutor(row);
}

const baseSelect = sql`
  SELECT
    t.id, t.display_name, t.gender, t.race, t.nationality, t.region, t.linkedin_url, t.photo_path, t.highest_qualification, t.education,
    t.profile_text, t.students_taught, t.experience_years,
    t.verification_status, t.featured_until,
    subj.subjects, lvl.levels,
    r.avg_rating, r.review_count,
    count(*) OVER() AS total
  FROM tutors t
  LEFT JOIN LATERAL (
    SELECT json_agg(json_build_object('id', s.id, 'name', s.name, 'slug', s.slug) ORDER BY s.name) AS subjects
    FROM tutor_subjects ts JOIN subjects s ON s.id = ts.subject_id
    WHERE ts.tutor_id = t.id
  ) subj ON true
  LEFT JOIN LATERAL (
    SELECT json_agg(json_build_object('id', l.id, 'name', l.name, 'slug', l.slug) ORDER BY l.sort_order) AS levels
    FROM tutor_levels tl JOIN levels l ON l.id = tl.level_id
    WHERE tl.tutor_id = t.id
  ) lvl ON true
  LEFT JOIN LATERAL (
    SELECT avg(rv.rating)::numeric(3,2) AS avg_rating, count(rv.id) AS review_count
    FROM reviews rv WHERE rv.tutor_id = t.id AND NOT rv.is_hidden
  ) r ON true
`;

export async function searchTutors(opts: SearchOpts): Promise<Paginated<PublicTutor>> {
  const conditions = [sql`t.is_active AND t.expires_at > now()`];
  if (opts.subjectSlug) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM tutor_subjects ts2 JOIN subjects s2 ON s2.id = ts2.subject_id WHERE ts2.tutor_id = t.id AND s2.slug = ${opts.subjectSlug})`
    );
  }
  if (opts.levelSlug) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM tutor_levels tl2 JOIN levels l2 ON l2.id = tl2.level_id WHERE tl2.tutor_id = t.id AND l2.slug = ${opts.levelSlug})`
    );
  }
  if (opts.gender === "male" || opts.gender === "female") {
    conditions.push(sql`t.gender = ${opts.gender}`);
  }
  if (opts.region) {
    conditions.push(sql`t.region = ${opts.region}::region`);
  }
  if (opts.q) {
    const like = `%${opts.q}%`;
    conditions.push(
      sql`(t.display_name ILIKE ${like} OR t.profile_text ILIKE ${like} OR t.highest_qualification ILIKE ${like} OR t.education ILIKE ${like})`
    );
  }
  if (opts.featuredOnly) {
    conditions.push(sql`t.featured_until IS NOT NULL AND t.featured_until > now()`);
  }

  const where = sql.join(conditions, sql` AND `);
  const offset = (opts.page - 1) * opts.pageSize;

  const query = sql`
    ${baseSelect}
    WHERE ${where}
    ORDER BY
      (t.featured_until IS NOT NULL AND t.featured_until > now()) DESC,
      (t.verification_status = 'verified') DESC,
      t.created_at DESC
    LIMIT ${opts.pageSize} OFFSET ${offset}
  `;

  const result = await db.execute(query);
  const rows = result.rows as unknown as RawRow[];
  return {
    items: rows.map(rowToPublic),
    page: opts.page,
    pageSize: opts.pageSize,
    total: rows.length > 0 ? Number(rows[0].total) : 0,
  };
}

export async function getPublicTutor(id: string): Promise<PublicTutor | null> {
  const query = sql`
    ${baseSelect}
    WHERE t.id = ${id} AND t.is_active AND t.expires_at > now()
    LIMIT 1
  `;
  const result = await db.execute(query);
  const rows = result.rows as unknown as RawRow[];
  return rows.length ? rowToPublic(rows[0]) : null;
}
