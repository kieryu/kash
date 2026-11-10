// Single source for the app's name. "Kash" is a working name — rename it in app.json next to this file.
// It's JSON so app.config.ts (which can't load TypeScript imports) can read the same value.
import Constants from 'expo-constants';

import app from './app.json';

export const APP_NAME: string = app.name;
export const APP_SLUG: string = app.slug;

/** Dev and tester (preview) builds: Settings shows tester tools (encrypted database check). Never in production. */
export const TESTER_TOOLS: boolean = __DEV__ || Constants.expoConfig?.extra?.testerTools === true;
