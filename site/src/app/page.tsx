import { getLiveDeals, getInspirationDeals } from '@/lib/queries';
import { toTicket } from '@/lib/mappers';
import { Header } from '@/components/Header';
import { Hero } from '@/components/Hero';
import { LiveDeals } from '@/components/LiveDeals';
import { CaptureBand } from '@/components/CaptureBand';
import { PastFares } from '@/components/PastFares';
import { Collections } from '@/components/Collections';
import { ProcessBand } from '@/components/ProcessBand';
import { EarlyAlertsBand } from '@/components/EarlyAlertsBand';
import { Faq, HOME_FAQ } from '@/components/Faq';
import { Footer } from '@/components/Footer';
import { StickyCta } from '@/components/StickyCta';

export const revalidate = 300; // ISR: refresh every 5 min

export default async function Home() {
  const now = new Date();
  const live = (await getLiveDeals()).map((r) => toTicket(r, now));
  const past = (await getInspirationDeals(3)).map((r) => toTicket(r, now));
  const [featured = null, ...rest] = live;

  return (
    <main className="yip-home" id="capture-top">
      <Header />
      <Hero newCount={live.length} topDeal={featured} />
      <LiveDeals featured={featured} rest={rest.slice(0, 2)} />
      <CaptureBand />
      {past.length > 0 && <PastFares deals={past} />}
      <Collections />
      <ProcessBand />
      <EarlyAlertsBand />
      <Faq items={HOME_FAQ} />
      <Footer />
      <StickyCta />
    </main>
  );
}
