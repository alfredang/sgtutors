import { z } from "zod";

/**
 * Singapore NRIC/FIN validation with mod-11 checksum for S/T/F/G series.
 * M-series (2022+ FINs) uses a different table; validated by format only.
 */
export function isValidNric(nric: string): boolean {
  const value = nric.toUpperCase().trim();
  if (!/^[STFGM]\d{7}[A-Z]$/.test(value)) return false;
  const prefix = value[0];
  if (prefix === "M") return true;
  const weights = [2, 7, 6, 5, 4, 3, 2];
  const digits = value.slice(1, 8).split("").map(Number);
  let sum = digits.reduce((acc, d, i) => acc + d * weights[i], 0);
  if (prefix === "T" || prefix === "G") sum += 4;
  const remainder = sum % 11;
  const stTable = "JZIHGFEDCBA";
  const fgTable = "XWUTRQPNMLK";
  const expected =
    prefix === "S" || prefix === "T" ? stTable[remainder] : fgTable[remainder];
  return value[8] === expected;
}

export const nricSchema = z
  .string()
  .transform((s) => s.toUpperCase().trim())
  .refine(isValidNric, "Invalid NRIC/FIN number");

export const mobileSchema = z
  .string()
  .trim()
  .regex(/^(\+65\s?)?[689]\d{7}$/, "Invalid Singapore mobile number");

export const tutorSignupSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  displayName: z.string().trim().min(2).max(60),
  gender: z.enum(["male", "female"]),
  race: z.enum(["chinese", "malay", "indian", "eurasian", "others"]),
  nationality: z.enum(["singaporean", "singapore_pr", "malaysian", "others"]),
  address: z.string().trim().min(5).max(300),
  region: z.enum(["north", "north_east", "north_west", "east", "west", "central"]),
  linkedinUrl: z
    .string()
    .trim()
    .url()
    .refine(
      (u) => /^https:\/\/(www\.)?linkedin\.com\//i.test(u),
      "Must be a linkedin.com profile URL"
    )
    .optional()
    .or(z.literal("").transform(() => undefined)),
  nric: nricSchema,
  dob: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "DOB must be YYYY-MM-DD")
    .refine((s) => {
      const d = new Date(s);
      const age = (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
      return age >= 16 && age <= 90;
    }, "Tutor must be between 16 and 90 years old"),
  mobile: mobileSchema,
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(8).max(100),
  profileText: z.string().trim().min(20).max(1000),
  highestQualification: z.string().trim().min(2).max(200),
  education: z.string().trim().min(2).max(300),
  studentsTaught: z.coerce.number().int().min(0).max(10000),
  experienceYears: z.coerce.number().int().min(0).max(70),
  subjectIds: z.array(z.coerce.number().int().positive()).min(1).max(15),
  levelIds: z.array(z.coerce.number().int().positive()).min(1).max(10),
});
export type TutorSignupInput = z.infer<typeof tutorSignupSchema>;

export const tutorProfileUpdateSchema = tutorSignupSchema
  .pick({
    displayName: true,
    gender: true,
    race: true,
    nationality: true,
    address: true,
    region: true,
    linkedinUrl: true,
    profileText: true,
    highestQualification: true,
    education: true,
    studentsTaught: true,
    experienceYears: true,
    subjectIds: true,
    levelIds: true,
  })
  .partial();

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export const reviewSchema = z.object({
  reviewerName: z.string().trim().min(2).max(80),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().min(5).max(2000),
});

export const enquirySchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(255),
  phone: mobileSchema,
  message: z.string().trim().min(10).max(3000),
  turnstileToken: z.string().min(1, "Captcha verification required"),
});

export const appealSchema = z.object({
  reason: z.string().trim().min(20).max(2000),
});

export const interviewAnswerSchema = z.object({
  answer: z.string().trim().min(1).max(5000),
  pasteFlag: z.boolean().optional().default(false),
});
