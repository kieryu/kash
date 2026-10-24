import { APP_NAME } from '@/config/app';
import { setEntitlement } from '@/db/repositories/settings';
import type { Db } from '@/db/schema';

// Google Play one-time "pro_unlock" (CLAUDE.md §20). No purchase server; Play verifies on the phone.
// ponytail: stub until expo-iap is added at public launch; swap the two store calls below then.

export const PRO_PRICE = '₱99'; // at launch: the price Play returns
export type BillingResult = 'unlocked' | 'not_found' | 'cancelled' | 'unavailable';

async function storeBuy(): Promise<'bought' | 'cancelled' | 'unavailable'> {
  return 'unavailable';
}

async function storeOwnsPro(): Promise<boolean | 'unavailable'> {
  return 'unavailable';
}

function grant(db: Db) {
  setEntitlement(db, { isPro: true, source: 'play', checkedAt: new Date().toISOString() });
}

export async function buyPro(db: Db): Promise<BillingResult> {
  const r = await storeBuy();
  if (r !== 'bought') return r;
  grant(db);
  return 'unlocked';
}

export async function restorePro(db: Db): Promise<BillingResult> {
  const owns = await storeOwnsPro();
  if (owns === 'unavailable') return owns;
  if (!owns) return 'not_found';
  grant(db);
  return 'unlocked';
}

export const BILLING_MESSAGES: Record<Exclude<BillingResult, 'unlocked'>, string | null> = {
  unavailable: `Purchases open when ${APP_NAME} launches on Google Play. Everything you need to pay off debt is free now.`,
  not_found: `No ${APP_NAME} Pro purchase found for this Google account.`,
  cancelled: null,
};
