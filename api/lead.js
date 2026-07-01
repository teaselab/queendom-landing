const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const field = (value) => {
  const cleanValue = String(value || "").trim();
  return cleanValue || "-";
};

const buildMessage = (body) => {
  const phone = field(body.number || body.phone);
  const telegram = field(body.username || body.telegram);
  const campaign = field(body.campaign || body.utm_campaign);
  const adset = field(body.adset || body.utm_adset);
  const creative = field(body.creative || body.utm_creative || body.utm_content);
  const placement = field(body.placement || body.utm_placement);
  const landing = field(body.landing);
  const createdAt = field(body.created_at || body.date || new Date().toLocaleString("ru-RU"));

  return [
    "🔥 <b>Новая заявка</b>",
    "",
    `📱 Телефон: <code>${escapeHtml(phone)}</code>`,
    `💬 Telegram: <code>${escapeHtml(telegram)}</code>`,
    "",
    `📈 Кампания: ${escapeHtml(campaign)}`,
    `🎯 Adset: ${escapeHtml(adset)}`,
    `🎨 Креатив: ${escapeHtml(creative)}`,
    "",
    `📍 Placement: ${escapeHtml(placement)}`,
    "",
    `🌍 Landing: ${escapeHtml(landing)}`,
    "",
    `🕒 Время: ${escapeHtml(createdAt)}`,
  ].join("\n");
};

const defaultSheetsEndpoint =
  "https://script.google.com/macros/s/AKfycbzCJZYZEedWOGCcs2B0RMwntHwPgW46stOYIwUUhuvi7cG-20j4SAZjB0Z_RQJTVTYCPw/exec";

const buildSheetsPayload = (body) => {
  const createdAt = body.created_at || body.date || new Date().toLocaleString("ru-RU");
  const username = body.username || body.telegram || "";
  const number = body.number || body.phone || "";
  const campaign = body.campaign || body.utm_campaign || "";
  const adset = body.adset || body.utm_adset || "";
  const creative = body.creative || body.utm_creative || body.utm_content || "";
  const placement = body.placement || body.utm_placement || "";

  return {
    date: createdAt,
    created_at: createdAt,
    username,
    number,
    telegram: username,
    phone: number,
    device: body.device || "",
    browser: body.browser || "",
    countryip: body.countryip || "",
    campaign,
    adset,
    creative,
    placement,
    landing: body.landing || "",
    utm_campaign: campaign,
    utm_adset: adset,
    utm_creative: body.utm_creative || body.creative || "",
    utm_content: body.utm_content || body.creative || "",
    utm_placement: placement,
  };
};

const sendToGoogleSheets = async (body) => {
  const endpoint = process.env.GOOGLE_SHEETS_ENDPOINT || defaultSheetsEndpoint;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildSheetsPayload(body)),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Google Sheets request failed: ${details}`);
  }
};

const sendToTelegram = async ({ token, chatId, body }) => {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: buildMessage(body),
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Telegram sendMessage failed: ${details}`);
  }
};

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return res.status(500).json({ ok: false, error: "Telegram is not configured" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};

    await Promise.all([
      sendToGoogleSheets(body),
      sendToTelegram({ token, chatId, body }),
    ]);

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Lead handler failed", error);
    return res.status(500).json({ ok: false, error: "Lead handler failed" });
  }
};
