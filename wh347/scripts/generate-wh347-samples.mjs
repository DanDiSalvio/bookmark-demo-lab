import PDFDocument from 'pdfkit';
import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '../app/samples');

function writePdf(filename, lines) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const stream = createWriteStream(join(outDir, filename));
    doc.pipe(stream);
    doc.fontSize(10);
    for (const line of lines) {
      if (line === '__PAGE__') {
        doc.addPage();
      } else if (line.startsWith('##')) {
        doc.moveDown(0.5).fontSize(12).font('Helvetica-Bold').text(line.slice(2).trim());
        doc.fontSize(10).font('Helvetica');
      } else {
        doc.text(line);
      }
    }
    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

const commonHeader = [
  '## CERTIFIED PAYROLL FORM WH-347',
  'U.S. Department of Labor — Wage and Hour Division',
  'OMB Control No. 1235-0008, Expires 01/31/2028',
  '',
  'Project Name: Riverside Federal Courthouse Renovation',
  'Project No. or Contract No.: DE-AC05-26SF-22441',
  'Certified Payroll No.: 12',
  'Prime Contractor or Subcontractor: [X] Subcontractor',
  'Subcontractor Business Name: Apex Mechanical LLC',
  'Project Location: 1200 Constitution Ave, Denver, CO 80203',
  'Week Ending Date: 09/27/2026',
];

const page1Workers = [
  '',
  'Wage Determination No.: CO20260001 Rev. 8',
  '',
  'Worker 1: Martinez, Juan — J — Pipefitter — 40 hrs ST',
  'Worker 2: Chen, Lisa — J — HVAC Mechanic — 38 hrs ST, 2 hrs OT',
  'Worker 3: Brooks, Tyler — RA Level 2 — Plumber Apprentice — 40 hrs ST',
];

const page2Pass = [
  '__PAGE__',
  '## STATEMENT OF COMPLIANCE',
  '',
  'Project Name: Riverside Federal Courthouse Renovation',
  'Payroll No.: 12',
  'Week Ending Date: 09/27/2026',
  '',
  '[X] Box 1 — Wages paid in accordance with wage determination',
  '[X] Box 2 — Classification of workers is correct',
  '[X] Box 3 — Apprentices employed only as permitted',
  '[X] Box 4 — Apprentices employed during the period',
  'Apprenticeship Program: Denver Pipefitters JATC — Registered with DOL Office of Apprenticeship (OA)',
  'Labor Classification: Plumber Apprentice — Tyler Brooks',
  '[X] Box 5 — Fringe benefits paid to approved plans',
  '',
  '## Hourly Credit for Fringe Benefits',
  'Worker 1 Martinez — Health & Welfare Plan #4521 — Funded — $4.82/hr',
  'Worker 2 Chen — Pension Plan #8830 — Funded — $6.15/hr',
  'Worker 3 Brooks — Training Fund #2201 — Funded — $2.40/hr',
  '',
  '[X] Box 6 — Deductions are lawful',
  '',
  'Certifying Official: Robert Kim, Payroll Manager',
  'Signature: /s/ Robert Kim',
  'Date Signed: 09/28/2026',
  'Telephone: (303) 555-0142',
  'Email: payroll@apexmechanical.example',
];

const oldRevision = [
  '## CERTIFIED PAYROLL FORM WH-347',
  'U.S. Department of Labor — Wage and Hour Division',
  'OMB Control No. 1235-0008, Expires 09/30/2026',
  '',
  'Project Name: Riverside Federal Courthouse Renovation',
  'Project No. or Contract No.: DE-AC05-26SF-22441',
  'Certified Payroll No.: 11',
  'Subcontractor Business Name: Summit Electric Inc.',
  'Project Location: 1200 Constitution Ave, Denver, CO 80203',
  'Week Ending Date: 09/20/2026',
  '',
  'Wage Determination No.: CO20260001 Rev. 8',
  '',
  'Worker 1: Davis, Marcus — J — Electrician — 40 hrs ST',
  '__PAGE__',
  '## STATEMENT OF COMPLIANCE',
  '[X] Box 1 — Wages paid in accordance with wage determination',
  '[X] Box 2 — Classification of workers is correct',
  'Certifying Official: Jane Summit, Controller',
  'Signature: /s/ Jane Summit',
  'Date Signed: 09/21/2026',
];

const failMissing = [
  '## CERTIFIED PAYROLL FORM WH-347',
  'U.S. Department of Labor — Wage and Hour Division',
  'OMB Control No. 1235-0008, Expires 01/31/2028',
  '',
  'Project Name: Riverside Federal Courthouse Renovation',
  'Project No. or Contract No.: DE-AC05-26SF-22441',
  'Certified Payroll No.: 10',
  'Subcontractor Business Name: Quick Drywall Co.',
  'Project Location: 1200 Constitution Ave, Denver, CO 80203',
  'Week Ending Date: 09/13/2026',
  '',
  'Wage Determination No.: _______________',
  '',
  'Worker 1: Nguyen, Pat — RA — Drywall Finisher Apprentice — 32 hrs ST',
  'Worker 2: Walsh, Erin — J — Drywall Installer — 40 hrs ST',
  '__PAGE__',
  '## STATEMENT OF COMPLIANCE',
  '[X] Box 1 — Wages paid in accordance with wage determination',
  '[ ] Box 4 — Apprentices employed during the period',
  'Apprenticeship Program: (blank)',
  '',
  'Certifying Official: _________________________',
  'Signature: _________________________ (unsigned)',
  'Date Signed: _______________',
  'Telephone: (303) 555-0199',
];

await mkdir(outDir, { recursive: true });
await writePdf('pass-apex-mechanical.pdf', [...commonHeader, ...page1Workers, ...page2Pass]);
await writePdf('fail-old-revision.pdf', oldRevision);
await writePdf('fail-missing-wd-unsigned.pdf', failMissing);
console.log('Generated 3 sample PDFs in', outDir);
