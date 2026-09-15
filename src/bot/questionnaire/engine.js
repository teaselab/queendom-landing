const { validateAnswer } = require("../../utils/validation");
const { SKIPPED, SKIPPED_BY_LOGIC, questions, questionById, questionByShortId, sections } = require("./questions");
const { normalizeLang } = require("./i18n");

function getLanguage(answers = {}) {
  return normalizeLang(answers.preferred_language);
}

function getFirstQuestion() {
  return questions[0];
}

function getQuestion(id) {
  return questionById.get(id) || questionByShortId.get(id) || null;
}

function getNextRelevantQuestion(afterQuestionId, answers = {}) {
  const startIndex = afterQuestionId ? questions.findIndex((q) => q.id === afterQuestionId) + 1 : 0;
  const updates = {};
  const resolvedAnswers = { ...answers };

  for (let index = Math.max(0, startIndex); index < questions.length; index += 1) {
    const question = questions[index];
    const autoValue = typeof question.autoAnswerIf === "function" ? question.autoAnswerIf(resolvedAnswers) : null;
    if (autoValue != null) {
      updates[question.id] = autoValue;
      resolvedAnswers[question.id] = autoValue;
      continue;
    }

    if (typeof question.showIf === "function" && !question.showIf(resolvedAnswers)) {
      updates[question.id] = SKIPPED_BY_LOGIC;
      resolvedAnswers[question.id] = SKIPPED_BY_LOGIC;
      continue;
    }

    return { question, updates, answers: resolvedAnswers };
  }

  return { question: null, updates, answers: resolvedAnswers };
}

function answerCurrentQuestion(state, questionId, rawValue, perf = null) {
  const question = getQuestion(questionId);
  if (!question) throw new Error(`Unknown question: ${questionId}`);

  const answers = { ...(state.answers || {}) };
  const lang = getLanguage(answers);
  const answerInput = normalizeAnswerInput(rawValue);
  const validation = timeSync(perf, "validation", () => validateAnswer(question, answerInput.value, lang));
  if (!validation.ok) {
    return { ok: false, error: validation.message, question };
  }

  answers[question.id] = normalizeValue(question, validation.value);
  if (answerInput.rawAnswer != null) {
    answers[`${question.id}_raw`] = answerInput.rawAnswer;
  }

  if (question.id === "age" && Number(answers.age) < 18) {
    return {
      ok: true,
      status: "AGE_REJECTED",
      current_question: "",
      answers,
      updates: { age: answers.age },
      completed: false,
      ageRejected: true
    };
  }

  const next = timeSync(perf, "logic", () => getNextRelevantQuestion(question.id, answers));
  Object.assign(answers, next.updates);

  return {
    ok: true,
    status: next.question ? "IN_PROGRESS" : "COMPLETED",
    current_question: next.question ? next.question.id : "",
    previous_question: question.id,
    question: next.question,
    answers,
    updates: { [question.id]: answers[question.id], ...next.updates },
    completed: !next.question
  };
}

function timeSync(perf, label, fn) {
  return perf && typeof perf.timeSync === "function" ? perf.timeSync(label, fn) : fn();
}

function skipCurrentQuestion(state, questionId, perf = null) {
  const question = getQuestion(questionId);
  if (!question) throw new Error(`Unknown question: ${questionId}`);
  if (question.required) {
    return { ok: false, error: "required", question };
  }
  const answers = { ...(state.answers || {}), [question.id]: SKIPPED };
  const next = timeSync(perf, "logic", () => getNextRelevantQuestion(question.id, answers));
  Object.assign(answers, next.updates);
  return {
    ok: true,
    status: next.question ? "IN_PROGRESS" : "COMPLETED",
    current_question: next.question ? next.question.id : "",
    previous_question: question.id,
    question: next.question,
    answers,
    updates: { [question.id]: SKIPPED, ...next.updates },
    completed: !next.question
  };
}

function getPreviousRelevantQuestion(currentQuestionId, answers = {}) {
  const currentIndex = questions.findIndex((q) => q.id === currentQuestionId);
  if (currentIndex <= 0) return null;

  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    const question = questions[index];
    const autoValue = typeof question.autoAnswerIf === "function" ? question.autoAnswerIf(answers) : null;
    if (autoValue != null) continue;
    if (typeof question.showIf === "function" && !question.showIf(answers)) continue;
    return question;
  }

  return null;
}

function toggleMultiValue(question, currentValue, optionId) {
  const optionIds = new Set((currentValue || "").split(",").filter(Boolean));

  if (optionId === "none") {
    return optionIds.has("none") ? "" : "none";
  }

  optionIds.delete("none");
  if (optionIds.has(optionId)) {
    optionIds.delete(optionId);
  } else {
    optionIds.add(optionId);
  }

  return Array.from(optionIds).join(",");
}

function parseMultiSelectText(question, text, answers = {}) {
  if (!question || question.type !== "multi") return { ok: false, reason: "not_multi" };
  const normalizedText = normalizeText(text);
  if (!normalizedText) return { ok: false, reason: "empty" };

  const options = getQuestionOptions(question, answers);
  const concreteMatches = [];
  for (const option of options.filter((candidate) => candidate.id !== "none")) {
    if (optionMatchesText(option, normalizedText)) {
      concreteMatches.push(option.id);
    }
  }

  if (concreteMatches.length > 0) {
    return { ok: true, value: unique(concreteMatches).join(",") };
  }

  const noneOption = options.find((option) => option.id === "none");
  if (noneOption && (optionMatchesText(noneOption, normalizedText) || matchesNonePhrase(normalizedText))) {
    return { ok: true, value: "none" };
  }

  return { ok: false, reason: "ambiguous" };
}

function getQuestionOptions(question, answers = {}) {
  if (!question) return [];
  if (typeof question.getOptions === "function") {
    return question.getOptions(answers, question) || [];
  }
  return question.options || [];
}

function normalizeValue(question, value) {
  if (question.type === "multi") {
    return Array.isArray(value) ? value.join(",") : String(value || "");
  }
  return value;
}

function normalizeAnswerInput(rawValue) {
  if (rawValue && typeof rawValue === "object" && !Array.isArray(rawValue) && Object.hasOwn(rawValue, "value")) {
    return rawValue;
  }
  return { value: rawValue, rawAnswer: null };
}

function getProgress(question) {
  if (!question) return { section: sections.length, totalSections: sections.length };
  return { section: question.section, totalSections: sections.length };
}

function getQuestionOption(question, optionId, answers = {}) {
  return getQuestionOptions(question, answers).find((option) => option.id === optionId) || null;
}

function optionMatchesText(option, normalizedText) {
  return optionAliases(option).some((alias) => containsAlias(normalizedText, alias));
}

function optionAliases(option) {
  const labels = Object.values(option.label || {});
  const labelParts = labels.flatMap((label) => String(label).split("/"));
  return unique([
    option.id,
    ...(option.aliases || []),
    ...labels,
    ...labelParts
  ])
    .map((alias) => normalizeText(alias))
    .filter(Boolean);
}

function containsAlias(normalizedText, alias) {
  if (!alias) return false;
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, "u").test(normalizedText);
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[✅❌💬▫️☑️✔️]/g, " ")
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesNonePhrase(normalizedText) {
  return [
    "нет",
    "не было",
    "не регистрировала",
    "никогда",
    "ничего",
    "ничего из перечисленного",
    "не использовала",
    "никакие",
    "ни одного",
    "нема",
    "ні",
    "не реєструвала",
    "не використовувала",
    "нічого",
    "жодного",
    "none",
    "no",
    "never",
    "never used any"
  ].some((phrase) => normalizedText === phrase || containsAlias(normalizedText, phrase));
}

function unique(values) {
  return Array.from(new Set(values));
}

module.exports = {
  getFirstQuestion,
  getLanguage,
  getNextRelevantQuestion,
  getPreviousRelevantQuestion,
  getProgress,
  getQuestion,
  getQuestionOption,
  getQuestionOptions,
  answerCurrentQuestion,
  skipCurrentQuestion,
  toggleMultiValue,
  parseMultiSelectText
};
