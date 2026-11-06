# PRICO AI — make yourself the star

by **PRICOP.studio** · package `studio.pricop.pricoai`

Photo and video app with a vertical feed, a local Reels editor, and a real fal.ai photo/video adapter that stays off until a key and credits exist. Sharing hands the file to TikTok, Instagram, YouTube, WhatsApp, or Telegram; it does not publish for you.

## What's inside

| Area | Status |
|---|---|
| Email sign-up / login, profile (avatar, bio, followers / following) | ✅ real |
| Selfies (1–3), on-device person cut-out (MediaPipe, self-hosted), consent | ✅ real |
| Templates from a server-side JSON catalog (`server/templates.json`, hot-reload via `TEMPLATES_URL` or `POST /api/admin/templates`) | ✅ catalog real · generative AI stays off until `AI_PROVIDER=fal` and `FAL_KEY` are set |
| AI photos and AI videos | ✅ real fal adapter (PuLID still, Wan 3.0 Prime image-to-video). No key or no credits → `ai_unavailable`, no composite fallback |
| Reels editor — photos / clips → 9:16 MP4, beat-synced cuts, transitions, Ken Burns, Mixkit music, subtitles | ✅ local ffmpeg. Labeled as an edit, not a generative AI video |
| Text + sticker overlays (28 Twemoji), meme templates | ✅ real |
| Swipe feed (For you / Following / Challenge), like + double-tap, comments, share, report, "Put me in" | ✅ real |
| Daily challenge + leaderboard + countdown | ✅ real |
| Shop shows Plus 5.99 €/month and 39.99 €/year | ✅ prices only. Purchases return `payments_postponed` and grant nothing |
| Safety filter (nudity, minors, hate, deception) on prompts / text / captions + reports (auto-hide after 3) | ✅ real (keyword level) |
| Watermark "PRICO AI" on every output | ✅ real |
| i18n: en (default), ru, uk, es, pt, de, fr, tr, ar (RTL), hi, id — auto-detect + switch in Settings | ✅ real |
| PWA plus a Capacitor Android/iOS shell | PWA and Android project steps are in the repo. An iPhone build needs macOS and signing. See docs/MOBILE.md |

## Run locally

```bash
npm install
npm start            # http://localhost:8080 — data in ./data (or DATA_DIR)
```

Node ≥ 20. `ffmpeg-static` and `sharp` ship their binaries — no system packages needed.

## Environment variables

| Var | Default | Meaning |
|---|---|---|
| `PORT` | 8080 | HTTP port |
| `PUBLIC_URL` | `http://localhost:PORT` | Absolute URL for share links / Open Graph |
| `LOW_MEM` | on | `0` disables low-memory mode (single-threaded ffmpeg, ultrafast x264, sharp cache off). Keep on for Render free (512 MB) |
| `MALLOC_ARENA_MAX` | – | Set `2` on small instances (cuts Node/sharp RSS ~40%) |
| `REEL_GROUP` | 4 | Segments joined per ffmpeg pass in the Reels maker |
| `DATABASE_URL` | – | Postgres → users, posts and media persist (tables `prico_doc`, `prico_blob`). Without it: local files in `DATA_DIR` (ephemeral on Render free) |
| `PGSSL` | auto | `off` to disable TLS for Postgres |
| `DATA_DIR` | `./data` | Local storage folder |
| `SEED` | on | `off` disables demo creators / posts |
| `AI_PROVIDER` | off | `fal` together with `FAL_KEY` turns on real generation. Anything else returns `ai_unavailable`. There is no demo provider fallback |
| `FAL_KEY` | – | fal.ai API key. Read only on the server. Never sent to the client |
| `FAL_PHOTO_MODEL` | `fal-ai/flux-pulid` | only this checked model is accepted |
| `FAL_VIDEO_MODEL` | `alibaba/wan-3.0-prime/image-to-video` | checked 2026-11-06. Input: `start_image_url`, `prompt`, `duration` integer 5, `resolution` `1080p`, `aspect_ratio` `9:16`, `audio` false, `enable_safety_checker` true |
| `JOB_CONCURRENCY` | 2 | parallel generation jobs |
| `TEMPLATES_URL` | – | remote JSON catalog (same schema as `server/templates.json`) |
| `OWNER_EMAILS` | `g968800071@gmail.com` | Comma-separated owner/admin emails: unlimited photos, videos and reels (Plus · ∞), no credits charged. Matched by email on every request, so it survives re-signup. Set to empty to disable |
| `ADMIN_TOKEN` | – | enables `POST /api/admin/templates` (header `x-admin-token`) to reload the catalog |
| `PAYMENTS_MODE` / `STRIPE_SECRET_KEY` | ignored | `/api/shop/buy` always returns `payments_postponed` and does not grant Plus, trials, packs, or coins |

## AI

Real generation is off unless `AI_PROVIDER=fal` and `FAL_KEY` are set, and the photo and video model ids stay on the checked pair (`fal-ai/flux-pulid`, `alibaba/wan-3.0-prime/image-to-video`). The account used for schema checks was out of credits, and this change does not call fal. A billing error from fal becomes `ai_exhausted`. A face cutout on a background is labeled as a cutout.

The editor, Reels, and Photo Studio sharpen/cutout run locally with ffmpeg and sharp.

## Render free plan notes

* Free web service sleeps after ~15 min idle (first request ≈ 30–60 s cold start).
* Disk is ephemeral: without `DATABASE_URL` new users / posts disappear on each deploy or restart. Seeds re-create themselves.
* Free Render Postgres expires after 30 days — move to a paid instance (≈ $7/mo) or Neon / Supabase free tier for durable data.
* Reel uploads are kept in `/tmp` for 3 h only; finished results are persisted.

## Android and iPhone

The Capacitor wrapper in `mobile/` is a native shell around this web app (`appId` `studio.pricop.pricoai`). It is not a store listing. Build steps, the debug APK, and the iPhone signing gap are in [docs/MOBILE.md](docs/MOBILE.md). An Android APK does not install on an iPhone.

## Checks

```bash
npm test    # contract tests plus a local create/edit/export smoke test
```

The smoke test uses a throwaway `DATA_DIR`, leaves `DATABASE_URL` unset, and does not call fal.

## Next steps

1. Fund the fal account and set `FAL_KEY` + `AI_PROVIDER=fal` on the server. Until then the UI says real generation is unavailable.
2. Object storage for media. Postgres already holds accounts when `DATABASE_URL` is set; do not point tests at that database.
3. Payments stay off until a store billing integration exists. Do not treat a button tap as a purchase.
4. iPhone build needs a Mac, Xcode, and an Apple signing team. See `docs/MOBILE.md`.
