import type { QualityTag as Q } from '@/lib/quality';

export function QualityTag({ quality }: { quality: Q }) {
  return (
    <span className={`tag ${quality === 'rare' ? 'tag-rare' : 'tag-great'}`}>
      {quality === 'rare' ? 'Rare deal' : 'Great deal'}
    </span>
  );
}
