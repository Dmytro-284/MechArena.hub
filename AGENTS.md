# Mech Arena Hub - Codex Guide

## Project Overview

- This is a lightweight Vercel-hosted web app without a package manager or build step.
- `mech-arena-hub.html` is the public single-page PWA.
- `admin.html` is the admin interface for promo codes and patch notes.
- `api/` contains Vercel serverless endpoints.
- `calc-data-*.js` files provide calculator datasets loaded directly by the site and Telegram bot.
- `manifest.json`, `sw.js`, `favicon.svg`, and `icons/` provide PWA branding and offline support.

## Integrations

- Public promo codes and admin CRUD use Supabase through `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_KEY`.
- Admin endpoints authenticate with `ADMIN_USERNAME` and `ADMIN_PASSWORD`.
- Patch-note retrieval uses `DISCORD_BOT_TOKEN` and `DISCORD_CHANNEL_ID`.
- The Telegram webhook uses `BOT_TOKEN` and may depend on the deployed site URL configured in its endpoint code.
- Never add actual secret values to tracked files.

## Editing Conventions

- Preserve the current no-build, plain HTML/CSS/JavaScript structure unless a task explicitly warrants a larger change.
- When changing user-facing text in `mech-arena-hub.html`, check both English and Ukrainian translation entries.
- When changing precached public behavior or assets, update the cache version in `sw.js` so installed PWAs receive the change.
- Treat calculator data and SQL schema files as product data: modify them only for a task that requires it.
- Keep `.claude/` as historical local tooling state; it is not a Codex configuration directory and should not be renamed or committed.

## Verification

- There is currently no automated test suite or package script.
- For frontend work, load the public page and the admin page in a browser and check the affected view at narrow and wide widths when relevant.
- For PWA/static asset work, verify service-worker registration and cached asset paths.
- For API work, validate request methods, authorization behavior, missing-environment fallback behavior, and returned JSON shape.

