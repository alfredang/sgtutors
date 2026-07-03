/**
 * Seeds 30 realistic mock tutors: 10 featured (verified), 10 verified,
 * 10 unverified — with SVG avatar photos, reviews and enquiries.
 * Run: npx tsx src/db/mockTutors.ts
 */
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { db, pool } from "./client.js";
import {
  tutors,
  subjects,
  levels,
  tutorSubjects,
  tutorLevels,
  reviews,
  enquiries,
  payments,
} from "./schema.js";
import { publicPhotosDir } from "../config.js";
import { eq } from "drizzle-orm";

type G = "male" | "female";
interface Mock {
  fullName: string;
  displayName: string;
  gender: G;
  race: "chinese" | "malay" | "indian" | "eurasian" | "others";
  qual: string;
  edu: string;
  subjects: string[];
  levels: string[];
  years: number;
  students: number;
  region: "north" | "north_east" | "north_west" | "east" | "west" | "central";
}

const MOCKS: Mock[] = [
  { fullName: "Lim Jia Hui", displayName: "Ms Lim", gender: "female", race: "chinese", qual: "BSc Mathematics (NUS)", edu: "NUS Mathematics; Raffles JC", subjects: ["Mathematics", "Additional Mathematics"], levels: ["Secondary", "Junior College"], years: 8, students: 120, region: "central" },
  { fullName: "Muhammad Irfan Bin Rahman", displayName: "Mr Irfan", gender: "male", race: "malay", qual: "BEng Chemical Engineering (NTU)", edu: "NTU Engineering; Victoria JC", subjects: ["Chemistry", "Science"], levels: ["Secondary", "Junior College"], years: 6, students: 85, region: "east" },
  { fullName: "Priya d/o Krishnan", displayName: "Ms Priya", gender: "female", race: "indian", qual: "BA English Literature (NUS)", edu: "NUS Arts; Anderson JC", subjects: ["English", "English Literature"], levels: ["Primary", "Secondary"], years: 10, students: 150, region: "north" },
  { fullName: "Tan Wei Jie", displayName: "Mr Tan WJ", gender: "male", race: "chinese", qual: "PhD Physics (NUS)", edu: "NUS Physics PhD; Hwa Chong Institution", subjects: ["Physics", "H2 Mathematics"], levels: ["Junior College", "IB", "University"], years: 12, students: 200, region: "north_west" },
  { fullName: "Nurul Aisyah Binte Hassan", displayName: "Ms Aisyah", gender: "female", race: "malay", qual: "BA Malay Studies (NUS)", edu: "NUS Malay Studies; Tampines JC", subjects: ["Malay", "English"], levels: ["Primary", "Secondary"], years: 5, students: 60, region: "east" },
  { fullName: "Chen Xiu Ling", displayName: "Laoshi Chen", gender: "female", race: "chinese", qual: "MA Chinese Language (NTU)", edu: "NTU Chinese; Nanjing University exchange", subjects: ["Chinese", "Higher Chinese"], levels: ["Primary", "Secondary", "Junior College"], years: 15, students: 260, region: "west" },
  { fullName: "Rajesh s/o Muthu", displayName: "Mr Rajesh", gender: "male", race: "indian", qual: "BSc Economics (LSE)", edu: "LSE Economics; ACS Independent", subjects: ["Economics", "Mathematics"], levels: ["Junior College", "IB", "University"], years: 9, students: 110, region: "central" },
  { fullName: "Sarah Anne De Souza", displayName: "Ms De Souza", gender: "female", race: "eurasian", qual: "BA History (NUS)", edu: "NUS History; St Joseph's Institution", subjects: ["History", "Social Studies", "General Paper"], levels: ["Secondary", "Junior College"], years: 7, students: 90, region: "north_east" },
  { fullName: "Ong Kai Ming", displayName: "Mr Ong", gender: "male", race: "chinese", qual: "BComp Computer Science (NUS)", edu: "NUS Computing; NUS High School", subjects: ["Computing", "Programming", "Mathematics"], levels: ["Secondary", "Junior College", "Polytechnic"], years: 4, students: 45, region: "west" },
  { fullName: "Fatimah Binte Yusof", displayName: "Cikgu Fatimah", gender: "female", race: "malay", qual: "BEd Primary Education (NIE)", edu: "NIE; Temasek JC", subjects: ["Malay", "Science", "Mathematics"], levels: ["Primary"], years: 11, students: 175, region: "north" },
  { fullName: "Goh Zhi Hao", displayName: "Mr Goh", gender: "male", race: "chinese", qual: "BSc Biomedical Science (NTU)", edu: "NTU Biomedical; National JC", subjects: ["Biology", "Chemistry"], levels: ["Secondary", "Junior College"], years: 6, students: 78, region: "north_east" },
  { fullName: "Ananya d/o Suresh", displayName: "Ms Ananya", gender: "female", race: "indian", qual: "BSc Mathematics & Economics (SMU)", edu: "SMU; Cedar Girls' Secondary", subjects: ["Mathematics", "Elementary Mathematics", "Economics"], levels: ["Secondary", "Junior College"], years: 3, students: 35, region: "central" },
  { fullName: "Wong Li Ting", displayName: "Ms Wong", gender: "female", race: "chinese", qual: "BA Geography (NUS)", edu: "NUS Geography; Dunman High", subjects: ["Geography", "Social Studies"], levels: ["Secondary", "Junior College"], years: 8, students: 95, region: "east" },
  { fullName: "Daniel Pereira", displayName: "Mr Pereira", gender: "male", race: "eurasian", qual: "BMus Music Performance (LASALLE)", edu: "LASALLE College of the Arts", subjects: ["Music"], levels: ["Primary", "Secondary", "Adult Learning"], years: 14, students: 130, region: "central" },
  { fullName: "Siti Zulaikha Binte Omar", displayName: "Ms Zulaikha", gender: "female", race: "malay", qual: "BSc Chemistry (NUS)", edu: "NUS Chemistry; Meridian JC", subjects: ["Chemistry", "Combined Science"], levels: ["Secondary"], years: 5, students: 55, region: "north" },
  { fullName: "Lee Jun Wei", displayName: "Mr Lee JW", gender: "male", race: "chinese", qual: "BEng Mechanical Engineering (NTU)", edu: "NTU Engineering; Catholic JC", subjects: ["Physics", "Mathematics", "Additional Mathematics"], levels: ["Secondary", "Junior College"], years: 7, students: 88, region: "west" },
  { fullName: "Kavitha d/o Raman", displayName: "Ms Kavitha", gender: "female", race: "indian", qual: "BA Tamil Studies (NUS)", edu: "NUS Tamil Studies", subjects: ["Tamil", "English"], levels: ["Primary", "Secondary"], years: 9, students: 105, region: "north_west" },
  { fullName: "Ng Hui Min", displayName: "Ms Ng", gender: "female", race: "chinese", qual: "BAcc Accountancy (NTU)", edu: "NTU Accountancy; St Andrew's JC", subjects: ["Principles of Accounts", "Mathematics"], levels: ["Secondary", "Polytechnic"], years: 6, students: 70, region: "east" },
  { fullName: "Amirul Hakim Bin Ismail", displayName: "Mr Amirul", gender: "male", race: "malay", qual: "BSc Sport Science (NTU)", edu: "NTU Sport Science; Yishun JC", subjects: ["Science", "Mathematics"], levels: ["Primary", "Secondary"], years: 4, students: 40, region: "north" },
  { fullName: "Isabella Rozario", displayName: "Ms Rozario", gender: "female", race: "eurasian", qual: "MA Applied Linguistics (NIE)", edu: "NIE; CHIJ Katong Convent", subjects: ["English", "English Literature", "General Paper"], levels: ["Secondary", "Junior College", "IB"], years: 13, students: 190, region: "east" },
  { fullName: "Koh Boon Keng", displayName: "Mr Koh", gender: "male", race: "chinese", qual: "BSc Statistics (NUS)", edu: "NUS Statistics; Jurong JC", subjects: ["H2 Mathematics", "Further Mathematics", "Mathematics"], levels: ["Junior College", "University"], years: 10, students: 140, region: "west" },
  { fullName: "Deepa d/o Vellu", displayName: "Ms Deepa", gender: "female", race: "indian", qual: "BSc Life Sciences (NUS)", edu: "NUS Life Sciences; Innova JC", subjects: ["Biology", "Science"], levels: ["Secondary", "Junior College"], years: 5, students: 62, region: "north" },
  { fullName: "Chua Mei Fen", displayName: "Ms Chua", gender: "female", race: "chinese", qual: "BFA Fine Arts (NAFA)", edu: "NAFA Fine Arts", subjects: ["Art"], levels: ["Primary", "Secondary", "Adult Learning"], years: 8, students: 75, region: "central" },
  { fullName: "Harith Bin Zainal", displayName: "Mr Harith", gender: "male", race: "malay", qual: "BEng Computer Engineering (NUS)", edu: "NUS Computer Engineering; Anglo-Chinese JC", subjects: ["Computing", "Programming"], levels: ["Junior College", "Polytechnic", "University"], years: 3, students: 28, region: "north_east" },
  { fullName: "Teo Sze Yin", displayName: "Ms Teo", gender: "female", race: "chinese", qual: "BSocSci Psychology (NUS)", edu: "NUS Psychology; Nanyang JC", subjects: ["General Paper", "English"], levels: ["Junior College", "IB"], years: 6, students: 80, region: "north_west" },
  { fullName: "Vikram s/o Pillai", displayName: "Mr Vikram", gender: "male", race: "indian", qual: "MSc Financial Engineering (NUS)", edu: "NUS MFE; SRJC", subjects: ["Mathematics", "Economics"], levels: ["Junior College", "University"], years: 7, students: 92, region: "central" },
  { fullName: "Yap Qian Yi", displayName: "Ms Yap", gender: "female", race: "chinese", qual: "BA Chinese (NTU)", edu: "NTU Chinese; River Valley High", subjects: ["Chinese", "Higher Chinese"], levels: ["Primary", "Secondary"], years: 4, students: 48, region: "west" },
  { fullName: "Aaron Emmanuel Fernandez", displayName: "Mr Fernandez", gender: "male", race: "eurasian", qual: "BSc Physics (Imperial College London)", edu: "Imperial College London; Raffles Institution", subjects: ["Physics", "IGCSE" ].filter(x => x !== "IGCSE").concat(["Mathematics"]), levels: ["Secondary", "IGCSE", "IB"], years: 5, students: 58, region: "central" },
  { fullName: "Halimah Binte Sulaiman", displayName: "Ms Halimah", gender: "female", race: "malay", qual: "BEd English (NIE)", edu: "NIE English Education", subjects: ["English", "Social Studies"], levels: ["Primary", "Secondary"], years: 16, students: 240, region: "east" },
  { fullName: "Seah Kok Wah", displayName: "Mr Seah", gender: "male", race: "chinese", qual: "BBA (NUS), ex-MOE teacher", edu: "NUS Business; 8 years MOE secondary school", subjects: ["Elementary Mathematics", "Principles of Accounts"], levels: ["Secondary"], years: 18, students: 320, region: "north" },
];

const REVIEW_POOL: [string, number, string][] = [
  ["Mrs Lim", 5, "Very patient and structured. My daughter's grades improved from B3 to A1 in one term."],
  ["Mr Kumar", 5, "Explains difficult concepts in a way my son actually understands. Highly recommended."],
  ["Madam Tan", 4, "Reliable and punctual. Homework is always marked with detailed feedback."],
  ["Jason", 5, "Went from failing to a B in 3 months. Really knows the exam requirements."],
  ["Mrs Wong", 4, "Good tutor, my kids enjoy the lessons. Sometimes reschedules but always makes up."],
  ["Mr Lee", 5, "Excellent command of the syllabus. Gave us past-year paper strategies that worked."],
  ["Aunty Mary", 5, "My grandson looks forward to every lesson. Patient with slow learners."],
  ["Mrs Nair", 4, "Professional and well-prepared. Provides own materials and practice papers."],
  ["David", 5, "Helped me clear my A-Levels with an A. Worth every dollar."],
  ["Mdm Siti", 5, "Sangat baik! My daughter improved a lot in a short time."],
];

const ENQUIRY_POOL: [string, string][] = [
  ["Mrs Chan", "Looking for weekly lessons for my Sec 3 son. Are you available on weekends?"],
  ["Mr Raj", "My daughter needs help before her O-Levels. Can you do intensive revision?"],
  ["Adeline", "Hi, do you offer online lessons? What are your rates?"],
  ["Mdm Noor", "My P5 child is struggling. Can we arrange a trial lesson?"],
  ["Kenneth", "Preparing for A-Levels next year, need 2x weekly sessions in the evenings."],
];

function avatarSvg(initials: string, hue: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="350" height="450" viewBox="0 0 350 450">
<rect width="350" height="450" fill="#ffffff"/>
<circle cx="175" cy="160" r="70" fill="hsl(${hue},45%,72%)"/>
<ellipse cx="175" cy="340" rx="115" ry="95" fill="hsl(${hue},45%,72%)"/>
<text x="175" y="185" font-family="Arial" font-size="64" font-weight="bold" fill="#ffffff" text-anchor="middle">${initials}</text>
</svg>`;
}

function initialsOf(displayName: string): string {
  const parts = displayName.replace(/^(Mr|Ms|Mrs|Mdm|Cikgu|Laoshi)\s+/i, "").split(/\s+/);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

/** Deterministic fake-but-checksum-valid NRIC for mock data. */
function mockNric(i: number): string {
  const digits = String(8000000 + i * 137).slice(0, 7);
  const weights = [2, 7, 6, 5, 4, 3, 2];
  const sum = digits.split("").reduce((a, d, j) => a + Number(d) * weights[j], 0);
  return `S${digits}${"JZIHGFEDCBA"[sum % 11]}`;
}

async function main() {
  const allSubjects = await db.select().from(subjects);
  const allLevels = await db.select().from(levels);
  const subjectId = (name: string) => allSubjects.find((s) => s.name === name)?.id;
  const levelId = (name: string) => allLevels.find((l) => l.name === name)?.id;
  const passwordHash = await bcrypt.hash("mocktutor123", 12);
  fs.mkdirSync(publicPhotosDir, { recursive: true });

  let created = 0;
  for (let i = 0; i < MOCKS.length; i++) {
    const m = MOCKS[i];
    const email = `mock.tutor${i + 1}@sgtutors.local`;
    const [exists] = await db
      .select({ id: tutors.id })
      .from(tutors)
      .where(eq(tutors.email, email));
    if (exists) continue;

    // Tier: 0-9 featured+verified, 10-19 verified, 20-29 unverified
    const tier = i < 10 ? "featured" : i < 20 ? "verified" : "unverified";

    // Local SVG avatar (dev fallback storage; R2 used automatically when configured)
    const photoName = `mock-${crypto.randomUUID()}.svg`;
    fs.writeFileSync(
      path.join(publicPhotosDir, photoName),
      avatarSvg(initialsOf(m.displayName), (i * 47) % 360)
    );

    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    const featuredUntil =
      tier === "featured"
        ? new Date(Date.now() + (30 + (i % 60)) * 86_400_000)
        : null;
    const verifiedAt =
      tier === "unverified" ? null : new Date(Date.now() - (i + 5) * 86_400_000);

    const [tutor] = await db
      .insert(tutors)
      .values({
        fullName: m.fullName,
        displayName: m.displayName,
        gender: m.gender,
        race: m.race,
        nationality: i % 7 === 3 ? "malaysian" : i % 5 === 4 ? "singapore_pr" : "singaporean",
        nric: mockNric(i),
        dob: `${1975 + (i % 25)}-0${(i % 9) + 1}-1${i % 9}`,
        mobile: `9${String(1000000 + i * 333).slice(0, 7)}`,
        email,
        address: `Blk ${100 + i} Mock Avenue ${(i % 9) + 1} #0${(i % 9) + 1}-${10 + i} Singapore 5${String(60000 + i * 13).slice(0, 5)}`,
        region: m.region,
        linkedinUrl:
          tier !== "unverified" && i % 2 === 0
            ? `https://www.linkedin.com/in/mock-tutor-${i + 1}`
            : null,
        passwordHash,
        profileText: `${m.qual.split("(")[0].trim()} graduate with ${m.years} years of tutoring experience and ${m.students} students taught. I specialise in ${m.subjects.join(" and ")} for ${m.levels.join(", ")} students, focusing on strong fundamentals, exam techniques and consistent practice. Lessons are structured around each student's school syllabus with regular progress updates for parents.`,
        highestQualification: m.qual,
        education: m.edu,
        studentsTaught: m.students,
        experienceYears: m.years,
        photoPath: photoName,
        verificationStatus: tier === "unverified" ? "unverified" : "verified",
        verifiedAt,
        featuredUntil,
        expiresAt,
      })
      .returning({ id: tutors.id });

    const sids = m.subjects.map(subjectId).filter((x): x is number => !!x);
    const lids = m.levels.map(levelId).filter((x): x is number => !!x);
    if (sids.length)
      await db.insert(tutorSubjects).values(sids.map((s) => ({ tutorId: tutor.id, subjectId: s }))).onConflictDoNothing();
    if (lids.length)
      await db.insert(tutorLevels).values(lids.map((l) => ({ tutorId: tutor.id, levelId: l }))).onConflictDoNothing();

    // Reviews: featured 3-6, verified 2-4, unverified 0-2
    const reviewCount = tier === "featured" ? 3 + (i % 4) : tier === "verified" ? 2 + (i % 3) : i % 3;
    for (let r = 0; r < reviewCount; r++) {
      const [name, rating, comment] = REVIEW_POOL[(i + r * 3) % REVIEW_POOL.length];
      await db.insert(reviews).values({
        tutorId: tutor.id,
        reviewerName: name,
        rating: Math.max(3, rating - (r % 2)),
        comment,
        ipHash: crypto.randomBytes(16).toString("hex"),
        createdAt: new Date(Date.now() - (r * 11 + i) * 86_400_000),
      });
    }

    // Enquiries: featured tutors get the most (popularity signal)
    const enquiryCount = tier === "featured" ? 4 + (i % 5) : tier === "verified" ? 1 + (i % 3) : i % 2;
    for (let e = 0; e < enquiryCount; e++) {
      const [name, message] = ENQUIRY_POOL[(i + e) % ENQUIRY_POOL.length];
      await db.insert(enquiries).values({
        tutorId: tutor.id,
        name,
        email: `parent${i}${e}@example.com`,
        phone: `8${String(1000000 + i * 91 + e).slice(0, 7)}`,
        message,
        ipHash: crypto.randomBytes(16).toString("hex"),
        emailSent: true,
        createdAt: new Date(Date.now() - (e * 6 + i) * 86_400_000),
      });
    }

    // Payments backing the verified/featured statuses (revenue data)
    if (tier !== "unverified") {
      await db.insert(payments).values({
        tutorId: tutor.id,
        purpose: "verification",
        amountCents: 5000,
        stripeSessionId: `cs_mock_verif_${i}`,
        status: "paid",
        paidAt: new Date(Date.now() - (i + 10) * 86_400_000),
      }).onConflictDoNothing();
    }
    if (tier === "featured") {
      await db.insert(payments).values({
        tutorId: tutor.id,
        purpose: "featured",
        amountCents: 10000,
        stripeSessionId: `cs_mock_feat_${i}`,
        status: "paid",
        paidAt: new Date(Date.now() - (i + 2) * 86_400_000),
      }).onConflictDoNothing();
    }

    created++;
  }

  console.log(`Mock seed complete: ${created} tutors created (10 featured, 10 verified, 10 unverified).`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
