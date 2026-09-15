const { t } = require("../bot/questionnaire/i18n");
const { getPreviousRelevantQuestion, getQuestionOptions } = require("../bot/questionnaire/engine");

function startKeyboard(lang = "ua") {
  return inlineKeyboard([[button(t(lang, "startButton"), "ctl:start")]]);
}

function resumeKeyboard(lang = "ua") {
  return inlineKeyboard([
    [button(t(lang, "continueButton"), "ctl:continue")],
    [button(t(lang, "resetButton"), "ctl:restart_prompt")]
  ]);
}

function menuKeyboard(lang = "ua", state = "new", env = {}) {
  const rows = [];
  if (state === "in_progress") {
    rows.push([button(t(lang, "menuContinueButton"), "ctl:continue")]);
    rows.push([button(t(lang, "menuRestartButton"), "ctl:restart_prompt")]);
  } else if (state === "completed") {
    rows.push([button(t(lang, "menuRetakeButton"), "ctl:restart_prompt")]);
  } else {
    rows.push([button(t(lang, "menuStartButton"), "ctl:start")]);
  }

  if (env.HR_TELEGRAM_URL) rows.push([urlButton(t(lang, "menuContactButton"), env.HR_TELEGRAM_URL)]);
  if (env.CASES_TELEGRAM_URL) rows.push([urlButton(t(lang, "menuCasesButton"), env.CASES_TELEGRAM_URL)]);
  return inlineKeyboard(rows);
}

function restartConfirmKeyboard(lang = "ua") {
  return inlineKeyboard([
    [button(t(lang, "restartConfirmButton"), "ctl:restart_confirm")],
    [button(t(lang, "restartCancelButton"), "ctl:restart_cancel")]
  ]);
}

function questionKeyboard(question, lang, answers = {}, telegramUser = {}) {
  const rows = [];

  if (question.type === "single" && isNumericScaleQuestion(question, answers)) {
    const optionRows = chunk(getQuestionOptions(question, answers).map((option) => option.label[lang] || option.label.ua), 5);
    const back = getPreviousRelevantQuestion(question.id, answers);
    if (back) optionRows.push([t(lang, "back")]);
    return {
      keyboard: optionRows,
      resize_keyboard: true
    };
  }

  if (question.type === "single") {
    for (const option of getQuestionOptions(question, answers)) {
      rows.push([button(option.label[lang] || option.label.ua, `${question.shortId}:${option.id}`)]);
    }
  }

  if (question.type === "multi") {
    const selected = new Set(String(answers[question.id] || "").split(",").filter(Boolean));
    for (const option of getQuestionOptions(question, answers)) {
      const mark = selected.has(option.id) ? "✅ " : "▫️ ";
      rows.push([button(`${mark}${option.label[lang] || option.label.ua}`, `${question.shortId}:${option.id}`)]);
    }
    rows.push([button(t(lang, "done"), `${question.shortId}:done`)]);
  }

  if (question.suggestTelegramUsername && telegramUser.username) {
    rows.push([button(t(lang, "useTelegramUsername", { username: telegramUser.username }), `${question.shortId}:use_tg`)]);
  }

  const nav = [];
  if (!question.required && question.type === "text") {
    nav.push(button(t(lang, "skip"), `${question.shortId}:skip`));
  }
  if (getPreviousRelevantQuestion(question.id, answers)) {
    nav.push(button(t(lang, "back"), `${question.shortId}:back`));
  }
  if (nav.length) rows.push(nav);

  return rows.length ? inlineKeyboard(rows) : undefined;
}

function isNumericScaleQuestion(question, answers = {}) {
  const options = getQuestionOptions(question, answers);
  if (options.length < 2 || options.length > 10) return false;
  return options.every((option, index) => option.id === String(index + 1));
}

function chunk(values, size) {
  const rows = [];
  for (let index = 0; index < values.length; index += size) {
    rows.push(values.slice(index, index + size));
  }
  return rows;
}

function inlineKeyboard(inline_keyboard) {
  return { inline_keyboard };
}

function button(text, callback_data) {
  return { text, callback_data };
}

function urlButton(text, url) {
  return { text, url };
}

module.exports = { startKeyboard, resumeKeyboard, menuKeyboard, restartConfirmKeyboard, questionKeyboard, inlineKeyboard, button, urlButton, isNumericScaleQuestion };
