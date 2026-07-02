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

- RU: `/ru/index.html`
- UA: `/ua/index.html`
- EN: `/en/index.html`

## Apply URLs

- RU: `/apply/ru/index.html`
- UA: `/apply/ua/index.html`
- EN: `/apply/en/index.html`

## Meta URL Templates

UA full landing:

```text
https://queendom.agency/ua/?utm_source=meta&utm_medium=paid_social&utm_agency=ua&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}&campaign={{campaign.name}}&campaign_id={{campaign.id}}&adset={{adset.name}}&adset_id={{adset.id}}&creative={{ad.name}}&ad_id={{ad.id}}&placement={{placement}}&site_source_name={{site_source_name}}&landing=full_ua&funnel=full_ua&source_tag=meta_2026_06_coresec_ua_full
```

UA apply landing:

```text
https://queendom.agency/apply/ua/?utm_source=meta&utm_medium=paid_social&utm_agency=applyua&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}&campaign={{campaign.name}}&campaign_id={{campaign.id}}&adset={{adset.name}}&adset_id={{adset.id}}&creative={{ad.name}}&ad_id={{ad.id}}&placement={{placement}}&site_source_name={{site_source_name}}&landing=apply_ua&funnel=apply_ua&source_tag=meta_2026_06_coresec_ua_apply
```

RU full landing:

```text
https://queendom.agency/ru/?utm_source=meta&utm_medium=paid_social&utm_agency=ru&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}&campaign={{campaign.name}}&campaign_id={{campaign.id}}&adset={{adset.name}}&adset_id={{adset.id}}&creative={{ad.name}}&ad_id={{ad.id}}&placement={{placement}}&site_source_name={{site_source_name}}&landing=full_ru&funnel=full_ru&source_tag=meta_2026_06_coresec_ru_full
```

RU apply landing:

```text
https://queendom.agency/apply/ru/?utm_source=meta&utm_medium=paid_social&utm_agency=applyru&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}&campaign={{campaign.name}}&campaign_id={{campaign.id}}&adset={{adset.name}}&adset_id={{adset.id}}&creative={{ad.name}}&ad_id={{ad.id}}&placement={{placement}}&site_source_name={{site_source_name}}&landing=apply_ru&funnel=apply_ru&source_tag=meta_2026_06_coresec_ru_apply
```
