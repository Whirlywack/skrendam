import { getLiveDeals, getInspirationDeals } from '@/lib/queries';
import { toPublicDeal } from '@/lib/mappers';
import { Header } from '@/components/Header';
import { Hero } from '@/components/Hero';
import { Tabs } from '@/components/Tabs';
import { CaptureBand } from '@/components/CaptureBand';

export const revalidate = 300; // ISR: refresh the feed every 5 min

export default async function Home() {
  const now = new Date();
  const live = (await getLiveDeals()).map((r) => toPublicDeal(r, now));
  const inspiration = (await getInspirationDeals()).map((r) => toPublicDeal(r, now));
  return (
    <main>
      <Header />
      <Hero newCount={live.length} />
      <Tabs bookNow={live} inspiration={inspiration} />
      <CaptureBand />
    </main>
  );
}
