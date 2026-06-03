export function Hero({ newCount }: { newCount: number }) {
  return (
    <div className="hero">
      <div className="eyebrow">Found &amp; checked by hand · {newCount} new today</div>
      <h1>This week&apos;s best fares from the Baltics.</h1>
      <p>We find the cheap ones, check they&apos;re real, and tell you why each is good — and the catch. You book direct.</p>
    </div>
  );
}
