import type { PublicDeal } from '@/lib/types';

export function BookingCta({ booking }: { booking: PublicDeal['booking'] }) {
  return (
    <>
      <a className="btn" href={booking.url} target="_blank" rel="noopener noreferrer">
        {booking.button} &rarr;
      </a>
      <div className="bookmeta">{booking.sub}</div>
    </>
  );
}
