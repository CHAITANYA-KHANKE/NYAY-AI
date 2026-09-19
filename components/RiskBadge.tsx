import { AlertCircle, AlertTriangle, CheckCircle, type LucideIcon } from 'lucide-react';
import type { RiskLevel } from '@/lib/types';

/**
 * components/RiskBadge.tsx — Color-coded risk pill (brain/08).
 * HIGH red / MEDIUM amber / LOW green, each with a distinct icon
 * so meaning never depends on color alone (WCAG 2.1).
 */

const STYLES: Record<RiskLevel, { classes: string; icon: LucideIcon }> = {
  HIGH: { classes: 'bg-risk-high text-white', icon: AlertTriangle },
  MEDIUM: { classes: 'bg-risk-medium text-slate-900', icon: AlertCircle },
  LOW: { classes: 'bg-risk-low text-white', icon: CheckCircle },
};

interface RiskBadgeProps {
  level: RiskLevel;
  size?: 'sm' | 'md';
}

export default function RiskBadge({ level, size = 'md' }: RiskBadgeProps) {
  const { classes, icon: Icon } = STYLES[level];
  const sizing = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]';
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';

  return (
    <span
      role="status"
      aria-label={`Risk level: ${level}`}
      className={`inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wide ${classes} ${sizing}`}
    >
      <Icon className={iconSize} aria-hidden="true" />
      {level}
    </span>
  );
}
