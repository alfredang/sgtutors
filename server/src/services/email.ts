import nodemailer from "nodemailer";
import { config } from "../config.js";

const transporter =
  !config.EMAIL_DEV_MODE && config.SMTP_HOST
    ? nodemailer.createTransport({
        host: config.SMTP_HOST,
        port: config.SMTP_PORT,
        secure: config.SMTP_PORT === 465,
        auth:
          config.SMTP_USER && config.SMTP_PASS
            ? { user: config.SMTP_USER, pass: config.SMTP_PASS }
            : undefined,
      })
    : null;

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<boolean> {
  if (!transporter) {
    console.log(
      `\n=== EMAIL (dev mode) ===\nTo: ${opts.to}\nSubject: ${opts.subject}\n${opts.text}\n========================\n`
    );
    return true;
  }
  try {
    await transporter.sendMail({ from: config.SMTP_FROM, ...opts });
    return true;
  } catch (err) {
    console.error("Email send failed:", err);
    return false;
  }
}

export async function sendEnquiryEmails(opts: {
  tutorEmail: string;
  tutorName: string;
  enquirerName: string;
  enquirerEmail: string;
  enquirerPhone: string;
  message: string;
}): Promise<boolean> {
  const body = [
    `New enquiry for tutor ${opts.tutorName}`,
    ``,
    `From: ${opts.enquirerName}`,
    `Email: ${opts.enquirerEmail}`,
    `Phone: ${opts.enquirerPhone}`,
    ``,
    `Message:`,
    opts.message,
  ].join("\n");
  const [adminOk, tutorOk] = await Promise.all([
    sendEmail({
      to: config.ADMIN_EMAIL,
      subject: `[SG Tutors] New enquiry for ${opts.tutorName}`,
      text: body,
    }),
    sendEmail({
      to: opts.tutorEmail,
      subject: `[SG Tutors] You have a new student enquiry`,
      text: body,
    }),
  ]);
  return adminOk && tutorOk;
}
