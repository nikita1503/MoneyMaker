import fs from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";
import { SENT_DIR } from "./storage";

type SendOpts = {
  to: string;
  from: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
};

function smtpConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function transporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST!,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! },
  });
}

// If SMTP is configured: really send. Otherwise: serialize to a .eml file
// the user can drag into any mail client. Returns { sent, savedEml }.
export async function sendOrSave(opts: SendOpts): Promise<{ sent: boolean; savedEml?: string }> {
  await fs.mkdir(SENT_DIR, { recursive: true });

  if (smtpConfigured()) {
    const info = await transporter().sendMail({
      to: opts.to,
      from: opts.from,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
      attachments: opts.attachments,
    });
    return { sent: !!info.messageId };
  }

  // Offline fallback — build a MIME message and drop it on disk.
  const t = nodemailer.createTransport({
    streamTransport: true,
    newline: "unix",
    buffer: true,
  });
  const info = await t.sendMail({
    to: opts.to,
    from: opts.from,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
    attachments: opts.attachments,
  });
  const file = path.join(
    SENT_DIR,
    `${Date.now()}-${opts.to.replace(/[^a-z0-9]/gi, "_")}.eml`
  );
  await fs.writeFile(file, info.message as Buffer);
  return { sent: false, savedEml: path.relative(process.cwd(), file) };
}
