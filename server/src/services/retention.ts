import path from "node:path";
import fs from "node:fs";
import { and, isNull, isNotNull, lt, eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { tutors, verificationDocuments } from "../db/schema.js";
import { deleteDriveFolder } from "./gdrive.js";
import { privateDocsDir } from "../config.js";
import { config } from "../config.js";

/**
 * PDPA retention sweep: verification documents (NRIC images, qualification
 * certs, CV) are erased DOCS_RETENTION_MONTHS (default 3) after the tutor
 * was verified — local files, the tutor's Google Drive subfolder, and the
 * verification_documents rows. The tutor account and public listing remain.
 */
export async function purgeExpiredVerificationDocs(): Promise<number> {
  const due = await db
    .select({
      id: tutors.id,
      fullName: tutors.fullName,
      gdriveFolderId: tutors.gdriveFolderId,
    })
    .from(tutors)
    .where(
      and(
        isNotNull(tutors.verifiedAt),
        isNull(tutors.docsPurgedAt),
        lt(
          tutors.verifiedAt,
          sql`now() - make_interval(months => ${config.DOCS_RETENTION_MONTHS})`
        )
      )
    );

  let purged = 0;
  for (const tutor of due) {
    try {
      const docs = await db
        .select()
        .from(verificationDocuments)
        .where(eq(verificationDocuments.tutorId, tutor.id));

      // 1. Local files
      for (const doc of docs) {
        if (!doc.filePath) continue; // Drive-only doc, no local copy
        const p = path.join(privateDocsDir, path.basename(doc.filePath));
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
      // 2. Google Drive subfolder
      if (tutor.gdriveFolderId) {
        await deleteDriveFolder(tutor.gdriveFolderId);
      }
      // 3. DB rows + mark purged
      await db
        .delete(verificationDocuments)
        .where(eq(verificationDocuments.tutorId, tutor.id));
      await db
        .update(tutors)
        .set({ gdriveFolderId: null, docsPurgedAt: new Date() })
        .where(eq(tutors.id, tutor.id));

      purged++;
      console.log(
        `Retention: erased verification documents for tutor ${tutor.id} (verified > ${config.DOCS_RETENTION_MONTHS} months ago)`
      );
    } catch (err) {
      console.error(`Retention purge failed for tutor ${tutor.id}:`, err);
    }
  }
  return purged;
}

/** Run at boot and then daily. */
export function startRetentionSweeper(): void {
  const run = () =>
    purgeExpiredVerificationDocs().catch((err) =>
      console.error("Retention sweep error:", err)
    );
  setTimeout(run, 10_000); // shortly after boot
  setInterval(run, 24 * 3600 * 1000).unref();
}
