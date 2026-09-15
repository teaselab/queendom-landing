const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseInteger(value) {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) return null;
  return Number.parseInt(normalized, 10);
}

function validateAnswer(question, value, lang = "ua") {
  if (question.required && (value === "" || value == null || (Array.isArray(value) && value.length === 0))) {
    return invalid(messages.required[lang]);
  }

  if (!question.required && (value === "" || value == null)) {
    return { ok: true, value: "" };
  }

  if (question.type === "integer" || question.validate) {
    if (question.validate === "email") {
      return EMAIL_RE.test(String(value).trim())
        ? { ok: true, value: String(value).trim() }
        : invalid(messages.email[lang]);
    }

    const parsed = parseInteger(value);
    if (parsed == null) return invalid(messages.integer[lang]);

    const min = question.min ?? Number.NEGATIVE_INFINITY;
    const max = question.max ?? Number.POSITIVE_INFINITY;
    if (parsed < min || parsed > max) {
      return invalid(formatRangeMessage(lang, min, max));
    }

    return { ok: true, value: parsed };
  }

  return { ok: true, value: String(value).trim() };
}

function invalid(message) {
  return { ok: false, message };
}

function formatRangeMessage(lang, min, max) {
  if (Number.isFinite(min) && Number.isFinite(max)) {
    return messages.range[lang].replace("{min}", min).replace("{max}", max);
  }
  if (Number.isFinite(min)) {
    return messages.min[lang].replace("{min}", min);
  }
  return messages.integer[lang];
}

const messages = {
  required: {
    ua: "Це питання обов'язкове. Дай, будь ласка, відповідь 🤍",
    en: "This question is required. Please answer it 🤍",
    ru: "Этот вопрос обязательный. Ответь, пожалуйста 🤍"
  },
  email: {
    ua: "Вкажи, будь ласка, коректну email-адресу.",
    en: "Please enter a valid email address.",
    ru: "Укажи, пожалуйста, корректный email."
  },
  integer: {
    ua: "Вкажи, будь ласка, число.",
    en: "Please enter a number.",
    ru: "Укажи, пожалуйста, число."
  },
  range: {
    ua: "Вкажи число від {min} до {max}.",
    en: "Enter a number from {min} to {max}.",
    ru: "Укажи число от {min} до {max}."
  },
  min: {
    ua: "Вкажи число не менше {min}.",
    en: "Enter a number not less than {min}.",
    ru: "Укажи число не меньше {min}."
  }
};

module.exports = { validateAnswer, parseInteger };
