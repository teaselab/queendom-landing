function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getEnv() {
  return {
    TELEGRAM_BOT_TOKEN: required("TELEGRAM_BOT_TOKEN"),
    TELEGRAM_ADMIN_CHAT_ID: required("TELEGRAM_ADMIN_CHAT_ID"),
    TELEGRAM_WEBHOOK_SECRET: required("TELEGRAM_WEBHOOK_SECRET"),
    KV_REST_API_URL: required("KV_REST_API_URL"),
    KV_REST_API_TOKEN: required("KV_REST_API_TOKEN"),
    GOOGLE_SHEETS_ENDPOINT: required("GOOGLE_SHEETS_ENDPOINT"),
    SHEETS_WEBHOOK_SECRET: required("SHEETS_WEBHOOK_SECRET"),
    BOT_USERNAME: required("BOT_USERNAME"),
    HR_TELEGRAM_URL: required("HR_TELEGRAM_URL"),
    CASES_TELEGRAM_URL: required("CASES_TELEGRAM_URL")
  };
}

module.exports = { getEnv };
