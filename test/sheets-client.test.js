const test = require("node:test");
const assert = require("node:assert/strict");

const { createSheetsClient } = require("../src/sheets/client");

test("Sheets client POSTs to GOOGLE_SHEETS_ENDPOINT and preserves POST through Apps Script redirect", async () => {
  const calls = [];
  const logs = [];
  const client = createSheetsClient({
    GOOGLE_SHEETS_ENDPOINT: "https://script.google.com/macros/s/deploy-id/exec",
    SHEETS_WEBHOOK_SECRET: "secret"
  }, {
    logger: captureLogger(logs),
    async fetch(url, request) {
      calls.push({
        url,
        method: request.method,
        headers: request.headers,
        body: JSON.parse(request.body),
        redirect: request.redirect
      });

      if (calls.length === 1) {
        return mockResponse(302, "", { location: "https://script.googleusercontent.com/macros/echo" });
      }
      return mockResponse(200, JSON.stringify({ ok: true, row: 2 }));
    }
  });

  const result = await client.complete("456", {
    status: "COMPLETED",
    telegram_username: "candidate",
    email: "candidate@example.com"
  });

  assert.deepEqual(result, { ok: true, row: 2 });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, "https://script.google.com/macros/s/deploy-id/exec");
  assert.equal(calls[1].url, "https://script.googleusercontent.com/macros/echo");
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[1].method, "POST");
  assert.equal(calls[0].headers["Content-Type"], "application/json");
  assert.equal(calls[0].redirect, "manual");
  assert.equal(calls[1].body.secret, "secret");
  assert.equal(calls[1].body.action, "complete");
  assert.equal(calls[1].body.telegram_id, "456");
  assert.equal(calls[1].body.fields.status, "COMPLETED");
  assert.ok(logs.some((line) => line.includes("[SHEETS_SYNC_START] telegram_id=456 action=complete")));
  assert.ok(logs.some((line) => line.includes("[SHEETS_SYNC_RESPONSE] telegram_id=456 status=200")));
  assert.ok(logs.some((line) => line.includes("[SHEETS_SYNC_SUCCESS] telegram_id=456")));
});

test("Sheets client reports missing endpoint without logging secrets", async () => {
  const logs = [];
  const client = createSheetsClient({
    GOOGLE_SHEETS_ENDPOINT: "",
    SHEETS_WEBHOOK_SECRET: "secret"
  }, {
    logger: captureLogger(logs),
    async fetch() {
      throw new Error("fetch must not run without endpoint");
    }
  });

  await assert.rejects(
    () => client.upsertMany("456", { email: "candidate@example.com" }),
    /GOOGLE_SHEETS_ENDPOINT/
  );
  assert.ok(logs.some((line) => line.includes("[SHEETS_ENDPOINT_MISSING] telegram_id=456")));
  assert.ok(logs.every((line) => !line.includes("secret")));
});

test("Sheets client rejects payloads without telegram_id", async () => {
  const logs = [];
  const client = createSheetsClient({
    GOOGLE_SHEETS_ENDPOINT: "https://example.test/sheets",
    SHEETS_WEBHOOK_SECRET: "secret"
  }, {
    logger: captureLogger(logs),
    async fetch() {
      throw new Error("fetch must not run for invalid payload");
    }
  });

  await assert.rejects(
    () => client.create({ telegram_username: "candidate" }),
    /missing_telegram_id/
  );
  assert.ok(logs.some((line) => line.includes("[SHEETS_PAYLOAD_ERROR] telegram_id=unknown error=missing_telegram_id")));
});

function mockResponse(status, body, headers = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: {
      get(name) {
        return headers[String(name).toLowerCase()] || null;
      }
    },
    async text() {
      return body;
    }
  };
}

function captureLogger(lines) {
  return {
    log(message) {
      lines.push(String(message));
    },
    error(message) {
      lines.push(String(message));
    }
  };
}
