import bcrypt from "bcryptjs";
import { db, pool } from "./client.js";
import { subjects, levels, admins } from "./schema.js";
import { config } from "../config.js";

const SUBJECTS: { name: string; category: string }[] = [
  { name: "English", category: "Languages" },
  { name: "Chinese", category: "Languages" },
  { name: "Higher Chinese", category: "Languages" },
  { name: "Malay", category: "Languages" },
  { name: "Tamil", category: "Languages" },
  { name: "General Paper", category: "Languages" },
  { name: "English Literature", category: "Humanities" },
  { name: "Mathematics", category: "Mathematics" },
  { name: "Additional Mathematics", category: "Mathematics" },
  { name: "Elementary Mathematics", category: "Mathematics" },
  { name: "H2 Mathematics", category: "Mathematics" },
  { name: "Further Mathematics", category: "Mathematics" },
  { name: "Science", category: "Sciences" },
  { name: "Physics", category: "Sciences" },
  { name: "Chemistry", category: "Sciences" },
  { name: "Biology", category: "Sciences" },
  { name: "Combined Science", category: "Sciences" },
  { name: "Geography", category: "Humanities" },
  { name: "History", category: "Humanities" },
  { name: "Social Studies", category: "Humanities" },
  { name: "Economics", category: "Humanities" },
  { name: "Principles of Accounts", category: "Business" },
  { name: "Computing", category: "Technology" },
  { name: "Programming", category: "Technology" },
  { name: "Music", category: "Arts" },
  { name: "Art", category: "Arts" },
];

const LEVELS = [
  "Primary",
  "Secondary",
  "Junior College",
  "IB",
  "IGCSE",
  "Polytechnic",
  "University",
  "Adult Learning",
];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function main() {
  console.log("Seeding subjects...");
  await db
    .insert(subjects)
    .values(
      SUBJECTS.map((s) => ({ name: s.name, slug: slugify(s.name), category: s.category }))
    )
    .onConflictDoNothing();

  console.log("Seeding levels...");
  await db
    .insert(levels)
    .values(
      LEVELS.map((name, i) => ({ name, slug: slugify(name), sortOrder: i }))
    )
    .onConflictDoNothing();

  console.log("Seeding admin account...");
  const passwordHash = await bcrypt.hash(config.ADMIN_PASSWORD, 12);
  await db
    .insert(admins)
    .values({ email: config.ADMIN_EMAIL, passwordHash })
    .onConflictDoNothing();

  console.log(`Seed complete. Admin: ${config.ADMIN_EMAIL}`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
