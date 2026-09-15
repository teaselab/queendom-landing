const { handleTelegramUpdate } = require("../src/bot/handler");
const { createSheetsClient } = require("../src/sheets/client");
const { createRedisSessionStore } = require("../src/storage/redis");
const { createTelegramClient } = require("../src/telegram/send");
const { getEnv } = require("../src/utils/env");

module.exports = async function telegramWebhook(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: "Method not allowed" }));
    return;
  }

  try {
    const env = getEnv();
    const secretToken = req.headers["x-telegram-bot-api-secret-token"];
    if (secretToken !== env.TELEGRAM_WEBHOOK_SECRET) {
      res.statusCode = 401;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ ok: false, error: "Unauthorized" }));
      return;
    }

    const result = await handleTelegramUpdate(req.body, {
      sheets: createSheetsClient(env),
      sessions: createRedisSessionStore(env),
      telegram: createTelegramClient(env.TELEGRAM_BOT_TOKEN),
      env
    });

    res.statusCode = 200;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: true, result }));
  } catch (error) {
    console.error("telegram webhook error", error);
    res.statusCode = 200;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: true }));
  }
};
