/**
 * scripts/build-sample-pdf.mjs
 * Regenerates public/sample-offer-letter.pdf — a realistic 2-page offer
 * letter used by the "Try a sample offer letter" button on the landing
 * page. Builds a valid PDF 1.4 file by hand (no dependencies).
 *
 * Usage: npm run sample:pdf
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(root, 'public', 'sample-offer-letter.pdf');

/* ------------------------------ document ------------------------------ */
// `null` = blank spacer line. Lines are wrapped to fit Helvetica 11pt.
const PAGE_1 = [
  'ACME TECHNOLOGIES PRIVATE LIMITED',
  'Registered Office: 14th Floor, Cyber Tower, HITEC City, Hyderabad 500081',
  'CIN: U72200TG2015PTC098765',
  null,
  'OFFER OF EMPLOYMENT',
  null,
  'Date: 12th August 2026',
  'To,',
  'Rahul Verma',
  'B-204, Lakeview Residency, Powai, Mumbai 400076',
  null,
  'Dear Rahul,',
  'We are pleased to offer you employment with Acme Technologies Private Limited',
  '("the Company") on the following terms and conditions:',
  null,
  '1. POSITION AND DUTIES',
  '1.1 You shall be employed as Software Engineer II, reporting to the Engineering',
  'Manager, Platform Team.',
  '1.2 Your date of joining shall be 1st October 2026.',
  '1.3 The Company may transfer you to any of its offices in India with 30 days notice.',
  null,
  '2. COMPENSATION',
  '2.1 Your annual Cost to Company (CTC) shall be Rs. 18,00,000 (Rupees Eighteen',
  'Lakh only), comprising Basic Salary, HRA, Special Allowance and statutory',
  'components as per Annexure A.',
  '2.2 A one-time joining bonus of Rs. 1,00,000 shall be paid with the first salary,',
  'recoverable in full if you resign within 12 months of joining.',
  null,
  '3. PROBATION',
  '3.1 You will be on probation for 6 months, extendable by 3 months at the sole',
  'discretion of the Company.',
  null,
  '4. NOTICE PERIOD',
  '4.1 During probation, either party may terminate with 15 days written notice.',
  '4.2 After confirmation, either party may terminate with 60 days written notice',
  'or salary in lieu thereof, at the discretion of the Company.',
  '4.3 The Company reserves the right to terminate without notice in cases of',
  'misconduct, as solely determined by the Company.',
  null,
  '5. SERVICE AGREEMENT (BOND)',
  '5.1 You agree to serve the Company for a minimum period of 24 months from',
  'the date of joining.',
  '5.2 In the event of breach, you shall pay liquidated damages of Rs. 2,00,000',
  '(Rupees Two Lakh only) within 30 days of separation.',
];

const PAGE_2 = [
  '6. NON-COMPETE AND NON-SOLICITATION',
  '6.1 For 12 months after separation, you shall not join any direct competitor of',
  'the Company, as determined by the Company, anywhere in India.',
  '6.2 For 18 months after separation, you shall not solicit any employee or client',
  'of the Company.',
  null,
  '7. INTELLECTUAL PROPERTY',
  '7.1 All work product, inventions and code created during employment, whether',
  'or not during working hours and whether or not related to your duties, shall be',
  'the exclusive property of the Company.',
  null,
  '8. TERMINATION',
  '8.1 The Company may terminate this employment at any time without assigning',
  'any reason, by providing notice as per Clause 4.',
  '8.2 Upon termination, you shall return all Company property within 7 days.',
  null,
  '9. CONFIDENTIALITY',
  '9.1 You shall keep all Company information confidential during and after',
  'employment, without any time limit.',
  null,
  '10. GOVERNING LAW AND JURISDICTION',
  '10.1 This offer shall be governed by the laws of India. Courts at Hyderabad',
  'shall have exclusive jurisdiction.',
  null,
  'Please sign and return a copy of this letter as acceptance by 20th August 2026.',
  null,
  'For Acme Technologies Private Limited,',
  null,
  null,
  'Priya Sharma',
  'Director - Human Resources',
  null,
  'ACCEPTED AND AGREED:',
  'Signature: ____________________    Date: ____________',
  'Name: Rahul Verma',
];

/* --------------------------- PDF construction -------------------------- */

const wrap = (line, max = 86) => {
  if (line.length <= max) return [line];
  return line
    .match(new RegExp(`.{1,${max}}(?:\\s|$)`, 'g'))
    .map((part) => part.trimEnd());
};

const escapePdfText = (text) => text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

function pageContentStream(lines) {
  const wrapped = lines.flatMap((line) => (line === null ? [''] : wrap(line)));
  const body = wrapped
    .map((line, index) => `${index === 0 ? '' : 'T* '}(${escapePdfText(line)}) Tj`)
    .join('\r\n');
  return `BT\r\n/F1 11 Tf\r\n50 742 Td\r\n15 TL\r\n${body}\r\nET`;
}

function buildPdf(pages) {
  const objects = [];
  const pageObjNums = pages.map((_, i) => 3 + i);
  const contentObjNums = pages.map((_, i) => 3 + pages.length + i);
  const fontObjNum = 3 + pages.length * 2;

  objects[0] = `<< /Type /Catalog /Pages 2 0 R >>`;
  objects[1] = `<< /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  pages.forEach((_, i) => {
    objects[2 + i] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ` +
      `/Resources << /Font << /F1 ${fontObjNum} 0 R >> >> /Contents ${contentObjNums[i]} 0 R >>`;
  });
  pages.forEach((lines, i) => {
    const stream = pageContentStream(lines);
    objects[2 + pages.length + i] = `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\r\nstream\r\n${stream}\r\nendstream`;
  });
  objects[2 + pages.length * 2] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`;

  let pdf = '%PDF-1.4\r\n';
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${i + 1} 0 obj\r\n${body}\r\nendobj\r\n`;
  });

  const xrefStart = Buffer.byteLength(pdf, 'latin1');
  const count = objects.length + 1;
  pdf += `xref\r\n0 ${count}\r\n0000000000 65535 f \r\n`;
  offsets.forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \r\n`;
  });
  pdf += `trailer\r\n<< /Size ${count} /Root 1 0 R >>\r\nstartxref\r\n${xrefStart}\r\n%%EOF\r\n`;

  return Buffer.from(pdf, 'latin1');
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, buildPdf([PAGE_1, PAGE_2]));
console.log(`Sample offer letter written to ${outPath}`);
