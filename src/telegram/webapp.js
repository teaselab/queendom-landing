const crypto = require("node:crypto");

function verifyTelegramInitData(initData, botToken, now = Math.floor(Date.now() / 1000)) {
  if (!initData || !botToken) return { ok: false, error: "missing_init_data" };
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { ok: false, error: "missing_hash" };
  params.delete("hash");

  const authDate = Number(params.get("auth_date") || 0);
  if (!authDate || now - authDate > 86400) return { ok: false, error: "expired_init_data" };

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const calculated = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  if (!timingSafeEqual(hash, calculated)) return { ok: false, error: "invalid_hash" };

  const user = parseJson(params.get("user"));
  if (!user?.id) return { ok: false, error: "missing_user" };
  return { ok: true, user, authDate };
}

function timingSafeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left), "hex");
  const rightBuffer = Buffer.from(String(right), "hex");
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function parseJson(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

module.exports = { verifyTelegramInitData };
