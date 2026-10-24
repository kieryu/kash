import config from '../../../app.config';
import pkg from '../../../package.json';

// Cheap guard for the "no network" promise (docs/network-audit.md). Not a substitute for an on-device capture.
const BANNED = [
  /^expo-updates$/, // D9: contacts Expo servers on every launch
  /^expo-insights$/,
  /^@react-native-firebase\//,
  /^firebase$/,
  /^@sentry\//,
  /^sentry-expo$/,
  /^@bugsnag\//,
  /^@datadog\//,
  /^posthog-/,
  /^@segment\//,
  /^@amplitude\//,
  /^mixpanel/,
  /^react-native-purchases/, // RevenueCat: third-party purchase server (§20)
  /^@supabase\//,
  /^aws-amplify/,
  /^axios$/,
];

declare const require: (path: string) => unknown;

const banned = (name: string) => BANNED.some((re) => re.test(name));

test('no analytics, crash reporting, OTA or backend SDKs in dependencies', () => {
  const direct = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
  expect(direct.filter(banned)).toEqual([]);
});

test('no banned SDK pulled in transitively', () => {
  // Required, not imported: typing the whole lockfile would slow the typecheck.
  const lock = require('../../../package-lock.json') as { packages: Record<string, unknown> };
  const all = Object.keys(lock.packages).map((p) => p.replace(/^.*node_modules\//, ''));
  expect(all.filter(banned)).toEqual([]);
});

test('app config has no OTA updates, Firebase config or network plugins', () => {
  expect(config.updates).toBeUndefined();
  expect(config.android?.googleServicesFile).toBeUndefined();
  expect(config.ios?.googleServicesFile).toBeUndefined();
  const plugins = (config.plugins ?? []).map((p) => String(Array.isArray(p) ? p[0] : p));
  expect(plugins.filter(banned)).toEqual([]);
  // D15: no OS cloud backup of app data.
  expect(config.android?.allowBackup).toBe(false);
});
