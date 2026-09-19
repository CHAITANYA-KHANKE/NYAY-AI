import type { ReactNode } from 'react';

/**
 * components/ui/GradientText.tsx — Animated gradient headline text.
 * The shimmer lives in .text-gradient-animated (globals.css).
 */
export default function GradientText({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={`text-gradient-animated ${className}`}>{children}</span>;
}
