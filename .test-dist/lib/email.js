"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendOrSave = sendOrSave;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const storage_1 = require("./storage");
function smtpConfigured() {
    return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}
// Dev mode: if DEV_MODE_EMAIL is set, every outbound email is redirected
// there and the real recipient is stamped into the subject + body so you
// can verify the pipeline end-to-end without ever contacting real prospects.
function devRedirect(opts) {
    const redirect = process.env.DEV_MODE_EMAIL?.trim();
    if (!redirect)
        return opts;
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
    return nodemailer_1.default.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: Number(process.env.SMTP_PORT ?? 587) === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
}
// If SMTP is configured: really send. Otherwise: serialize to a .eml file
// the user can drag into any mail client. Returns { sent, savedEml }.
async function sendOrSave(rawOpts) {
    await promises_1.default.mkdir(storage_1.SENT_DIR, { recursive: true });
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
    const t = nodemailer_1.default.createTransport({
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
    const file = node_path_1.default.join(storage_1.SENT_DIR, `${Date.now()}-${opts.to.replace(/[^a-z0-9]/gi, "_")}.eml`);
    await promises_1.default.writeFile(file, info.message);
    return { sent: false, savedEml: node_path_1.default.relative(process.cwd(), file), redirectedTo };
}
