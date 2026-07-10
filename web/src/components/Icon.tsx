import {
  AlertTriangle,
  Archive,
  Check,
  CheckCircle,
  Clock,
  Copy,
  Loader,
  Mail,
  Music,
  RefreshCw,
  Type,
  X,
} from 'lucide-react';
import type { ComponentType } from 'react';

// Literal named imports keep the client bundle to just these icons; the old
// `import * as icons` namespace + runtime lookup shipped the whole library.
const ICONS = {
  AlertTriangle,
  Archive,
  Check,
  CheckCircle,
  Clock,
  Copy,
  Loader,
  Mail,
  Music,
  RefreshCw,
  Type,
  X,
} satisfies Record<string, ComponentType<{ size?: number; color?: string; strokeWidth?: number }>>;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 18,
  color = 'currentColor',
  strokeWidth = 2,
}: {
  name: IconName | (string & {});
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const Cmp = (ICONS as Record<string, ComponentType<{ size?: number; color?: string; strokeWidth?: number }>>)[name];
  return Cmp ? <Cmp size={size} color={color} strokeWidth={strokeWidth} /> : null;
}
