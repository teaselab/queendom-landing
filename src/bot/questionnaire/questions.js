const SKIPPED_BY_LOGIC = "SKIPPED_BY_LOGIC";
const SKIPPED = "SKIPPED";

const L = (ua, en, ru) => ({ ua, en, ru });
const opt = (id, ua, en, ru, extra = {}) => ({ id, label: L(ua, en, ru), ...extra });

const yesNo = [
  opt("yes", "Так", "Yes", "Да"),
  opt("no", "Ні", "No", "Нет")
];

const yesNoDiscuss = [
  opt("yes", "✅ Так", "✅ Yes", "✅ Да"),
  opt("no", "❌ Ні", "❌ No", "❌ Нет"),
  opt("discuss", "💬 Обговорюється", "💬 Discussable", "💬 Обсуждается")
];

const sections = [
  L("Основна інформація", "Basic information", "Основная информация"),
  L("Мови та фінансові очікування", "Languages and financial expectations", "Языки и финансовые ожидания"),
  L("Про себе та параметри", "About you and parameters", "О себе и параметры"),
  L("Обладнання та матеріали", "Equipment and materials", "Оборудование и материалы"),
  L("Досвід і бекграунд", "Experience and background", "Опыт и бэкграунд"),
  L("OnlyFans та платіжні системи", "OnlyFans and payment systems", "OnlyFans и платежные системы"),
  L("Соцмережі та трафік", "Social media and traffic", "Соцсети и трафик"),
  L("Межі контенту та фінальні питання", "Content boundaries and final questions", "Границы контента и финальные вопросы")
];

const questions = [
  q("preferred_language", "q01", 1, "single", true, L("Оберіть мову / Choose language / Выберите язык", "Оберіть мову / Choose language / Выберите язык", "Оберіть мову / Choose language / Выберите язык"), [
    opt("ua", "🇺🇦 Українська", "🇺🇦 Ukrainian", "🇺🇦 Украинский"),
    opt("en", "🇬🇧 English", "🇬🇧 English", "🇬🇧 English"),
    opt("ru", "🇷🇺 Русский", "🇷🇺 Russian", "🇷🇺 Русский")
  ]),
  q("email", "q02", 1, "text", true, L("Електронна адреса", "Email address", "Электронная почта"), null, { validate: "email" }),
  q("name", "q03", 1, "text", true, L("Ім'я", "Name", "Имя")),
  q("age", "q04", 1, "integer", true, L("Вік", "Age", "Возраст"), null, { min: 1, max: 99 }),
  q("tg_username", "q05", 1, "text", true, L("ТГ юзернейм", "Telegram username", "Telegram username"), null, { suggestTelegramUsername: true }),
  q("instagram", "q06", 1, "text", false, L("Insta", "Instagram", "Instagram")),
  q("tiktok", "q07", 1, "text", false, L("Tik-Tok", "TikTok", "TikTok")),
  q("citizenship_region", "q08", 1, "text", true, L("Громадянство та область прописки", "Citizenship and registered region", "Гражданство и область прописки")),
  q("current_city", "q09", 1, "text", true, L("Місто проживання зараз", "Current city", "Город проживания сейчас")),
  q("phone_model", "q10", 1, "text", true, L("Модель телефону", "Phone model", "Модель телефона")),

  q("english_level", "q11", 2, "single", true, L("Рівень англійської за шкалою від 1 до 10", "English level from 1 to 10", "Уровень английского от 1 до 10"), Array.from({ length: 10 }, (_, i) => opt(String(i + 1), String(i + 1), String(i + 1), String(i + 1)))),
  q("english_courses", "q12", 2, "single", true, L("Готовність підвищити рівень англійської, якщо агентство оплачує курси", "Would you improve English if the agency pays for courses?", "Готовность улучшать английский, если агентство оплачивает курсы"), yesNoDiscuss),
  q("additional_languages", "q13", 2, "text", false, L("Вкажіть додаткові мови, які знаєте, та рівень володіння", "List other languages you know and your level", "Укажи дополнительные языки и уровень владения")),
  q("expected_income_month1", "q14", 2, "text", true, L("Очікуваний дохід у першому місяці", "Expected income in the first month", "Ожидаемый доход в первый месяц")),
  q("expected_payment_model", "q15", 2, "text", true, L("Очікувана модель оплати: відсоток / ставка / ріст окладу. Який саме формат та цифри ти очікуєш?", "Expected payment model: percent / fixed rate / salary growth. What format and numbers do you expect?", "Ожидаемая модель оплаты: процент / ставка / рост оклада. Какой формат и цифры ожидаешь?")),
  q("expected_income_future", "q16", 2, "text", true, L("Очікуваний дохід у перспективі", "Expected income in the future", "Ожидаемый доход в перспективе")),
  q("hours_per_day", "q17", 2, "text", true, L("Скільки годин готова працювати на день?", "How many hours per day are you ready to work?", "Сколько часов в день готова работать?")),

  q("lead_source_answer", "q18", 3, "text", true, L("Як ти до нас потрапила? Дуже цікаво знати 🥰", "How did you find us? We are curious 🥰", "Как ты к нам попала? Очень интересно 🥰")),
  q("how_feeling", "q19", 3, "text", true, L("Як почуваєшся?", "How are you feeling?", "Как себя чувствуешь?")),
  q("height_cm", "q20", 3, "integer", true, L("Зріст (см)", "Height (cm)", "Рост (см)"), null, { min: 100, max: 220 }),
  q("weight_kg", "q21", 3, "integer", true, L("Вага (кг)", "Weight (kg)", "Вес (кг)"), null, { min: 30, max: 250 }),
  q("breast_size", "q22", 3, "text", true, L("Розмір грудей", "Breast size", "Размер груди")),
  q("measurements", "q23", 3, "text", false, L("Параметри: груди / талія / стегна", "Measurements: bust / waist / hips", "Параметры: грудь / талия / бедра")),
  q("hair_color", "q24", 3, "text", true, L("Ваш природний колір волосся та теперішній, якщо змінили", "Your natural hair color and current color if changed", "Ваш натуральный цвет волос и текущий, если изменили")),
  q("body_features", "q25", 3, "text", false, L("Наявність шрамів / татуювань / пірсингу / сильної асиметрії - вкажіть, якщо є", "Scars / tattoos / piercing / strong asymmetry - mention if any", "Шрамы / татуировки / пирсинг / сильная асимметрия - укажите, если есть")),

  q("equipment", "q26", 4, "text", true, L("Обладнання для зйомки: фотоапарат / штатив / кільцева лампа / софтбокси / інше / нема", "Shooting equipment: camera / tripod / ring light / softboxes / other / none", "Оборудование для съемки: камера / штатив / кольцевая лампа / софтбоксы / другое / нет")),
  q("lingerie", "q27", 4, "text", true, L("Наявність білизни, чулків та костюмів. Вкажіть приблизну кількість комплектів/предметів.", "Lingerie, stockings and costumes. Approximate number of sets/items.", "Наличие белья, чулок и костюмов. Укажите примерное количество.")),
  q("adult_toys", "q28", 4, "text", true, L("Наявність 18+ іграшок. Вкажіть список або напишіть «нема».", "Adult toys. List them or write none.", "Наличие 18+ игрушек. Укажите список или напишите «нет».")),

  q("adult_experience", "q29", 5, "text", true, L("Досвід у сфері Adult - де працювала та скільки часу?", "Adult industry experience - where and for how long?", "Опыт в Adult - где работала и сколько времени?")),
  q("agency_experience", "q30", 5, "text", true, L("Досвід роботи з агентствами: період, формат співпраці та причина завершення.", "Agency experience: period, cooperation format and reason for ending.", "Опыт работы с агентствами: период, формат и причина завершения."), null, { showIf: (a) => !hasNoAdultExperience(a.adult_experience) }),
  q("ready_content", "q31", 5, "text", true, L("Наявність готового контенту. Опиши: фото / відео / паки та приблизну кількість.", "Ready content. Describe photos / videos / packs and approximate quantity.", "Наличие готового контента. Опиши фото / видео / паки и примерное количество.")),
  q("adult_content_available", "q32", 5, "text", true, L("Наявність готового 18+ контенту: фото, відео, паки для секстингу. Опиши приблизну кількість та види.", "Ready 18+ content: photos, videos, sexting packs. Approximate amount and types.", "Наличие готового 18+ контента: фото, видео, паки для секстинга. Примерное количество и виды.")),

  q("onlyfans_registered", "q33", 6, "single", true, L("Чи реєструвалися Ви раніше на OnlyFans?", "Have you registered on OnlyFans before?", "Регистрировались ли вы раньше на OnlyFans?"), yesNo),
  q("onlyfans_registered_pages", "q34", 6, "integer", true, L("Скільки сторінок ви реєстрували та проходили верифікацію на OnlyFans?", "How many OnlyFans pages have you registered and verified?", "Сколько страниц OnlyFans вы регистрировали и верифицировали?"), null, { min: 0, showIf: (a) => a.onlyfans_registered === "yes" }),
  q("onlyfans_accessible_pages", "q35", 6, "integer", true, L("Скільки сторінок OnlyFans зараз мають повний доступ з вашого боку?\n\nНе надсилай логіни, паролі, email, 2FA або коди. Нам потрібно тільки число.", "How many OnlyFans pages do you currently fully access?\n\nDo not send logins, passwords, email, 2FA or codes. We only need a number.", "К скольким страницам OnlyFans у вас сейчас есть полный доступ?\n\nНе отправляйте логины, пароли, email, 2FA или коды. Нужно только число."), null, { min: 0, showIf: (a) => a.onlyfans_registered === "yes" }),
  q("onlyfans_account_bans", "q36", 6, "single", true, L("Чи були коли-небудь блокування або бани ваших OnlyFans-акаунтів?", "Have your OnlyFans accounts ever been blocked or banned?", "Были ли когда-либо блокировки или баны ваших OnlyFans-аккаунтов?"), [
    opt("yes", "Так", "Yes", "Да"),
    opt("no", "Ні", "No", "Нет"),
    opt("unknown", "Не знаю", "I do not know", "Не знаю")
  ], { showIf: (a) => a.onlyfans_registered === "yes" }),
  q("payment_accounts_registered", "q37", 6, "multi", true, L("Чи реєстрували ви коли-небудь акаунти в Skrill, Paxum або Cosmo?", "Have you ever registered accounts in Skrill, Paxum or Cosmo?", "Регистрировали ли вы когда-нибудь аккаунты в Skrill, Paxum или Cosmo?"), [
    opt("sk", "Skrill", "Skrill", "Skrill"),
    opt("px", "Paxum", "Paxum", "Paxum"),
    opt("cs", "Cosmo", "Cosmo", "Cosmo"),
    opt("none", "Нічого з переліченого", "None of these", "Ничего из перечисленного")
  ]),
  q("payment_accounts_access", "q38", 6, "multi", true, L("До яких із зазначених платіжних акаунтів ви зараз маєте повний доступ?\n\nНіколи не надсилай пароль або код.", "Which selected payment accounts do you currently fully access?\n\nNever send a password or code.", "К каким из этих платёжных аккаунтов у вас сейчас есть доступ?\n\nНикогда не отправляйте пароль или код."), [
    opt("sk", "Skrill", "Skrill", "Skrill"),
    opt("px", "Paxum", "Paxum", "Paxum"),
    opt("cs", "Cosmo", "Cosmo", "Cosmo")
  ], {
    showIf: (a) => hasAnyPaymentAccount(a.payment_accounts_registered),
    getOptions: (answers, question) => {
      const selected = selectedValues(answers.payment_accounts_registered);
      return (question.options || []).filter((option) => selected.includes(option.id));
    }
  }),
  q("payment_account_bans", "q38b", 6, "single", true, L("Чи були коли-небудь блокування або обмеження цих платіжних акаунтів?", "Have these payment accounts ever had blocks or restrictions?", "Были ли когда-либо блокировки или ограничения этих платёжных аккаунтов?"), [
    opt("yes", "Так", "Yes", "Да"),
    opt("no", "Ні", "No", "Нет"),
    opt("unknown", "Не знаю", "I do not know", "Не знаю")
  ], { showIf: (a) => hasAnyPaymentAccount(a.payment_accounts_registered) }),
  q("agency_access_readiness", "q39", 6, "single", true, L("Чи готові ви, за необхідності, обговорити підключення наявних робочих сторінок та платіжної інфраструктури до процесів агентства?", "If needed, are you ready to discuss connecting existing work pages and payment infrastructure to agency processes?", "Готовы ли вы при необходимости обсудить подключение рабочих страниц и платежной инфраструктуры к процессам агентства?"), yesNoDiscuss, { showIf: hasConnectableInfrastructure }),

  q("active_promo_socials", "q40", 7, "single", true, L("Чи маєте ви активні робочі соцмережі для просування OnlyFans?", "Do you have active work social media for OnlyFans promotion?", "Есть ли активные рабочие соцсети для продвижения OnlyFans?"), yesNo),
  q("active_promo_socials_details", "q40d", 7, "text", true, L("Які саме? Можеш вказати назви або посилання.", "Which ones? You can add names or links.", "Какие именно? Можно указать названия или ссылки."), null, { showIf: (a) => a.active_promo_socials === "yes" }),
  q("traffic_sources", "q41", 7, "multi", true, L("Джерела трафіку, які ви вже використовували", "Traffic sources you have already used", "Источники трафика, которые вы уже использовали"), [
    opt("tt", "TikTok", "TikTok", "TikTok"),
    opt("rd", "Reddit", "Reddit", "Reddit"),
    opt("x", "Twitter / X", "Twitter / X", "Twitter / X"),
    opt("ig", "Instagram", "Instagram", "Instagram"),
    opt("yt", "YouTube", "YouTube", "YouTube"),
    opt("oth", "Інше", "Other", "Другое"),
    opt("none", "Нічого не використовувала", "None", "Ничего не использовала")
  ]),
  q("traffic_sources_other", "q41o", 7, "text", true, L("Опиши інші джерела трафіку.", "Describe the other traffic sources.", "Опиши другие источники трафика."), null, { showIf: (a) => includesValue(a.traffic_sources, "oth") }),

  q("content_feet", "q42", 8, "single", true, L("Фото / відео ніг", "Feet photos / videos", "Фото / видео ног"), yesNoDiscuss, { introKey: "boundariesIntro" }),
  q("content_closeups", "q43", 8, "single", true, L("Фото / відео грудей / попи / інтимної зони крупним планом", "Close-up photos / videos of breasts / butt / intimate area", "Фото / видео груди / попы / интимной зоны крупным планом"), yesNoDiscuss),
  q("content_masturbation", "q44", 8, "single", true, L("Мастурбація", "Masturbation", "Мастурбация"), yesNoDiscuss),
  q("explicit_solo_gate", "q44g", 8, "single", true, L("Чи готова ти окремо обговорювати більш відверті соло-формати контенту?", "Are you open to separately discussing more explicit solo content formats?", "Готова ли отдельно обсуждать более откровенные соло-форматы контента?"), yesNoDiscuss, {
    showIf: (a) => a.content_masturbation === "no",
    autoAnswerIf: (a) => ["yes", "discuss"].includes(a.content_masturbation) ? "discuss" : null
  }),
  q("content_paid_call", "q45", 8, "single", true, L("Інколи дзвінок з найкращим фанатом за окрему плату", "Occasional call with a top fan for extra payment", "Иногда звонок с лучшим фанатом за отдельную оплату"), yesNoDiscuss),
  q("content_toy_oral", "q46", 8, "single", true, L("Інтимний контент з іграшкою", "Intimate content with a toy", "Интимный контент с игрушкой"), yesNoDiscuss, { showIf: (a) => a.explicit_solo_gate !== "no" }),
  q("partner_content_gate", "q46g", 8, "single", true, L("Чи розглядаєш ти взагалі контент з іншими людьми?", "Do you consider content with other people at all?", "Рассматриваешь ли ты вообще контент с другими людьми?"), yesNoDiscuss),
  q("content_duo_girl", "q47", 8, "single", true, L("Дуо - контент з дівчиною", "Duo content with a girl", "Дуо - контент с девушкой"), yesNoDiscuss, { showIf: (a) => a.partner_content_gate !== "no" }),
  q("content_duo_guy", "q48", 8, "single", true, L("Дуо - контент з хлопцем", "Duo content with a guy", "Дуо - контент с парнем"), yesNoDiscuss, { showIf: (a) => a.partner_content_gate !== "no" }),
  q("permanent_partner", "q48p", 8, "single", true, L("Чи є у тебе постійний партнер, з яким потенційно можливі зйомки?", "Do you have a permanent partner for potential shoots?", "Есть ли постоянный партнер, с которым потенциально возможны съемки?"), yesNoDiscuss, { showIf: (a) => ["yes", "discuss"].includes(a.content_duo_guy) }),
  q("content_trio", "q49", 8, "single", true, L("Тріо", "Trio", "Трио"), yesNoDiscuss, { showIf: (a) => a.partner_content_gate !== "no" }),
  q("content_anal", "q50", 8, "single", true, L("Анал", "Anal", "Анал"), yesNoDiscuss, { showIf: (a) => a.explicit_solo_gate !== "no" && a.content_toy_oral !== "no" }),
  q("us_social_posting", "q51", 8, "single", true, L("Постинг у наших соцмережах з орієнтацією лише на США", "Posting in our social media targeted only to the US", "Постинг в наших соцсетях с ориентацией только на США"), yesNoDiscuss),
  q("streaming_promo", "q52", 8, "single", true, L("Чи готові ви за додаткову оплату проводити трансляції на стрімінгових сервісах (наприклад, ChatRoulette та подібних) для залучення підписників?", "Are you ready, for extra payment, to stream on services to attract subscribers?", "Готовы ли за доплату проводить трансляции на стриминговых сервисах для привлечения подписчиков?"), yesNoDiscuss),
  q("pornhub_reels", "q53", 8, "single", true, L("Постинг коротких промо-відео на Pornhub", "Posting short promo videos on Pornhub", "Постинг коротких промо-видео на Pornhub"), yesNoDiscuss),
  q("other_taboos", "q54", 8, "text", true, L("Інші табу або формати, які для тебе точно неприйнятні.\n\nНапиши, будь ласка, повний список.", "Other taboos or formats that are definitely unacceptable for you.\n\nPlease write the full list.", "Другие табу или форматы, которые для тебя точно неприемлемы.\n\nНапиши, пожалуйста, полный список.")),
  q("about_candidate", "q55", 8, "text", true, L("Що нам важливо знати про тебе?\n\nПоділися будь-якими нюансами, рисами характеру чи особливостями, які допоможуть нам краще зрозуміти тебе.", "What is important for us to know about you?\n\nShare any nuances, character traits or details that can help us understand you better.", "Что нам важно знать о тебе?\n\nПоделись нюансами, чертами характера или особенностями, которые помогут лучше тебя понять.")),
  q("team_preferences", "q56", 8, "text", true, L("Що для тебе важливо в команді? З ким тобі комфортно працювати?", "What matters to you in a team? Who are you comfortable working with?", "Что для тебя важно в команде? С кем тебе комфортно работать?"))
];

function q(id, shortId, section, type, required, text, options = null, extra = {}) {
  return { id, field: id, shortId, section, type, required, text, options, ...extra };
}

function includesValue(value, needle) {
  return selectedValues(value).includes(needle);
}

function hasAnyPaymentAccount(value) {
  const selected = selectedValues(value);
  return selected.length > 0 && !selected.includes("none");
}

function hasConnectableInfrastructure(answers) {
  return Number(answers.onlyfans_accessible_pages || 0) > 0 || hasAnyPaymentAccount(answers.payment_accounts_registered);
}

function hasNoAdultExperience(answer) {
  const value = String(answer || "").trim().toLowerCase().replace(/[.!?,;:]+$/g, "");
  return [
    "нет",
    "не было",
    "без опыта",
    "никогда",
    "не работала",
    "0",
    "ні",
    "не було",
    "без досвіду",
    "ніколи",
    "не працювала",
    "no",
    "none",
    "no experience",
    "never",
    "never worked"
  ].includes(value);
}

function selectedValues(value) {
  if (Array.isArray(value)) return value;
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

const questionById = new Map(questions.map((question) => [question.id, question]));
const questionByShortId = new Map(questions.map((question) => [question.shortId, question]));

module.exports = {
  SKIPPED_BY_LOGIC,
  SKIPPED,
  questions,
  sections,
  questionById,
  questionByShortId,
  yesNoDiscuss,
  hasAnyPaymentAccount,
  hasNoAdultExperience
};
