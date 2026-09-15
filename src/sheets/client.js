const MAX_REDIRECTS = 3;
const MAX_ATTEMPTS = 3;

function createSheetsClient(env, options = {}) {
  const fetchFn = options.fetch || globalThis.fetch;
  const logger = options.logger || console;

  async function post(payload, attempt = 1) {
    const endpoint = env.GOOGLE_SHEETS_ENDPOINT;
    const payloadError = validatePayload(payload);
    const telegramId = String(payload?.telegram_id || "");

    if (!endpoint) {
      logger.error(`[SHEETS_ENDPOINT_MISSING] telegram_id=${telegramId || "unknown"}`);
      throw new Error("Missing required environment variable: GOOGLE_SHEETS_ENDPOINT");
    }
    if (!fetchFn) {
      logger.error(`[SHEETS_ENDPOINT_MISSING] telegram_id=${telegramId || "unknown"} fetch=missing`);
      throw new Error("Global fetch is not available");
    }
    if (payloadError) {
      logger.error(`[SHEETS_PAYLOAD_ERROR] telegram_id=${telegramId || "unknown"} error=${payloadError}`);
      throw new Error(`Invalid Sheets payload: ${payloadError}`);
    }

    const body = JSON.stringify({ secret: env.SHEETS_WEBHOOK_SECRET, ...payload });
    logger.log(`[SHEETS_SYNC_START] telegram_id=${telegramId} action=${payload.action} attempt=${attempt}`);

    const response = await postWithRedirect(fetchFn, endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      redirect: "manual"
    });

    const responseBody = await response.text().catch(() => "");
    logger.log(`[SHEETS_SYNC_RESPONSE] telegram_id=${telegramId} status=${response.status} body=${safeResponseBody(responseBody)}`);

    const json = parseJson(responseBody);
    if (!response.ok || !json || json.ok === false) {
      if (attempt < MAX_ATTEMPTS) {
        await delay(250 * attempt);
        return post(payload, attempt + 1);
      }
      throw new Error(`Sheets request failed: ${response.status} ${JSON.stringify(json)}`);
    }
    logger.log(`[SHEETS_SYNC_SUCCESS] telegram_id=${telegramId}`);
    return json;
  }

  return {
    async create(lead) {
      return post({ action: "create", ...lead });
    },
    async reset(telegramId, lead = {}) {
      return post({ action: "reset", telegram_id: String(telegramId), ...lead });
    },
    async get(telegramId) {
      const result = await post({ action: "get", telegram_id: String(telegramId) });
      return result.lead || null;
    },
    async upsert(telegramId, field, value, options = {}) {
      return post({ action: "upsert", telegram_id: String(telegramId), field, value, ...expectedPayload(options) });
    },
    async upsertMany(telegramId, fields, options = {}) {
      return post({ action: "upsert", telegram_id: String(telegramId), fields, ...expectedPayload(options) });
    },
    async complete(telegramId, fields = {}, options = {}) {
      return post({ action: "complete", telegram_id: String(telegramId), fields, ...expectedPayload(options) });
    }
  };
}

async function postWithRedirect(fetchFn, url, request, redirectCount = 0) {
  const response = await fetchFn(url, request);
  if (!isRedirect(response.status)) return response;

  const location = response.headers?.get?.("location");
  if (!location || redirectCount >= MAX_REDIRECTS) return response;

  const nextUrl = new URL(location, url).toString();
  return postWithRedirect(fetchFn, nextUrl, request, redirectCount + 1);
}

function isRedirect(status) {
  return [301, 302, 303, 307, 308].includes(status);
}

function validatePayload(payload = {}) {
  if (!payload || typeof payload !== "object") return "payload_not_object";
  if (!payload.action) return "missing_action";
  if (!payload.telegram_id) return "missing_telegram_id";
  if (["upsert", "complete", "reset"].includes(payload.action) && payload.fields && typeof payload.fields !== "object") {
    return "fields_not_object";
  }
  return null;
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function safeResponseBody(text) {
  return String(text || "").replace(/\s+/g, " ").slice(0, 500);
}

function expectedPayload(options = {}) {
  return options.expectedCurrentQuestion
    ? { expected_current_question: options.expectedCurrentQuestion }
    : {};
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { createSheetsClient };
