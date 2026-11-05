# PRICO AI v2: research and priorities (Nov 2026)

## What the market says
| Signal | Source (Nov 2026) | What it means for PRICO AI |
|---|---|---|
| Top-grossing photo/video apps are Picsart (about $4.5–24M/mo), CapCut (about $3.9–13M/mo) and Remini. Google Play's top-grossing chart is led by face apps: FaceApp, Meitu, BeautyPlus, SNOW, B612, Retake, FaceLab | appcurrents.com, appwinners.eu, rev.now | Two things drive spending: **face transformations** (age, baby, beauty, AI styles) and an **easy editor** |
| The 2026 viral AI effects are one-photo physics effects (squish, melt, inflate, explode, cakeify), figurine, kiss/hug, dance motion (Viggle), Ghibli/anime style, lip-sync / talking photo, brainrot voiceover, polaroid develop, crash zoom / bullet time | bgremovit, dromana, reelmuse, Fast Company (Pika: +800% users after Pikaffects) | **One tap, one photo, under 7 seconds, ready to share.** Build a catalog of 100+ templates that updates from the server |
| Number-one complaint about CapCut: 31% of negative reviews are about the Pro paywall. People hit **export blocked at the last step**, fades and slow-mo became paid, and the watermark costs money to remove | unstar.app (2,881 reviews), r/CapCut, Trustpilot | PRICO's editor is **free with no export wall**: fades, slow-mo, filters and captions are all free. If something is limited, say so *before* editing, never at export |
| Instagram Edits wins on free 4K export, auto captions in 15 languages and no watermark. Its users complain about lost projects | itechguides, vidpal | **Auto-save drafts**, captions in all 11 languages, reliable export |
| Live gifting is the biggest consumer spend in social: TikTok + Douyin passed $6B/yr, TikTok LIVE gifts alone are about $3.8B/yr, and the gifting market is about $14.8B (+21.5% YoY). 78% of gifters are motivated by an on-stream shout-out. PK battles drive 58% of gift volume | Sensor Tower via techbloat and voxbooster, Tubefilter/Ipsos | **LIVE with coins and gifts** is the strongest money feature: animated gifts, a shout-out banner for every gift, a top-gifter leaderboard |
| Lip-sync, talking photos and brainrot voiceovers are in the top 3 effects | reelmuse | **Text-to-speech voiceover** in 11 languages (in the editor and in templates), plus a bigger music library |

## Priority order (build order)
1. **P1 Viral catalog 2.0.** 100+ templates in server JSON across trends, physics FX (squish, melt, inflate, explode, cakeify), memes, dances, avatars/styles, couples (kiss, hug), greetings, movies/games, seasonal (Halloween, Christmas, Diwali, Ramadan/Eid, Lunar New Year, Valentine's, Easter) and niches. Categories, search, Hot/New badges.
2. **P2 Face-effects camera and photo filters** (the FaceApp/B612/SNOW revenue core). Real-time face mesh in the browser: big eyes, big head, baby, aging, beauty, cartoon, glitch, VHS, color grades, AR masks and stickers. Capture a photo or record a video, then send it to the editor or a post.
3. **P3 Free video editor with no paywall** (the anti-CapCut). Multi-clip timeline with trim, split, reorder, speed and per-clip filters. Transitions, animated text in several fonts, stickers, picture-in-picture, music (volume and fade), voiceover recording, TTS, auto captions, aspect ratio and crop, undo/redo, auto-saved drafts. Exports a 9:16 MP4 on the server and stays under 512 MB of RAM.
4. **P4 Voice and music.** TTS in 11 languages with several voices (free open engine on the server; ElevenLabs pluggable later). A bigger royalty-free library with categories and preview.
5. **P5 LIVE with gifts** (the biggest monetization lever). Go live from the camera (one-to-many WebRTC, small audiences), chat, viewer count, coins (demo payments), animated gifts with shout-out banners, gift leaderboard.
6. **P6 Chat and DMs** (retention and sharing loop). 1:1 and group chats in realtime over WebSocket; send text, photos, videos and shared posts; read receipts; unread badges; notifications; block and report.

Cross-cutting: everything in the 11 languages, owner unlimited (OWNER_EMAILS), persistent Postgres if it can be connected, and memory kept under 512 MB on Render free.

## Deliberately not now
PK battles, live shopping, 4K export and true AI lip-sync (they need paid GPU models; the code is ready to plug in fal.ai).

## Added in this pass: Photo Studio (Remini/Lensa level)
Remini and Lensa sit in the top-grossing lists on the strength of one-tap **HD enhance**, **AI avatars**, **background swap / "you anywhere"** and **cards**. PRICO now has a Photo Studio (+ menu → Photo Studio) with all four:
- HD Enhance with a before/after slider. Free mode is on the server (sharp: 2K Lanczos upscale, denoise, CLAHE, clarity). With AI_PROVIDER=fal it switches to fal-ai/codeformer face restoration.
- You anywhere: the cut-out is made on the phone, then placed into 22 scenes.
- Greeting cards: 10 occasions, your photo plus your own text.
- Avatars: jumps to the 15 avatar templates.
