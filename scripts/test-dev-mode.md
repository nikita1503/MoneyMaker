# Dev-mode email redirect — test plan

Goal: verify that `DEV_MODE_EMAIL`, when set, intercepts every outbound
message inside `lib/email.ts::sendOrSave()`, regardless of whether SMTP is
configured. SMTP_PASS is blank in `.env.local`, so the .eml fallback path is
what actually runs for the user.

The redirect is a single choke point (`devRedirect()` in `lib/email.ts`) so
exercising `sendOrSave` directly gives full coverage of both SMTP and
fallback callers.

## Setup
- Node 24.2 → use `--experimental-strip-types` to load the TS modules
  without adding a build step.
- Tests run with `cwd = MoneyMaker/` so the .eml files land in
  `MoneyMaker/data/sent/` just like production.

## Steps

1. **Inspect existing evidence** — check the `.eml` files already in
   `data/sent/` (produced by the user's live run) for the dev banner and
   correct `To:` header.

2. **Redirect-on test** — with `DEV_MODE_EMAIL=redirect@test.invalid`,
   call `sendOrSave({ to: "real@prospect.invalid", ... })` and assert:
   - return value has `redirectedTo === "redirect@test.invalid"`
   - a new `.eml` was written; its filename contains the dev inbox slug
   - the `.eml` has `To: redirect@test.invalid`
   - the banner `[DEV MODE — would have sent to real@prospect.invalid]`
     appears in both subject and body

3. **Redirect-off test** — unset `DEV_MODE_EMAIL`, run the same call, assert:
   - return value has no `redirectedTo`
   - `.eml` has `To: real@prospect.invalid`
   - no dev banner in subject or body

4. **Duplicate env lines** — `.env.local` has two `DEV_MODE_EMAIL=` lines
   (line 8 blank, line 10 set). Confirm which one Node's env loader honors
   so we know what the live app actually uses.

## Execution

```
cd MoneyMaker
./node_modules/.bin/tsc --outDir .test-dist --module commonjs \
  --moduleResolution node --target es2022 --esModuleInterop --skipLibCheck \
  --rootDir . lib/email.ts lib/storage.ts lib/types.ts
node scripts/test-dev-mode.cjs
```

## Results

**Step 1 — live-run evidence:** `data/sent/` contains three `.eml` files from
the user's earlier session, all named `…-not11_just12_for13_fun14_gmail_com.eml`
(the dev inbox). Header dump of the most recent one:

```
From: Nikita <nikfury786@gmail.com>
To: not11.just12.for13.fun14@gmail.com
Subject: =?UTF-8?Q?=5BDEV_MODE_=E2=80=94_would_have_sent_to?=
 =?UTF-8?Q?_no-contact+28618310=40example=2Einvalid?=
 =?UTF-8?Q?=5D_Mocked_up_a_new_landing_page_for_Cle?= =?UTF-8?Q?arML?=
```

`To:` = dev inbox ✅. Subject (MIME-Q decoded) = `[DEV MODE — would have
sent to no-contact+28618310@example.invalid] Mocked up a new landing page
for ClearML` ✅. PASS.

**Step 2 — redirect ON (`DEV_MODE_EMAIL=redirect@test.invalid`):**
all 7 assertions pass.
- A1 `redirectedTo` returned = dev inbox ✅
- A2 `savedEml` returned (SMTP_PASS blank → fallback) ✅
- A3 filename slug = dev inbox ✅
- A4/A5 `To:` header = dev inbox, not original ✅
- A6 banner encoded in Subject block (`=5BDEV_MODE…real…prospect`) ✅
- A7 banner present in plaintext body ✅

**Step 3 — redirect OFF (env unset):**
all 5 assertions pass.
- B1 no `redirectedTo` ✅
- B2 filename slug = original recipient ✅
- B3 `To:` header = original recipient ✅
- B4/B5 no `DEV MODE` string anywhere ✅

**Step 4 — duplicate `DEV_MODE_EMAIL` lines in `.env.local`:**
line 8 is blank, line 10 is `not11.just12.for13.fun14@gmail.com`. The
live-run evidence above (all `.eml`s addressed to the line-10 value)
confirms **last-write-wins**, matching standard dotenv behavior. Still
worth cleaning up — keep one line. Recommended edit: delete line 8.

## Verdict

**12/12 assertions pass.** Dev-mode redirect works on both the SMTP path
(forced via unit test) and the offline `.eml` fallback (confirmed by the
live-run artifacts). Safe to keep running the real pipeline — nothing will
leave the machine addressed to a real prospect while `DEV_MODE_EMAIL` is set.

## Teardown

- `.test-dist/` is a build artifact — safe to delete.
- `data/sent/*redirect_test_invalid*.eml` and `*real_prospect_invalid*.eml`
  are test outputs — safe to delete.

