# PRICO AI native shells

The Android package and the iOS project are Capacitor shells around `www/`. Version 1.4.0 (Android `versionCode` 4, iOS build 4). An empty `www/server.json` `apiBase` is the deliverable. `https://prico-ai.onrender.com` is refused.

## On this phone

An empty address opens **on this phone** mode. Import, the editor, music, captions, a crossfade, and export stay on the device. Projects stay in IndexedDB on the phone. That mode does not include an account, the feed, messages, or LIVE. Real AI and payments stay off. Nothing is sent to a model.

The export is encoded on the device as an MP4: H.264 video and AAC audio, 540×960 for 9:16. Android uses `MediaCodec` and `MediaMuxer`. iOS uses `AVAssetWriter`. The file is not a WebM recording with a renamed extension. A browser that is not the native shell can still record WebM, and that result is labeled `video/webm`.

## A server you choose

A server address is saved only after `/api/health` reports contract 2, generation `unavailable-or-real`, and payments `postponed`. The public 1.1 server fails that check, so the app does not call `/api/generate` or `/api/shop/buy` there. Register, the feed, a profile, likes, messages, and a LIVE room are available only after that check. Creating a LIVE room is not a camera broadcast, and it is not a generative model.

The debug Android manifest allows cleartext so a debug build can call an `http` test server. Release manifests do not. iOS allows local networking in ATS. The simulator reaches the Mac at `127.0.0.1`. The emulator reaches the host at `10.0.2.2`.

## Android debug APK

Needs Node 20+, JDK 21, and Android SDK 36.

```bash
cd mobile
npm install
node ../tools/stage-mobile.mjs
npx cap sync android
cd android && ./gradlew assembleDebug
```

Output: `mobile/android/app/build/outputs/apk/debug/app-debug.apk`

Package `studio.pricop.pricoai`, minSdk 24, targetSdk 36. The debug keystore can sideload the app and cannot sign a later Play update. Do not commit a keystore. Portrait orientation, camera, microphone, and photo permissions are in the manifest.

## iOS simulator

`mobile/ios` is an Xcode project (`PRODUCT_BUNDLE_IDENTIFIER` `studio.pricop.pricoai`, deployment target iOS 15). Portrait only, with camera, microphone, photo-library, and local-network usage strings.

`.github/workflows/ios-simulator.yml` runs on the standard free `macos-latest` runner for this public repository. It does not use a larger runner. It builds with `CODE_SIGNING_ALLOWED=NO`, boots an iPhone simulator, installs the `.app`, and runs the export smoke plus a throwaway local server. The uploaded `.app` is an unsigned simulator build. It is not an IPA and will not install on a physical iPhone. A physical iPhone still needs an Apple signing team. That signing step is not done here.
