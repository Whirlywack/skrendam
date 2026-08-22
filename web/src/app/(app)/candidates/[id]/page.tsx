import { notFound } from 'next/navigation';
import { getCandidateRow } from '@/lib/queries';
import { toCandidateView } from '@/lib/mappers';
import { Composer } from '@/components/Composer';

// Next.js 16: params is a Promise — must be awaited.
export default async function CandidatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Strip the leading "m" prefix used by CandidateView.id (e.g. "m42" → 42)
  const row = await getCandidateRow(Number(id.replace(/^m/, '')));
  if (!row) notFound();

  // Inline mode: no scrim, no close button, renders in-flow as the full review
  // room. onClose is intentionally omitted — a function prop from a Server
  // Component cannot cross the RSC boundary (it crashed this page before).
  return <Composer c={toCandidateView(row)} inline />;
}
