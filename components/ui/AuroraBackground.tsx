/**
 * components/ui/AuroraBackground.tsx — Premium dark-hero backdrop:
 * drifting aurora blobs, a fading grid texture and floating particles.
 * Purely decorative (aria-hidden), fully CSS-driven.
 */

interface Particle {
  left: string;
  top: string;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
}

const PARTICLES: Particle[] = [
  { left: '8%', top: '24%', size: 3, duration: 7, delay: 0, opacity: 0.5 },
  { left: '16%', top: '62%', size: 2, duration: 9, delay: 1.2, opacity: 0.35 },
  { left: '24%', top: '12%', size: 2, duration: 8, delay: 2, opacity: 0.4 },
  { left: '33%', top: '78%', size: 3, duration: 10, delay: 0.6, opacity: 0.3 },
  { left: '45%', top: '18%', size: 2, duration: 7.5, delay: 1.6, opacity: 0.45 },
  { left: '54%', top: '66%', size: 2, duration: 9.5, delay: 0.3, opacity: 0.3 },
  { left: '63%', top: '10%', size: 3, duration: 8.5, delay: 2.4, opacity: 0.4 },
  { left: '71%', top: '54%', size: 2, duration: 7, delay: 1, opacity: 0.35 },
  { left: '79%', top: '28%', size: 3, duration: 10.5, delay: 0.8, opacity: 0.45 },
  { left: '87%', top: '70%', size: 2, duration: 8, delay: 1.9, opacity: 0.3 },
  { left: '93%', top: '16%', size: 2, duration: 9, delay: 0.4, opacity: 0.4 },
  { left: '42%', top: '86%', size: 2, duration: 11, delay: 2.8, opacity: 0.28 },
];

export default function AuroraBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="bg-grid bg-grid-fade absolute inset-0" />
      <div className="blob-aurora absolute -left-32 -top-32 h-[26rem] w-[26rem] rounded-full bg-indigo-600/40 blur-[110px]" />
      <div className="blob-aurora-slow absolute -right-32 top-1/3 h-[24rem] w-[24rem] rounded-full bg-sky-500/30 blur-[110px]" />
      <div className="blob-aurora absolute -bottom-40 left-1/3 h-[22rem] w-[22rem] rounded-full bg-fuchsia-500/25 blur-[120px]" />
      {PARTICLES.map((particle, index) => (
        <span
          key={index}
          className="animate-float absolute rounded-full bg-white/50"
          style={{
            left: particle.left,
            top: particle.top,
            width: particle.size,
            height: particle.size,
            opacity: particle.opacity,
            animationDuration: `${particle.duration}s`,
            animationDelay: `${particle.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
