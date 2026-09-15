const { handleMiniAppAction } = require("../src/bot/handler");
const { createSheetsClient } = require("../src/sheets/client");
const { createRedisSessionStore } = require("../src/storage/redis");
const { createTelegramClient } = require("../src/telegram/send");
const { verifyTelegramInitData } = require("../src/telegram/webapp");
const { createPerfTimer } = require("../src/utils/perf");
const { getEnv } = require("../src/utils/env");

module.exports = async function menuAction(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "method_not_allowed" });
  }

  try {
    const env = getEnv();
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const verified = verifyTelegramInitData(body.initData, env.TELEGRAM_BOT_TOKEN);
    if (!verified.ok) {
      return json(res, 401, { ok: false, error: verified.error });
    }

    const telegramId = String(verified.user.id);
    const sessions = createRedisSessionStore(env);
    const session = await sessions.getSession(telegramId);
    const chatId = session?.chat_id || telegramId;
    const result = await handleMiniAppAction(body.action, {
      sessions,
      sheets: createSheetsClient(env),
      telegram: createTelegramClient(env.TELEGRAM_BOT_TOKEN),
      env,
      perf: createPerfTimer(`menu:${body.action || "unknown"}`),
      user: verified.user,
      chat: { id: chatId },
      session,
      updateId: null,
      waitUntil: null
    });

    return json(res, result.ok === false ? 400 : 200, result.ok === false ? result : { ok: true, ...result });
  } catch (error) {
    console.error("menu action failed", {
      name: error?.name,
      message: error?.message
    });
    return json(res, 500, { ok: false, error: "internal_error" });
  }
};

function json(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}
