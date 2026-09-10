// Letter cadence constants — spec §6, module-level like the rest of the desk.
// There is no scheduler (decision D1: no always-on host); the digest labels are
// informational, shown on the Letters page next to the send button.

/** Days between free nurture letters. */
export const FREE_LETTER_CADENCE_DAYS = 10;
/** Fresh (still live) deals in a free letter. */
export const FREE_LETTER_FRESH = 2;
/** Expired deals shown under „Ką praleidai" in a free letter. */
export const FREE_LETTER_MISSED = 3;

/** Paid digest send slot, Europe/Vilnius — a label, not a trigger. */
export const DIGEST_DAY = 'Thursday';
export const DIGEST_TIME = '07:00';
