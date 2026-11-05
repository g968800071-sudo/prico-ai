# PRICO AI — make yourself the star

by **PRICOP.studio** · package `studio.pricop.pricoai`

AI photo + AI video "you are the star" app with a TikTok-style vertical feed, an AI **Reels maker**, daily challenges and one-tap sharing to TikTok / Instagram Reels / YouTube Shorts / WhatsApp / Telegram.

## What's inside

| Area | Status |
|---|---|
| Email sign-up / login, profile (avatar, bio, followers / following) | ✅ real |
| Selfies (1–3), on-device person cut-out (MediaPipe, self-hosted), consent | ✅ real |
| 47 templates from a server-side JSON catalog (`server/templates.json`, hot-reload via `TEMPLATES_URL` or `POST /api/admin/templates`) — Viggle dance, face-swap memes, Lensa-style avatars, old-photo animation, baby / aging, Ghibli / anime, action figure / doll box, superhero, talking photo, friendly hug, greetings, movies / games ("я танкист в PRICOPBUM") | ✅ catalog real · AI = demo until a key is set |
| Free AI photos, paid AI videos (2–3 faces for friends formats) | ✅ demo renderer, fal.ai pluggable |
| **AI Reels maker** — photos / clips or just an idea → 9:16 1080×1920 MP4, best moments (scene-score), beat-synced cuts, transitions, Ken Burns, royalty-free original music, auto subtitles, hook text, caption + hashtags; niches travel / food / fitness / business / birthday / funny / love / vlog | ✅ **real** local ffmpeg rendering |
| Text + sticker overlays (28 Twemoji), meme templates | ✅ real |
| Swipe feed (For you / Following / Challenge), like + double-tap, comments, share, report, "Put me in" | ✅ real |
| Daily challenge + leaderboard + countdown | ✅ real |
| Credits: 3 free videos, Plus 6.99 €/month (40 videos), packs 10 / 30 / 100 | ✅ **DEMO payments** (no money moves) |
| Safety filter (nudity, minors, hate, deception) on prompts / text / captions + reports (auto-hide after 3) | ✅ real (keyword level) |
| Watermark "PRICO AI" on every output | ✅ real |
| i18n: en (default), ru, uk, es, pt, de, fr, tr, ar (RTL), hi, id — auto-detect + switch in Settings | ✅ real |
| PWA (portrait, installable, offline shell) + Android APK (Capacitor) | ✅ |

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
| `AI_PROVIDER` | `demo` | `fal` to use fal.ai |
| `FAL_KEY` | – | fal.ai API key (required for `fal`) |
| `FAL_PHOTO_MODEL` | `fal-ai/flux-pulid` | identity-preserving photo model |
| `FAL_VIDEO_MODEL` | `fal-ai/kling-video/v2.5-turbo/pro/image-to-video` | image-to-video model |
| `JOB_CONCURRENCY` | 2 | parallel generation jobs |
| `TEMPLATES_URL` | – | remote JSON catalog (same schema as `server/templates.json`) |
| `ADMIN_TOKEN` | – | enables `POST /api/admin/templates` (header `x-admin-token`) to reload the catalog |
| `PAYMENTS_MODE` / `STRIPE_SECRET_KEY` | demo | Stripe hook placeholder; in-app stores need Google Play Billing / Apple IAP |

## AI costs (fal.ai, Nov 2026 list prices)

| Call | Price | Per creation |
|---|---|---|
| Photo, flux-pulid ~1 MP | ≈ $0.033 / MP | ≈ **$0.03–0.04** |
| Video, Kling v2.5-turbo 5 s | $0.35 / 5 s | ≈ **$0.35** |
| Video, MiniMax Hailuo | ≈ $0.025 / s | ≈ $0.15 (6 s) |
| Reels maker | local ffmpeg | **$0** (CPU only) |
| Speech-to-text for clip subtitles (optional, wizper) | ≈ $0.0005 / s | < $0.01 |

With Plus at 6.99 €/month and 40 videos max, worst-case AI cost ≈ $14 → set Plus to ~20–25 videos on Kling, or use MiniMax / Kling standard for Plus, or keep 40 with a cheaper model. Packs (0.40–0.50 € per video) are profitable on all listed models.

## Render free plan notes

* Free web service sleeps after ~15 min idle (first request ≈ 30–60 s cold start).
* Disk is ephemeral: without `DATABASE_URL` new users / posts disappear on each deploy or restart. Seeds re-create themselves.
* Free Render Postgres expires after 30 days — move to a paid instance (≈ $7/mo) or Neon / Supabase free tier for durable data.
* Reel uploads are kept in `/tmp` for 3 h only; finished results are persisted.

## Android

Capacitor 8 wrapper config lives in `mobile/` (appId `studio.pricop.pricoai`, label "PRICO AI", portrait, Share + Filesystem + StatusBar + SplashScreen). The app bundles `www/` (without `sw.js`) and talks to `https://prico-ai.onrender.com`.

```bash
cd mobile && npm install && rm -rf www && cp -r ../www www && rm www/sw.js
npx cap add android && npx cap sync android
cd android && JAVA_HOME=/path/to/jdk21 ./gradlew assembleRelease
```

Release signing reads a `keystore.properties` (storeFile, storePassword, keyAlias, keyPassword) referenced from `android/app/build.gradle`; the keystore and its properties are never committed. Back the keystore up — Play updates need the same key.

## Next steps

1. Add `FAL_KEY` + `AI_PROVIDER=fal` → real AI photos / videos.
2. Durable Postgres + object storage (R2 / S3) for media.
3. Google Play Billing / Apple IAP (replace demo shop), Stripe for web.
4. Server-side image moderation (e.g. fal / AWS Rekognition) on top of keyword filter.
5. Whisper subtitles for user clips; AI B-roll generation for idea-only reels.
