// @vitest-environment jsdom
/**
 * tests/components.test.tsx — React Testing Library component tests.
 * Verifies rendered output, accessible names and the mandatory trust
 * elements (risk labels, disclaimer, citations) in the actual DOM.
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import CitationBadge from '../components/CitationBadge';
import Disclaimer from '../components/Disclaimer';
import Navbar from '../components/Navbar';
import RiskBadge from '../components/RiskBadge';
import { APP_TAGLINE, LEGAL_DISCLAIMER } from '../lib/constants';

describe('RiskBadge', () => {
  it.each([
    ['HIGH', /high/i],
    ['MEDIUM', /medium/i],
    ['LOW', /low/i],
  ] as const)('renders %s with an accessible risk name', (level, pattern) => {
    render(<RiskBadge level={level} />);
    expect(screen.getByRole('status', { name: `Risk level: ${level}` })).toBeInTheDocument();
    expect(screen.getByText(pattern)).toBeInTheDocument();
  });
});

describe('Disclaimer', () => {
  it('renders the mandatory disclaimer as a labelled note', () => {
    render(<Disclaimer />);
    const note = screen.getByRole('note', { name: 'Legal disclaimer' });
    expect(note).toBeInTheDocument();
    expect(note).toHaveTextContent(LEGAL_DISCLAIMER);
    expect(note.textContent).toContain('does not constitute legal advice');
  });
});

describe('CitationBadge', () => {
  it('renders "Clause X.Y | Pg Z" and exposes a verify action', () => {
    render(<CitationBadge clauseNumber="8.2" pageNumber={2} quote="return all Company property" />);
    expect(screen.getByText('Clause 8.2 | Pg 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /verify citation/i })).toBeInTheDocument();
  });

  it('labels unnumbered sections as General', () => {
    render(<CitationBadge clauseNumber="General" pageNumber={1} />);
    expect(screen.getByText('General | Pg 1')).toBeInTheDocument();
  });

  it('shows the exact quote in the hover tooltip', () => {
    render(<CitationBadge clauseNumber="4.2" pageNumber={1} quote="60 days written notice" />);
    // Tooltip is CSS-hidden until hover, so match hidden elements too.
    expect(screen.getByRole('tooltip', { hidden: true })).toHaveTextContent('60 days written notice');
  });
});

describe('Navbar', () => {
  it('renders brand, tagline and a labelled navigation landmark', () => {
    render(<Navbar />);
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /nyayai home/i })).toBeInTheDocument();
    expect(screen.getByText(APP_TAGLINE)).toBeInTheDocument();
  });

  it('does not render hackathon/promotional badges in the UI', () => {
    render(<Navbar />);
    expect(screen.queryByText(/promptwars/i)).not.toBeInTheDocument();
  });
});
