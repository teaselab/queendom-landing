const test = require("node:test");
const assert = require("node:assert/strict");

const { handleTelegramUpdate, formatQuestionMessage, displayAnswersForSheets, buildSheetsSnapshot } = require("../src/bot/handler");
const { t } = require("../src/bot/questionnaire/i18n");
const { getFirstQuestion, getQuestion } = require("../src/bot/questionnaire/engine");
const { questionKeyboard } = require("../src/telegram/keyboards");
const { setupTelegramMenuButton } = require("../src/telegram/send");

test("credential-like sensitive text answers are not persisted", async () => {
  const sent = [];
  let persisted = false;
  const result = await handleTelegramUpdate(messageUpdate("password: qwerty123"), {
    sessions: mockSessions({
      status: "IN_PROGRESS",
      current_question: "onlyfans_accessible_pages",
      answers: {
        preferred_language: "ua",
        onlyfans_registered: "yes"
      }
    }),
    sheets: {
      async upsertMany() {
        persisted = true;
      },
      async complete() {
        persisted = true;
      }
    },
    telegram: {
      async sendMessage(chatId, text) {
        sent.push({ chatId, text });
      }
    },
    env: {
      TELEGRAM_ADMIN_CHAT_ID: "admin"
    },
    waitUntil() {
    }
  });

  assert.equal(result.privacyBlocked, "onlyfans_accessible_pages");
  assert.equal(persisted, false);
  assert.match(sent[0].text, /З міркувань безпеки/);
});

test("RU and EN intro messages use 3-5 minutes with HTML emphasis", () => {
  assert.match(t("ru", "intro"), /<b>3–5 минут<\/b>/);
  assert.match(t("en", "intro"), /<b>3–5 minutes<\/b>/);
  assert.doesNotMatch(t("ru", "intro"), /7[-–]10/);
  assert.doesNotMatch(t("en", "intro"), /7[-–]10/);
});

test("question formatting makes metadata secondary and question primary", () => {
  assert.equal(
    formatQuestionMessage(getQuestion("email"), { preferred_language: "ru" }),
    "<i>Основная информация • Раздел 1 из 8</i>\n\n<b>Электронная почта</b>"
  );
  assert.equal(
    formatQuestionMessage(getQuestion("age"), { preferred_language: "en" }),
    "<i>Basic information • Section 1 of 8</i>\n\n<b>Age</b>"
  );
});

test("question formatting escapes HTML-sensitive text", () => {
  const message = formatQuestionMessage({
    section: 1,
    text: {
      ua: "A < B & C > D",
      en: "A < B & C > D",
      ru: "A < B & C > D"
    }
  }, { preferred_language: "en" });

  assert.match(message, /<b>A &lt; B &amp; C &gt; D<\/b>/);
});

test("next question is sent with Telegram HTML parse mode", async () => {
  const sent = [];
  const result = await handleTelegramUpdate(messageUpdate("candidate@example.com"), {
    sessions: mockSessions({
      status: "IN_PROGRESS",
      current_question: "email",
      answers: {
        preferred_language: "en"
      }
    }),
    sheets: {
      async complete() {
        throw new Error("Sheets should not be called");
      }
    },
    telegram: {
      async sendMessage(chatId, text, replyMarkup, options) {
        sent.push({ chatId, text, replyMarkup, options });
      }
    },
    env: {
      TELEGRAM_ADMIN_CHAT_ID: "admin"
    },
    waitUntil() {
    }
  });

  assert.equal(result.next, "name");
  assert.equal(sent[0].options.parse_mode, "HTML");
  assert.match(sent[0].text, /<i>Basic information • Section 1 of 8<\/i>\n\n<b>Name<\/b>/);
  assert.ok(sent[0].replyMarkup);
});

test("ordinary answer uses one Redis GET, one Redis SET, no Sheets call and one Telegram send", async () => {
  const calls = {
    redisGet: 0,
    redisSet: 0,
    sheets: 0,
    telegramSend: 0
  };
  const result = await handleTelegramUpdate(messageUpdate("candidate@example.com"), {
    sessions: {
      async getSession() {
        calls.redisGet += 1;
        return {
          telegram_id: "456",
          status: "IN_PROGRESS",
          current_question: "email",
          answers: { preferred_language: "en" },
          processedUpdateIds: []
        };
      },
      async saveSession(session) {
        calls.redisSet += 1;
        return session;
      }
    },
    sheets: {
      async get() { calls.sheets += 1; },
      async upsert() { calls.sheets += 1; },
      async upsertMany() { calls.sheets += 1; },
      async create() { calls.sheets += 1; },
      async complete() { calls.sheets += 1; }
    },
    telegram: {
      async sendMessage() {
        calls.telegramSend += 1;
      }
    },
    env: {
      TELEGRAM_ADMIN_CHAT_ID: "admin"
    },
    waitUntil() {}
  });

  assert.equal(result.next, "name");
  assert.deepEqual(calls, {
    redisGet: 1,
    redisSet: 1,
    sheets: 0,
    telegramSend: 1
  });
});

test("english_level=6 advances to english_courses and does not resend english_level", async () => {
  const sent = [];
  const backgroundTasks = [];
  let savedSession = null;
  const result = await handleTelegramUpdate(messageUpdate("6", 611), {
    sessions: {
      async getSession() {
        return {
          telegram_id: "456",
          status: "IN_PROGRESS",
          current_question: "english_level",
          answers: { preferred_language: "ru" },
          processedUpdateIds: []
        };
      },
      async saveSession(session) {
        savedSession = session;
        return session;
      }
    },
    sheets: {
      async upsertMany() {
        throw new Error("background task should not run during foreground assertion");
      }
    },
    telegram: {
      async sendMessage(chatId, text, replyMarkup, options) {
        sent.push({ chatId, text, replyMarkup, options });
      }
    },
    env: {
      TELEGRAM_ADMIN_CHAT_ID: "admin"
    },
    waitUntil(task) {
      backgroundTasks.push(task);
    }
  });

  assert.equal(result.next, "english_courses");
  assert.equal(savedSession.answers.english_level, "6");
  assert.equal(savedSession.current_question, "english_courses");
  assert.equal(sent.length, 1);
  assert.doesNotMatch(sent[0].text, /Уровень английского от 1 до 10/);
  assert.match(sent[0].text, /Готовность улучшать английский/);
  assert.equal(backgroundTasks.length, 1);
});

test("citizenship_region advances after the first valid text answer", async () => {
  let savedSession = null;
  const sent = [];
  const result = await handleTelegramUpdate(messageUpdate("Украина", 6111), {
    sessions: {
      async getSession() {
        return {
          telegram_id: "456",
          status: "IN_PROGRESS",
          current_question: "citizenship_region",
          answers: { preferred_language: "ru" },
          processedUpdateIds: []
        };
      },
      async saveSession(session) {
        savedSession = session;
        return session;
      }
    },
    sheets: { async upsertMany() {} },
    telegram: {
      async sendMessage(chatId, text) {
        sent.push({ chatId, text });
      }
    },
    env: baseEnv(),
    waitUntil() {}
  });

  assert.equal(result.next, "current_city");
  assert.equal(savedSession.answers.citizenship_region, "Украина");
  assert.equal(savedSession.current_question, "current_city");
  assert.equal(sent.length, 1);
  assert.doesNotMatch(sent[0].text, /Гражданство/);
  assert.match(sent[0].text, /Город проживания/);
});

test("current_city advances after the first valid text answer", async () => {
  let savedSession = null;
  const sent = [];
  const result = await handleTelegramUpdate(messageUpdate("Киев", 6112), {
    sessions: {
      async getSession() {
        return {
          telegram_id: "456",
          status: "IN_PROGRESS",
          current_question: "current_city",
          answers: { preferred_language: "ru", citizenship_region: "Украина" },
          processedUpdateIds: []
        };
      },
      async saveSession(session) {
        savedSession = session;
        return session;
      }
    },
    sheets: { async upsertMany() {} },
    telegram: {
      async sendMessage(chatId, text) {
        sent.push({ chatId, text });
      }
    },
    env: baseEnv(),
    waitUntil() {}
  });

  assert.equal(result.next, "phone_model");
  assert.equal(savedSession.answers.current_city, "Киев");
  assert.equal(savedSession.current_question, "phone_model");
  assert.equal(sent.length, 1);
  assert.doesNotMatch(sent[0].text, /Город проживания/);
  assert.match(sent[0].text, /Модель телефона/);
});

test("expected_income_future accepts 500 once and advances to hours_per_day", async () => {
  let savedSession = null;
  const sent = [];
  const result = await handleTelegramUpdate(messageUpdate("500", 6113), {
    sessions: {
      async getSession() {
        return {
          telegram_id: "456",
          status: "IN_PROGRESS",
          current_question: "expected_income_future",
          revision: 7,
          answers: { preferred_language: "ru" },
          processedUpdateIds: []
        };
      },
      async saveSession(session) {
        savedSession = session;
        return session;
      }
    },
    sheets: { async upsertMany() {} },
    telegram: {
      async sendMessage(chatId, text) {
        sent.push({ chatId, text });
      }
    },
    env: baseEnv(),
    waitUntil() {}
  });

  assert.equal(result.next, "hours_per_day");
  assert.equal(savedSession.revision, 8);
  assert.equal(savedSession.answers.expected_income_future, "500");
  assert.equal(savedSession.current_question, "hours_per_day");
  assert.equal(sent.length, 1);
  assert.doesNotMatch(sent[0].text, /expected_income_future|перспектив/i);
  assert.match(sent[0].text, /hours|час/i);
});

test("validation error keeps current question and revision, then valid answer advances", async () => {
  let session = {
    telegram_id: "456",
    status: "IN_PROGRESS",
    current_question: "weight_kg",
    revision: 4,
    answers: { preferred_language: "ru" },
    processedUpdateIds: []
  };
  let saves = 0;
  const sent = [];
  const deps = {
    sessions: {
      async getSession() {
        return session;
      },
      async saveSession(nextSession) {
        saves += 1;
        session = nextSession;
        return nextSession;
      }
    },
    sheets: { async upsertMany() {} },
    telegram: {
      async sendMessage(chatId, text) {
        sent.push({ chatId, text });
      }
    },
    env: baseEnv(),
    waitUntil() {}
  };

  const invalid = await handleTelegramUpdate(messageUpdate("2", 6114), deps);
  assert.equal(invalid.validation, "Укажи число от 30 до 250.");
  assert.equal(session.current_question, "weight_kg");
  assert.equal(session.revision, 4);
  assert.equal(saves, 0);

  const valid = await handleTelegramUpdate(messageUpdate("55", 6115), deps);
  assert.equal(valid.next, "breast_size");
  assert.equal(session.answers.weight_kg, 55);
  assert.equal(session.current_question, "breast_size");
  assert.equal(session.revision, 5);
  assert.ok(sent.at(-1).text);
});

test("section cannot roll back after moving from section 2 to section 3", async () => {
  let session = {
    telegram_id: "456",
    status: "IN_PROGRESS",
    current_question: "hours_per_day",
    revision: 12,
    answers: { preferred_language: "ru" },
    processedUpdateIds: []
  };
  const sent = [];
  const deps = {
    sessions: {
      async getSession() {
        return session;
      },
      async saveSession(nextSession) {
        session = nextSession;
        return nextSession;
      }
    },
    sheets: { async upsertMany() {} },
    telegram: {
      async sendMessage(chatId, text) {
        sent.push({ chatId, text });
      }
    },
    env: baseEnv(),
    waitUntil() {}
  };

  const section3 = await handleTelegramUpdate(messageUpdate("8 часов", 6116), deps);
  assert.equal(section3.next, "lead_source_answer");
  assert.equal(getQuestion(session.current_question).section, 3);

  const next = await handleTelegramUpdate(messageUpdate("Instagram", 6117), deps);
  assert.equal(next.next, "how_feeling");
  assert.equal(getQuestion(session.current_question).section, 3);
  assert.doesNotMatch(sent.at(-1).text, /hours_per_day|Сколько часов/i);
});

test("full handler text flow sends no duplicate question ids without retry flows", async () => {
  let session = {
    telegram_id: "456",
    status: "IN_PROGRESS",
    current_question: getFirstQuestion().id,
    revision: 0,
    answers: {},
    processedUpdateIds: []
  };
  const sentQuestionIds = [];
  let previousSection = getQuestion(session.current_question).section;
  let updateId = 6200;

  while (session.current_question && updateId < 6300) {
    const before = session.current_question;
    const revisionBefore = session.revision;
    const sectionBefore = getQuestion(before).section;
    const result = await handleTelegramUpdate(messageUpdate(sampleHandlerAnswer(getQuestion(before)), updateId), {
      sessions: {
        async getSession() {
          return session;
        },
        async saveSession(nextSession) {
          session = nextSession;
          return nextSession;
        }
      },
      sheets: {
        async upsertMany() {},
        async complete() {}
      },
      telegram: {
        async sendMessage() {}
      },
      env: baseEnv(),
      waitUntil() {}
    });

    if (result.next) {
      assert.notEqual(result.next, before);
      assert.equal(session.revision, revisionBefore + 1);
      assert.ok(getQuestion(result.next).section >= sectionBefore);
      assert.ok(getQuestion(result.next).section >= previousSection);
      previousSection = getQuestion(result.next).section;
      sentQuestionIds.push(result.next);
    }
    updateId += 1;
  }

  assert.equal(session.status, "COMPLETED");
  assert.deepEqual(duplicates(sentQuestionIds), []);
});

test("numeric 1-10 keyboard uses two rows of five and Back as the final row", () => {
  const keyboard = questionKeyboard(getQuestion("english_level"), "ru", { preferred_language: "ru" });

  assert.deepEqual(keyboard.keyboard[0], ["1", "2", "3", "4", "5"]);
  assert.deepEqual(keyboard.keyboard[1], ["6", "7", "8", "9", "10"]);
  assert.deepEqual(keyboard.keyboard.at(-1), ["⬅️ Назад"]);
  assert.equal(keyboard.resize_keyboard, true);
});

test("duplicate update is ignored without Redis SET, Sheets or Telegram send", async () => {
  const calls = {
    redisGet: 0,
    redisSet: 0,
    sheets: 0,
    telegramSend: 0
  };
  const update = messageUpdate("candidate@example.com", 777);
  const result = await handleTelegramUpdate(update, {
    sessions: {
      async getSession() {
        calls.redisGet += 1;
        return {
          telegram_id: "456",
          status: "IN_PROGRESS",
          current_question: "email",
          answers: { preferred_language: "en" },
          processedUpdateIds: [777]
        };
      },
      async saveSession() {
        calls.redisSet += 1;
      }
    },
    sheets: {
      async complete() { calls.sheets += 1; }
    },
    telegram: {
      async sendMessage() {
        calls.telegramSend += 1;
      }
    },
    env: {
      TELEGRAM_ADMIN_CHAT_ID: "admin"
    }
  });

  assert.deepEqual(result, { duplicate: true });
  assert.deepEqual(calls, {
    redisGet: 1,
    redisSet: 0,
    sheets: 0,
    telegramSend: 0
  });
});

test("background Sheets sync upserts IN_PROGRESS snapshot after an answer", async () => {
  const backgroundTasks = [];
  const sheetCalls = [];
  const result = await handleTelegramUpdate(messageUpdate("candidate@example.com", 1001), {
    sessions: mockSessions({
      telegram_id: "456",
      status: "IN_PROGRESS",
      current_question: "email",
      answers: { preferred_language: "en" }
    }),
    sheets: {
      async upsertMany(telegramId, fields) {
        sheetCalls.push({ telegramId, fields });
      }
    },
    telegram: {
      async sendMessage() {}
    },
    env: {
      TELEGRAM_ADMIN_CHAT_ID: "admin"
    },
    waitUntil(task) {
      backgroundTasks.push(task);
    }
  });

  assert.equal(result.next, "name");
  assert.equal(sheetCalls.length, 0);
  await backgroundTasks[0]();
  assert.equal(sheetCalls.length, 1);
  assert.equal(sheetCalls[0].telegramId, "456");
  assert.equal(sheetCalls[0].fields.status, "IN_PROGRESS");
  assert.equal(sheetCalls[0].fields.current_question, "name");
  assert.equal(sheetCalls[0].fields.email, "candidate@example.com");
  assert.equal(sheetCalls[0].fields.answers_count, 2);
});

test("background Sheets sync failure does not block next question or rewrite Redis session", async () => {
  const backgroundTasks = [];
  const savedSessions = [];
  const result = await handleTelegramUpdate(messageUpdate("candidate@example.com", 1002), {
    sessions: {
      async getSession() {
        return {
          telegram_id: "456",
          status: "IN_PROGRESS",
          current_question: "email",
          answers: { preferred_language: "en" },
          processedUpdateIds: []
        };
      },
      async saveSession(session) {
        savedSessions.push(session);
        return session;
      }
    },
    sheets: {
      async upsertMany() {
        throw new Error("Sheets unavailable");
      }
    },
    telegram: {
      async sendMessage() {}
    },
    env: {
      TELEGRAM_ADMIN_CHAT_ID: "admin"
    },
    waitUntil(task) {
      backgroundTasks.push(task);
    }
  });

  assert.equal(result.next, "name");
  assert.equal(savedSessions[0].current_question, "name");
  await backgroundTasks[0]();
  assert.equal(savedSessions.length, 1);
  assert.equal(savedSessions[0].current_question, "name");
});

test("stale background Sheets snapshot cannot overwrite a newer questionnaire state", async () => {
  const backgroundTasks = [];
  let session = {
    telegram_id: "456",
    status: "IN_PROGRESS",
    current_question: "citizenship_region",
    revision: 10,
    answers: { preferred_language: "ru" },
    processedUpdateIds: []
  };
  const sessions = {
    async getSession() {
      return session;
    },
    async saveSession(nextSession) {
      session = nextSession;
      return nextSession;
    }
  };

  await handleTelegramUpdate(messageUpdate("Украина", 5101), {
    sessions,
    sheets: { async upsertMany() {} },
    telegram: { async sendMessage() {} },
    env: baseEnv(),
    waitUntil(task) {
      backgroundTasks.push(task);
    }
  });

  assert.equal(session.current_question, "current_city");
  assert.equal(session.revision, 11);
  session = {
    ...session,
    answers: { ...session.answers, current_city: "Киев" },
    current_question: "phone_model",
    revision: 12
  };

  await backgroundTasks[0]();
  assert.equal(session.current_question, "phone_model");
  assert.equal(session.revision, 12);
  assert.equal(session.answers.current_city, "Киев");
});

test("concurrent Telegram updates for one user are serialized by the state lock", async () => {
  let session = {
    telegram_id: "456",
    status: "IN_PROGRESS",
    current_question: "citizenship_region",
    revision: 20,
    answers: { preferred_language: "ru" },
    processedUpdateIds: []
  };
  const saved = [];
  const sessions = {
    async getSession() {
      await delay(5);
      return session;
    },
    async saveSession(nextSession) {
      await delay(5);
      session = nextSession;
      saved.push(nextSession);
      return nextSession;
    }
  };
  const deps = {
    sessions,
    sheets: { async upsertMany() {} },
    telegram: { async sendMessage() {} },
    env: baseEnv(),
    waitUntil() {}
  };

  const [first, second] = await Promise.all([
    handleTelegramUpdate(messageUpdate("РЈРєСЂР°РёРЅР°", 5102), deps),
    handleTelegramUpdate(messageUpdate("РљРёРµРІ", 5103), deps)
  ]);

  assert.equal(first.next, "current_city");
  assert.equal(second.next, "phone_model");
  assert.equal(session.current_question, "phone_model");
  assert.equal(session.revision, 22);
  assert.deepEqual(saved.map((item) => item.revision), [21, 22]);
});

test("repeated background syncs target the same lead row by telegram_id", async () => {
  const backgroundTasks = [];
  const sheetCalls = [];
  const sessions = [
    {
      telegram_id: "456",
      status: "IN_PROGRESS",
      current_question: "email",
      answers: { preferred_language: "en" },
      processedUpdateIds: []
    },
    {
      telegram_id: "456",
      status: "IN_PROGRESS",
      current_question: "name",
      answers: { preferred_language: "en", email: "candidate@example.com" },
      processedUpdateIds: []
    }
  ];

  for (const [index, text] of ["candidate@example.com", "Candidate"].entries()) {
    await handleTelegramUpdate(messageUpdate(text, 2000 + index), {
      sessions: {
        async getSession() {
          return sessions[index];
        },
        async saveSession(session) {
          sessions[index] = session;
          return session;
        }
      },
      sheets: {
        async upsertMany(telegramId, fields) {
          sheetCalls.push({ telegramId, fields });
        }
      },
      telegram: {
        async sendMessage() {}
      },
      env: {
        TELEGRAM_ADMIN_CHAT_ID: "admin"
      },
      waitUntil(task) {
        backgroundTasks.push(task);
      }
    });
  }

  await Promise.all(backgroundTasks.map((task) => task()));
  assert.equal(sheetCalls.length, 2);
  assert.deepEqual(sheetCalls.map((call) => call.telegramId), ["456", "456"]);
});

test("completed questionnaire schedules final Sheets sync with full COMPLETED snapshot", async () => {
  const sheetCalls = [];
  const backgroundTasks = [];
  const result = await handleTelegramUpdate(messageUpdate("Supportive team", 1003), {
    sessions: mockSessions({
      telegram_id: "456",
      telegram_username: "candidate",
      telegram_first_name: "Candidate",
      telegram_last_name: "Model",
      source: "campaign_a",
      recruiter: "campaign_a",
      created_at: "2026-08-13T00:00:00.000Z",
      started_at: "2026-08-13T00:01:00.000Z",
      status: "IN_PROGRESS",
      current_question: "team_preferences",
      answers: {
        preferred_language: "en",
        email: "candidate@example.com",
        age: 22,
        name: "Candidate"
      }
    }),
    sheets: {
      async complete(telegramId, fields) {
        sheetCalls.push({ telegramId, fields });
      }
    },
    telegram: {
      async sendMessage() {}
    },
    env: {
      TELEGRAM_ADMIN_CHAT_ID: "admin"
    },
    waitUntil(task) {
      backgroundTasks.push(task);
    }
  });

  assert.equal(result.status, "COMPLETED");
  assert.equal(sheetCalls.length, 0);
  assert.equal(backgroundTasks.length, 1);
  await backgroundTasks[0]();
  assert.equal(sheetCalls.length, 1);
  assert.equal(sheetCalls[0].telegramId, "456");
  assert.equal(sheetCalls[0].fields.status, "COMPLETED");
  assert.ok(sheetCalls[0].fields.completed_at);
  assert.equal(sheetCalls[0].fields.telegram_username, "candidate");
  assert.equal(sheetCalls[0].fields.telegram_first_name, "Candidate");
  assert.equal(sheetCalls[0].fields.telegram_last_name, "Model");
  assert.equal(sheetCalls[0].fields.source, "campaign_a");
  assert.equal(sheetCalls[0].fields.recruiter, "campaign_a");
  assert.equal(sheetCalls[0].fields.email, "candidate@example.com");
  assert.equal(sheetCalls[0].fields.name, "Candidate");
  assert.equal(sheetCalls[0].fields.age, 22);
});

test("Sheets snapshot includes Telegram metadata and answers", () => {
  const snapshot = buildSheetsSnapshot({
    telegram_username: "candidate",
    telegram_first_name: "Candidate",
    telegram_last_name: "Model",
    source: "ads",
    recruiter: "ads",
    status: "IN_PROGRESS",
    current_question: "name",
    progress_percent: 12,
    last_activity_at: "2026-08-13T00:02:00.000Z",
    answers_count: 2,
    skipped_count: 0,
    answers: {
      preferred_language: "en",
      email: "candidate@example.com"
    }
  });

  assert.equal(snapshot.telegram_username, "candidate");
  assert.equal(snapshot.telegram_first_name, "Candidate");
  assert.equal(snapshot.telegram_last_name, "Model");
  assert.equal(snapshot.source, "ads");
  assert.equal(snapshot.recruiter, "ads");
  assert.equal(snapshot.email, "candidate@example.com");
  assert.equal(snapshot.status, "IN_PROGRESS");
  assert.equal(snapshot.current_question, "name");
});

test("measurements can be skipped by the user and Sheets displays it as not specified", async () => {
  let savedSession = null;
  const sent = [];
  const backgroundTasks = [];
  const result = await handleTelegramUpdate(callbackUpdate("q23:skip", 3001), {
    sessions: {
      async getSession() {
        return {
          telegram_id: "456",
          status: "IN_PROGRESS",
          current_question: "measurements",
          answers: { preferred_language: "ru" },
          processedUpdateIds: []
        };
      },
      async saveSession(session) {
        savedSession = session;
        return session;
      }
    },
    sheets: { async upsertMany() {} },
    telegram: {
      async answerCallbackQuery() {},
      async sendMessage(chatId, text) {
        sent.push({ chatId, text });
      }
    },
    env: { TELEGRAM_ADMIN_CHAT_ID: "admin" },
    waitUntil(task) {
      backgroundTasks.push(task);
    }
  });

  assert.equal(result.next, "hair_color");
  assert.equal(savedSession.answers.measurements, "SKIPPED");
  assert.equal(displayAnswersForSheets(savedSession.answers).measurements, "\u041d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u043e");
  assert.equal(sent.length, 1);
  assert.equal(backgroundTasks.length, 1);
});

test("hybrid OnlyFans text stores normalized value for logic and raw answer for Sheets", async () => {
  let savedSession = null;
  const result = await handleTelegramUpdate(messageUpdate("Да, был аккаунт", 3002), {
    sessions: {
      async getSession() {
        return {
          telegram_id: "456",
          status: "IN_PROGRESS",
          current_question: "onlyfans_registered",
          answers: { preferred_language: "ru" },
          processedUpdateIds: []
        };
      },
      async saveSession(session) {
        savedSession = session;
        return session;
      }
    },
    sheets: { async upsertMany() {} },
    telegram: { async sendMessage() {} },
    env: { TELEGRAM_ADMIN_CHAT_ID: "admin" },
    waitUntil() {}
  });

  assert.equal(result.next, "onlyfans_registered_pages");
  assert.equal(savedSession.answers.onlyfans_registered, "yes");
  assert.equal(savedSession.answers.onlyfans_registered_raw, "Да, был аккаунт");
  assert.equal(displayAnswersForSheets(savedSession.answers).onlyfans_registered, "Да, был аккаунт");
});

test("ambiguous hybrid OnlyFans text asks clarification and stays on the same question", async () => {
  let savedSession = null;
  const sent = [];
  const result = await handleTelegramUpdate(messageUpdate("Был профиль давно", 3003), {
    sessions: {
      async getSession() {
        return {
          telegram_id: "456",
          status: "IN_PROGRESS",
          current_question: "onlyfans_registered",
          answers: { preferred_language: "ru" },
          processedUpdateIds: []
        };
      },
      async saveSession(session) {
        savedSession = session;
        return session;
      }
    },
    sheets: { async upsertMany() { throw new Error("Sheets should not sync clarification"); } },
    telegram: {
      async sendMessage(chatId, text, replyMarkup) {
        sent.push({ chatId, text, replyMarkup });
      }
    },
    env: { TELEGRAM_ADMIN_CHAT_ID: "admin" },
    waitUntil() {}
  });

  assert.deepEqual(result, { clarification: "onlyfans_registered" });
  assert.equal(savedSession.current_question, "onlyfans_registered");
  assert.deepEqual(savedSession.pendingClarification, {
    questionId: "onlyfans_registered",
    rawAnswer: "Был профиль давно"
  });
  assert.match(sent[0].text, /OnlyFans/);
  assert.deepEqual(sent[0].replyMarkup.inline_keyboard.map((row) => row[0].callback_data), ["clar:yes", "clar:no"]);
});

test("payment multi-select text none advances and skips dependent payment questions", async () => {
  let savedSession = null;
  const sent = [];
  const backgroundTasks = [];
  const result = await handleTelegramUpdate(messageUpdate("нет", 5001), {
    sessions: {
      async getSession() {
        return {
          telegram_id: "456",
          status: "IN_PROGRESS",
          current_question: "payment_accounts_registered",
          answers: { preferred_language: "ru" },
          processedUpdateIds: []
        };
      },
      async saveSession(session) {
        savedSession = session;
        return session;
      }
    },
    sheets: { async upsertMany() {} },
    telegram: {
      async sendMessage(chatId, text, replyMarkup) {
        sent.push({ chatId, text, replyMarkup });
      }
    },
    env: baseEnv(),
    waitUntil(task) {
      backgroundTasks.push(task);
    }
  });

  assert.equal(result.next, "active_promo_socials");
  assert.equal(savedSession.current_question, "active_promo_socials");
  assert.equal(savedSession.answers.payment_accounts_registered, "none");
  assert.equal(savedSession.answers.payment_accounts_registered_raw, "нет");
  assert.equal(savedSession.answers.payment_accounts_access, "SKIPPED_BY_LOGIC");
  assert.equal(savedSession.answers.payment_account_bans, "SKIPPED_BY_LOGIC");
  assert.equal(sent.length, 2);
  assert.doesNotMatch(sent.at(-1).text, /Skrill|Paxum|Cosmo/);
  assert.equal(backgroundTasks.length, 1);
});

test("payment multi-select text stores raw answer for Sheets and normalized value for logic", async () => {
  let savedSession = null;
  const backgroundTasks = [];
  const sheetCalls = [];
  const result = await handleTelegramUpdate(messageUpdate("Skrill и Paxum", 5002), {
    sessions: {
      async getSession() {
        return {
          telegram_id: "456",
          status: "IN_PROGRESS",
          current_question: "payment_accounts_registered",
          answers: { preferred_language: "ru" },
          processedUpdateIds: []
        };
      },
      async saveSession(session) {
        savedSession = session;
        return session;
      }
    },
    sheets: {
      async upsertMany(telegramId, fields) {
        sheetCalls.push({ telegramId, fields });
      }
    },
    telegram: { async sendMessage() {} },
    env: baseEnv(),
    waitUntil(task) {
      backgroundTasks.push(task);
    }
  });

  assert.equal(result.next, "payment_accounts_access");
  assert.equal(savedSession.answers.payment_accounts_registered, "sk,px");
  assert.equal(savedSession.answers.payment_accounts_registered_raw, "Skrill и Paxum");
  assert.equal(displayAnswersForSheets(savedSession.answers).payment_accounts_registered, "Skrill и Paxum");

  await backgroundTasks[0]();
  assert.equal(sheetCalls.length, 1);
  assert.equal(sheetCalls[0].fields.payment_accounts_registered, "Skrill и Paxum");
  assert.equal(sheetCalls[0].fields.current_question, "payment_accounts_access");
});

test("ambiguous payment multi-select text asks clarification without moving current question", async () => {
  const sent = [];
  const session = {
    telegram_id: "456",
    status: "IN_PROGRESS",
    current_question: "payment_accounts_registered",
    answers: { preferred_language: "ru" },
    processedUpdateIds: []
  };
  const result = await handleTelegramUpdate(messageUpdate("не помню", 5003), {
    sessions: {
      async getSession() { return session; },
      async saveSession() { throw new Error("Ambiguous multi-select text must not be saved"); }
    },
    sheets: { async upsertMany() { throw new Error("Ambiguous text must not sync Sheets"); } },
    telegram: {
      async sendMessage(chatId, text, replyMarkup) {
        sent.push({ chatId, text, replyMarkup });
      }
    },
    env: baseEnv(),
    waitUntil() {}
  });

  assert.deepEqual(result, { clarification: "payment_accounts_registered" });
  assert.equal(session.current_question, "payment_accounts_registered");
  assert.deepEqual(session.answers, { preferred_language: "ru" });
  assert.match(sent[0].text, /Уточни|вариант/);
  assert.deepEqual(sent[0].replyMarkup.inline_keyboard.map((row) => row[0].callback_data).slice(0, 5), [
    "q37:sk",
    "q37:px",
    "q37:cs",
    "q37:none",
    "q37:done"
  ]);
});

test("traffic sources text none advances without repeating the same question", async () => {
  let savedSession = null;
  const sent = [];
  const result = await handleTelegramUpdate(messageUpdate("не использовала", 5004), {
    sessions: {
      async getSession() {
        return {
          telegram_id: "456",
          status: "IN_PROGRESS",
          current_question: "traffic_sources",
          answers: { preferred_language: "ru" },
          processedUpdateIds: []
        };
      },
      async saveSession(session) {
        savedSession = session;
        return session;
      }
    },
    sheets: { async upsertMany() {} },
    telegram: {
      async sendMessage(chatId, text, replyMarkup) {
        sent.push({ chatId, text, replyMarkup });
      }
    },
    env: baseEnv(),
    waitUntil() {}
  });

  assert.equal(result.next, "content_feet");
  assert.equal(savedSession.answers.traffic_sources, "none");
  assert.equal(savedSession.answers.traffic_sources_raw, "не использовала");
  assert.equal(savedSession.answers.traffic_sources_other, "SKIPPED_BY_LOGIC");
  assert.equal(sent.length, 2);
  assert.doesNotMatch(sent.at(-1).text, /Источники трафика/);
});

test("multi-select keyboard highlights selected values and uses localized Continue label", () => {
  const keyboard = questionKeyboard(getQuestion("payment_accounts_registered"), "ru", {
    preferred_language: "ru",
    payment_accounts_registered: "px,cs"
  });
  const labels = keyboard.inline_keyboard.map((row) => row[0].text);

  assert.match(labels[0], /^▫️ Skrill$/);
  assert.match(labels[1], /^✅ Paxum$/);
  assert.match(labels[2], /^✅ Cosmo$/);
  assert.ok(labels.includes("Продолжить →"));
});

for (const attachmentType of ["photo", "document", "video", "voice"]) {
  test(`${attachmentType} is rejected without changing questionnaire state`, async () => {
    const calls = { redisSet: 0, sheets: 0 };
    const sent = [];
    const session = {
      telegram_id: "456",
      status: "IN_PROGRESS",
      current_question: "email",
      progress_percent: 12,
      answers: { preferred_language: "ru" },
      processedUpdateIds: []
    };

    const result = await handleTelegramUpdate(attachmentUpdate(attachmentType, 4000 + sent.length), {
      sessions: {
        async getSession() {
          return session;
        },
        async saveSession() {
          calls.redisSet += 1;
          throw new Error("Attachment must not be saved");
        }
      },
      sheets: {
        async upsertMany() { calls.sheets += 1; },
        async complete() { calls.sheets += 1; },
        async reset() { calls.sheets += 1; }
      },
      telegram: {
        async sendMessage(chatId, text, replyMarkup, options) {
          sent.push({ chatId, text, replyMarkup, options });
        }
      },
      env: baseEnv(),
      waitUntil() {}
    });

    assert.equal(result.attachmentRejected, true);
    assert.equal(result.current_question, "email");
    assert.deepEqual(calls, { redisSet: 0, sheets: 0 });
    assert.equal(session.current_question, "email");
    assert.equal(session.progress_percent, 12);
    assert.equal(sent.length, 2);
    assert.match(sent[0].text, /Вложения не сохраняются/);
    assert.match(sent[1].text, /<b>Электронная почта<\/b>/);
  });
}

test("/menu is not treated as an answer and does not change current progress", async () => {
  const calls = { redisSet: 0, sheets: 0 };
  const sent = [];
  const session = {
    telegram_id: "456",
    status: "IN_PROGRESS",
    current_question: "email",
    progress_percent: 25,
    answers: { preferred_language: "ru", email: "old@example.com" },
    processedUpdateIds: []
  };

  const result = await handleTelegramUpdate(messageUpdate("/menu", 4100), {
    sessions: {
      async getSession() { return session; },
      async saveSession() { calls.redisSet += 1; }
    },
    sheets: {
      async upsertMany() { calls.sheets += 1; },
      async reset() { calls.sheets += 1; }
    },
    telegram: {
      async sendMessage(chatId, text, replyMarkup, options) {
        sent.push({ chatId, text, replyMarkup, options });
      }
    },
    env: baseEnv(),
    waitUntil() {}
  });

  assert.deepEqual(result, { menu: "in_progress" });
  assert.deepEqual(calls, { redisSet: 0, sheets: 0 });
  assert.equal(session.current_question, "email");
  assert.equal(session.progress_percent, 25);
  assert.deepEqual(sent[0].replyMarkup.inline_keyboard.map((row) => row[0].text), [
    "Продолжить анкету",
    "Начать анкету заново",
    "Связаться с Лизой",
    "Кейсы моделей"
  ]);
  assert.equal(sent[0].replyMarkup.inline_keyboard[2][0].url, "https://t.me/elize_cherry");
  assert.equal(sent[0].replyMarkup.inline_keyboard[3][0].url, "https://t.me/queendom_agency");
});

test("/menu without session shows main menu without starting questionnaire", async () => {
  let saved = false;
  const sent = [];
  const result = await handleTelegramUpdate(commandUpdate("/menu", 4102), {
    sessions: {
      async getSession() { return null; },
      async saveSession() { saved = true; }
    },
    sheets: { async upsertMany() { throw new Error("Menu must not sync Sheets"); } },
    telegram: {
      async sendMessage(chatId, text, replyMarkup) {
        sent.push({ chatId, text, replyMarkup });
      }
    },
    env: baseEnv(),
    waitUntil() {}
  });

  assert.deepEqual(result, { menu: "new" });
  assert.equal(saved, false);
  assert.equal(sent[0].text, "Меню");
  assert.deepEqual(sent[0].replyMarkup.inline_keyboard.map((row) => row[0].text), [
    "Начать анкету",
    "Связаться с Лизой",
    "Кейсы моделей"
  ]);
});

test("/menu with COMPLETED session shows retake menu without Continue", async () => {
  const sent = [];
  const session = {
    telegram_id: "456",
    status: "COMPLETED",
    current_question: "",
    answers: { preferred_language: "ru", email: "old@example.com" },
    processedUpdateIds: []
  };

  const result = await handleTelegramUpdate(commandUpdate("/menu", 4103), {
    sessions: {
      async getSession() { return session; },
      async saveSession() { throw new Error("Menu must not save completed session"); }
    },
    sheets: { async upsertMany() { throw new Error("Menu must not sync Sheets"); } },
    telegram: {
      async sendMessage(chatId, text, replyMarkup) {
        sent.push({ chatId, text, replyMarkup });
      }
    },
    env: baseEnv(),
    waitUntil() {}
  });

  assert.deepEqual(result, { menu: "completed" });
  assert.equal(sent[0].text, "Меню");
  assert.deepEqual(sent[0].replyMarkup.inline_keyboard.map((row) => row[0].text), [
    "Пройти анкету заново",
    "Связаться с Лизой",
    "Кейсы моделей"
  ]);
});

test("/menu@castingform_bot bot_command entity shows menu before text answer handling", async () => {
  const sent = [];
  const session = {
    telegram_id: "456",
    status: "IN_PROGRESS",
    current_question: "age",
    progress_percent: 25,
    answers_count: 4,
    answers: { preferred_language: "ru", email: "old@example.com" },
    processedUpdateIds: []
  };

  const result = await handleTelegramUpdate(commandUpdate("/menu@castingform_bot", 4110), {
    sessions: {
      async getSession() { return session; },
      async saveSession() { throw new Error("Command must not be saved as an answer"); }
    },
    sheets: {
      async upsertMany() { throw new Error("Command must not sync Sheets as an answer"); }
    },
    telegram: {
      async sendMessage(chatId, text, replyMarkup) {
        sent.push({ chatId, text, replyMarkup });
      }
    },
    env: baseEnv(),
    waitUntil() {}
  });

  assert.deepEqual(result, { menu: "in_progress" });
  assert.equal(session.current_question, "age");
  assert.equal(session.answers_count, 4);
  assert.equal(session.answers.email, "old@example.com");
  assert.equal(sent[0].replyMarkup.inline_keyboard[0][0].text, "Продолжить анкету");
});

test("bot command is not passed into question text validation", async () => {
  const sent = [];
  const result = await handleTelegramUpdate(commandUpdate("/menu", 4111), {
    sessions: mockSessions({
      status: "IN_PROGRESS",
      current_question: "age",
      progress_percent: 10,
      answers_count: 2,
      answers: { preferred_language: "ru" }
    }),
    sheets: {
      async upsertMany() { throw new Error("Command must not schedule answer sync"); }
    },
    telegram: {
      async sendMessage(chatId, text, replyMarkup) {
        sent.push({ chatId, text, replyMarkup });
      }
    },
    env: baseEnv(),
    waitUntil() {}
  });

  assert.deepEqual(result, { menu: "in_progress" });
  assert.doesNotMatch(sent[0].text, /Возраст|лет|число/);
  assert.equal(sent[0].replyMarkup.inline_keyboard[0][0].callback_data, "ctl:continue");
});

test("/menu during email question does not run email validation", async () => {
  const sent = [];
  const session = {
    telegram_id: "456",
    status: "IN_PROGRESS",
    current_question: "email",
    answers: { preferred_language: "ru" },
    processedUpdateIds: []
  };

  const result = await handleTelegramUpdate(commandUpdate("/menu", 4112), {
    sessions: {
      async getSession() { return session; },
      async saveSession() { throw new Error("Menu must not save /menu as email"); }
    },
    sheets: { async upsertMany() { throw new Error("Menu must not sync answer"); } },
    telegram: {
      async sendMessage(chatId, text, replyMarkup) {
        sent.push({ chatId, text, replyMarkup });
      }
    },
    env: baseEnv(),
    waitUntil() {}
  });

  assert.deepEqual(result, { menu: "in_progress" });
  assert.equal(session.current_question, "email");
  assert.deepEqual(session.answers, { preferred_language: "ru" });
  assert.equal(sent[0].text, "Меню");
});

test("continue from menu preserves answers and returns to the current question", async () => {
  const sent = [];
  const session = {
    telegram_id: "456",
    status: "IN_PROGRESS",
    current_question: "email",
    progress_percent: 25,
    answers: { preferred_language: "ru", name: "Candidate" },
    processedUpdateIds: []
  };

  const result = await handleTelegramUpdate(callbackUpdate("ctl:continue", 4200), {
    sessions: {
      async getSession() { return session; },
      async saveSession() { throw new Error("Continue must not save session"); }
    },
    sheets: { async reset() { throw new Error("Continue must not touch Sheets"); } },
    telegram: {
      async answerCallbackQuery() {},
      async sendMessage(chatId, text) {
        sent.push({ chatId, text });
      }
    },
    env: baseEnv(),
    waitUntil() {}
  });

  assert.deepEqual(result, { question: "email" });
  assert.equal(session.progress_percent, 25);
  assert.equal(session.answers.name, "Candidate");
  assert.match(sent[0].text, /<b>Электронная почта<\/b>/);
});

test("restart requires confirmation and cancel keeps existing answers", async () => {
  const sent = [];
  const session = {
    telegram_id: "456",
    status: "IN_PROGRESS",
    current_question: "email",
    progress_percent: 25,
    answers: { preferred_language: "ru", email: "old@example.com" },
    processedUpdateIds: []
  };

  const prompt = await handleTelegramUpdate(callbackUpdate("ctl:restart_prompt", 4300), {
    sessions: {
      async getSession() { return session; },
      async saveSession() { throw new Error("Prompt must not save session"); }
    },
    sheets: { async reset() { throw new Error("Prompt must not reset Sheets"); } },
    telegram: {
      async answerCallbackQuery() {},
      async sendMessage(chatId, text, replyMarkup) {
        sent.push({ chatId, text, replyMarkup });
      }
    },
    env: baseEnv(),
    waitUntil() {}
  });

  assert.deepEqual(prompt, { restartConfirmation: true });
  assert.match(sent[0].text, /Начать анкету заново/);
  assert.deepEqual(sent[0].replyMarkup.inline_keyboard.map((row) => row[0].callback_data), ["ctl:restart_confirm", "ctl:restart_cancel"]);

  const cancel = await handleTelegramUpdate(callbackUpdate("ctl:restart_cancel", 4301), {
    sessions: {
      async getSession() { return session; },
      async saveSession() { throw new Error("Cancel must not save session"); }
    },
    sheets: { async reset() { throw new Error("Cancel must not reset Sheets"); } },
    telegram: {
      async answerCallbackQuery() {},
      async sendMessage(chatId, text) {
        sent.push({ chatId, text });
      }
    },
    env: baseEnv(),
    waitUntil() {}
  });

  assert.equal(cancel.restartCancelled, true);
  assert.equal(session.answers.email, "old@example.com");
  assert.equal(session.current_question, "email");
  assert.match(sent.at(-1).text, /<b>Электронная почта<\/b>/);
});

test("confirmed restart clears answers, resets progress and resets the existing Sheets row", async () => {
  let savedSession = null;
  const resetCalls = [];
  const sent = [];
  const session = {
    telegram_id: "456",
    source: "instagram",
    recruiter: "instagram",
    status: "COMPLETED",
    current_question: "team_preferences",
    progress_percent: 100,
    answers_count: 20,
    skipped_count: 3,
    completed_at: "2026-08-13T00:00:00.000Z",
    answers: {
      preferred_language: "ru",
      email: "old@example.com",
      onlyfans_registered: "yes",
      onlyfans_registered_raw: "Да"
    },
    processedUpdateIds: []
  };

  const result = await handleTelegramUpdate(callbackUpdate("ctl:restart_confirm", 4400), {
    sessions: {
      async getSession() { return session; },
      async saveSession(nextSession) {
        savedSession = nextSession;
        return nextSession;
      }
    },
    sheets: {
      async reset(telegramId, fields) {
        resetCalls.push({ telegramId, fields });
      }
    },
    telegram: {
      async answerCallbackQuery() {},
      async sendMessage(chatId, text) {
        sent.push({ chatId, text });
      }
    },
    env: baseEnv(),
    waitUntil() {}
  });

  assert.deepEqual(result, { restarted: true, question: "preferred_language" });
  assert.equal(savedSession.current_question, "preferred_language");
  assert.equal(savedSession.status, "IN_PROGRESS");
  assert.deepEqual(savedSession.answers, {});
  assert.equal(savedSession.progress_percent, 0);
  assert.equal(savedSession.answers_count, 0);
  assert.equal(savedSession.completed_at, "");
  assert.equal(resetCalls.length, 1);
  assert.equal(resetCalls[0].telegramId, "456");
  assert.equal(resetCalls[0].fields.status, "IN_PROGRESS");
  assert.equal(resetCalls[0].fields.current_question, "preferred_language");
  assert.equal(resetCalls[0].fields.answers_count, 0);
  assert.equal(resetCalls[0].fields.completed_at, "");
  assert.equal(resetCalls[0].fields.email, undefined);
  assert.match(sent[0].text, /<b>Оберіть мову \/ Choose language \/ Выберите язык<\/b>/);
});

test("/start with IN_PROGRESS shows menu without destroying the session", async () => {
  let saved = false;
  const sent = [];
  const session = {
    telegram_id: "456",
    status: "IN_PROGRESS",
    current_question: "email",
    progress_percent: 25,
    answers: { preferred_language: "ru", email: "old@example.com" },
    processedUpdateIds: []
  };

  const result = await handleTelegramUpdate(messageUpdate("/start", 4500), {
    sessions: {
      async getSession() { return session; },
      async saveSession() { saved = true; }
    },
    sheets: { async reset() { throw new Error("Start menu must not reset Sheets"); } },
    telegram: {
      async sendMessage(chatId, text, replyMarkup) {
        sent.push({ chatId, text, replyMarkup });
      }
    },
    env: baseEnv(),
    waitUntil() {}
  });

  assert.deepEqual(result, { menu: "in_progress" });
  assert.equal(saved, false);
  assert.equal(session.answers.email, "old@example.com");
  assert.equal(sent[0].replyMarkup.inline_keyboard[0][0].callback_data, "ctl:continue");
});

test("/start@castingform_bot with IN_PROGRESS is routed before answer handler", async () => {
  let saved = false;
  const sent = [];
  const session = {
    telegram_id: "456",
    status: "IN_PROGRESS",
    current_question: "age",
    progress_percent: 25,
    answers: { preferred_language: "ru", age: "22" },
    processedUpdateIds: []
  };

  const result = await handleTelegramUpdate(commandUpdate("/start@castingform_bot", 4510), {
    sessions: {
      async getSession() { return session; },
      async saveSession() { saved = true; }
    },
    sheets: { async reset() { throw new Error("Start menu must not reset Sheets"); } },
    telegram: {
      async sendMessage(chatId, text, replyMarkup) {
        sent.push({ chatId, text, replyMarkup });
      }
    },
    env: baseEnv(),
    waitUntil() {}
  });

  assert.deepEqual(result, { menu: "in_progress" });
  assert.equal(saved, false);
  assert.equal(session.current_question, "age");
  assert.equal(session.answers.age, "22");
  assert.equal(sent[0].replyMarkup.inline_keyboard[0][0].callback_data, "ctl:continue");
});

test("Telegram MenuButtonCommands setup configures menu commands", async () => {
  const calls = [];
  await setupTelegramMenuButton({
    async setChatMenuButton(chatId, menuButton) {
      calls.push({ method: "setChatMenuButton", chatId, menuButton });
    },
    async setMyCommands(commands, options) {
      calls.push({ method: "setMyCommands", commands, options });
    }
  });

  assert.deepEqual(calls[0], {
    method: "setChatMenuButton",
    chatId: null,
    menuButton: { type: "commands" }
  });
  const commandCalls = calls.filter((call) => call.method === "setMyCommands");
  assert.equal(commandCalls.length, 3);
  assert.ok(commandCalls.every((call) => call.commands.some((command) => command.command === "menu")));
  assert.ok(commandCalls.some((call) => call.options.language_code === "en" && call.commands[0].description === "Menu"));
  assert.ok(commandCalls.some((call) => call.options.language_code === "ru" && call.commands[0].description === "Меню"));
});

function sampleHandlerAnswer(question) {
  if (question.id === "preferred_language") return "ru";
  if (question.id === "email") return "candidate@example.com";
  if (question.id === "age") return "22";
  if (question.id === "height_cm") return "170";
  if (question.id === "weight_kg") return "55";
  if (question.id === "onlyfans_registered_pages") return "1";
  if (question.id === "onlyfans_accessible_pages") return "1";
  if (question.id === "payment_accounts_registered") return "Skrill";
  if (question.id === "payment_accounts_access") return "Skrill";
  if (question.id === "traffic_sources") return "Instagram";
  if (question.type === "integer") return "1";
  if (question.type === "multi") return question.options.find((option) => option.id !== "none")?.label.ru || question.options[0].id;
  if (question.type === "single") return question.options[0].id;
  return "Тестовый ответ";
}

function duplicates(values) {
  const seen = new Set();
  const repeated = new Set();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return Array.from(repeated);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mockSessions(session) {
  return {
    async getSession() {
      return {
        telegram_id: "456",
        processedUpdateIds: [],
        ...session
      };
    },
    async saveSession(nextSession) {
      return nextSession;
    }
  };
}

function messageUpdate(text, updateId) {
  return {
    update_id: updateId,
    message: {
      text,
      chat: { id: 123 },
      from: {
        id: 456,
        username: "candidate",
        first_name: "Candidate"
      }
    }
  };
}

function commandUpdate(text, updateId) {
  return {
    update_id: updateId,
    message: {
      text,
      entities: [{ type: "bot_command", offset: 0, length: text.split(/\s+/, 1)[0].length }],
      chat: { id: 123 },
      from: {
        id: 456,
        username: "candidate",
        first_name: "Candidate"
      }
    }
  };
}

function callbackUpdate(data, updateId) {
  return {
    update_id: updateId,
    callback_query: {
      id: `callback-${updateId}`,
      data,
      message: {
        message_id: 10,
        chat: { id: 123 }
      },
      from: {
        id: 456,
        username: "candidate",
        first_name: "Candidate"
      }
    }
  };
}

function attachmentUpdate(type, updateId) {
  const attachmentPayloads = {
    photo: [{ file_id: "photo-file-id", file_unique_id: "photo-unique-id" }],
    document: { file_id: "document-file-id", file_unique_id: "document-unique-id", file_name: "secret.pdf" },
    video: { file_id: "video-file-id", file_unique_id: "video-unique-id" },
    voice: { file_id: "voice-file-id", file_unique_id: "voice-unique-id" }
  };
  return {
    update_id: updateId,
    message: {
      [type]: attachmentPayloads[type],
      chat: { id: 123 },
      from: {
        id: 456,
        username: "candidate",
        first_name: "Candidate"
      }
    }
  };
}

function baseEnv() {
  return {
    TELEGRAM_ADMIN_CHAT_ID: "admin",
    BOT_USERNAME: "castingform_bot",
    HR_TELEGRAM_URL: "https://t.me/elize_cherry",
    CASES_TELEGRAM_URL: "https://t.me/queendom_agency"
  };
}
