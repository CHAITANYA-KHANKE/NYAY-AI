import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import Navbar from '@/components/Navbar';
import './globals.css';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  title: 'NyayAI — Har Contract, Crystal Clear',
  description:
    'NyayAI is an AI-powered legal document analyzer that simplifies contracts, offer letters, NDAs and rental agreements for non-lawyers — with exact citations, personalized risk flags and zero hallucination.',
  applicationName: 'NyayAI',
  keywords: ['legal AI', 'contract analyzer', 'offer letter', 'NDA', 'rental agreement', 'Gemini'],
};

export const viewport: Viewport = {
  themeColor: '#2563EB',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-surface text-ink antialiased min-h-screen`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          Skip to content
        </a>
        <Navbar />
        {children}
      </body>
    </html>
  );
}
