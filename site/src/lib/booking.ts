export type BookingKind = 'airline' | 'ota' | 'google';
export interface BookingCta { kind: BookingKind; button: string; sub: string; url: string; }

function isSafeUrl(u: string): boolean {
  // https only: booking links are outbound hrefs on public pages; a stray
  // http:// link must not downgrade the visitor to cleartext.
  try { return new URL(u).protocol === 'https:'; }
  catch { return false; }
}

// v1: published_deals stores the Google Flights tfs deep link → 'google'. The 'airline'/'ota'
// variants need engine vendor-resolution (get_booking_options) — a flagged fast-follow.
export function bookingCta(bookingUrl: string | null, vendor: string | null = null,
                           kind: BookingKind = 'google'): BookingCta {
  const url = bookingUrl && isSafeUrl(bookingUrl) ? bookingUrl : 'https://www.google.com/travel/flights';
  if (kind === 'airline' && vendor)
    return { kind, button: `Book with ${vendor}`, sub: 'Airline-direct · live price shown there', url };
  if (kind === 'ota')
    return { kind, button: 'Open booking partner', sub: 'Live price shown before you pay', url };
  return { kind: 'google', button: 'Open in Google Flights', sub: 'Use this to check live availability & book', url };
}
