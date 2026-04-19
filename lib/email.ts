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

// Dev mode: if DEV_MODE_EMAIL is set, every outbound email is redirected
// there and the real recipient is stamped into the subject + body so you
// can verify the pipeline end-to-end without ever contacting real prospects.
function devRedirect(opts: SendOpts): SendOpts {
  const redirect = process.env.DEV_MODE_EMAIL?.trim();
  if (!redirect) return opts;
  const banner = `[DEV MODE — would have sent to ${opts.to}]`;
  return {
    ...opts,
    to: redirect,
    subject: `${banner} ${opts.subject}`,
    text: `${banner}\n\n${opts.text}`,
    html: opts.html ? `<p><strong>${banner}</strong></p>${opts.html}` : undefined,
  };
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
export async function sendOrSave(rawOpts: SendOpts): Promise<{ sent: boolean; savedEml?: string; redirectedTo?: string }> {
  await fs.mkdir(SENT_DIR, { recursive: true });
  const opts = devRedirect(rawOpts);
  const redirectedTo = opts.to !== rawOpts.to ? opts.to : undefined;

  if (smtpConfigured()) {
    const info = await transporter().sendMail({
      to: opts.to,
      from: opts.from,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
      attachments: opts.attachments,
    });
    return { sent: !!info.messageId, redirectedTo };
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
  return { sent: false, savedEml: path.relative(process.cwd(), file), redirectedTo };
}
