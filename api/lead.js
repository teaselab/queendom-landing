const { randomUUID } = require("crypto");

const defaultSheetsEndpoint =
  "https://script.google.com/macros/s/AKfycbzCJZYZEedWOGCcs2B0RMwntHwPgW46stOYIwUUhuvi7cG-20j4SAZjB0Z_RQJTVTYCPw/exec";

const field = (value) => {
  const cleanValue = String(value || "").trim();
  return cleanValue || "";
};

const displayField = (value) => field(value) || "-";

const getHeader = (req, name) => {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value || "";
};

const getClientIp = (req) => {
  const forwardedFor = getHeader(req, "x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return getHeader(req, "x-real-ip") || "";
};

const looksLikeUrl = (value) => /^https?:\/\//i.test(field(value));

const normalizeLanguage = (value) => {
  const language = field(value).toLowerCase();
  if (language === "uk") return "ua";
  return language;
};

const inferLanding = (body) => {
  const rawLanding = field(body.landing);
  if (rawLanding && !looksLikeUrl(rawLanding)) return rawLanding;

  const language = normalizeLanguage(body.language);
  const pageValue = `${field(body.page_path)} ${field(body.page_url)} ${rawLanding}`.toLowerCase();
  const isApply = pageValue.includes("/apply/");
  const inferredLanguage =
    language ||
    (pageValue.includes("/ua/") ? "ua" : pageValue.includes("/ru/") ? "ru" : pageValue.includes("/en/") ? "en" : "");

  if (!inferredLanguage) return "";
  return isApply ? `apply_${inferredLanguage}` : `full_${inferredLanguage}`;
};

const inferFunnel = (body, landing) => {
  const rawFunnel = field(body.funnel);
  if (rawFunnel && !looksLikeUrl(rawFunnel)) return rawFunnel;
  return landing;
};

const buildSheetsPayload = ({ body, clientIp, requestId }) => {
  const leadId = field(body.lead_id) || randomUUID();
  const leadGenerationDate = field(body.created_at || body.date) || new Date().toLocaleString("ru-RU");
  const createdAtIso = field(body.created_at_iso) || new Date().toISOString();
  const phone = field(body.phone || body.number);
  const telegram = field(body.telegram || body.username);
  const campaignName = field(body.campaign);
  const adsetName = field(body.adset);
  const creative = field(body.creative);
  const eventId = field(body.event_id) || leadId;
  const metaEventId = field(body.meta_event_id) || eventId;
  const language = normalizeLanguage(body.language);
  const landing = inferLanding(body);
  const funnel = inferFunnel(body, landing);

  return {
    "Lead ID": leadId,
    "Lead Generation Date": leadGenerationDate,
    "Created At ISO": createdAtIso,
    PHONE: phone,
    TELEGRAM: telegram,
    "Telegram Link": field(body.telegram_link) || (telegram ? `https://t.me/${telegram.replace(/^@/, "")}` : ""),
    "Page Path": field(body.page_path),
    "Page URL": field(body.page_url),
    Landing: landing,
    Funnel: funnel,
    Language: language,
    Platform: field(body.platform || body.utm_source),
    "Source Tag": field(body.source_tag),
    utm_source: field(body.utm_source),
    utm_medium: field(body.utm_medium),
    utm_agency: field(body.utm_agency),
    utm_campaign: field(body.utm_campaign),
    utm_content: field(body.utm_content),
    utm_term: field(body.utm_term),
    "Campaign Name": campaignName,
    "Campaign ID": field(body.campaign_id),
    "Adset Name": adsetName,
    "Adset ID": field(body.adset_id),
    Creative: creative,
    "Ad ID": field(body.ad_id),
    Placement: field(body.placement),
    "Site Source Name": field(body.site_source_name),
    fbclid: field(body.fbclid),
    _fbp: field(body._fbp),
    _fbc: field(body._fbc),
    Referrer: field(body.referrer),
    "User Agent": field(body.user_agent || body.browser),
    "Client IP": clientIp,
    "Request ID": requestId,
    "Event ID": eventId,
    "Meta Event ID": metaEventId,

    lead_id: leadId,
    lead_generation_date: leadGenerationDate,
    date: leadGenerationDate,
    created_at: leadGenerationDate,
    created_at_iso: createdAtIso,
    phone,
    number: phone,
    telegram,
    username: telegram,
    telegram_link: field(body.telegram_link) || (telegram ? `https://t.me/${telegram.replace(/^@/, "")}` : ""),
    page_path: field(body.page_path),
    page_url: field(body.page_url),
    landing,
    funnel,
    language,
    platform: field(body.platform || body.utm_source),
    source_tag: field(body.source_tag),
    utm_source: field(body.utm_source),
    utm_medium: field(body.utm_medium),
    utm_agency: field(body.utm_agency),
    utm_campaign: field(body.utm_campaign),
    utm_content: field(body.utm_content),
    utm_term: field(body.utm_term),
    campaign: campaignName,
    campaign_name: campaignName,
    campaign_id: field(body.campaign_id),
    adset: adsetName,
    adset_name: adsetName,
    adset_id: field(body.adset_id),
    creative,
    ad_id: field(body.ad_id),
    placement: field(body.placement),
    site_source_name: field(body.site_source_name),
    fbclid: field(body.fbclid),
    _fbp: field(body._fbp),
    _fbc: field(body._fbc),
    referrer: field(body.referrer),
    user_agent: field(body.user_agent || body.browser),
    client_ip: clientIp,
    request_id: requestId,
    event_id: eventId,
    meta_event_id: metaEventId,
    device: field(body.device),
    browser: field(body.browser),
    countryip: field(body.countryip),
  };
};

const buildTelegramMessage = (payload) =>
  [
    "🔥 Новая заявка",
    "",
    `📱 Телефон: ${displayField(payload.PHONE)}`,
    `💬 Telegram: ${displayField(payload.TELEGRAM)}`,
    `🌍 Язык: ${displayField(payload.Language)}`,
    `📍 Landing: ${displayField(payload.Landing)}`,
    `🏷️ Agency: ${displayField(payload.utm_agency)}`,
    "",
    `📈 Кампания: ${displayField(payload["Campaign Name"])}`,
    `🎯 Adset: ${displayField(payload["Adset Name"])}`,
    `🎨 Creative: ${displayField(payload.Creative)}`,
    `📍 Placement: ${displayField(payload.Placement)}`,
    "",
    `🕒 Дата: ${displayField(payload["Lead Generation Date"])}`,
  ].join("\n");

const sendToGoogleSheets = async (payload) => {
  const endpoint = process.env.GOOGLE_SHEETS_ENDPOINT || defaultSheetsEndpoint;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Google Sheets request failed: ${details}`);
  }
};

const sendToTelegram = async ({ token, chatId, payload }) => {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: buildTelegramMessage(payload),
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
    const requestId = getHeader(req, "x-vercel-id") || getHeader(req, "x-request-id") || randomUUID();
    const payload = buildSheetsPayload({
      body,
      clientIp: getClientIp(req),
      requestId,
    });

    await sendToGoogleSheets(payload);
    await sendToTelegram({ token, chatId, payload });

    return res.status(200).json({ ok: true, lead_id: payload["Lead ID"], event_id: payload["Event ID"] });
  } catch (error) {
    console.error("Lead handler failed", error);
    return res.status(500).json({ ok: false, error: "Lead handler failed" });
  }
};
