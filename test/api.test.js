const test = require("node:test");
const assert = require("node:assert/strict");

const telegramWebhook = require("../api/telegram");

test("Telegram webhook rejects requests with a wrong secret token", async () => {
  setRequiredEnv();
  const req = {
    method: "POST",
    headers: {
      "x-telegram-bot-api-secret-token": "wrong"
    },
    body: {}
  };
  const res = mockResponse();

  await telegramWebhook(req, res);

  assert.equal(res.statusCode, 401);
  assert.match(res.body, /Unauthorized/);
});

function setRequiredEnv() {
  process.env.TELEGRAM_BOT_TOKEN = "bot-token";
  process.env.TELEGRAM_ADMIN_CHAT_ID = "1";
  process.env.TELEGRAM_WEBHOOK_SECRET = "expected-secret";
  process.env.KV_REST_API_URL = "https://example.invalid/redis";
  process.env.KV_REST_API_TOKEN = "redis-token";
  process.env.GOOGLE_SHEETS_ENDPOINT = "https://example.invalid/sheets";
  process.env.SHEETS_WEBHOOK_SECRET = "sheets-secret";
  process.env.BOT_USERNAME = "candidate_bot";
  process.env.HR_TELEGRAM_URL = "https://t.me/elize_cherry";
  process.env.CASES_TELEGRAM_URL = "https://t.me/queendom_agency";
}

function mockResponse() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(body) {
      this.body = body;
    }
  };
}
