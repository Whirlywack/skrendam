import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDeal } from '@/lib/queries';
import { toPublicDeal } from '@/lib/mappers';
import { priceContext } from '@/lib/priceContext';
import { DealDetail } from '@/components/DealDetail';

export const revalidate = 300;

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numId = Number(id);
  if (Number.isNaN(numId)) notFound();
  const row = await getDeal(numId);
  if (!row) notFound();
  const now = new Date();
  const deal = toPublicDeal(row, now);
  const stats = await priceContext(row.pd.origin, row.pd.destination, row.pd.tripType, deal.price, now);
  if (stats.hasHistory) deal.why = `−${deal.drop}% vs the 90-day median (€${stats.median})`;
  return <DealDetail deal={deal} stats={stats} snapshot={row.snapshot} />;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const numId = Number(id);
  if (Number.isNaN(numId)) return { title: 'Deal — Yip' };
  const row = await getDeal(numId);
  if (!row) return { title: 'Deal — Yip' };
  const d = toPublicDeal(row, new Date());
  const noindex = row.pd.status !== 'live';
  return {
    title: `${d.destination} €${d.price} — Yip`,
    description: `${d.route} · ${d.dates} · ${d.why}. Found and checked by hand.`,
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}
