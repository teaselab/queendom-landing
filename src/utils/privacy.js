const SECRET_PATTERNS = [
  /\b(password|pass|пароль|код|2fa|otp|sms|seed|mnemonic|cvv|cvc)\b/i,
  /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/,
  /\b\d{6,8}\b/
];

function looksLikeCredential(value) {
  if (typeof value !== "string") return false;
  return SECRET_PATTERNS.some((pattern) => pattern.test(value));
}

function shouldBlockCredentialAnswer(question, value) {
  if (!question || typeof value !== "string") return false;
  if (!isSensitiveCredentialQuestion(question)) return false;
  return looksLikeCredential(value);
}

function isSensitiveCredentialQuestion(question) {
  const id = question.id || "";
  return [
    "onlyfans",
    "payment_accounts",
    "agency_access",
    "bans"
  ].some((fragment) => id.includes(fragment));
}

function safeForAdmin(value, fallback = "не вказано") {
  if (value == null || value === "") return fallback;
  if (Array.isArray(value)) return value.join(", ");
  if (looksLikeCredential(String(value))) return "[приховано: схоже на дані доступу]";
  return String(value);
}

module.exports = { isSensitiveCredentialQuestion, looksLikeCredential, safeForAdmin, shouldBlockCredentialAnswer };
