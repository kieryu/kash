import type * as Iap from 'expo-iap';

import { PRO_SKU, type Store } from './billing';

// Google Play through expo-iap (D43). Only the on-device Play Billing calls are used. Never call kitApi,
// verifyPurchase, verifyPurchaseWithProvider or verifyAppOwnership: those send data to servers.

const WAIT_MS = 10 * 60 * 1000; // purchase sheet left open: give up waiting, then check what Play has

let iap: typeof Iap | null | undefined;
let connected: Promise<void> | null = null;
let lastError: string | null = null;

/** Play's reason for the last failed purchase (error code + Play response code), for support. No user data. */
export const lastBillingError = () => lastError;

type IapError = { code?: string; responseCode?: number | null; debugMessage?: string | null; message?: string };
const describe = (e: IapError | null | undefined) =>
  [e?.code, e?.responseCode != null ? `#${e.responseCode}` : null, e?.debugMessage || e?.message].filter(Boolean).join(' · ') ||
  'unknown';

/** Loaded lazily: Expo Go, web and tests have no native module, and that must not crash the app. */
function lib(): typeof Iap {
  if (iap === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy on purpose, see above
      iap = require('expo-iap') as typeof Iap;
    } catch {
      iap = null;
    }
  }
  if (!iap) throw new Error('billing unavailable');
  return iap;
}

async function connect(): Promise<typeof Iap> {
  const m = lib();
  connected ??= m.initConnection().then((ok) => {
    if (!ok) throw new Error('billing unavailable');
  });
  try {
    await connected;
  } catch (e) {
    connected = null; // retry next time (offline, Play Store updating…)
    throw e;
  }
  return m;
}

type Purchase = Iap.Purchase;

const isPro = (p: Purchase) => p.productId === PRO_SKU || (p.ids ?? []).includes(PRO_SKU);

/** Acknowledge within 3 days or Google refunds it. Safe to repeat; a failure is retried on the next check. */
async function acknowledge(m: typeof Iap, p: Purchase) {
  if ('isAcknowledgedAndroid' in p && p.isAcknowledgedAndroid) return;
  await m.finishTransaction({ purchase: p, isConsumable: false });
}

export const playStore: Store = {
  async price() {
    const m = await connect();
    const products = await m.fetchProducts({ skus: [PRO_SKU], type: 'in-app' });
    const p = (products ?? []).find((x) => x.id === PRO_SKU);
    return p?.displayPrice ?? null;
  },

  async owned() {
    const m = await connect();
    const mine = (await m.getAvailablePurchases()).filter(isPro);
    const done = mine.find((p) => p.purchaseState === 'purchased');
    if (done) {
      await acknowledge(m, done).catch(() => {});
      return 'owned';
    }
    return mine.some((p) => p.purchaseState === 'pending') ? 'pending' : 'none';
  },

  async buy() {
    lastError = null;
    const m = await connect();
    const outcome = new Promise<'bought' | 'pending' | 'cancelled' | 'owned' | 'failed'>((resolve) => {
      const done = (r: Awaited<typeof outcome>) => {
        ok.remove();
        err.remove();
        clearTimeout(timer);
        resolve(r);
      };
      const ok = m.purchaseUpdatedListener((p) => {
        if (!isPro(p)) return;
        if (p.purchaseState === 'pending') return done('pending');
        if (p.purchaseState !== 'purchased') return;
        acknowledge(m, p).then(
          () => done('bought'),
          () => done('owned'), // charged but not acknowledged yet: restore path re-checks and retries
        );
      });
      const err = m.purchaseErrorListener((e) => {
        if (e.code === m.ErrorCode.UserCancelled) done('cancelled');
        else if (e.code === m.ErrorCode.AlreadyOwned) done('owned');
        else {
          lastError = describe(e);
          done('failed');
        }
      });
      const timer = setTimeout(() => done('owned'), WAIT_MS);
      m.requestPurchase({ request: { google: { skus: [PRO_SKU] } }, type: 'in-app' }).catch((e: IapError) => {
        if (e?.code === m.ErrorCode.UserCancelled) done('cancelled');
        else if (e?.code === m.ErrorCode.AlreadyOwned) done('owned');
        else {
          lastError = describe(e);
          done('failed');
        }
      });
    });
    return outcome;
  },
};
