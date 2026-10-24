// 13–19 digits, optionally split by single spaces or dashes ("4111 1111-1111 1111").
const DIGIT_RUN = /\d(?:[ -]?\d){12,18}/g;

/** True if free text seems to contain a payment card number (Luhn-valid), so the UI can warn (§4). */
export function looksLikeCardNumber(text: string): boolean {
  return (text.match(DIGIT_RUN) ?? []).some((run) => luhn(run.replace(/\D/g, '')));
}

function luhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) d = d * 2 > 9 ? d * 2 - 9 : d * 2;
    sum += d;
  }
  return sum % 10 === 0;
}
