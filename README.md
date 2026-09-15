# Telegram Candidate Questionnaire Bot

Node.js Telegram webhook bot for a candidate questionnaire with conditional logic, Vercel deployment, Upstash Redis sessions and final Google Sheets persistence through Google Apps Script.

## Architecture

```text
api/telegram.js                 Vercel webhook entrypoint
src/bot/handler.js              Telegram update orchestration
src/bot/questionnaire/
  questions.js                  single source of truth for questions, sections, options and showIf logic
  engine.js                     pure questionnaire state machine
  i18n.js                       UA/EN/RU interface messages
src/storage/redis.js            Upstash Redis session storage
src/sheets/client.js            Google Apps Script JSON client with retry
src/telegram/send.js            Telegram Bot API client
src/telegram/keyboards.js       inline keyboard builders
src/utils/validation.js         validation helpers
src/utils/privacy.js            admin-notification safety helpers
src/utils/scoring.js            optional lead score
google-apps-script/Code.gs      Apps Script endpoint for Sheets
test/*.test.js                  webhook, handler and state-machine regression tests
```

The bot stores operational session state in Upstash Redis under `casting:session:<telegram_id>`. A normal answer path is Redis GET -> validation/logic -> Redis SET with TTL -> Telegram send. Google Sheets sync runs in the background via Vercel `waitUntil`, so Apps Script is no longer in the foreground critical path for each question.

Each update writes a `PERF update=...` log with sanitized foreground timings for Redis, validation, logic and Telegram. Background Sheets sync writes a separate `background_sheets_sync` log. User answers, secrets and tokens are not logged.

## Environment Variables

Add these variables in Vercel Project Settings:

```text
TELEGRAM_BOT_TOKEN=
TELEGRAM_ADMIN_CHAT_ID=
TELEGRAM_WEBHOOK_SECRET=
KV_REST_API_URL=
KV_REST_API_TOKEN=
GOOGLE_SHEETS_ENDPOINT=
SHEETS_WEBHOOK_SECRET=
BOT_USERNAME=
HR_TELEGRAM_URL=
CASES_TELEGRAM_URL=
```

Never commit real values. `.env.example` contains only empty placeholders.

## Create Telegram Bot

1. Open Telegram and message `@BotFather`.
2. Run `/newbot`.
3. Choose bot name and username.
4. Copy the token into `TELEGRAM_BOT_TOKEN`.
5. Put the username without `@` into `BOT_USERNAME`.
6. Generate a long random value for `TELEGRAM_WEBHOOK_SECRET`. It is used by Telegram's `secret_token` webhook protection.
7. Get the admin chat id by messaging your bot once and using a Telegram getUpdates helper, or temporarily logging incoming updates during local testing.

## Create Google Sheet

1. Create a new Google Sheet.
2. Add two sheets: `Leads` and `Events`.
3. The Apps Script will create/update Russian display headers automatically on first request.
4. Open `Extensions -> Apps Script`.
5. Paste `google-apps-script/Code.gs`.
6. In Apps Script, open `Project Settings -> Script properties`.
7. Add `SHEETS_WEBHOOK_SECRET` with the same value you will set in Vercel.
8. Click `Deploy -> New deployment`.
9. Select `Web app`.
10. Execute as: `Me`.
11. Who has access: usually `Anyone`.
12. Deploy and copy the Web App URL into `GOOGLE_SHEETS_ENDPOINT`.

## Deploy To Vercel

1. Push this project to a Git repository or import it through Vercel CLI.
2. In Vercel, set all environment variables.
3. Deploy.
4. Your webhook URL will be:

```text
https://YOUR_VERCEL_DOMAIN/api/telegram
```

## Set Telegram Webhook

Open this URL in a browser after deploy:

```text
https://api.telegram.org/botTELEGRAM_BOT_TOKEN/setWebhook?url=https://YOUR_VERCEL_DOMAIN/api/telegram&secret_token=TELEGRAM_WEBHOOK_SECRET
```

Use the real values locally when opening the URL. Do not print or commit `TELEGRAM_WEBHOOK_SECRET`; the webhook rejects requests whose `X-Telegram-Bot-Api-Secret-Token` header does not match it.

Check status:

```text
https://api.telegram.org/botTELEGRAM_BOT_TOKEN/getWebhookInfo
```

## Configure Telegram Menu Button

After setting production environment variables, run:

```bash
npm run setup:telegram-menu
```

This configures Telegram `MenuButtonCommands`. The system Menu button opens Telegram commands, and `/menu` opens the bot's inline menu without modifying questionnaire sessions.

## Recruiter Deep Links

Use the `start` payload to track source/recruiter:

```text
https://t.me/BOT_USERNAME?start=instagram
https://t.me/BOT_USERNAME?start=dmytro
https://t.me/BOT_USERNAME?start=mt
```

The payload is saved to `source` and `recruiter` for new leads.

## Redis Sessions

Sessions are stored as one JSON object with a 7 day TTL. Every save refreshes TTL with a single `redis.set(key, session, { ex: SESSION_TTL_SECONDS })` call. Duplicate Telegram updates are tracked in `processedUpdateIds` inside the session and ignored before any state transition.

After each successfully saved answer, the current session snapshot is upserted into Google Sheets in the background. If Sheets sync fails, the session remains in Redis with `pendingSheetsSync: true`, and the next background sync can clear it.

## Questionnaire Changes

Edit `src/bot/questionnaire/questions.js`.

Each question has:

```js
{
  id: "onlyfans_registered",
  shortId: "q33",
  section: 6,
  type: "single",
  required: true,
  text: { ua: "...", en: "...", ru: "..." },
  options: [...]
}
```

Use `showIf: (answers) => ...` for conditional questions. The engine writes `SKIPPED_BY_LOGIC` when a question is hidden by logic.

## Add Admin

Telegram supports one `TELEGRAM_ADMIN_CHAT_ID` in this implementation. To notify several admins, create a Telegram group, add the bot, get the group chat id, and set that as `TELEGRAM_ADMIN_CHAT_ID`.

## Local Checks

Run:

```bash
npm test
npm run lint
```

The tests cover:

1. new questionnaire starts at language selection;
2. age 17 becomes `AGE_REJECTED`;
3. `OnlyFans = no` skips Q34/Q35;
4. no Skrill/Paxum/Cosmo skips access question;
5. explicit solo gate behavior;
6. partner gate skips duo/trio;
7. saved `current_question` supports resume;
8. back navigation finds previous visible question;
9. multi-select toggles;
10. completion state is emitted only at the end;
11. serverless-safe progress is represented by Sheets state;
12. question ids and short ids are unique;
13. Q55 appears once and is followed by Q56;
14. Q38 shows only payment systems selected in Q37;
15. webhook secret protection rejects unauthorized requests;
16. obvious credentials on sensitive questions are not persisted;
17. ordinary answer flow performs at most one Redis GET, one Redis SET, zero Sheets calls and one Telegram send;
18. duplicate Telegram updates do not advance state;
19. Redis SET uses TTL;
20. Google Sheets Russian display headers map to unchanged internal field keys;
21. `english_level=6` advances to `english_courses` and does not resend the same question;
22. numeric 1-10 keyboards render as two rows of five plus a final Back row;
23. background Sheets sync updates the same lead row by `telegram_id`.

## Privacy Notes

The bot text explicitly avoids requesting passwords, SMS codes, 2FA codes, seed phrases, card data and full payment credentials. Sensitive account-related questions also block obvious credential-like text before saving it to Google Sheets. Admin notifications include only a compact summary and never include the full intimate content block.
