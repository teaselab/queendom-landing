const SECRET_PROPERTY = 'SHEETS_WEBHOOK_SECRET';
const LEADS_SHEET = 'Leads';
const EVENTS_SHEET = 'Events';
const SKIPPED_BY_LOGIC = 'SKIPPED_BY_LOGIC';

const HEADERS = [
  'created_at', 'updated_at', 'completed_at', 'status',
  'telegram_id', 'telegram_username', 'telegram_first_name', 'telegram_last_name',
  'source', 'recruiter', 'current_question', 'progress_percent',
  'preferred_language', 'email', 'name', 'age', 'tg_username', 'instagram', 'tiktok',
  'citizenship_region', 'current_city', 'phone_model',
  'english_level', 'english_courses', 'additional_languages',
  'expected_income_month1', 'expected_payment_model', 'expected_income_future', 'hours_per_day',
  'lead_source_answer', 'how_feeling', 'height_cm', 'weight_kg', 'breast_size', 'measurements',
  'hair_color', 'body_features', 'equipment', 'lingerie', 'adult_toys',
  'adult_experience', 'agency_experience', 'ready_content', 'adult_content_available',
  'onlyfans_registered', 'onlyfans_registered_pages', 'onlyfans_accessible_pages',
  'onlyfans_account_bans', 'payment_accounts_registered', 'payment_accounts_access',
  'payment_account_bans', 'agency_access_readiness',
  'active_promo_socials', 'active_promo_socials_details', 'traffic_sources', 'traffic_sources_other',
  'content_feet', 'content_closeups', 'content_masturbation', 'explicit_solo_gate',
  'content_paid_call', 'content_toy_oral', 'partner_content_gate',
  'content_duo_girl', 'content_duo_guy', 'permanent_partner', 'content_trio', 'content_anal',
  'us_social_posting', 'streaming_promo', 'pornhub_reels', 'other_taboos',
  'about_candidate', 'team_preferences',
  'started_at', 'last_activity_at', 'answers_count', 'skipped_count'
];

const HEADER_TITLES = {
  created_at: 'Дата создания',
  updated_at: 'Дата обновления',
  completed_at: 'Дата заполнения',
  status: 'Статус',
  telegram_id: 'Telegram ID',
  telegram_username: 'Telegram username',
  telegram_first_name: 'Имя в Telegram',
  telegram_last_name: 'Фамилия в Telegram',
  source: 'Источник',
  recruiter: 'Рекрутер',
  current_question: 'Текущий вопрос',
  progress_percent: 'Прогресс, %',
  preferred_language: 'Язык анкеты',
  email: 'Email',
  name: 'Имя',
  age: 'Возраст',
  tg_username: 'Telegram для связи',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  citizenship_region: 'Гражданство / регион',
  current_city: 'Текущий город',
  phone_model: 'Модель телефона',
  english_level: 'Уровень английского',
  english_courses: 'Готовность учить английский',
  additional_languages: 'Дополнительные языки',
  expected_income_month1: 'Ожидаемый доход в первый месяц',
  expected_payment_model: 'Ожидаемая модель оплаты',
  expected_income_future: 'Ожидаемый доход в перспективе',
  hours_per_day: 'Сколько часов в день готова уделять',
  lead_source_answer: 'Откуда узнала о нас',
  how_feeling: 'Самочувствие / настроение',
  height_cm: 'Рост, см',
  weight_kg: 'Вес, кг',
  breast_size: 'Размер груди',
  measurements: 'Параметры фигуры',
  hair_color: 'Цвет волос',
  body_features: 'Шрамы / тату / пирсинг / особенности',
  equipment: 'Оборудование для съемки',
  lingerie: 'Белье / чулки / костюмы',
  adult_toys: '18+ игрушки',
  adult_experience: 'Опыт в Adult',
  agency_experience: 'Опыт работы с агентствами',
  ready_content: 'Готовый контент',
  adult_content_available: 'Готовый 18+ контент',
  onlyfans_registered: 'Была регистрация на OnlyFans',
  onlyfans_registered_pages: 'Сколько страниц OnlyFans регистрировала',
  onlyfans_accessible_pages: 'Сколько страниц OnlyFans доступны сейчас',
  onlyfans_account_bans: 'Баны OnlyFans-аккаунтов',
  payment_accounts_registered: 'Регистрировала Skrill / Paxum / Cosmo',
  payment_accounts_access: 'Доступные платежные аккаунты',
  payment_account_bans: 'Блокировки платежных аккаунтов',
  agency_access_readiness: 'Готовность обсуждать подключение инфраструктуры',
  active_promo_socials: 'Активные соцсети для продвижения',
  active_promo_socials_details: 'Какие активные соцсети',
  traffic_sources: 'Использованные источники трафика',
  traffic_sources_other: 'Другие источники трафика',
  content_feet: 'Контент: фото / видео ног',
  content_closeups: 'Контент: крупные планы',
  content_masturbation: 'Контент: мастурбация',
  explicit_solo_gate: 'Готовность обсуждать откровенные соло-форматы',
  content_paid_call: 'Контент: платный звонок с фанатом',
  content_toy_oral: 'Контент: интимный контент с игрушкой',
  partner_content_gate: 'Рассматривает контент с другими людьми',
  content_duo_girl: 'Контент: дуо с девушкой',
  content_duo_guy: 'Контент: дуо с парнем',
  permanent_partner: 'Есть постоянный партнер для съемок',
  content_trio: 'Контент: трио',
  content_anal: 'Контент: анал',
  us_social_posting: 'Постинг в соцсетях для США',
  streaming_promo: 'Стримы для привлечения подписчиков',
  pornhub_reels: 'Промо-видео на Pornhub',
  other_taboos: 'Другие табу / неприемлемые форматы',
  about_candidate: 'Что важно знать о кандидатке',
  team_preferences: 'Что важно в команде',
  started_at: 'Дата старта',
  last_activity_at: 'Последняя активность',
  answers_count: 'Количество ответов',
  skipped_count: 'Пропущено логикой'
};

const DISPLAY_HEADERS = HEADERS.map((header) => HEADER_TITLES[header] || header);

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || '{}');
    assertSecret(payload.secret);
    const sheet = ensureLeadsSheet();
    ensureEventsSheet();

    const action = payload.action;
    if (action === 'create') return json(withLock(() => createLead(sheet, payload)));
    if (action === 'upsert') return json(withLock(() => upsertLead(sheet, payload)));
    if (action === 'complete') return json(withLock(() => completeLead(sheet, payload)));
    if (action === 'reset') return json(withLock(() => resetLead(sheet, payload)));
    if (action === 'get') return json(getLead(sheet, payload.telegram_id));

    return json({ ok: false, error: 'Unknown action' });
  } catch (error) {
    return json({ ok: false, error: String(error && error.message || error) });
  }
}

function createLead(sheet, payload) {
  const row = findRowByTelegramId(sheet, payload.telegram_id);
  const now = new Date().toISOString();
  if (row) {
    setFields(sheet, row, {
      updated_at: now,
      telegram_username: payload.telegram_username || '',
      telegram_first_name: payload.telegram_first_name || '',
      telegram_last_name: payload.telegram_last_name || '',
      source: getCellByHeader(sheet, row, 'source') || payload.source || '',
      recruiter: getCellByHeader(sheet, row, 'recruiter') || payload.recruiter || ''
    });
    logEvent('create_existing', payload.telegram_id, '');
    return { ok: true, row, existed: true };
  }

  const values = HEADERS.map((header) => payload[header] || '');
  values[indexOf('created_at')] = payload.created_at || now;
  values[indexOf('updated_at')] = payload.updated_at || now;
  values[indexOf('status')] = payload.status || 'STARTED';
  values[indexOf('telegram_id')] = String(payload.telegram_id);
  sheet.appendRow(values);
  const newRow = sheet.getLastRow();
  logEvent('create', payload.telegram_id, '');
  return { ok: true, row: newRow, existed: false };
}

function upsertLead(sheet, payload) {
  const row = ensureLeadRow(sheet, payload);
  const stale = checkExpectedCurrentQuestion(sheet, row, payload.expected_current_question);
  if (stale) return stale;
  const fields = payload.fields || {};
  if (payload.field) fields[payload.field] = payload.value;
  fields.updated_at = new Date().toISOString();
  setFields(sheet, row, fields);
  logEvent('upsert', payload.telegram_id, Object.keys(fields).join(','));
  return { ok: true, row };
}

function completeLead(sheet, payload) {
  const row = ensureLeadRow(sheet, payload);
  const stale = checkExpectedCurrentQuestion(sheet, row, payload.expected_current_question);
  if (stale) return stale;
  const fields = payload.fields || {};
  fields.status = fields.status || 'COMPLETED';
  fields.completed_at = fields.completed_at || new Date().toISOString();
  fields.updated_at = new Date().toISOString();
  setFields(sheet, row, fields);
  logEvent('complete', payload.telegram_id, fields.status);
  return { ok: true, row };
}

function resetLead(sheet, payload) {
  const row = ensureLeadRow(sheet, payload);
  const clear = {};
  HEADERS.forEach((header) => {
    if (!metadataHeaders().includes(header)) clear[header] = '';
  });
  const now = new Date().toISOString();
  Object.assign(clear, payload, {
    status: payload.status || 'IN_PROGRESS',
    current_question: payload.current_question || 'preferred_language',
    updated_at: now,
    started_at: now,
    completed_at: ''
  });
  setFields(sheet, row, clear);
  logEvent('reset', payload.telegram_id, '');
  return { ok: true, row };
}

function checkExpectedCurrentQuestion(sheet, row, expected) {
  if (!expected) return null;
  const current = String(getCellByHeader(sheet, row, 'current_question') || '');
  if (current !== String(expected)) {
    return {
      ok: true,
      stale: true,
      current_question: current
    };
  }
  return null;
}

function withLock(callback) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(3000)) {
    throw new Error('Could not acquire lock');
  }
  try {
    return callback();
  } finally {
    lock.releaseLock();
  }
}

function getLead(sheet, telegramId) {
  const row = findRowByTelegramId(sheet, telegramId);
  if (!row) return { ok: true, lead: null };
  const values = sheet.getRange(row, 1, 1, HEADERS.length).getValues()[0];
  const lead = {};
  HEADERS.forEach((header, index) => lead[header] = values[index]);
  const answers = {};
  answerHeaders().forEach((header) => answers[header] = lead[header]);
  lead.answers = answers;
  return { ok: true, lead };
}

function ensureLeadRow(sheet, payload) {
  const row = findRowByTelegramId(sheet, payload.telegram_id);
  if (row) return row;
  createLead(sheet, Object.assign({}, payload, payload.fields || {}));
  return findRowByTelegramId(sheet, payload.telegram_id);
}

function ensureLeadsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(LEADS_SHEET) || ss.insertSheet(LEADS_SHEET);
  migrateLeadHeaders(sheet);
  sheet.setFrozenRows(1);
  return sheet;
}

function migrateLeadHeaders(sheet) {
  const lastRow = Math.max(sheet.getLastRow(), 1);
  const lastColumn = Math.max(sheet.getLastColumn(), HEADERS.length);
  const currentHeaders = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const data = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues() : [];
  const usedColumns = {};
  const finalHeaders = DISPLAY_HEADERS.slice();
  const finalData = data.map(() => []);

  HEADERS.forEach((header, targetIndex) => {
    const sourceIndex = findExistingHeaderIndex(currentHeaders, header);
    if (sourceIndex >= 0) {
      usedColumns[sourceIndex] = true;
      data.forEach((row, rowIndex) => finalData[rowIndex][targetIndex] = row[sourceIndex]);
    }
  });

  currentHeaders.forEach((header, sourceIndex) => {
    if (!header || usedColumns[sourceIndex]) return;
    finalHeaders.push(header);
    data.forEach((row, rowIndex) => finalData[rowIndex].push(row[sourceIndex]));
  });

  sheet.getRange(1, 1, lastRow, Math.max(lastColumn, finalHeaders.length)).clearContent();
  sheet.getRange(1, 1, 1, finalHeaders.length).setValues([finalHeaders]);
  if (finalData.length) {
    sheet.getRange(2, 1, finalData.length, finalHeaders.length).setValues(finalData);
  }
}

function findExistingHeaderIndex(currentHeaders, internalHeader) {
  const displayHeader = HEADER_TITLES[internalHeader] || internalHeader;
  return currentHeaders.findIndex((header) => header === internalHeader || header === displayHeader);
}

function ensureEventsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(EVENTS_SHEET) || ss.insertSheet(EVENTS_SHEET);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['created_at', 'action', 'telegram_id', 'details']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function setFields(sheet, row, fields) {
  Object.keys(fields).forEach((field) => {
    const col = indexOf(field) + 1;
    if (col <= 0) return;
    sheet.getRange(row, col).setValue(fields[field]);
  });
}

function findRowByTelegramId(sheet, telegramId) {
  if (!telegramId || sheet.getLastRow() < 2) return null;
  const values = sheet.getRange(2, indexOf('telegram_id') + 1, sheet.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < values.length; i += 1) {
    if (String(values[i][0]) === String(telegramId)) return i + 2;
  }
  return null;
}

function getCellByHeader(sheet, row, header) {
  return sheet.getRange(row, indexOf(header) + 1).getValue();
}

function indexOf(header) {
  return HEADERS.indexOf(header);
}

function metadataHeaders() {
  return [
    'created_at', 'updated_at', 'completed_at', 'status',
    'telegram_id', 'telegram_username', 'telegram_first_name', 'telegram_last_name',
    'source', 'recruiter', 'current_question', 'progress_percent',
    'started_at', 'last_activity_at', 'answers_count', 'skipped_count'
  ];
}

function answerHeaders() {
  return HEADERS.filter((header) => !metadataHeaders().includes(header));
}

function assertSecret(secret) {
  const expected = PropertiesService.getScriptProperties().getProperty(SECRET_PROPERTY);
  if (!expected) throw new Error('Set Script Property SHEETS_WEBHOOK_SECRET first');
  if (secret !== expected) throw new Error('Invalid secret');
}

function logEvent(action, telegramId, details) {
  const sheet = ensureEventsSheet();
  sheet.appendRow([new Date().toISOString(), action, String(telegramId || ''), details || '']);
}

function json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
