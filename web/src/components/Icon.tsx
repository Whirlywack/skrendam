import * as icons from 'lucide-react';
import type { ComponentType } from 'react';

export function Icon({
  name,
  size = 18,
  color = 'currentColor',
  strokeWidth = 2,
}: {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const Cmp = (icons as unknown as Record<string, ComponentType<{ size?: number; color?: string; strokeWidth?: number }>>)[name];
  return Cmp ? <Cmp size={size} color={color} strokeWidth={strokeWidth} /> : null;
}
