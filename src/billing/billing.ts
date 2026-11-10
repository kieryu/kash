import { APP_NAME } from '@/config/app';
import { getEntitlement, setEntitlement } from '@/db/repositories/settings';
import type { Db } from '@/db/schema';

// Google Play one-time "pro_unlock" (CLAUDE.md §20, D43). No purchase server: Play verifies on the phone.
// This file is the rules; `playStore.ts` talks to Play. Kept apart so the rules are tested without a phone.

export const PRO_SKU = 'pro_unlock';
export const PRO_PRICE = '₱99'; // shown until Play returns the local price
export type BillingResult = 'unlocked' | 'pending' | 'not_found' | 'cancelled' | 'failed' | 'unavailable';

/** What the app needs from Google Play. Any method may throw when Play can't be reached. */
export interface Store {
  /** Play's localized price, e.g. "₱99.00", or null if the product isn't available. */
  price(): Promise<string | null>;
  /** Opens Play's purchase sheet. 'owned' = this account already bought it. Acknowledges a completed purchase. */
  buy(): Promise<'bought' | 'pending' | 'cancelled' | 'owned' | 'failed'>;
  /** Whether this Google account owns Pro. Acknowledges any completed purchase that isn't yet. */
  owned(): Promise<'owned' | 'pending' | 'none'>;
}

function grant(db: Db) {
  setEntitlement(db, { isPro: true, source: 'play', checkedAt: new Date().toISOString() });
}

export async function buyPro(db: Db, store: Store): Promise<BillingResult> {
  let r: Awaited<ReturnType<Store['buy']>>;
  try {
    r = await store.buy();
  } catch {
    return 'unavailable';
  }
  if (r === 'owned') return restorePro(db, store);
  if (r !== 'bought') return r;
  grant(db);
  return 'unlocked';
}

export async function restorePro(db: Db, store: Store): Promise<BillingResult> {
  let owns: Awaited<ReturnType<Store['owned']>>;
  try {
    owns = await store.owned();
  } catch {
    return 'unavailable';
  }
  if (owns === 'pending') return 'pending';
  if (owns === 'none') return 'not_found';
  grant(db);
  return 'unlocked';
}

/**
 * On launch: match the local entitlement to Play (§20). Grants a purchase that finished while the app was closed
 * (pending payments, another phone) and removes Pro after a refund. Can't reach Play → keeps what we have.
 * Losing Pro never deletes data: extra debts turn read-only. Pro left over from the old tester switch ('test', D41)
 * is cleared the same way once Play says this account doesn't own it.
 */
export async function syncPro(db: Db, store: Store): Promise<void> {
  const current = getEntitlement(db);
  let owns: Awaited<ReturnType<Store['owned']>>;
  try {
    owns = await store.owned();
  } catch {
    return;
  }
  if (owns === 'owned') grant(db);
  else if (owns === 'none' && current.isPro) setEntitlement(db, { isPro: false, source: null, checkedAt: new Date().toISOString() });
}

export const BILLING_MESSAGES: Record<Exclude<BillingResult, 'unlocked'>, string | null> = {
  unavailable: `Couldn't reach Google Play. Check that you're online and signed in to the Play Store, then try again.`,
  pending: `Your payment is still processing. ${APP_NAME} Pro unlocks by itself once Google Play confirms it.`,
  failed: `Google Play couldn't finish the purchase. Try again, or tap Restore purchase if you were charged.`,
  not_found: `No ${APP_NAME} Pro purchase found for this Google account.`,
  cancelled: null,
};
