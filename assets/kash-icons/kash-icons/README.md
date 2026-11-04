# Kash app icons

## assets/ (Option A, Green Pom, ready for Expo)
- icon.png: 1024×1024, opaque. iOS and the general app icon.
- adaptive-icon.png: 1024×1024, transparent. Android adaptive icon foreground, kept inside the safe zone.
- splash-icon.png: 1024×1024, transparent. The mascot for the splash screen.

Copy these into your project's `assets/images/` folder, then in app.json:

```json
{
  "expo": {
    "icon": "./assets/images/icon.png",
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/adaptive-icon.png",
        "backgroundColor": "#1E5B47"
      }
    },
    "plugins": [
      ["expo-splash-screen", {
        "image": "./assets/images/splash-icon.png",
        "imageWidth": 200,
        "backgroundColor": "#1E5B47"
      }]
    ]
  }
}
```

## options/
PNGs for all three options (A green Pom, B cream Pom, C "K" coin).
For option B, use backgroundColor `#FCF3E3`.

## svg-source/
Editable SVG sources. Re-export at 1024×1024 if you change them.

Play Store listing also needs a 512×512 icon. Resize icon.png when you upload it.
