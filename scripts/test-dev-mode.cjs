// Run from MoneyMaker/ as:
//   node scripts/test-dev-mode.cjs
// (after: tsc emitted into .test-dist/)

const fs = require("node:fs/promises");
const path = require("node:path");
const { sendOrSave } = require("../.test-dist/lib/email.js");

const SENT_DIR = path.join(process.cwd(), "data", "sent");

const checks = [];
const expect = (name, cond, detail = "") => checks.push({ name, pass: !!cond, detail });

async function snapshot() {
  try { return new Set(await fs.readdir(SENT_DIR)); }
  catch { return new Set(); }
}

async function readNewEml(before) {
  const after = await snapshot();
  const added = [...after].filter((f) => !before.has(f));
  if (added.length !== 1) throw new Error(`expected 1 new .eml, got ${added.length}: ${added.join(",")}`);
  const file = added[0];
  const body = await fs.readFile(path.join(SENT_DIR, file), "utf8");
  return { file, body };
}

// Decode nodemailer's quoted-printable + UTF-8 MIME-encoded headers so we can
// match on the actual subject content. We only need enough to handle ASCII +
// the em-dash in our banner.
function decodeHeaderValue(v) {
  return v
    .replace(/\?=\s+=\?UTF-8\?Q\?/g, "") // stitch continuation lines
    .replace(/=\?UTF-8\?Q\?([^?]*)\?=/g, (_, s) =>
      s.replace(/_/g, " ").replace(/=([0-9A-Fa-f]{2})/g, (_, h) =>
        String.fromCharCode(parseInt(h, 16))));
}

function subjectOf(body) {
  const m = body.match(/^Subject:\s*((?:.|\n[ \t])+?)(?=\n\S)/m);
  return m ? decodeHeaderValue(m[1].replace(/\n[ \t]+/g, " ")) : "";
}

function toOf(body) {
  const m = body.match(/^To:\s*(.+)$/m);
  return m ? m[1].trim() : "";
}

(async () => {
  // ---------- Case A: redirect ON ----------
  {
    process.env.DEV_MODE_EMAIL = "redirect@test.invalid";
    const before = await snapshot();
    const send = await sendOrSave({
      to: "real@prospect.invalid",
      from: "Tester <tester@test.invalid>",
      subject: "Mocked landing page for Prospect Co",
      text: "hello prospect",
      html: "<p>hello prospect</p>",
    });
    const { file, body } = await readNewEml(before);
    const subj = subjectOf(body);
    const to = toOf(body);

    expect("A1 returns redirectedTo = dev inbox",
      send.redirectedTo === "redirect@test.invalid", `got ${send.redirectedTo}`);
    expect("A2 returns savedEml (fallback path)", !!send.savedEml);
    expect("A3 filename is slug of dev inbox",
      file.includes("redirect_test_invalid"), file);
    expect("A4 To: header is dev inbox", /redirect@test\.invalid/.test(to), `To: ${to}`);
    expect("A5 To: header is NOT original recipient",
      !/real@prospect\.invalid/.test(to), `To: ${to}`);
    // Subject is MIME-Q-encoded across continuation lines. Check raw bytes:
    // `=5BDEV_MODE` is the encoded form of `[DEV MODE`.
    const rawSubjectBlock = body.match(/^Subject:(?:.|\r?\n[ \t])+/m)?.[0] ?? "";
    expect("A6 encoded banner in Subject block",
      rawSubjectBlock.includes("=5BDEV_MODE") &&
        rawSubjectBlock.includes("real") && rawSubjectBlock.includes("prospect"),
      `raw subject: ${rawSubjectBlock.slice(0, 200)}`);
    expect("A7 banner in plaintext body",
      body.includes("[DEV MODE") && body.includes("real@prospect.invalid"));
  }

  // ---------- Case B: redirect OFF ----------
  {
    delete process.env.DEV_MODE_EMAIL;
    const before = await snapshot();
    const send = await sendOrSave({
      to: "real@prospect.invalid",
      from: "Tester <tester@test.invalid>",
      subject: "Mocked landing page for Prospect Co",
      text: "hello prospect",
      html: "<p>hello prospect</p>",
    });
    const { file, body } = await readNewEml(before);
    const subj = subjectOf(body);
    const to = toOf(body);

    expect("B1 returns no redirectedTo",
      send.redirectedTo === undefined, `got ${send.redirectedTo}`);
    expect("B2 filename is slug of original recipient",
      file.includes("real_prospect_invalid"), file);
    expect("B3 To: header is original recipient",
      /real@prospect\.invalid/.test(to), `To: ${to}`);
    const rawSubjectBlockB = body.match(/^Subject:(?:.|\r?\n[ \t])+/m)?.[0] ?? "";
    expect("B4 no dev banner in Subject block",
      !/DEV_MODE|DEV MODE|=5BDEV/.test(rawSubjectBlockB),
      `raw subject: ${rawSubjectBlockB.slice(0, 200)}`);
    expect("B5 no dev banner in body", !body.includes("DEV MODE"));
  }

  let failed = 0;
  for (const c of checks) {
    console.log(`${c.pass ? "PASS" : "FAIL"}  ${c.name}${!c.pass && c.detail ? `  — ${c.detail}` : ""}`);
    if (!c.pass) failed++;
  }
  console.log(`\n${checks.length - failed}/${checks.length} passed`);
  process.exit(failed ? 1 : 0);
})();
