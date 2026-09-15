const test = require("node:test");
const assert = require("node:assert/strict");
const { answerCurrentQuestion, getFirstQuestion, getNextRelevantQuestion, getPreviousRelevantQuestion, getQuestion, getQuestionOptions, parseMultiSelectText, toggleMultiValue } = require("../src/bot/questionnaire/engine");
const { questions } = require("../src/bot/questionnaire/questions");

function state(current_question, answers = {}) {
  return { current_question, answers, status: "IN_PROGRESS" };
}

function sampleAnswer(question) {
  if (question.id === "preferred_language") return "ua";
  if (question.id === "email") return "candidate@example.com";
  if (question.id === "age") return "22";
  if (question.id === "height_cm") return "170";
  if (question.id === "weight_kg") return "55";
  if (question.id === "onlyfans_registered_pages") return "1";
  if (question.id === "onlyfans_accessible_pages") return "1";
  if (question.type === "integer") return "1";
  if (question.type === "multi") return question.id === "payment_accounts_registered" ? "sk" : "tt,ig";
  if (question.type === "single") return question.options[0].id;
  return "Тестова відповідь";
}

test("TEST 1: new user passes the questionnaire and reaches COMPLETED", () => {
  assert.equal(getFirstQuestion().id, "preferred_language");

  let current = getFirstQuestion().id;
  let answers = {};
  let result = null;
  let guard = 0;
  const visited = new Set();

  while (current && guard < 90) {
    assert.equal(visited.has(current), false, `question repeated: ${current}`);
    visited.add(current);
    const question = getQuestion(current);
    result = answerCurrentQuestion(state(current, answers), current, sampleAnswer(question));
    assert.equal(result.ok, true, `question failed: ${current}`);
    answers = result.answers;
    current = result.current_question;
    guard += 1;
  }

  assert.equal(result.status, "COMPLETED");
  assert.equal(result.completed, true);
  assert.ok(guard >= 40);
});

test("TEST 2: age 17 is rejected before adult questions", () => {
  const result = answerCurrentQuestion(state("age", {}), "age", "17");
  assert.equal(result.status, "AGE_REJECTED");
  assert.equal(result.current_question, "");
});

test("TEST 3: OnlyFans no skips registered/access pages", () => {
  const result = answerCurrentQuestion(state("onlyfans_registered", {}), "onlyfans_registered", "no");
  assert.equal(result.answers.onlyfans_registered_pages, "SKIPPED_BY_LOGIC");
  assert.equal(result.answers.onlyfans_accessible_pages, "SKIPPED_BY_LOGIC");
  assert.equal(result.answers.onlyfans_account_bans, "SKIPPED_BY_LOGIC");
  assert.equal(result.current_question, "payment_accounts_registered");
});

test("TEST 4: payment access is skipped when no payment accounts were registered", () => {
  const result = answerCurrentQuestion(state("payment_accounts_registered", {}), "payment_accounts_registered", "none");
  assert.equal(result.answers.payment_accounts_access, "SKIPPED_BY_LOGIC");
  assert.equal(result.answers.payment_account_bans, "SKIPPED_BY_LOGIC");
  assert.equal(result.answers.agency_access_readiness, "SKIPPED_BY_LOGIC");
  assert.equal(result.current_question, "active_promo_socials");
});

test("Q38 shows only payment systems selected in Q37", () => {
  const question = getQuestion("payment_accounts_access");
  const options = getQuestionOptions(question, { payment_accounts_registered: "px,cs" }).map((option) => option.id);
  assert.deepEqual(options, ["px", "cs"]);
});

test("adult_experience with no experience skips agency_experience only for clear no-experience text", () => {
  const noExperience = answerCurrentQuestion(state("adult_experience", {}), "adult_experience", "без опыта");
  assert.equal(noExperience.answers.agency_experience, "SKIPPED_BY_LOGIC");
  assert.equal(noExperience.current_question, "ready_content");

  const smallExperience = answerCurrentQuestion(state("adult_experience", {}), "adult_experience", "небольшой опыт 2 месяца");
  assert.equal(smallExperience.current_question, "agency_experience");
});

test("OnlyFans yes shows pages, accessible pages and OnlyFans bans before payment accounts", () => {
  const registered = answerCurrentQuestion(state("onlyfans_registered", {}), "onlyfans_registered", "yes");
  assert.equal(registered.current_question, "onlyfans_registered_pages");

  const pages = answerCurrentQuestion(state("onlyfans_registered_pages", registered.answers), "onlyfans_registered_pages", "2");
  assert.equal(pages.current_question, "onlyfans_accessible_pages");

  const accessible = answerCurrentQuestion(state("onlyfans_accessible_pages", pages.answers), "onlyfans_accessible_pages", "1");
  assert.equal(accessible.current_question, "onlyfans_account_bans");

  const bans = answerCurrentQuestion(state("onlyfans_account_bans", accessible.answers), "onlyfans_account_bans", "no");
  assert.equal(bans.current_question, "payment_accounts_registered");
});

test("payment systems go registered -> access -> payment bans -> agency readiness", () => {
  const registered = answerCurrentQuestion(state("payment_accounts_registered", {}), "payment_accounts_registered", "px,cs");
  assert.equal(registered.current_question, "payment_accounts_access");

  const access = answerCurrentQuestion(state("payment_accounts_access", registered.answers), "payment_accounts_access", "px");
  assert.equal(access.current_question, "payment_account_bans");

  const bans = answerCurrentQuestion(state("payment_account_bans", access.answers), "payment_account_bans", "unknown");
  assert.equal(bans.current_question, "agency_access_readiness");
});

test("TEST 5: masturbation no asks explicit gate, gate no skips explicit solo questions", () => {
  const gate = answerCurrentQuestion(state("content_masturbation", {}), "content_masturbation", "no");
  assert.equal(gate.current_question, "explicit_solo_gate");

  const afterGate = answerCurrentQuestion(state("explicit_solo_gate", gate.answers), "explicit_solo_gate", "no");
  assert.equal(afterGate.current_question, "content_paid_call");

  const afterPaidCall = answerCurrentQuestion(state("content_paid_call", afterGate.answers), "content_paid_call", "yes");
  assert.equal(afterPaidCall.answers.content_toy_oral, "SKIPPED_BY_LOGIC");
  assert.equal(afterPaidCall.current_question, "partner_content_gate");

  const afterPartnerGate = answerCurrentQuestion(state("partner_content_gate", afterPaidCall.answers), "partner_content_gate", "no");
  assert.equal(afterPartnerGate.answers.content_anal, "SKIPPED_BY_LOGIC");
});

test("TEST 6: partner gate no skips duo and trio questions", () => {
  const result = answerCurrentQuestion(state("partner_content_gate", { explicit_solo_gate: "no" }), "partner_content_gate", "no");
  assert.equal(result.answers.content_duo_girl, "SKIPPED_BY_LOGIC");
  assert.equal(result.answers.content_duo_guy, "SKIPPED_BY_LOGIC");
  assert.equal(result.answers.content_trio, "SKIPPED_BY_LOGIC");
  assert.equal(result.current_question, "us_social_posting");
});

test("Section 8 skips anal when toy content is no", () => {
  const toy = answerCurrentQuestion(state("content_toy_oral", { explicit_solo_gate: "yes" }), "content_toy_oral", "no");
  assert.equal(toy.current_question, "partner_content_gate");

  const partner = answerCurrentQuestion(state("partner_content_gate", toy.answers), "partner_content_gate", "no");
  assert.equal(partner.answers.content_anal, "SKIPPED_BY_LOGIC");
  assert.equal(partner.current_question, "us_social_posting");
});

test("Section 8 shows anal when toy content is yes", () => {
  const toy = answerCurrentQuestion(state("content_toy_oral", { explicit_solo_gate: "yes" }), "content_toy_oral", "yes");
  const partner = answerCurrentQuestion(state("partner_content_gate", toy.answers), "partner_content_gate", "no");
  assert.equal(partner.current_question, "content_anal");
});

test("TEST 7: saved current_question can resume after stateless restart", () => {
  const saved = state("current_city", { preferred_language: "ua", email: "a@example.com" });
  const next = getNextRelevantQuestion("current_city", saved.answers);
  assert.equal(saved.current_question, "current_city");
  assert.equal(next.question.id, "phone_model");
});

test("TEST 8: back finds previous visible question", () => {
  const previous = getPreviousRelevantQuestion("current_city", { preferred_language: "ua" });
  assert.equal(previous.id, "citizenship_region");
});

test("TEST 9: multi-select toggles values idempotently", () => {
  const question = { id: "traffic_sources" };
  let value = toggleMultiValue(question, "", "tt");
  value = toggleMultiValue(question, value, "ig");
  assert.equal(value, "tt,ig");
  value = toggleMultiValue(question, value, "tt");
  assert.equal(value, "ig");
});

test("multi-select text parser recognizes payment systems and none phrases", () => {
  const question = getQuestion("payment_accounts_registered");
  const cases = [
    ["нет", "none"],
    ["не регистрировала", "none"],
    ["ні", "none"],
    ["no", "none"],
    ["Skrill", "sk"],
    ["Skrill и Paxum", "sk,px"],
    ["есть Paxum", "px"],
    ["нет, только Paxum", "px"]
  ];

  for (const [text, expected] of cases) {
    assert.deepEqual(parseMultiSelectText(question, text), { ok: true, value: expected });
  }
});

test("ambiguous multi-select text is not guessed", () => {
  assert.equal(parseMultiSelectText(getQuestion("payment_accounts_registered"), "не помню").ok, false);
});

test("traffic sources support none and text parsing", () => {
  const question = getQuestion("traffic_sources");
  assert.deepEqual(parseMultiSelectText(question, "нет"), { ok: true, value: "none" });
  assert.deepEqual(parseMultiSelectText(question, "не использовала"), { ok: true, value: "none" });
  assert.deepEqual(parseMultiSelectText(question, "Instagram и TikTok"), { ok: true, value: "tt,ig" });
  assert.deepEqual(parseMultiSelectText(question, "нет, только Instagram"), { ok: true, value: "ig" });
});

test("traffic sources none is mutually exclusive in button toggles", () => {
  const question = getQuestion("traffic_sources");
  assert.equal(toggleMultiValue(question, "tt,ig", "none"), "none");
  assert.equal(toggleMultiValue(question, "none", "ig"), "ig");
});

test("TEST 10: admin notification is outside the pure engine", () => {
  const mid = answerCurrentQuestion(state("team_preferences", { age: 20 }), "team_preferences", "Kind team");
  assert.equal(mid.completed, true);
  assert.equal(mid.status, "COMPLETED");
});

test("TEST 11: explicit gate auto-fills when masturbation is yes/discuss", () => {
  const result = answerCurrentQuestion(state("content_masturbation", {}), "content_masturbation", "yes");
  assert.equal(result.answers.explicit_solo_gate, "discuss");
  assert.equal(result.current_question, "content_paid_call");
});

test("questionnaire integrity: ids, shortIds, sections, options and ordering are valid", () => {
  assertUnique(questions.map((question) => question.id), "question.id");
  assertUnique(questions.map((question) => question.shortId), "question.shortId");

  for (const question of questions) {
    assert.ok(question.section >= 1 && question.section <= 8, `${question.id} section out of range`);
    if (["single", "multi"].includes(question.type)) {
      assert.ok(Array.isArray(question.options), `${question.id} options missing`);
      assert.ok(question.options.length > 0, `${question.id} options empty`);
      assertUnique(question.options.map((option) => option.id), `${question.id} option.id`);
      for (const option of question.options) {
        assert.ok(option.label.ua && option.label.en && option.label.ru, `${question.id}:${option.id} missing i18n label`);
      }
    }
    if (typeof question.showIf === "function") {
      assert.doesNotThrow(() => question.showIf({}), `${question.id} showIf throws on empty answers`);
    }
  }

  const q55 = questions.filter((question) => question.shortId === "q55");
  assert.equal(q55.length, 1);
  assert.equal(q55[0].id, "about_candidate");

  const q55Index = questions.findIndex((question) => question.shortId === "q55");
  assert.equal(questions[q55Index + 1].shortId, "q56");
  assert.equal(questions[q55Index + 1].id, "team_preferences");

  const last = questions.at(-1);
  assert.equal(last.id, "team_preferences");
  assert.equal(last.shortId, "q56");
});

test("traffic sources has none option and streaming promo UA text names ChatRoulette", () => {
  const trafficOptionIds = getQuestion("traffic_sources").options.map((option) => option.id);
  assert.ok(trafficOptionIds.includes("none"));
  assert.match(getQuestion("streaming_promo").text.ua, /ChatRoulette/);
});

function assertUnique(values, label) {
  const seen = new Set();
  for (const value of values) {
    assert.equal(seen.has(value), false, `${label} is duplicated: ${value}`);
    seen.add(value);
  }
}
