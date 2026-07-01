# Queendom Agency Landing

Static one-page landing for Queendom Agency.

## Deploy

Upload all files from this folder to a GitHub repository and deploy it on Vercel.
GitHub Pages will not run the `/api/lead.js` serverless function.

Set these Environment Variables in Vercel:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `GOOGLE_SHEETS_ENDPOINT`

The form sends extended application data to Google Sheets and a short lead notification to Telegram.

## Language URLs

- RU: `/index.html`
- UA: `/ua/index.html`
- EN: `/en/index.html`
