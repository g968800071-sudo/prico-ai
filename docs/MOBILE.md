# PRICO AI native shells

The installable apps are Capacitor shells. They load the same UI as the site and, in the native build, talk to `https://prico-ai.onrender.com`. An Android package is not an iPhone app.

`mobile/android` and `mobile/www` are gitignored. Rebuild them from this repo.

## Android debug APK

Needs Node 20+, JDK 21, and Android SDK command-line tools (`ANDROID_HOME` with platform `android-35` or the version Capacitor 8 selects, plus build-tools).

```bash
cd mobile
npm install
rm -rf www android
cp -a ../www www
rm -f www/sw.js
npx cap add android
npx cap sync android
cd android
./gradlew assembleDebug
```

The installable file is:

`mobile/android/app/build/outputs/apk/debug/app-debug.apk`

Debug builds are signed with the Android debug keystore. They install with “install unknown apps” and cannot be updated later by a Play release signed with a different key. A Play release needs `keystore.properties` (`storeFile`, `storePassword`, `keyAlias`, `keyPassword`) and `./gradlew assembleRelease`. Do not commit the keystore.

A debug APK was produced with JDK 21 and Android SDK platform 36 (the generated Capacitor project asks for 36; platform 35 was installed first and Gradle fetched 36). It is signed with the Android debug keystore, so it can be sideloaded and cannot be the key for a later Play update. The file is not committed. This host has no Mac and no Apple signing identity, so there is no iPhone build.

## iPhone

This repository does not contain a built iOS app, and a Linux host cannot produce one.

What is present:

- Capacitor config: `mobile/capacitor.config.json` (`appId` `studio.pricop.pricoai`, `appName` PRICO AI, portrait web bundle).
- The same `www/` UI, with safe-area insets for the notch and the home indicator.

What is missing, and has to be done on macOS:

1. Xcode with the iOS SDK, plus CocoaPods.
2. `cd mobile && npm install && npx cap add ios && npx cap sync ios`
3. Open `mobile/ios/App/App.xcworkspace` in Xcode.
4. Select a development team, a bundle id that you own, and a signing certificate. Automatic signing is enough for a device you register.
5. Run on a simulator, or archive an `.ipa` for TestFlight / App Store. The Apple Developer Program is required for a device install that outlives a free provisioning profile, and for TestFlight.

`npx cap add ios` on Linux does not create a usable signed app. Do not ship the Android APK as the iPhone build.
