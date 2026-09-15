const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("Google Sheets Russian headers map internal keys without renaming fields", () => {
  const code = fs.readFileSync(path.join(__dirname, "../google-apps-script/Code.gs"), "utf8");
  const expected = {
    citizenship_region: "Гражданство / регион",
    current_city: "Текущий город",
    phone_model: "Модель телефона",
    english_level: "Уровень английского",
    english_courses: "Готовность учить английский",
    additional_languages: "Дополнительные языки",
    hours_per_day: "Сколько часов в день готова уделять",
    lead_source_answer: "Откуда узнала о нас",
    how_feeling: "Самочувствие / настроение",
    height_cm: "Рост, см",
    onlyfans_account_bans: "Баны OnlyFans-аккаунтов",
    payment_account_bans: "Блокировки платежных аккаунтов",
    team_preferences: "Что важно в команде"
  };

  for (const [field, title] of Object.entries(expected)) {
    assert.match(code, new RegExp(`${field}: '${escapeRegExp(title)}'`));
    assert.match(code, new RegExp(`'${field}'`));
  }

  assert.match(code, /findExistingHeaderIndex\(currentHeaders, internalHeader\)/);
  assert.match(code, /header === internalHeader \|\| header === displayHeader/);
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
