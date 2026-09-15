const crypto = require("node:crypto");
const { answerCurrentQuestion, getFirstQuestion, getLanguage, getPreviousRelevantQuestion, getProgress, getQuestion, getQuestionOption, parseMultiSelectText, skipCurrentQuestion, toggleMultiValue } = require("./questionnaire/engine");
const { SKIPPED, SKIPPED_BY_LOGIC, questionByShortId, questions, sections } = require("./questionnaire/questions");
const { t } = require("./questionnaire/i18n");
const { menuKeyboard, questionKeyboard, restartConfirmKeyboard, resumeKeyboard, startKeyboard } = require("../telegram/keyboards");
const { calculateLeadScore } = require("../utils/scoring");
const { createPerfTimer, logBackgroundSheetsSync, performance } = require("../utils/perf");
const { escapeHtml } = require("../utils/html");
const { waitUntilTask } = require("../utils/background");
const { safeForAdmin, shouldBlockCredentialAnswer } = require("../utils/privacy");

const HTML_MESSAGE = { parse_mode: "HTML" };
const PROCESSED_UPDATE_LIMIT = 20;
const userLocks = new Map();

async function handleTelegramUpdate(update, { sessions, sheets, telegram, env, perf: providedPerf, waitUntil }) {
  const perf = providedPerf || createPerfTimer(update?.update_id);
  let callbackAck = null;

  try {
    const parsed = perf.timeSync("parse_update", () => parseUpdate(update));
    if (!parsed.user || !parsed.chat) return { ignored: true };

    if (parsed.callback) {
      callbackAck = perf.time("telegram_answer_callback", () => telegram.answerCallbackQuery(parsed.callback.id).catch((error) => {
        console.error("answerCallbackQuery failed", safeError(error));
      }));
    }

    const telegramId = String(parsed.user.id);
    const result = await withUserLock(telegramId, async () => {
      const session = await getSessionOnce(sessions, telegramId, perf);
      if (isDuplicateUpdate(session, update?.update_id)) {
        if (callbackAck) await callbackAck;
        return { duplicate: true };
      }

      const ctx = {
        sessions,
        sheets,
        telegram,
        env,
        perf,
        user: parsed.user,
        chat: parsed.chat,
        session,
        updateId: update?.update_id,
        waitUntil
      };

      if (parsed.callback) {
        return handleCallback(parsed.callback, ctx);
      }
      if (isTelegramCommand(parsed, "start", env.BOT_USERNAME)) {
        return handleStart({ ...ctx, source: parseStartSource(parsed.text) });
      }
      if (isTelegramCommand(parsed, "menu", env.BOT_USERNAME)) {
        return handleMenu(ctx);
      }
      if (parsed.attachment) {
        return handleAttachment(ctx);
      }
      if (!session || !["STARTED", "IN_PROGRESS"].includes(session.status)) {
        await sendMenu(ctx);
        return { menu: menuState(session) };
      }
      return handleTextAnswer(parsed.text, ctx);
    });

    if (callbackAck) await callbackAck;
    return result;
  } catch (error) {
    console.error("telegram update handling failed", safeError(error));
    const parsed = parseUpdate(update);
    if (parsed.chat) {
      const lang = getLanguageFromSessionSafe(parsed, arguments[1]);
      await telegram.sendMessage(parsed.chat.id, t(lang, "temporaryStorageError")).catch(() => null);
    }
    if (callbackAck) await callbackAck;
    return { error: true };
  } finally {
    perf.log();
  }
}

async function withUserLock(telegramId, fn) {
  const previous = userLocks.get(telegramId) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => current, () => current);
  userLocks.set(telegramId, tail);
  await previous.catch(() => null);
  try {
    return await fn();
  } finally {
    release();
    if (userLocks.get(telegramId) === tail) {
      userLocks.delete(telegramId);
    }
  }
}

function parseUpdate(update = {}) {
  const callback = update.callback_query;
  const message = update.message || callback?.message;
  const user = callback?.from || message?.from;
  const chat = message?.chat;
  const text = update.message?.text || "";
  const attachment = Boolean(!callback && message && hasAttachment(message));
  const command = !callback ? parseTelegramCommand(message) : null;
  return { callback, message, user, chat, text, attachment, command };
}

async function getSessionOnce(sessions, telegramId, perf) {
  if (!sessions) throw new Error("Session storage is not configured");
  return perf.time("redis_get", () => sessions.getSession(telegramId));
}

async function handleStart(ctx) {
  const lang = getLanguage(ctx.session?.answers || {});

  if (ctx.session && ["IN_PROGRESS", "STARTED"].includes(ctx.session.status) && ctx.session.current_question) {
    await sendMenu(ctx);
    return { menu: "in_progress" };
  }

  if (ctx.session?.status === "COMPLETED") {
    await sendMenu(ctx);
    return { menu: "completed" };
  }

  if (ctx.session?.status === "AGE_REJECTED") {
    await sendTelegramMessage(ctx, ctx.chat.id, t(lang, "ageRejected"));
    return { ageRejected: true };
  }

  if (ctx.source && !ctx.session) {
    const session = withProcessedUpdate(baseLead(ctx.user, ctx.source, ctx.chat.id), ctx.updateId);
    await saveSession(ctx, session);
    await sendMenu({ ...ctx, session });
  } else {
    await sendMenu(ctx);
  }
  return { menu: "new" };
}

async function handleMenu(ctx) {
  await sendMenu(ctx);
  return { menu: menuState(ctx.session) };
}

async function handleAttachment(ctx) {
  const lang = getLanguage(ctx.session?.answers || {});
  if (ctx.session && ["STARTED", "IN_PROGRESS"].includes(ctx.session.status) && ctx.session.current_question) {
    await sendTelegramMessage(ctx, ctx.chat.id, t(lang, "attachmentRejected"));
    await sendQuestion(getQuestion(ctx.session.current_question), ctx);
    return { attachmentRejected: true, current_question: ctx.session.current_question };
  }
  await sendMenu(ctx);
  return { attachmentIgnored: true };
}

async function handleMiniAppAction(action, ctx) {
  if (action === "state") {
    return { state: menuState(ctx.session) };
  }
  if (action === "continue") {
    const question = getQuestion(ctx.session?.current_question) || getFirstQuestion();
    await sendQuestion(question, ctx);
    return { ok: true, action, question: question.id };
  }
  if (action === "start") {
    const result = await startFreshQuestionnaire(ctx);
    return { ok: true, action, ...result };
  }
  if (action === "restart") {
    const result = await restartQuestionnaire(ctx);
    return { ok: true, action, ...result };
  }
  return { ok: false, error: "unknown_action" };
}

async function handleCallback(callback, ctx) {
  const [prefix, action] = callback.data.split(":");
  const answers = ctx.session?.answers || {};
  const lang = getLanguage(answers);

  if (prefix === "clar") {
    return handleClarificationCallback(action, ctx);
  }

  if (prefix === "ctl") {
    if (action === "start") {
      return startFreshQuestionnaire(ctx);
    }

    if (action === "restart_prompt" || action === "reset") {
      await sendTelegramMessage(ctx, ctx.chat.id, t(lang, "restartConfirm"), restartConfirmKeyboard(lang));
      return { restartConfirmation: true };
    }

    if (action === "restart_cancel") {
      if (ctx.session?.status === "IN_PROGRESS" && ctx.session.current_question) {
        await sendQuestion(getQuestion(ctx.session.current_question), ctx);
        return { restartCancelled: true, question: ctx.session.current_question };
      }
      await sendMenu(ctx);
      return { restartCancelled: true };
    }

    if (action === "restart_confirm") {
      return restartQuestionnaire(ctx);
    }

    if (action === "continue") {
      const question = getQuestion(ctx.session?.current_question) || getFirstQuestion();
      await sendQuestion(question, ctx);
      return { question: question.id };
    }
  }

  const question = questionByShortId.get(prefix);
  if (!question || !ctx.session) return { ignored: true };

  if (ctx.session.current_question !== question.id) {
    return { ignored: "stale_callback", expected: ctx.session.current_question, received: question.id };
  }

  if (action === "back") {
    const previous = getPreviousRelevantQuestion(question.id, answers);
    if (!previous) return { ignored: "no_previous" };
    const session = withProcessedUpdate({
      ...ctx.session,
      current_question: previous.id,
      status: "IN_PROGRESS",
      revision: nextRevision(ctx.session)
    }, ctx.updateId);
    await saveSession(ctx, session);
    await sendQuestion(previous, { ...ctx, session });
    return { back: previous.id };
  }

  if (action === "skip") {
    return finishAnswer(await buildAnswerResult(ctx, () => skipCurrentQuestion(ctx.session, question.id, ctx.perf)), ctx);
  }

  if (question.suggestTelegramUsername && action === "use_tg") {
    return finishAnswer(await buildAnswerResult(ctx, () => answerCurrentQuestion(ctx.session, question.id, { value: `@${ctx.user.username}`, rawAnswer: `@${ctx.user.username}` }, ctx.perf)), ctx);
  }

  if (question.type === "multi") {
    if (action !== "done") {
      if (!getQuestionOption(question, action, answers)) return { ignored: "unknown_option" };
      const value = toggleMultiValue(question, answers[question.id], action);
      const session = withProcessedUpdate({
        ...ctx.session,
        answers: { ...answers, [question.id]: value },
        revision: nextRevision(ctx.session)
      }, ctx.updateId);
      await saveSession(ctx, session);
      const replyMarkup = questionKeyboard(question, lang, session.answers, ctx.user);
      if (callback.message?.message_id) {
        await ctx.perf.time("telegram_send", () => ctx.telegram.editMessageReplyMarkup(ctx.chat.id, callback.message.message_id, replyMarkup).catch(() => null));
      }
      return { toggled: question.id, value };
    }

    if (question.required && !answers[question.id]) {
      await sendTelegramMessage(ctx, ctx.chat.id, t(lang, "chooseAtLeastOne"));
      return { validation: "empty_multi" };
    }
    return finishAnswer(await buildAnswerResult(ctx, () => answerCurrentQuestion(ctx.session, question.id, { value: answers[question.id], rawAnswer: multiRawAnswer(question, answers[question.id], lang) }, ctx.perf)), ctx);
  }

  const option = getQuestionOption(question, action, answers);
  if (!option) return { ignored: "unknown_option" };
  return finishAnswer(await buildAnswerResult(ctx, () => answerCurrentQuestion(ctx.session, question.id, { value: option.id, rawAnswer: option.label[lang] || option.label.ua }, ctx.perf)), ctx);
}

async function startFreshQuestionnaire(ctx) {
  const first = getFirstQuestion();
  const session = withProcessedUpdate({
    ...baseLead(ctx.user, ctx.session?.source, ctx.chat.id),
    status: "IN_PROGRESS",
    current_question: first.id,
    progress_percent: 0,
    answers: {},
    answers_count: 0,
    skipped_count: 0,
    completed_at: "",
    revision: nextRevision(ctx.session)
  }, ctx.updateId);
  await saveSession(ctx, session);
  await sendQuestion(first, { ...ctx, session });
  scheduleSheetsSync(ctx, session);
  return { question: first.id };
}

async function restartQuestionnaire(ctx) {
  const first = getFirstQuestion();
  const session = withProcessedUpdate({
    ...baseLead(ctx.user, ctx.session?.source, ctx.chat.id),
    telegram_id: String(ctx.user.id),
    status: "IN_PROGRESS",
    current_question: first.id,
    progress_percent: 0,
    answers: {},
    answers_count: 0,
    skipped_count: 0,
    completed_at: "",
    pendingClarification: null,
    pendingSheetsSync: true,
    revision: nextRevision(ctx.session)
  }, ctx.updateId);
  await saveSession(ctx, session);
  await ctx.perf.time("sheets", () => ctx.sheets.reset(session.telegram_id, resetSheetsPayload(session)));
  await sendQuestion(first, { ...ctx, session });
  return { restarted: true, question: first.id };
}

async function handleTextAnswer(text, ctx) {
  const question = getQuestion(ctx.session.current_question);
  if (!question) {
    const lang = getLanguage(ctx.session.answers);
    await sendTelegramMessage(ctx, ctx.chat.id, t(lang, "intro"), startKeyboard(lang), HTML_MESSAGE);
    return { missingQuestion: true };
  }

  if (text === t(getLanguage(ctx.session.answers), "back")) {
    const previous = getPreviousRelevantQuestion(question.id, ctx.session.answers || {});
    if (!previous) return { ignored: "no_previous" };
    const session = withProcessedUpdate({
      ...ctx.session,
      current_question: previous.id,
      status: "IN_PROGRESS",
      revision: nextRevision(ctx.session)
    }, ctx.updateId);
    await saveSession(ctx, session);
    await sendQuestion(previous, { ...ctx, session });
    scheduleSheetsSync(ctx, session);
    return { back: previous.id };
  }

  if (question.type === "single") {
    const hybrid = resolveSingleTextAnswer(question, text, ctx.session.answers || {});
    if (hybrid.needsClarification) {
      const session = {
        ...ctx.session,
        pendingClarification: {
          questionId: question.id,
          rawAnswer: text
        },
        processedUpdateIds: withProcessedUpdate(ctx.session, ctx.updateId).processedUpdateIds
      };
      await saveSession(ctx, session);
      await sendClarification(question, ctx);
      return { clarification: question.id };
    }
    if (!hybrid.optionId) {
      await sendQuestion(question, ctx);
      return { resent: question.id };
    }
    return finishAnswer(await buildAnswerResult(ctx, () => answerCurrentQuestion(ctx.session, question.id, { value: hybrid.optionId, rawAnswer: text }, ctx.perf)), ctx);
  }

  if (question.type === "multi") {
    const parsed = parseMultiSelectText(question, text, ctx.session.answers || {});
    if (!parsed.ok) {
      await sendTelegramMessage(ctx, ctx.chat.id, t(getLanguage(ctx.session.answers), "multiSelectClarify"), questionKeyboard(question, getLanguage(ctx.session.answers), ctx.session.answers, ctx.user));
      return { clarification: question.id };
    }
    return finishAnswer(await buildAnswerResult(ctx, () => answerCurrentQuestion(ctx.session, question.id, { value: parsed.value, rawAnswer: text }, ctx.perf)), ctx);
  }

  if (!["text", "integer"].includes(question.type)) {
    await sendQuestion(question, ctx);
    return { resent: question.id };
  }

  if (shouldBlockCredentialAnswer(question, text)) {
    await sendTelegramMessage(ctx, ctx.chat.id, t(getLanguage(ctx.session.answers), "privacyWarning"));
    return { privacyBlocked: question.id };
  }

  return finishAnswer(await buildAnswerResult(ctx, () => answerCurrentQuestion(ctx.session, question.id, text, ctx.perf)), ctx);
}

async function buildAnswerResult(ctx, fn) {
  return fn();
}

async function finishAnswer(result, ctx) {
  const lang = getLanguage(result.answers || ctx.session.answers || {});
  if (!result.ok) {
    logQuestionTransition(ctx, {
      questionBefore: result.question?.id || ctx.session?.current_question || "",
      questionAfter: ctx.session?.current_question || "",
      revisionBefore: currentRevision(ctx.session),
      revisionAfter: currentRevision(ctx.session),
      result: "VALIDATION_ERROR"
    });
    await sendTelegramMessage(ctx, ctx.chat.id, result.error);
    return { validation: result.error };
  }

  const progress = getProgress(result.question);
  const fields = buildPersistenceFields(result, progress);
  const revisionBefore = currentRevision(ctx.session);
  const session = withProcessedUpdate({
    ...ctx.session,
    ...fields,
    answers: result.answers,
    revision: revisionBefore + 1
  }, ctx.updateId);

  if (!validateForwardTransition(ctx, result, session)) {
    await sendTelegramMessage(ctx, ctx.chat.id, t(lang, "techError"));
    return { invariantViolation: true };
  }

  if (result.ageRejected) {
    const completedSession = {
      ...session,
      completed_at: new Date().toISOString(),
      pendingSheetsSync: true
    };
    await saveSession(ctx, completedSession);
    await sendTelegramMessage(ctx, ctx.chat.id, t(lang, "ageRejected"));
    scheduleFinalSheetsSync(ctx, completedSession, result.answers);
    await notifyAgeRejected(ctx, result.answers);
    return { status: "AGE_REJECTED" };
  }

  if (result.completed) {
    const completedSession = {
      ...session,
      completed_at: new Date().toISOString(),
      pendingSheetsSync: true
    };
    await saveSession(ctx, completedSession);
    await sendTelegramMessage(ctx, ctx.chat.id, t(lang, "final"));
    scheduleFinalSheetsSync(ctx, completedSession, result.answers);
    await notifyCompleted(ctx, { ...completedSession, answers: result.answers });
    return { status: "COMPLETED" };
  }

  await saveSession(ctx, session);
  logQuestionTransition(ctx, {
    questionBefore: result.previous_question,
    questionAfter: result.current_question,
    revisionBefore,
    revisionAfter: session.revision,
    result: "ACCEPTED"
  });
  await sendQuestion(result.question, { ...ctx, session }, result.previous_question);
  scheduleSheetsSync(ctx, session);
  return { next: result.current_question };
}

function buildPersistenceFields(result, progress) {
  return {
    ...result.updates,
    status: result.status,
    current_question: result.current_question,
    current_section: result.question ? result.question.section : progress.section,
    progress_percent: Math.round((progress.section / progress.totalSections) * 100),
    last_activity_at: new Date().toISOString(),
    answers_count: countAnsweredQuestions(result.answers),
    skipped_count: Object.values(result.answers).filter((value) => value === "SKIPPED_BY_LOGIC").length
  };
}

async function saveSession(ctx, session) {
  ctx.session = await ctx.perf.time("redis_save", () => ctx.sessions.saveSession(session));
  return ctx.session;
}

async function syncFinalToSheets(ctx, session, answers) {
  await ctx.perf.time("sheets", () => ctx.sheets.complete(session.telegram_id, buildSheetsSnapshot({
    ...session,
    answers: answers || session.answers || {}
  })));
}

function scheduleSheetsSync(ctx, session) {
  const snapshot = {
    ...session,
    answers: { ...(session.answers || {}) }
  };
  waitUntilTask(() => syncSessionToSheetsBackground(ctx, snapshot), ctx.waitUntil);
}

function scheduleFinalSheetsSync(ctx, session, answers) {
  const snapshot = {
    ...session,
    answers: { ...(answers || session.answers || {}) }
  };
  waitUntilTask(() => syncFinalToSheetsBackground(ctx, snapshot), ctx.waitUntil);
}

async function syncSessionToSheetsBackground(ctx, session) {
  const startedAt = performance.now();
  try {
    await ctx.sheets.upsertMany(session.telegram_id, buildSheetsSnapshot(session));
    logBackgroundSheetsSync(ctx.updateId, performance.now() - startedAt, true);
  } catch (error) {
    console.error("background Google Sheets sync failed", safeError(error));
    logBackgroundSheetsSync(ctx.updateId, performance.now() - startedAt, false);
  }
}

async function syncFinalToSheetsBackground(ctx, session) {
  const startedAt = performance.now();
  try {
    await syncFinalToSheets(ctx, session, session.answers);
    logBackgroundSheetsSync(ctx.updateId, performance.now() - startedAt, true);
  } catch (error) {
    console.error("final Google Sheets sync failed", safeError(error));
    logBackgroundSheetsSync(ctx.updateId, performance.now() - startedAt, false);
  }
}

function validateForwardTransition(ctx, result, session) {
  if (result.completed || result.ageRejected) return true;
  const before = getQuestion(result.previous_question);
  const after = result.question;
  if (!before || !after) return true;
  const sameQuestion = before.id === after.id;
  const sectionRollback = after.section < before.section;
  if (!sameQuestion && !sectionRollback) return true;

  console.error(`STATE_INVARIANT_VIOLATION user_hash=${hashUserId(ctx.user?.id)} update_id=${ctx.updateId ?? ""} revision_before=${currentRevision(ctx.session)} revision_after=${session.revision} question_before=${before.id} question_after=${after.id} section_before=${before.section} section_after=${after.section}`);
  return false;
}

function logQuestionTransition(ctx, details) {
  const before = getQuestion(details.questionBefore);
  const after = getQuestion(details.questionAfter);
  console.log([
    "QUESTION_TRANSITION",
    `user_hash=${hashUserId(ctx.user?.id)}`,
    `update_id=${ctx.updateId ?? ""}`,
    `revision_before=${details.revisionBefore}`,
    `revision_after=${details.revisionAfter}`,
    `question_before=${details.questionBefore || ""}`,
    `question_after=${details.questionAfter || ""}`,
    `section_before=${before?.section || ""}`,
    `section_after=${after?.section || ""}`,
    `result=${details.result}`
  ].join(" "));
}

function currentRevision(session) {
  const revision = Number(session?.revision || 0);
  return Number.isFinite(revision) && revision >= 0 ? Math.trunc(revision) : 0;
}

function nextRevision(session) {
  return currentRevision(session) + 1;
}

function hashUserId(userId) {
  return crypto.createHash("sha256").update(String(userId || "")).digest("hex").slice(0, 12);
}

function buildSheetsSnapshot(session) {
  return {
    created_at: session.created_at,
    started_at: session.started_at || session.startedAt,
    completed_at: session.completed_at,
    telegram_username: session.telegram_username,
    telegram_first_name: session.telegram_first_name,
    telegram_last_name: session.telegram_last_name,
    source: session.source,
    recruiter: session.recruiter,
    ...displayAnswersForSheets(session.answers || {}),
    status: session.status,
    updated_at: new Date().toISOString(),
    last_activity_at: session.last_activity_at,
    current_question: session.current_question,
    progress_percent: session.progress_percent,
    answers_count: session.answers_count,
    skipped_count: session.skipped_count
  };
}

function resetSheetsPayload(session) {
  return {
    telegram_username: session.telegram_username,
    telegram_first_name: session.telegram_first_name,
    telegram_last_name: session.telegram_last_name,
    source: session.source,
    recruiter: session.recruiter,
    status: "IN_PROGRESS",
    current_question: session.current_question,
    progress_percent: 0,
    answers_count: 0,
    skipped_count: 0,
    completed_at: "",
    last_activity_at: session.last_activity_at,
    fields: buildSheetsSnapshot(session)
  };
}

async function sendMenu(ctx) {
  const lang = getMenuLanguage(ctx.session);
  await sendTelegramMessage(ctx, ctx.chat.id, t(lang, "menuTitle"), menuKeyboard(lang, menuState(ctx.session), ctx.env), HTML_MESSAGE);
}

function menuState(session) {
  if (session?.status === "COMPLETED") return "completed";
  if (session && ["STARTED", "IN_PROGRESS"].includes(session.status) && session.current_question) return "in_progress";
  return "new";
}

function getMenuLanguage(session) {
  return session?.answers?.preferred_language ? getLanguage(session.answers) : "ru";
}

async function sendQuestion(question, ctx, previousQuestionId = null) {
  const answers = ctx.session?.answers || {};
  const lang = getLanguage(answers);
  const previous = previousQuestionId ? getQuestion(previousQuestionId) : null;

  if (question.introKey) {
    await sendTelegramMessage(ctx, ctx.chat.id, t(lang, question.introKey));
  } else if (previous && previous.section !== question.section) {
    const sectionName = sections[question.section - 1][lang] || sections[question.section - 1].ua;
    await sendTelegramMessage(ctx, ctx.chat.id, t(lang, "sectionIntro", { section: sectionName }));
  }

  await sendTelegramMessage(
    ctx,
    ctx.chat.id,
    formatQuestionMessage(question, answers),
    questionKeyboard(question, lang, answers, ctx.user),
    HTML_MESSAGE
  );
}

async function sendTelegramMessage(ctx, chatId, text, replyMarkup, options) {
  return ctx.perf.time("telegram_send", () => ctx.telegram.sendMessage(chatId, text, replyMarkup, options));
}

function formatQuestionMessage(question, answers = {}) {
  const lang = getLanguage(answers);
  const progress = getProgress(question);
  const sectionName = sections[question.section - 1][lang] || sections[question.section - 1].ua;
  const progressText = t(lang, "sectionPrefix", { current: progress.section, total: progress.totalSections });
  const questionText = question.text[lang] || question.text.ua;
  const hint = question.type === "multi" ? `\n\n${escapeHtml(t(lang, "multiSelectHint"))}` : "";
  return `<i>${escapeHtml(sectionName)} • ${escapeHtml(progressText)}</i>\n\n<b>${escapeHtml(questionText)}</b>${hint}`;
}

async function handleClarificationCallback(action, ctx) {
  const pending = ctx.session?.pendingClarification;
  if (!pending || !["yes", "no"].includes(action)) return { ignored: "unknown_clarification" };
  const question = getQuestion(pending.questionId);
  if (!question) return { ignored: "missing_clarification_question" };
  const session = {
    ...ctx.session,
    pendingClarification: null
  };
  return finishAnswer(await buildAnswerResult(ctx, () => answerCurrentQuestion(session, question.id, { value: action, rawAnswer: pending.rawAnswer }, ctx.perf)), { ...ctx, session });
}

async function sendClarification(question, ctx) {
  const lang = getLanguage(ctx.session?.answers || {});
  const textKey = question.id === "onlyfans_registered" ? "onlyfansClarification" : "onlyfansClarification";
  await sendTelegramMessage(ctx, ctx.chat.id, t(lang, textKey), {
    inline_keyboard: [
      [{ text: yesLabel(lang), callback_data: "clar:yes" }],
      [{ text: noLabel(lang), callback_data: "clar:no" }]
    ]
  });
}

function resolveSingleTextAnswer(question, text, answers = {}) {
  const option = findTextOption(question, text, answers);
  if (option) return { optionId: option.id };
  if (!isHybridSingleQuestion(question)) return { optionId: null };
  const normalized = inferNormalizedSingleValue(text);
  if (normalized && getQuestionOption(question, normalized, answers)) return { optionId: normalized };
  if (hasYesNoOptions(question)) return { needsClarification: true };
  return { optionId: "custom" };
}

function findTextOption(question, text, answers = {}) {
  const lang = getLanguage(answers);
  const normalized = String(text || "").trim();
  return (question.options || []).find((option) => {
    return option.id === normalized || option.label[lang] === normalized || option.label.ua === normalized || option.label.en === normalized || option.label.ru === normalized;
  }) || null;
}

function isHybridSingleQuestion(question) {
  if (!question || question.type !== "single") return false;
  return !question.options.every((option, index) => option.id === String(index + 1));
}

function inferNormalizedSingleValue(text) {
  const value = String(text || "").trim().toLowerCase();
  if (/^(да|так|yes|y)(\s|[,.;:!?]|$)/.test(value)) return "yes";
  if (/^(нет|ні|no|n)(\s|[,.;:!?]|$)/.test(value)) return "no";
  if (/^(не знаю|i do not know|i don't know|unknown)(\s|[,.;:!?]|$)/.test(value)) return "unknown";
  if (/^(обсуждается|обговорюється|discussable|discuss)(\s|[,.;:!?]|$)/.test(value)) return "discuss";
  return null;
}

function hasYesNoOptions(question) {
  const ids = new Set((question.options || []).map((option) => option.id));
  return ids.has("yes") && ids.has("no");
}

function yesLabel(lang) {
  return ({ ua: "Так", en: "Yes", ru: "Да" })[lang] || "Так";
}

function noLabel(lang) {
  return ({ ua: "Ні", en: "No", ru: "Нет" })[lang] || "Ні";
}

function multiRawAnswer(question, value, lang) {
  const selected = String(value || "").split(",").filter(Boolean);
  return selected.map((id) => {
    const option = (question.options || []).find((candidate) => candidate.id === id);
    return option ? (option.label[lang] || option.label.ua) : id;
  }).join(", ");
}

function countAnsweredQuestions(answers) {
  const questionIds = new Set(questions.map((question) => question.id));
  return Object.entries(answers || {}).filter(([key, value]) => {
    return questionIds.has(key) && value && value !== SKIPPED_BY_LOGIC;
  }).length;
}

function displayAnswersForSheets(answers) {
  const output = {};
  const questionIds = new Set(questions.map((question) => question.id));
  for (const [key, value] of Object.entries(answers || {})) {
    if (key.endsWith("_raw")) continue;
    if (!questionIds.has(key)) continue;
    if (value === SKIPPED) {
      output[key] = "Не указано";
    } else if (value === SKIPPED_BY_LOGIC) {
      output[key] = SKIPPED_BY_LOGIC;
    } else {
      output[key] = answers[`${key}_raw`] || value;
    }
  }
  return output;
}

async function notifyCompleted(ctx, lead) {
  const answers = lead.answers || {};
  const score = calculateLeadScore(answers);
  const strong = score >= 6 ? "\n⭐ Потенційно сильний лід\n" : "";
  const username = ctx.user.username || answers.tg_username || "";
  const text = `🔥 НОВА ЗАПОВНЕНА АНКЕТА${strong}
👤 Ім'я: ${safeForAdmin(answers.name)}
🎂 Вік: ${safeForAdmin(answers.age)}
📍 Місто: ${safeForAdmin(answers.current_city)}
✈️ TG: ${username ? `@${String(username).replace(/^@/, "")}` : "не вказано"}
📸 Instagram: ${safeForAdmin(answers.instagram)}

💬 Adult досвід:
${safeForAdmin(answers.adult_experience)}

💰 Очікування 1 місяць:
${safeForAdmin(answers.expected_income_month1)}

⏱ Готова працювати:
${safeForAdmin(answers.hours_per_day)}

OF раніше:
${safeForAdmin(answers.onlyfans_registered)}

Статус: COMPLETED
Source: ${safeForAdmin(lead.source || answers.source)}`;
  await sendTelegramMessage(ctx, ctx.env.TELEGRAM_ADMIN_CHAT_ID, text);
}

async function notifyAgeRejected(ctx) {
  const username = ctx.user.username ? `@${ctx.user.username}` : `telegram_id ${ctx.user.id}`;
  await sendTelegramMessage(ctx, ctx.env.TELEGRAM_ADMIN_CHAT_ID, `Анкета завершена за віковим обмеженням.\nTG: ${username}`);
}

function baseLead(user, source = "", chatId = "") {
  const now = new Date().toISOString();
  return {
    telegram_id: String(user.id),
    chat_id: String(chatId || ""),
    telegram_username: user.username || "",
    telegram_first_name: user.first_name || "",
    telegram_last_name: user.last_name || "",
    source: source || "",
    recruiter: source || "",
    language: "",
    current_section: 1,
    current_question: "",
    answers: {},
    processedUpdateIds: [],
    revision: 0,
    status: "STARTED",
    created_at: now,
    updated_at: now,
    started_at: now,
    startedAt: now,
    updatedAt: now,
    last_activity_at: now
  };
}

function parseStartSource(text) {
  const [, source] = text.trim().split(/\s+/, 2);
  return source ? source.slice(0, 64) : "";
}

function hasAttachment(message = {}) {
  const attachmentKeys = [
    "photo",
    "video",
    "document",
    "animation",
    "audio",
    "voice",
    "video_note",
    "sticker",
    "contact",
    "location",
    "venue",
    "poll",
    "dice",
    "game",
    "invoice",
    "successful_payment",
    "passport_data",
    "web_app_data"
  ];
  return attachmentKeys.some((key) => Object.prototype.hasOwnProperty.call(message, key)) || !Object.prototype.hasOwnProperty.call(message, "text");
}

function parseTelegramCommand(message = {}) {
  const text = message.text || "";
  if (!text) return null;
  const entity = (message.entities || []).find((item) => item.type === "bot_command");
  const raw = entity
    ? text.slice(entity.offset, entity.offset + entity.length)
    : text.trimStart().split(/\s+/, 1)[0];
  if (!raw.startsWith("/")) return null;
  const withoutSlash = raw.slice(1);
  const [command, mention = ""] = withoutSlash.split("@", 2);
  if (!command) return null;
  return {
    command: command.toLowerCase(),
    mention: mention.toLowerCase(),
    raw
  };
}

function isTelegramCommand(parsed, expectedCommand, botUsername = "") {
  const command = parsed.command || parseTelegramCommand(parsed.message);
  if (!command || command.command !== expectedCommand) return false;
  const expectedMention = String(botUsername || "").replace(/^@/, "").toLowerCase();
  return !command.mention || !expectedMention || command.mention === expectedMention;
}

function isDuplicateUpdate(session, updateId) {
  if (updateId == null || !session) return false;
  return (session.processedUpdateIds || []).includes(updateId);
}

function withProcessedUpdate(session, updateId) {
  if (updateId == null) return session;
  const ids = (session.processedUpdateIds || []).filter((id) => id !== updateId);
  ids.push(updateId);
  return {
    ...session,
    processedUpdateIds: ids.slice(-PROCESSED_UPDATE_LIMIT)
  };
}

function getLanguageFromSessionSafe(parsed, ctx) {
  const telegramId = parsed.user?.id ? String(parsed.user.id) : "";
  if (ctx?.session?.telegram_id === telegramId) return getLanguage(ctx.session.answers || {});
  return "ua";
}

function safeError(error) {
  return {
    name: error?.name,
    message: error?.message
  };
}

module.exports = { handleTelegramUpdate, handleMiniAppAction, parseStartSource, baseLead, formatQuestionMessage, buildSheetsSnapshot, displayAnswersForSheets, parseTelegramCommand, isTelegramCommand };
