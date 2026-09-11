import { getDealCheckCounts, getPublishedDeals } from '@/lib/queries';
import { PublishedBoard } from '@/components/PublishedBoard';

export default async function PublishedPage() {
  const [deals, checkCounts] = await Promise.all([getPublishedDeals(), getDealCheckCounts()]);
  return <PublishedBoard deals={deals} checkCounts={checkCounts} />;
}
