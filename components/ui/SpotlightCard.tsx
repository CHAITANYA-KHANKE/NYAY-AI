'use client';

/**
 * components/ui/SpotlightCard.tsx — Card with a cursor-tracking radial
 * highlight (reactbits "spotlight" pattern). Positions are written to
 * CSS variables consumed by .spotlight-card::before — no re-renders.
 */

import type { ReactNode } from 'react';

interface SpotlightCardProps {
  children: ReactNode;
  className?: string;
}

export default function SpotlightCard({ children, className = '' }: SpotlightCardProps) {
  function handleMouseMove(event: React.MouseEvent<HTMLDivElement>): void {
    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();
    target.style.setProperty('--x', `${event.clientX - rect.left}px`);
    target.style.setProperty('--y', `${event.clientY - rect.top}px`);
  }

  return (
    <div onMouseMove={handleMouseMove} className={`spotlight-card ${className}`}>
      {children}
    </div>
  );
}
