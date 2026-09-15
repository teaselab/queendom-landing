const { createTelegramClient, setupTelegramMenuButton } = require("../src/telegram/send");
const { getEnv } = require("../src/utils/env");

async function main() {
  const env = getEnv();
  await setupTelegramMenuButton(createTelegramClient(env.TELEGRAM_BOT_TOKEN));
  console.log("Telegram menu button configured");
}

main().catch((error) => {
  console.error("Telegram menu button setup failed", {
    name: error?.name,
    message: error?.message
  });
  process.exit(1);
});
