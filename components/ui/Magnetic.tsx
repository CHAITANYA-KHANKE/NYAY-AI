'use client';

/**
 * components/ui/Magnetic.tsx — Magnetic hover wrapper: the element is
 * gently pulled toward the cursor and springs back on leave. Direct
 * style writes (no state) keep it at 60fps; touch users are unaffected.
 */

import { useRef, type PointerEvent, type ReactNode } from 'react';

interface MagneticProps {
  children: ReactNode;
  /** 0-1 — fraction of cursor offset applied. */
  strength?: number;
  className?: string;
}

const SPRING = 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)';

export default function Magnetic({ children, strength = 0.25, className = '' }: MagneticProps) {
  const ref = useRef<HTMLDivElement>(null);

  function handleMove(event: PointerEvent<HTMLDivElement>): void {
    const element = ref.current;
    if (!element) return;
    if (event.pointerType === 'touch') return;
    const rect = element.getBoundingClientRect();
    const dx = (event.clientX - (rect.left + rect.width / 2)) * strength;
    const dy = (event.clientY - (rect.top + rect.height / 2)) * strength;
    element.style.transition = 'none';
    element.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  function handleLeave(): void {
    const element = ref.current;
    if (!element) return;
    element.style.transition = SPRING;
    element.style.transform = 'translate(0px, 0px)';
  }

  return (
    <div
      ref={ref}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      className={`inline-block will-change-transform ${className}`}
    >
      {children}
    </div>
  );
}
