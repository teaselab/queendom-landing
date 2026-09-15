const { parseInteger } = require("./validation");

function calculateLeadScore(answers = {}) {
  const age = parseInteger(String(answers.age ?? ""));
  if (age == null || age < 18) return 0;

  let score = 0;
  if (answers.instagram) score += 1;
  if (answers.tiktok) score += 1;
  if (Number(answers.english_level) >= 5) score += 1;
  if (hasMeaningfulText(answers.adult_experience)) score += 2;
  if (hasMeaningfulText(answers.ready_content)) score += 2;
  if (answers.onlyfans_registered === "yes") score += 2;
  if (Number.parseFloat(answers.hours_per_day) >= 2) score += 1;
  return score;
}

function hasMeaningfulText(value) {
  if (!value) return false;
  const text = String(value).trim().toLowerCase();
  return text.length > 2 && !["ні", "нет", "no", "none", "нема", "немає"].includes(text);
}

module.exports = { calculateLeadScore };
