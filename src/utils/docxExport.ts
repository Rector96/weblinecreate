import {
  Document,
  Paragraph,
  TextRun,
  AlignmentType,
  Packer,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  Header,
  Footer,
  PageNumber,
  ImageRun,
} from 'docx';
import { saveAs } from 'file-saver';
import { Exam, School } from '../types';

const FONT_NAME = 'Times New Roman';

/** Convert AI / KaTeX-style markup into plain printable text for Word. */
export function cleanMathForPrint(input: string | null | undefined): string {
  if (!input) return '';
  let s = String(input);
  s = s.replace(/\r\n/g, '\n');
  s = s.replace(/\\\[([\s\S]*?)\\\]/g, '$1');
  s = s.replace(/\\\(([\s\S]*?)\\\)/g, '$1');
  s = s.replace(/\$\$([\s\S]*?)\$\$/g, '$1');
  s = s.replace(/\$([^$\n]+)\$/g, '$1');
  for (let i = 0; i < 6; i++) {
    const next = s.replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '$1/$2');
    if (next === s) break;
    s = next;
  }
  s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, '√($1)');
  s = s.replace(/\\sqrt\s*/g, '√');
  const ops: Array<[RegExp, string]> = [
    [/\\times\b/g, '×'], [/\\cdot\b/g, '·'], [/\\div\b/g, '÷'], [/\\pm\b/g, '±'],
    [/\\leq\b/g, '≤'], [/\\geq\b/g, '≥'], [/\\neq\b/g, '≠'], [/\\approx\b/g, '≈'],
    [/\\infty\b/g, '∞'], [/\\degree\b/g, '°'], [/\\circ\b/g, '°'], [/\\pi\b/g, 'π'],
    [/\\theta\b/g, 'θ'], [/\\alpha\b/g, 'α'], [/\\beta\b/g, 'β'], [/\\gamma\b/g, 'γ'],
    [/\\delta\b/g, 'δ'], [/\\ldots\b/g, '…'], [/\\%/g, '%'], [/\\&/g, '&'], [/\\_/g, '_'],
  ];
  for (const [re, rep] of ops) s = s.replace(re, rep);
  s = s.replace(/\\(?:text|mathrm|mathbf|textit|textbf)\s*\{([^{}]*)\}/g, '$1');
  s = s.replace(/\^{(\d+)}/g, (_m, d) => {
    const map: Record<string, string> = { '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹' };
    return d.split('').map((c: string) => map[c] || c).join('');
  });
  s = s.replace(/\^(\d)/g, (_m, d) => {
    const map: Record<string, string> = { '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹' };
    return map[d] || `^${d}`;
  });
  s = s.replace(/\\N\s*\\?\$?\s*/g, '₦');
  s = s.replace(/\bN\\?\$\s*/g, '₦');
  s = s.replace(/\\left\s*/g, '');
  s = s.replace(/\\right\s*/g, '');
  s = s.replace(/\\,/g, ' ');
  s = s.replace(/\\;/g, ' ');
  s = s.replace(/\\!/g, '');
  s = s.replace(/\\quad\b/g, '  ');
  s = s.replace(/\\[a-zA-Z]+/g, '');
  s = s.replace(/\{\s*\}/g, '');
  s = s.replace(/[ \t]{2,}/g, ' ');
  s = s.replace(/ *\n */g, '\n');
  return s.trim();
}

async function getSchoolLogoRun(school?: School | null): Promise<ImageRun | null> {
  if (!school?.logo_url) return null;
  try {
    const response = await fetch(school.logo_url);
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('svg') || contentType.includes('webp')) return null;
    const type: 'jpg' | 'gif' | 'bmp' | 'png' = contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' : contentType.includes('gif') ? 'gif' : contentType.includes('bmp') ? 'bmp' : 'png';
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.length) return null;
    return new ImageRun({ data: bytes, type, transformation: { width: 56, height: 56 } });
  } catch (error) {
    console.warn('[ROCKCRAFT] Could not embed school logo in DOCX export:', error);
    return null;
  }
}

async function getQuestionImageRun(dataUrl?: string): Promise<ImageRun | null> {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) return null;
  try {
    const comma = dataUrl.indexOf(',');
    if (comma < 0) return null;
    const binary = atob(dataUrl.slice(comma + 1));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    if (!bytes.length) return null;
    const type: 'jpg' | 'png' = dataUrl.startsWith('data:image/png') ? 'png' : 'jpg';
    return new ImageRun({ data: bytes, type, transformation: { width: 280, height: 180 } });
  } catch { return null; }
}

/** Build the official dense A4 exam paper as a Blob (used by single download and ZIP). */
export async function buildExamDocxBlob(exam: Exam, school?: School | null): Promise<Blob> {
  const schoolName = (school?.name || 'SCHOOL NAME').toUpperCase();
  const motto = school?.motto ? `"${school.motto}"` : '';
  const address = school?.address || [school?.lga, school?.state].filter(Boolean).join(', ');
  const schoolContacts = [school?.phone, school?.email].filter(Boolean).join('  •  ');

  const sectionAQuestions = (exam.questions || []).filter((q) => q.section === 'A');
  const sectionBQuestions = (exam.questions || []).filter((q) => q.section === 'B');

  const none = {
    top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  };

  const docChildren: any[] = [];
  const logo = await getSchoolLogoRun(school);
  const schoolHeaderParagraphs = [
    new Paragraph({ spacing: { after: 20 }, children: [new TextRun({ text: schoolName, font: FONT_NAME, size: 26, bold: true })] }),
    ...(motto ? [new Paragraph({ spacing: { after: 10 }, children: [new TextRun({ text: motto, font: FONT_NAME, size: 16, italics: true })] })] : []),
    ...(address ? [new Paragraph({ spacing: { after: 10 }, children: [new TextRun({ text: address, font: FONT_NAME, size: 16 })] })] : []),
    ...(schoolContacts ? [new Paragraph({ spacing: { after: 20 }, children: [new TextRun({ text: schoolContacts, font: FONT_NAME, size: 15 })] })] : []),
  ];
  docChildren.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: none,
    rows: [new TableRow({ children: [
      new TableCell({ width: { size: 16, type: WidthType.PERCENTAGE }, borders: none, verticalAlign: 'center', children: [new Paragraph({ alignment: AlignmentType.CENTER, children: logo ? [logo] : [] })] }),
      new TableCell({ width: { size: 84, type: WidthType.PERCENTAGE }, borders: none, verticalAlign: 'center', children: schoolHeaderParagraphs }),
    ]})],
  }));

  docChildren.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: '000000', space: 4 } },
    children: [new TextRun({
      text: `${(exam.term || '').toUpperCase()} EXAMINATION — ${(exam.session || '').toUpperCase()} ACADEMIC SESSION`,
      font: FONT_NAME, size: 22, bold: true,
    })],
  }));

  docChildren.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: none,
    rows: [new TableRow({ children: [
      new TableCell({ width: { size: 55, type: WidthType.PERCENTAGE }, borders: none, children: [
        new Paragraph({ spacing: { after: 16 }, children: [
          new TextRun({ text: 'SUBJECT: ', font: FONT_NAME, size: 20, bold: true }),
          new TextRun({ text: (exam.subject || '').toUpperCase(), font: FONT_NAME, size: 20 }),
        ]}),
        new Paragraph({ children: [
          new TextRun({ text: 'CLASS: ', font: FONT_NAME, size: 20, bold: true }),
          new TextRun({ text: exam.class_name || '', font: FONT_NAME, size: 20 }),
        ]}),
      ]}),
      new TableCell({ width: { size: 45, type: WidthType.PERCENTAGE }, borders: none, children: [
        new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 16 }, children: [
          new TextRun({ text: 'TIME ALLOWED: ', font: FONT_NAME, size: 20, bold: true }),
          new TextRun({ text: `${exam.duration_minutes || 60} MINUTES`, font: FONT_NAME, size: 20 }),
        ]}),
        new Paragraph({ alignment: AlignmentType.RIGHT, children: [
          new TextRun({ text: 'TOTAL MARKS: ', font: FONT_NAME, size: 20, bold: true }),
          new TextRun({ text: `${exam.total_marks || 100} MARKS`, font: FONT_NAME, size: 20 }),
        ]}),
      ]}),
    ]})],
  }));

  if ((exam.instructions || '').trim()) {
    docChildren.push(new Paragraph({
      spacing: { before: 60, after: 80 },
      children: [
        new TextRun({ text: 'GENERAL INSTRUCTIONS: ', font: FONT_NAME, size: 18, bold: true, italics: true }),
        new TextRun({ text: exam.instructions, font: FONT_NAME, size: 18, italics: true }),
      ],
    }));
  }

  if (sectionAQuestions.length > 0) {
    const sectionAMarks = exam.section_a_marks || sectionAQuestions.reduce((s, q) => s + (Number(q.marks) || 1), 0);
    docChildren.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 80, after: 40 },
      children: [new TextRun({ text: `SECTION A: OBJECTIVE TEST [${sectionAMarks} MARKS]`, font: FONT_NAME, size: 20, bold: true, underline: {} })],
    }));
    docChildren.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: 'Instruction: Answer all questions in this section. Choose the correct option (A–D).', font: FONT_NAME, size: 16, italics: true })],
    }));

    sectionAQuestions.forEach((q, idx) => {
      const qText = cleanMathForPrint(q.question_text) || `Question ${idx + 1}`;
      docChildren.push(new Paragraph({
        spacing: { before: 50, after: 16 },
        children: [
          new TextRun({ text: `${idx + 1}. `, font: FONT_NAME, size: 20, bold: true }),
          new TextRun({ text: qText, font: FONT_NAME, size: 20 }),
        ],
      }));
      const diagramRun = await getQuestionImageRun(q.image_url);
      if (diagramRun) docChildren.push(new Paragraph({ spacing: { after: 24 }, indent: { left: 220 }, children: [diagramRun] }));
      if (q.objective_data) {
        const a = cleanMathForPrint(q.objective_data.option_a) || '—';
        const b = cleanMathForPrint(q.objective_data.option_b) || '—';
        const c = cleanMathForPrint(q.objective_data.option_c) || '—';
        const d = cleanMathForPrint(q.objective_data.option_d) || '—';
        const totalLen = a.length + b.length + c.length + d.length;
        if (totalLen < 90) {
          docChildren.push(new Paragraph({
            spacing: { before: 0, after: 36 },
            indent: { left: 200 },
            children: [
              new TextRun({ text: 'A. ', font: FONT_NAME, size: 18, bold: true }),
              new TextRun({ text: `${a}    `, font: FONT_NAME, size: 18 }),
              new TextRun({ text: 'B. ', font: FONT_NAME, size: 18, bold: true }),
              new TextRun({ text: `${b}    `, font: FONT_NAME, size: 18 }),
              new TextRun({ text: 'C. ', font: FONT_NAME, size: 18, bold: true }),
              new TextRun({ text: `${c}    `, font: FONT_NAME, size: 18 }),
              new TextRun({ text: 'D. ', font: FONT_NAME, size: 18, bold: true }),
              new TextRun({ text: d, font: FONT_NAME, size: 18 }),
            ],
          }));
        } else {
          docChildren.push(
            new Paragraph({
              spacing: { before: 0, after: 6 },
              indent: { left: 200 },
              children: [
                new TextRun({ text: 'A. ', font: FONT_NAME, size: 18, bold: true }),
                new TextRun({ text: `${a}      `, font: FONT_NAME, size: 18 }),
                new TextRun({ text: 'B. ', font: FONT_NAME, size: 18, bold: true }),
                new TextRun({ text: b, font: FONT_NAME, size: 18 }),
              ],
            }),
            new Paragraph({
              spacing: { before: 0, after: 36 },
              indent: { left: 200 },
              children: [
                new TextRun({ text: 'C. ', font: FONT_NAME, size: 18, bold: true }),
                new TextRun({ text: `${c}      `, font: FONT_NAME, size: 18 }),
                new TextRun({ text: 'D. ', font: FONT_NAME, size: 18, bold: true }),
                new TextRun({ text: d, font: FONT_NAME, size: 18 }),
              ],
            }),
          );
        }
      }
    });
  }

  if (sectionBQuestions.length > 0) {
    docChildren.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 40 },
      children: [new TextRun({ text: 'SECTION B: ESSAY / THEORY', font: FONT_NAME, size: 20, bold: true, underline: {} })],
    }));
    docChildren.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: 'Instruction: Answer the questions in this section in your answer booklet. Show all working clearly.', font: FONT_NAME, size: 16, italics: true })],
    }));

    sectionBQuestions.forEach((q, idx) => {
      const lines = cleanMathForPrint(q.question_text).split('\n').filter((l) => l.trim().length > 0);
      const marksLabel = '';
      if (lines.length === 0) {
        docChildren.push(new Paragraph({
          spacing: { before: 60, after: 30 },
          children: [
            new TextRun({ text: `${idx + 1}. `, font: FONT_NAME, size: 20, bold: true }),
            new TextRun({ text: `Theory question ${idx + 1}`, font: FONT_NAME, size: 20 }),
            new TextRun({ text: marksLabel, font: FONT_NAME, size: 18, bold: true, italics: true }),
          ],
        }));
        return;
      }
      const diagramRun = await getQuestionImageRun(q.image_url);
      if (diagramRun) docChildren.push(new Paragraph({ spacing: { after: 24 }, indent: { left: 220 }, children: [diagramRun] }));
      lines.forEach((line, lIdx) => {
        if (lIdx === 0) {
          docChildren.push(new Paragraph({
            spacing: { before: 60, after: 16 },
            children: [
              new TextRun({ text: `${idx + 1}. `, font: FONT_NAME, size: 20, bold: true }),
              new TextRun({ text: line, font: FONT_NAME, size: 20 }),
              new TextRun({ text: marksLabel, font: FONT_NAME, size: 18, bold: true, italics: true }),
            ],
          }));
        } else {
          docChildren.push(new Paragraph({
            spacing: { before: 6, after: 12 },
            indent: { left: 280 },
            children: [new TextRun({ text: line, font: FONT_NAME, size: 20 })],
          }));
        }
      });
    });
  }

  if (docChildren.length < 3) {
    docChildren.push(new Paragraph({
      children: [new TextRun({ text: 'No questions were available for this exam export. Please add questions and download again.', font: FONT_NAME, size: 20, italics: true })],
    }));
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 540, right: 540, bottom: 540, left: 540 },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({
              text: `${exam.subject || ''} · ${exam.class_name || ''} · ${exam.term || ''}`.trim(),
              font: FONT_NAME, size: 14, color: '666666',
            })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'Page ', font: FONT_NAME, size: 14 }),
              new TextRun({ children: [PageNumber.CURRENT], font: FONT_NAME, size: 14 }),
              new TextRun({ text: ' of ', font: FONT_NAME, size: 14 }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT_NAME, size: 14 }),
              new TextRun({ text: '  ·  ROCKCRAFT Academic Engine', font: FONT_NAME, size: 14, color: '888888' }),
            ],
          })],
        }),
      },
      children: docChildren,
    }],
  });

  return await Packer.toBlob(doc);
}

export async function exportExamToDocx(exam: Exam, school?: School | null): Promise<void> {
  const schoolName = (school?.name || 'SCHOOL NAME').toUpperCase();
  const blob = await buildExamDocxBlob(exam, school);
  const cleanSubject = (exam.subject || 'Exam').replace(/[^a-zA-Z0-9]/g, '_');
  const cleanClass = (exam.class_name || 'Class').replace(/[^a-zA-Z0-9]/g, '_');
  const termSlug = (exam.term || 'Term').replace(/\s+/g, '');
  saveAs(blob, `${schoolName.slice(0, 18)}_${cleanSubject}_${cleanClass}_${termSlug}_Exam.docx`);
}

export async function exportMarkingSchemeToDocx(exam: Exam, school?: School | null): Promise<void> {
  const schoolName = (school?.name || 'SCHOOL NAME').toUpperCase();
  const sectionAQuestions = (exam.questions || []).filter((q) => q.section === 'A');
  const sectionBQuestions = (exam.questions || []).filter((q) => q.section === 'B');
  const docChildren: any[] = [];

  docChildren.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 40 },
    children: [new TextRun({ text: schoolName, font: FONT_NAME, size: 28, bold: true })],
  }));
  docChildren.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [new TextRun({ text: 'STRICTLY CONFIDENTIAL — MARKING SCHEME', font: FONT_NAME, size: 22, bold: true, color: 'B91C1C', underline: {} })],
  }));
  docChildren.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [new TextRun({ text: `${(exam.subject || '').toUpperCase()}  |  ${exam.class_name || ''}  |  ${(exam.term || '').toUpperCase()} (${exam.session || ''})`, font: FONT_NAME, size: 20, bold: true })],
  }));

  if (sectionAQuestions.length > 0) {
    docChildren.push(new Paragraph({
      spacing: { before: 60, after: 60 },
      children: [new TextRun({ text: 'SECTION A: OBJECTIVE ANSWER KEY', font: FONT_NAME, size: 20, bold: true })],
    }));
    const itemsPerRow = 5;
    const tableRows: TableRow[] = [];
    for (let i = 0; i < sectionAQuestions.length; i += itemsPerRow) {
      const slice = sectionAQuestions.slice(i, i + itemsPerRow);
      const cells: TableCell[] = slice.map((q, idx) => {
        const correctOpt = q.objective_data?.correct_option || 'N/A';
        return new TableCell({
          width: { size: 20, type: WidthType.PERCENTAGE },
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: `${i + idx + 1}. `, font: FONT_NAME, size: 20 }),
              new TextRun({ text: `[ ${correctOpt} ]`, font: FONT_NAME, size: 20, bold: true, color: '047857' }),
            ],
          })],
        });
      });
      while (cells.length < itemsPerRow) {
        cells.push(new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, children: [new Paragraph({})] }));
      }
      tableRows.push(new TableRow({ children: cells }));
    }
    docChildren.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: tableRows }));
  }

  if (sectionBQuestions.length > 0) {
    docChildren.push(new Paragraph({
      spacing: { before: 160, after: 60 },
      children: [new TextRun({ text: 'SECTION B: THEORY MODEL ANSWERS & SCORING', font: FONT_NAME, size: 20, bold: true })],
    }));
    sectionBQuestions.forEach((q, idx) => {
      docChildren.push(new Paragraph({
        spacing: { before: 80, after: 20 },
        children: [new TextRun({ text: `QUESTION ${idx + 1} (${q.marks || 15} Marks)`, font: FONT_NAME, size: 20, bold: true, underline: {} })],
      }));
      docChildren.push(new Paragraph({
        spacing: { before: 10, after: 40 },
        children: [
          new TextRun({ text: 'Question: ', font: FONT_NAME, size: 18, bold: true }),
          new TextRun({ text: cleanMathForPrint(q.question_text), font: FONT_NAME, size: 18 }),
        ],
      }));
      if (q.theory_data?.model_answer) {
        docChildren.push(new Paragraph({
          spacing: { before: 20, after: 20 },
          children: [
            new TextRun({ text: 'Model Answer: ', font: FONT_NAME, size: 18, bold: true }),
            new TextRun({ text: cleanMathForPrint(q.theory_data.model_answer), font: FONT_NAME, size: 18 }),
          ],
        }));
      }
      if (q.theory_data?.score_breakdown) {
        docChildren.push(new Paragraph({
          spacing: { before: 10, after: 40 },
          children: [
            new TextRun({ text: 'Marking: ', font: FONT_NAME, size: 18, bold: true }),
            new TextRun({ text: cleanMathForPrint(q.theory_data.score_breakdown), font: FONT_NAME, size: 18 }),
          ],
        }));
      }
    });
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 720, right: 720, bottom: 720, left: 720 },
        },
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'CONFIDENTIAL — Examiners only  ·  ROCKCRAFT', font: FONT_NAME, size: 14, color: 'B91C1C' })],
          })],
        }),
      },
      children: docChildren,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const cleanSubject = (exam.subject || 'Exam').replace(/[^a-zA-Z0-9]/g, '_');
  const cleanClass = (exam.class_name || 'Class').replace(/[^a-zA-Z0-9]/g, '_');
  saveAs(blob, `${schoolName.slice(0, 18)}_${cleanSubject}_${cleanClass}_MarkingScheme.docx`);
}
