import type { DisplayStatus } from './types';
export function toDisplayStatus(engineStatus: string, hasPublishedDeal: boolean): DisplayStatus {
  if (hasPublishedDeal || engineStatus === 'approved' || engineStatus === 'edited') return 'published';
  if (engineStatus === 'rejected') return 'rejected';
  if (engineStatus === 'expired') return 'expired';
  if (engineStatus === 'seen' || engineStatus === 'maybe') return 'review';
  return 'suggested'; // "new"
}
