# PRICO AI native shells

The Android package and the iOS Xcode project are Capacitor shells around `www/`. Neither file is an iPhone executable produced on this Linux host. The iOS tree is source scaffolding only.

## Which server an install calls

The native UI reads `www/server.json` at launch (`apiBase`). The deliverable build leaves `apiBase` empty.

- An empty address opens **on this phone** mode: import, the editor, music, captions, a crossfade, and an on-phone video export. Projects stay in the phone. There is no account. Real AI and payments stay off, and nothing is sent to a model.
- `https://prico-ai.onrender.com` is refused even if it is typed in. The app does not fall back to that host.
- A server address can be saved only after `/api/health` reports contract 2. Web pages keep using the site they were loaded from.
- Before AI generation or a shop tap, the client reads `/api/health` and continues only when `capabilities.contract` is at least 2, `capabilities.generation` is `unavailable-or-real`, and `capabilities.payments` is `postponed`. The public 1.1 server (`provider: demo`, `payments: demo`, no `capabilities`) fails that check, so the app does not call `/api/generate` or `/api/shop/buy` there. Those old routes would composite a face or grant Plus.

The debug APK built for verification sets `apiBase` to `http://10.0.2.2:18181`, the Android emulator alias for the host test server. It does not use the production database. The shell is loaded from `https://localhost`, so a debug build also sets Capacitor `allowMixedContent` so that page can call the explicit `http://10.0.2.2:18181` test server. Release manifests still refuse cleartext. An `https` `apiBase` does not need cleartext.

Settings shows the configured server host.

## Android debug APK

Needs Node 20+, JDK 21, and Android SDK 36 (the Capacitor project’s `compileSdk`).

```bash
cd mobile
npm install
rm -rf www
cp -a ../www www
rm -f www/sw.js
# Set the explicit server. Leave apiBase empty to refuse every network call.
printf '%s\n' '{"apiBase":"http://10.0.2.2:18181"}' > www/server.json
npx cap sync android
cd android
./gradlew assembleDebug
```

`android/app/build.gradle` sets `versionCode 2` and `versionName "1.2.0"` (the previous debug artifact was versionCode 1 / versionName 1.0). Output:

`mobile/android/app/build/outputs/apk/debug/app-debug.apk`

Package `studio.pricop.pricoai`, minSdk 24, targetSdk 36. The debug keystore can sideload the app and cannot sign a later Play update. Do not commit a keystore. Portrait orientation, camera, and microphone permissions are in the manifest.

## iOS source

`mobile/ios` is an Xcode project (`PRODUCT_BUNDLE_IDENTIFIER` `studio.pricop.pricoai`, `MARKETING_VERSION` 1.2.0, `CURRENT_PROJECT_VERSION` 2, deployment target iOS 15). `Info.plist` is portrait-only and declares camera, microphone, and photo-library usage strings. `capacitor.config.json` sets iOS `contentInset` to `automatic` so the web view stays inside the safe area. This tree does not contain a compiled `.ipa` or a signed `.app`.

On a Mac with Xcode and CocoaPods or Swift Package Manager:

1. `cd mobile && npm install && npx cap sync ios`
2. Put the intended `apiBase` in `www/server.json` before that sync. An empty value ships an install that does not call the public site.
3. Open `mobile/ios/App/App.xcworkspace` if CocoaPods created it, otherwise `mobile/ios/App/App.xcodeproj`.
4. Select the App target, Signing & Capabilities, your Apple team, and the bundle id `studio.pricop.pricoai` (or one your team owns). Automatic signing is enough for a registered device.
5. Run on an iOS Simulator, or Product → Archive for an `.ipa`. A device install that outlives a free provisioning profile, and TestFlight, need the Apple Developer Program.

`npx cap add ios` on Linux only writes the project. It does not compile or sign. Do not describe the Android APK as an iPhone app.
