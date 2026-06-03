import { getPublishedDeals } from '@/lib/queries';
import { PublishedBoard } from '@/components/PublishedBoard';

export default async function PublishedPage() {
  const deals = await getPublishedDeals();
  return <PublishedBoard deals={deals} />;
}
