import type { ExpoConfig } from 'expo/config';

import app from './src/config/app.json';

const APP_NAME = app.name;
const APP_SLUG = app.slug;

// TODO(before Play upload): the app ID (Android package / iOS bundle ID) is permanent once published. Pick the final one.
const APP_ID = 'com.kieruy.kash';

const config: ExpoConfig = {
  name: APP_NAME,
  slug: APP_SLUG,
  scheme: APP_SLUG,
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  // Light mode only in MVP (DECISIONS.md D7).
  userInterfaceStyle: 'light',
  android: {
    package: APP_ID,
    // No OS cloud backup of app data. The only way data leaves the phone is a user-initiated encrypted export.
    allowBackup: false,
    adaptiveIcon: {
      backgroundColor: '#1E5B47',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  ios: {
    bundleIdentifier: APP_ID,
    supportsTablet: false,
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    ['expo-sqlite', { useSQLCipher: true }],
    [
      'expo-splash-screen',
      {
        backgroundColor: '#1E5B47',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
