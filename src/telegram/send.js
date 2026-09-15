function createTelegramClient(token) {
  async function api(method, payload) {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok || json.ok === false) {
      throw new Error(`Telegram ${method} failed: ${JSON.stringify(json)}`);
    }
    return json.result;
  }

  return {
    sendMessage(chatId, text, replyMarkup, options = {}) {
      return api("sendMessage", {
        chat_id: chatId,
        text,
        reply_markup: replyMarkup,
        ...options,
        disable_web_page_preview: true
      });
    },
    answerCallbackQuery(callbackQueryId, text) {
      return api("answerCallbackQuery", {
        callback_query_id: callbackQueryId,
        text,
        show_alert: false
      });
    },
    editMessageReplyMarkup(chatId, messageId, replyMarkup) {
      return api("editMessageReplyMarkup", {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: replyMarkup
      });
    },
    setMyCommands(commands, options = {}) {
      return api("setMyCommands", {
        commands,
        ...options
      });
    },
    setChatMenuButton(chatId, menuButton = { type: "commands" }) {
      return api("setChatMenuButton", {
        ...(chatId ? { chat_id: chatId } : {}),
        menu_button: menuButton
      });
    }
  };
}

async function setupTelegramMenuButton(telegram) {
  const commandSets = [
    { language_code: "ru", description: "Меню" },
    { language_code: "uk", description: "Меню" },
    { language_code: "en", description: "Menu" }
  ];

  await telegram.setChatMenuButton(null, { type: "commands" });
  await Promise.all(commandSets.map(({ language_code, description }) => telegram.setMyCommands([
    { command: "menu", description },
    { command: "start", description: language_code === "en" ? "Start" : "Старт" }
  ], { language_code })));
}

module.exports = { createTelegramClient, setupTelegramMenuButton };
