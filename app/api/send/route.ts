import { NextResponse } from "next/server";
import { findTopContact } from "@/lib/crustdata";
import { loadConfig, loadSiteHtml } from "@/lib/storage";
import { fullPageScreenshot } from "@/lib/screenshot";
import { sendOrSave } from "@/lib/email";
import type { LandingPage, OutreachResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function buildEmail(opts: {
  companyName: string;
  recipientName?: string;
  fromName: string;
  price: number;
  paymentDetails: string;
}) {
  const salutation = opts.recipientName
    ? `Hi ${opts.recipientName.split(" ")[0]},`
    : `Hi there,`;

  const subject = `Mocked up a new landing page for ${opts.companyName}`;

  const text = `${salutation}

I'm ${opts.fromName} — I'm a freelance web designer and I spend a lot of time studying B2B sites.
I noticed ${opts.companyName}'s site was due for a refresh, so instead of sending a cold pitch
I went ahead and built one. I've attached a full-page screenshot.

If you like it, you can buy the full HTML + source for $${opts.price}. I'll ship the files within
24 hours and throw in one round of copy tweaks.

Payment: ${opts.paymentDetails}

If it's not a fit, no problem — keep the mockup as a thought-starter.

— ${opts.fromName}`;

  const html = `<p>${salutation}</p>
<p>I'm <strong>${opts.fromName}</strong> — I'm a freelance web designer and I spend a lot of time studying B2B sites.
I noticed <strong>${opts.companyName}</strong>'s site was due for a refresh, so instead of sending a cold pitch I went ahead and built one. A full-page screenshot is attached.</p>
<p>If you like it, you can buy the full HTML + source for <strong>$${opts.price}</strong>. I'll ship the files within 24 hours and throw in one round of copy tweaks.</p>
<p><em>Payment:</em> ${opts.paymentDetails}</p>
<p>If it's not a fit, no problem — keep the mockup as a thought-starter.</p>
<p>— ${opts.fromName}</p>`;

  return { subject, text, html };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const pages = (body.pages ?? []) as LandingPage[];
    if (!pages.length) {
      return NextResponse.json({ error: "pages[] required" }, { status: 400 });
    }
    const config = await loadConfig();

    const results: OutreachResult[] = await Promise.all(
      pages.map(async (p): Promise<OutreachResult> => {
        try {
          const c = p.company;
          // 1. find founder / top contact
          const contact = await findTopContact({
            companyName: c.name,
            linkedinCompanyId: c.linkedin_company_id,
            domain: c.domain,
          });

          // 2. screenshot
          const html = p.html ?? (await loadSiteHtml(c.id));
          if (!html) throw new Error("no landing page html on disk");
          const png = await fullPageScreenshot(html);

          const email = buildEmail({
            companyName: c.name,
            recipientName: contact?.name,
            fromName: config.fromName,
            price: config.price,
            paymentDetails: config.paymentDetails,
          });

          if (!contact?.email) {
            return {
              id: c.id,
              companyName: c.name,
              recipient: contact ?? undefined,
              subject: email.subject,
              body: email.text,
              sent: false,
              error: "no contact email found",
            };
          }

          const send = await sendOrSave({
            to: contact.email,
            from: `${config.fromName} <${config.fromEmail}>`,
            subject: email.subject,
            text: email.text,
            html: email.html,
            attachments: [
              { filename: `${c.id}-landing.png`, content: png, contentType: "image/png" },
            ],
          });

          return {
            id: c.id,
            companyName: c.name,
            recipient: contact,
            subject: email.subject,
            body: email.text,
            sent: send.sent,
            savedEml: send.savedEml,
          };
        } catch (e: any) {
          return {
            id: p.company.id,
            companyName: p.company.name,
            sent: false,
            error: String(e.message ?? e),
          };
        }
      })
    );

    return NextResponse.json({ results });
  } catch (e: any) {
    return NextResponse.json({ error: String(e.message ?? e) }, { status: 500 });
  }
}
