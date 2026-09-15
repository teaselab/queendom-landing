const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const menuPage = require("../api/menu");
const { verifyTelegramInitData } = require("../src/telegram/webapp");

test("valid Telegram Mini App initData resolves verified user", () => {
  const initData = signedInitData({
    user: JSON.stringify({ id: 456, first_name: "Candidate" }),
    auth_date: "2000",
    query_id: "query"
  }, "bot-token");

  const result = verifyTelegramInitData(initData, "bot-token", 2100);
  assert.equal(result.ok, true);
  assert.equal(result.user.id, 456);
});

test("invalid Telegram Mini App initData is rejected", () => {
  const initData = signedInitData({
    user: JSON.stringify({ id: 456 }),
    auth_date: "2000"
  }, "bot-token").replace(/hash=[^&]+/, `hash=${"0".repeat(64)}`);

  const result = verifyTelegramInitData(initData, "bot-token", 2100);
  assert.equal(result.ok, false);
  assert.equal(result.error, "invalid_hash");
});

test("Mini App /menu page renders Queendom Agency menu shell", async () => {
  const res = mockResponse();
  await menuPage({}, res);

  assert.equal(res.statusCode, 200);
  assert.match(res.headers["content-type"], /text\/html/);
  assert.match(res.body, /Queendom Agency/);
  assert.match(res.body, /Telegram\.WebApp\.ready|tg\.ready/);
  assert.match(res.body, /\/api\/menu\/action/);
  assert.match(res.body, /Продолжить анкету/);
  assert.match(res.body, /https:\/\/t\.me\/elize_cherry/);
  assert.match(res.body, /https:\/\/t\.me\/queendom_agency/);
});

function signedInitData(fields, botToken) {
  const params = new URLSearchParams(fields);
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  params.set("hash", hash);
  return params.toString();
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
