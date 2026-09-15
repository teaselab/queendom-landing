module.exports = async function menuPage(_req, res) {
  res.statusCode = 200;
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.end(`<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Queendom Agency</title>
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <style>
    :root {
      color-scheme: light dark;
      --bg: var(--tg-theme-bg-color, #ffffff);
      --text: var(--tg-theme-text-color, #111111);
      --hint: var(--tg-theme-hint-color, #707579);
      --button: var(--tg-theme-button-color, #2481cc);
      --button-text: var(--tg-theme-button-text-color, #ffffff);
      --secondary-bg: var(--tg-theme-secondary-bg-color, #f4f4f5);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    main {
      width: min(520px, 100%);
      margin: 0 auto;
      padding: 28px 18px calc(24px + env(safe-area-inset-bottom));
    }
    h1 {
      margin: 0;
      font-size: 24px;
      line-height: 1.15;
      font-weight: 700;
    }
    .subtitle {
      margin: 6px 0 22px;
      color: var(--hint);
      font-size: 15px;
    }
    .actions {
      display: grid;
      gap: 10px;
    }
    button {
      width: 100%;
      min-height: 52px;
      border: 0;
      border-radius: 10px;
      padding: 13px 16px;
      background: var(--button);
      color: var(--button-text);
      font: inherit;
      font-size: 16px;
      font-weight: 650;
      cursor: pointer;
    }
    button.secondary {
      background: var(--secondary-bg);
      color: var(--text);
    }
    .confirm {
      display: none;
      margin-top: 14px;
      padding: 14px;
      border-radius: 12px;
      background: var(--secondary-bg);
    }
    .confirm.visible {
      display: block;
    }
    .confirm p {
      margin: 0 0 12px;
      line-height: 1.35;
    }
  </style>
</head>
<body>
  <main>
    <h1>Queendom Agency</h1>
    <div class="subtitle">Меню</div>
    <div class="actions" id="actions"></div>
    <div class="confirm" id="confirm">
      <p>Начать анкету заново?<br><br>Текущие ответы будут удалены.</p>
      <button id="confirmRestart">Начать заново</button>
      <button class="secondary" id="cancelRestart">Отмена</button>
    </div>
  </main>
  <script>
    const tg = window.Telegram && window.Telegram.WebApp;
    const actions = document.getElementById("actions");
    const confirmBox = document.getElementById("confirm");
    const initData = tg ? tg.initData : "";
    const links = {
      hr: "https://t.me/elize_cherry",
      cases: "https://t.me/queendom_agency"
    };

    if (tg) {
      tg.ready();
      tg.expand();
    }

    function button(label, onClick, secondary = false) {
      const item = document.createElement("button");
      item.textContent = label;
      if (secondary) item.className = "secondary";
      item.addEventListener("click", onClick);
      actions.appendChild(item);
    }

    async function api(action) {
      const response = await fetch("/api/menu/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, initData })
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || "request_failed");
      return json;
    }

    function close() {
      if (tg) tg.close();
    }

    function openTelegramLink(url) {
      if (tg && tg.openTelegramLink) tg.openTelegramLink(url);
      else window.location.href = url;
    }

    function render(state) {
      actions.textContent = "";
      if (state === "in_progress") {
        button("Продолжить анкету", () => api("continue").then(close));
        button("Начать анкету заново", () => confirmBox.classList.add("visible"), true);
      } else if (state === "completed") {
        button("Пройти анкету заново", () => confirmBox.classList.add("visible"));
      } else {
        button("Начать анкету", () => api("start").then(close));
      }
      button("Связаться с Лизой", () => openTelegramLink(links.hr), true);
      button("Кейсы моделей", () => openTelegramLink(links.cases), true);
    }

    document.getElementById("confirmRestart").addEventListener("click", () => api("restart").then(close));
    document.getElementById("cancelRestart").addEventListener("click", () => confirmBox.classList.remove("visible"));

    api("state")
      .then((data) => render(data.state))
      .catch(() => render("new"));
  </script>
</body>
</html>`);
};
