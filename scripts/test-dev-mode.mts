// Run from MoneyMaker/ as:
//   node --experimental-strip-types scripts/test-dev-mode.mts
//
// Exercises lib/email.ts::sendOrSave() directly so the dev-mode redirect
// is verified without spinning up Next.js or hitting Crustdata.

import fs from "node:fs/promises";
import path from "node:path";
import { sendOrSave } from "../lib/email.ts";

const SENT_DIR = path.join(process.cwd(), "data", "sent");

type Check = { name: string; pass: boolean; detail?: string };
const checks: Check[] = [];
const expect = (name: string, cond: boolean, detail = "") =>
  checks.push({ name, pass: cond, detail });

async function snapshot(): Promise<Set<string>> {
  try {
    return new Set(await fs.readdir(SENT_DIR));
  } catch {
    return new Set();
  }
}

async function newFilesSince(before: Set<string>): Promise<string[]> {
  const after = await snapshot();
  return [...after].filter((f) => !before.has(f));
}

async function readNewEml(before: Set<string>): Promise<{ file: string; body: string }> {
  const added = await newFilesSince(before);
  if (added.length !== 1) throw new Error(`expected 1 new .eml, got ${added.length}`);
  const file = added[0];
  const body = await fs.readFile(path.join(SENT_DIR, file), "utf8");
  return { file, body };
}

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

  expect("A1 returns redirectedTo = dev inbox", send.redirectedTo === "redirect@test.invalid",
    `got ${send.redirectedTo}`);
  expect("A2 returns savedEml (fallback path)", !!send.savedEml);
  expect("A3 filename is slug of dev inbox",
    file.includes("redirect_test_invalid"), file);
  expect("A4 To: header is dev inbox",
    /^To: .*redirect@test\.invalid/m.test(body));
  expect("A5 To: header is NOT original recipient",
    !/^To: .*real@prospect\.invalid/m.test(body));
  expect("A6 banner in subject",
    /^Subject: \[DEV MODE — would have sent to real@prospect\.invalid\]/m.test(body));
  expect("A7 banner in plaintext body",
    body.includes("[DEV MODE — would have sent to real@prospect.invalid]"));
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

  expect("B1 returns no redirectedTo", send.redirectedTo === undefined,
    `got ${send.redirectedTo}`);
  expect("B2 filename is slug of original recipient",
    file.includes("real_prospect_invalid"), file);
  expect("B3 To: header is original recipient",
    /^To: .*real@prospect\.invalid/m.test(body));
  expect("B4 no dev banner in subject",
    !/\[DEV MODE/.test(body.split("\n").find((l) => l.startsWith("Subject:")) ?? ""));
  expect("B5 no dev banner in body",
    !body.includes("[DEV MODE"));
}

// ---------- Report ----------
let failed = 0;
for (const c of checks) {
  const tag = c.pass ? "PASS" : "FAIL";
  console.log(`${tag}  ${c.name}${c.detail && !c.pass ? `  — ${c.detail}` : ""}`);
  if (!c.pass) failed++;
}
console.log(`\n${checks.length - failed}/${checks.length} passed`);
process.exit(failed ? 1 : 0);
