import { google, type drive_v3 } from "googleapis";
import fs from "node:fs";
import { Readable } from "node:stream";
import { config } from "../config.js";

/**
 * Google Drive archival for verification documents.
 *
 * Setup (admin):
 * 1. Create a Google Cloud service account and download its JSON key.
 * 2. Set GDRIVE_SERVICE_ACCOUNT_JSON to the key file path (or the raw JSON).
 * 3. Create/choose a Drive folder, share it with the service account's
 *    client_email (Editor), and set GDRIVE_PARENT_FOLDER_ID to its ID.
 *
 * The system then creates one subfolder per tutor (named with the tutor's
 * full name) and uploads every verification document into it. When not
 * configured, uploads fall back to local-disk-only storage.
 */

let driveClient: drive_v3.Drive | null | undefined;

function getDrive(): drive_v3.Drive | null {
  if (driveClient !== undefined) return driveClient;
  if (!config.GDRIVE_PARENT_FOLDER_ID || !config.GDRIVE_SERVICE_ACCOUNT_JSON) {
    driveClient = null;
    return null;
  }
  try {
    const raw = config.GDRIVE_SERVICE_ACCOUNT_JSON.trim();
    const credentials = raw.startsWith("{")
      ? JSON.parse(raw)
      : JSON.parse(fs.readFileSync(raw, "utf8"));
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/drive"],
    });
    driveClient = google.drive({ version: "v3", auth });
  } catch (err) {
    console.error("Google Drive init failed — falling back to local storage:", err);
    driveClient = null;
  }
  return driveClient;
}

export function isDriveConfigured(): boolean {
  return getDrive() !== null;
}

/** Find or create the tutor's subfolder under the admin-provided parent. */
export async function ensureTutorFolder(
  fullName: string,
  tutorId: string
): Promise<string | null> {
  const drive = getDrive();
  if (!drive) return null;
  const folderName = `${fullName} (${tutorId.slice(0, 8)})`;
  try {
    const existing = await drive.files.list({
      q: `'${config.GDRIVE_PARENT_FOLDER_ID}' in parents and name = '${folderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: "files(id)",
      pageSize: 1,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    if (existing.data.files?.[0]?.id) return existing.data.files[0].id;

    const created = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [config.GDRIVE_PARENT_FOLDER_ID!],
      },
      fields: "id",
      supportsAllDrives: true,
    });
    return created.data.id ?? null;
  } catch (err) {
    console.error(`Drive folder creation failed for ${folderName}:`, err);
    return null;
  }
}

export async function uploadDocToDrive(opts: {
  folderId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<string | null> {
  const drive = getDrive();
  if (!drive) return null;
  try {
    const res = await drive.files.create({
      requestBody: { name: opts.fileName, parents: [opts.folderId] },
      media: { mimeType: opts.mimeType, body: Readable.from(opts.buffer) },
      fields: "id",
      supportsAllDrives: true,
    });
    return res.data.id ?? null;
  } catch (err) {
    console.error(`Drive upload failed for ${opts.fileName}:`, err);
    return null;
  }
}

/** Stream a document back from Drive (admin viewing — nothing stored locally). */
export async function downloadDriveFile(
  fileId: string
): Promise<{ stream: NodeJS.ReadableStream; mimeType: string } | null> {
  const drive = getDrive();
  if (!drive) return null;
  try {
    const meta = await drive.files.get({
      fileId,
      fields: "mimeType",
      supportsAllDrives: true,
    });
    const res = await drive.files.get(
      { fileId, alt: "media", supportsAllDrives: true },
      { responseType: "stream" }
    );
    return {
      stream: res.data as unknown as NodeJS.ReadableStream,
      mimeType: meta.data.mimeType ?? "application/octet-stream",
    };
  } catch (err) {
    console.error(`Drive download failed (${fileId}):`, err);
    return null;
  }
}

/** Permanently delete a tutor's Drive folder (retention sweep). */
export async function deleteDriveFolder(folderId: string): Promise<boolean> {
  const drive = getDrive();
  if (!drive) return false;
  try {
    await drive.files.delete({ fileId: folderId, supportsAllDrives: true });
    return true;
  } catch (err) {
    console.error(`Drive folder deletion failed (${folderId}):`, err);
    return false;
  }
}
