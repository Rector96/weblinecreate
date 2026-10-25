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

/**
 * Convert AI / KaTeX-style markup into plain printable text for Word.
 * Keeps meaning readable on paper (no raw backslashes).
 */
export function cleanMathForPrint(input: string | null | undefined): string {
  if (!input) return '';
  let s = String(input);

  // Normalize newlines
  s = s.replace(/\r\n/g, '\n');

  // Display / inline math delimiters → keep inner content only
  s = s.replace(/\\\[([\s\S]*?)\\\]/g, '$1');
  s = s.replace(/\\\(([\s\S]*?)\\\)/g, '$1');
  s = s.replace(/\$\$([\s\S]*?)\$\$/g, '$1');
  s = s.replace(/\$([^$\n]+)\$/g, '$1');

  // \frac{a}{b} → a/b  (nested-ish: apply repeatedly)
  for (let i = 0; i < 6; i++) {
    const next = s.replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '$1/$2');
    if (next === s) break;
    s = next;
  }

  // Roots
  s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, '√($1)');
  s = s.replace(/\\sqrt\s*/g, '√');

  // Common operators & symbols
  const ops: Array<[RegExp, string]> = [
    [/\\times\b/g, '×'],
    [/\\cdot\b/g, '·'],
    [/\\div\b/g, '÷'],
    [/\\pm\b/g, '±'],
    [/\\mp\b/g, '∓'],
    [/\\leq\b/g, '≤'],
    [/\\geq\b/g, '≥'],
    [/\\neq\b/g, '≠'],
    [/\\approx\b/g, '≈'],
    [/\\infty\b/g, '∞'],
    [/\\degree\b/g, '°'],
    [/\\circ\b/g, '°'],
    [/\\pi\b/g, 'π'],
    [/\\theta\b/g, 'θ'],
    [/\\alpha\b/g, 'α'],
    [/\\beta\b/g, 'β'],
    [/\\gamma\b/g, 'γ'],
    [/\\delta\b/g, 'δ'],
    [/\\sigma\b/g, 'σ'],
    [/\\omega\b/g, 'ω'],
    [/\\mu\b/g, 'μ'],
    [/\\lambda\b/g, 'λ'],
    [/\\phi\b/g, 'φ'],
    [/\\angle\b/g, '∠'],
    [/\\triangle\b/g, '△'],
    [/\\perp\b/g, '⊥'],
    [/\\parallel\b/g, '∥'],
    [/\\rightarrow\b/g, '→'],
    [/\\leftarrow\b/g, '←'],
    [/\\Rightarrow\b/g, '⇒'],
    [/\\Leftrightarrow\b/g, '⇔'],
    [/\\ldots\b/g, '…'],
    [/\\cdots\b/g, '⋯'],
    [/\\%/g, '%'],
    [/\\&/g, '&'],
    [/\\_/g, '_'],
  ];
  for (const [re, rep] of ops) s = s.replace(re, rep);

  // \text{...} / \mathrm{...} / \mathbf{...}
  s = s.replace(/\\(?:text|mathrm|mathbf|textit|textbf)\s*\{([^{}]*)\}/g, '$1');

  // Simple superscripts: x^{2} or x^2
  s = s.replace(/\^{(\d+)}/g, (_m, d) => {
    const map: Record<string, string> = {
      '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
      '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    };
    return d.split('').map((c: string) => map[c] || c).join('');
  });
  s = s.replace(/\^(\d)/g, (_m, d) => {
    const map: Record<string, string> = {
      '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
      '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    };
    return map[d] || `^${d}`;
  });

  // Currency / Naira glitches from AI: \N, N\, \(N\), etc.
  s = s.replace(/\\N\s*\\?\$?\s*/g, '₦');
  s = s.replace(/\bN\\?\$\s*/g, '₦');
  s = s.replace(/\(N\\?\$\s*/g, '(₦');
  s = s.replace(/₦\s*\$/g, '₦');

  // Strip remaining simple braces from commands like \left( \right)
  s = s.replace(/\\left\s*/g, '');
  s = s.replace(/\\right\s*/g, '');
  s = s.replace(/\\,/g, ' ');
  s = s.replace(/\\;/g, ' ');
  s = s.replace(/\\!/g, '');
  s = s.replace(/\\quad\b/g, '  ');
  s = s.replace(/\\qquad\b/g, '   ');

  // Drop leftover backslash-commands of the form \word
  s = s.replace(/\\[a-zA-Z]+/g, '');

  // Clean excess braces that are no longer needed
  s = s.replace(/\{\s*\}/g, '');

  // Collapse multiple spaces but keep newlines
  s = s.replace(/[ \t]{2,}/g, ' ');
  s = s.replace(/ *\n */g, '\n');
  s = s.trim();

  return s;
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
    return new ImageRun({ data: bytes, type, transformation: { width: 68, height: 68 } });
  } catch (error) {
    console.warn('[ROCKCRAFT] Could not embed school logo in DOCX export:', error);
    return null;
  }
}

export async function exportExamToDocx(exam: Exam, school?: School | null): Promise<void> {
  const schoolName = (school?.name || 'SCHOOL NAME').toUpperCase();
  const motto = school?.motto ? `"${school.motto}"` : '';
  const address = school?.address || [school?.lga, school?.state].filter(Boolean).join(', ');

  const sectionAQuestions = (exam.questions || []).filter((q) => q.section === 'A');
  const sectionBQuestions = (exam.questions || []).filter((q) => q.section === 'B');

  const docChildren: any[] = [];
  const schoolLogoRun = await getSchoolLogoRun(school);
  if (schoolLogoRun) docChildren.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [schoolLogoRun] }));

  // ==========================================
  // 1. OFFICIAL SCHOOL HEADER
  // ==========================================
  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: schoolName,
          font: FONT_NAME,
          size: 32, // 16pt
          bold: true,
        }),
      ],
    })
  );

  if (motto) {
    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [
          new TextRun({
            text: motto,
            font: FONT_NAME,
            size: 20, // 10pt
            italics: true,
          }),
        ],
      })
    );
  }

  if (address) {
    docChildren.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: address, font: FONT_NAME, size: 20 })],
    }));
  }
  const schoolContacts = [school?.phone, school?.email].filter(Boolean).join('  •  ');
  if (schoolContacts) {
    docChildren.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: schoolContacts, font: FONT_NAME, size: 18 })],
    }));
  }

  // Exam Title & Session
  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: `${exam.term.toUpperCase()} EXAMINATION - ${exam.session} ACADEMIC SESSION`,
          font: FONT_NAME,
          size: 26, // 13pt
          bold: true,
          underline: {},
        }),
      ],
    })
  );

  // Metadata Table (Subject, Class, Time Allowed, Max Marks)
  const metaBorderNone = {
    top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  };

  const metaTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: metaBorderNone,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: metaBorderNone,
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: 'SUBJECT: ', font: FONT_NAME, size: 24, bold: true }),
                  new TextRun({ text: exam.subject.toUpperCase(), font: FONT_NAME, size: 24 }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: 'CLASS: ', font: FONT_NAME, size: 24, bold: true }),
                  new TextRun({ text: exam.class_name, font: FONT_NAME, size: 24 }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: metaBorderNone,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: 'TIME ALLOWED: ', font: FONT_NAME, size: 24, bold: true }),
                  new TextRun({ text: `${exam.duration_minutes} MINUTES`, font: FONT_NAME, size: 24 }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: 'TOTAL MARKS: ', font: FONT_NAME, size: 24, bold: true }),
                  new TextRun({ text: `${exam.total_marks} MARKS`, font: FONT_NAME, size: 24 }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  docChildren.push(metaTable);


  // General Instructions
  docChildren.push(
    new Paragraph({
      spacing: { before: 80, after: 160 },
      children: [
        new TextRun({ text: 'GENERAL INSTRUCTIONS: ', font: FONT_NAME, size: 22, bold: true, italics: true }),
        new TextRun({ text: exam.instructions, font: FONT_NAME, size: 22, italics: true }),
      ],
    })
  );

  // ==========================================
  // 2. SECTION A: OBJECTIVE TEST
  // ==========================================
  if (sectionAQuestions.length > 0) {
    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 80 },
        children: [
          new TextRun({
            text: `SECTION A: OBJECTIVE TEST [${exam.section_a_marks || sectionAQuestions.length} MARKS]`,
            font: FONT_NAME,
            size: 24,
            bold: true,
            underline: {},
          }),
        ],
      })
    );

    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 160 },
        children: [
          new TextRun({
            text: 'Instruction: Each question is followed by four options lettered A to D. Choose the correct option.',
            font: FONT_NAME,
            size: 20,
            italics: true,
          }),
        ],
      })
    );

    sectionAQuestions.forEach((q, idx) => {
      // Question text
      docChildren.push(
        new Paragraph({
          spacing: { before: 70, after: 20 },
          children: [
            new TextRun({
              text: `${idx + 1}. `,
              font: FONT_NAME,
              size: 22, // 11pt denser
              bold: true,
            }),
            new TextRun({
              text: cleanMathForPrint(q.question_text),
              font: FONT_NAME,
              size: 22,
            }),
          ],
        })
      );

      // Options A, B, C, D (Strictly inline for compact A4 single-sheet layout)
      if (q.objective_data) {
        const option_a = cleanMathForPrint(q.objective_data.option_a);
        const option_b = cleanMathForPrint(q.objective_data.option_b);
        const option_c = cleanMathForPrint(q.objective_data.option_c);
        const option_d = cleanMathForPrint(q.objective_data.option_d);
        const totalLen = (option_a?.length || 0) + (option_b?.length || 0) + (option_c?.length || 0) + (option_d?.length || 0);

        if (totalLen < 85) {
          // All 4 options strictly on a SINGLE inline row
          docChildren.push(
            new Paragraph({
              spacing: { before: 4, after: 28 },
              indent: { left: 200 },
              children: [
                new TextRun({ text: 'A. ', font: FONT_NAME, size: 20, bold: true }),
                new TextRun({ text: `${option_a}    `, font: FONT_NAME, size: 20 }),
                new TextRun({ text: '  B. ', font: FONT_NAME, size: 20, bold: true }),
                new TextRun({ text: `${option_b}    `, font: FONT_NAME, size: 20 }),
                new TextRun({ text: '  C. ', font: FONT_NAME, size: 20, bold: true }),
                new TextRun({ text: `${option_c}    `, font: FONT_NAME, size: 20 }),
                new TextRun({ text: '  D. ', font: FONT_NAME, size: 20, bold: true }),
                new TextRun({ text: option_d, font: FONT_NAME, size: 20 }),
              ],
            })
          );
        } else {
          // 2 balanced rows of 2 options each
          docChildren.push(
            new Paragraph({
              spacing: { before: 10, after: 10 },
              indent: { left: 240 },
              children: [
                new TextRun({ text: 'A. ', font: FONT_NAME, size: 20, bold: true }),
                new TextRun({ text: `${option_a}    `, font: FONT_NAME, size: 20 }),
                new TextRun({ text: '      B. ', font: FONT_NAME, size: 20, bold: true }),
                new TextRun({ text: option_b, font: FONT_NAME, size: 20 }),
              ],
            }),
            new Paragraph({
              spacing: { before: 10, after: 40 },
              indent: { left: 240 },
              children: [
                new TextRun({ text: 'C. ', font: FONT_NAME, size: 20, bold: true }),
                new TextRun({ text: `${option_c}    `, font: FONT_NAME, size: 20 }),
                new TextRun({ text: '      D. ', font: FONT_NAME, size: 20, bold: true }),
                new TextRun({ text: option_d, font: FONT_NAME, size: 20 }),
              ],
            })
          );
        }
      }
    });
  }

  // Keep a substantial objective section together, then begin theory on page two.
  // This gives typical school papers a deliberate two-page rhythm instead of an awkward split.
  if (sectionBQuestions.length > 0 && sectionAQuestions.length >= 8) {
    docChildren.push(new Paragraph({ children: [new TextRun({ text: '', break: 1 })], pageBreakBefore: true }));
  }

  // ==========================================
  // 3. SECTION B: THEORY / ESSAY
  // ==========================================
  if (sectionBQuestions.length > 0) {
    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 280, after: 80 },
        children: [
          new TextRun({
            text: `SECTION B: ESSAY / THEORY [${exam.section_b_marks || 60} MARKS]`,
            font: FONT_NAME,
            size: 24,
            bold: true,
            underline: {},
            }),
        ],
      })
    );

    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 160 },
        children: [
          new TextRun({
            text: 'Instruction: Answer questions in this section in your answer booklet. Show all steps clearly.',
            font: FONT_NAME,
            size: 20,
            italics: true,
          }),
        ],
      })
    );

    sectionBQuestions.forEach((q, idx) => {
      // Split sub-lines if available
      const lines = cleanMathForPrint(q.question_text).split('\n');

      lines.forEach((line, lIdx) => {
        if (lIdx === 0) {
          docChildren.push(
            new Paragraph({
              spacing: { before: 100, after: 30 },
              children: [
                new TextRun({
                  text: `${idx + 1}. `,
                  font: FONT_NAME,
                  size: 22,
                  bold: true,
                }),
                new TextRun({
                  text: line,
                  font: FONT_NAME,
                  size: 22,
                }),
                new TextRun({
                  text: `   [${q.marks} Marks]`,
                  font: FONT_NAME,
                  size: 20,
                  bold: true,
                  italics: true,
                }),
              ],
            })
          );
        } else {
          docChildren.push(
            new Paragraph({
              spacing: { before: 12, after: 24 },
              indent: { left: 320 },
              children: [
                new TextRun({
                  text: line,
                  font: FONT_NAME,
                  size: 22,
                }),
              ],
            })
          );
        }
      });
    });
  }

  // Create Document
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 11906, // A4 width in twips
              height: 16838, // A4 height in twips
            },
            margin: {
              top: 760,
              right: 760,
              bottom: 760,
              left: 760,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: `${exam.subject} - ${exam.class_name} | ${exam.term}`,
                    font: FONT_NAME,
                    size: 18,
                    color: '666666',
                  }),
                ],
              }),
            ],
          }),
        },
        headers: {
          default: new Header({
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'D8E2F0', space: 4 } },
              spacing: { after: 70 },
              children: [new TextRun({ text: schoolName, font: FONT_NAME, size: 14, bold: true, color: 'D6DDE8' })],
            })],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'Page ',
                    font: FONT_NAME,
                    size: 18,
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: FONT_NAME,
                    size: 18,
                  }),
                  new TextRun({
                    text: ' of ',
                    font: FONT_NAME,
                    size: 18,
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    font: FONT_NAME,
                    size: 18,
                  }),
                  new TextRun({
                    text: `  •  ${schoolName}  •  ROCKCRAFT Academic Engine`,
                    font: FONT_NAME,
                    size: 18,
                    color: '888888',
                  }),
                ],
              }),
            ],
          }),
        },
        children: docChildren,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const cleanSubject = exam.subject.replace(/[^a-zA-Z0-9]/g, '_');
  const cleanClass = exam.class_name.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `${schoolName.slice(0, 15)}_${cleanSubject}_${cleanClass}_${exam.term.replace(/\s+/g, '')}_Exam.docx`;
  saveAs(blob, filename);
}

// ==========================================
// CONFIDENTIAL MARKING SCHEME DOCX EXPORT
// ==========================================
export async function exportMarkingSchemeToDocx(exam: Exam, school?: School | null): Promise<void> {
  const schoolName = (school?.name || 'EXAMCRAFT SECONDARY SCHOOL').toUpperCase();
  const sectionAQuestions = (exam.questions || []).filter((q) => q.section === 'A');
  const sectionBQuestions = (exam.questions || []).filter((q) => q.section === 'B');

  const docChildren: any[] = [];

  // Header Banner
  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: schoolName,
          font: FONT_NAME,
          size: 30,
          bold: true,
        }),
      ],
    })
  );

  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: 'STRICTLY CONFIDENTIAL - TEACHERS / EXAMINERS MARKING SCHEME',
          font: FONT_NAME,
          size: 24,
          bold: true,
          color: 'B91C1C', // Red color indicator
          underline: {},
        }),
      ],
    })
  );

  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 180 },
      children: [
        new TextRun({
          text: `${exam.subject.toUpperCase()}  |  ${exam.class_name}  |  ${exam.term.toUpperCase()} (${exam.session})`,
          font: FONT_NAME,
          size: 24,
          bold: true,
        }),
      ],
    })
  );

  // Section A Answer Grid
  if (sectionAQuestions.length > 0) {
    docChildren.push(
      new Paragraph({
        spacing: { before: 100, after: 80 },
        children: [
          new TextRun({
            text: 'SECTION A: OBJECTIVE ANSWER KEY',
            font: FONT_NAME,
            size: 24,
            bold: true,
          }),
        ],
      })
    );

    // Group in table of 5 columns (Q1-5, Q6-10, etc.)
    const tableRows: TableRow[] = [];
    const itemsPerRow = 5;

    // Header row
    tableRows.push(
      new TableRow({
        children: Array.from({ length: itemsPerRow }).map((_, colIdx) => {
          return new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: `Q.No`, font: FONT_NAME, size: 20, bold: true })],
              }),
            ],
          });
        }),
      })
    );

    for (let i = 0; i < sectionAQuestions.length; i += itemsPerRow) {
      const slice = sectionAQuestions.slice(i, i + itemsPerRow);
      const cells: TableCell[] = slice.map((q, idx) => {
        const correctOpt = q.objective_data?.correct_option || 'N/A';
        return new TableCell({
          width: { size: 20, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: `${i + idx + 1}. `, font: FONT_NAME, size: 22 }),
                new TextRun({ text: `[ ${correctOpt} ]`, font: FONT_NAME, size: 22, bold: true, color: '047857' }),
              ],
            }),
          ],
        });
      });

      // Fill remaining empty cells if any
      while (cells.length < itemsPerRow) {
        cells.push(new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, children: [new Paragraph({})] }));
      }

      tableRows.push(new TableRow({ children: cells }));
    }

    docChildren.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: tableRows,
      })
    );
  }

  // Section B Theory Rubrics
  if (sectionBQuestions.length > 0) {
    docChildren.push(
      new Paragraph({
        spacing: { before: 240, after: 100 },
        children: [
          new TextRun({
            text: 'SECTION B: THEORY MODEL ANSWERS & SCORING RUBRIC',
            font: FONT_NAME,
            size: 24,
            bold: true,
          }),
        ],
      })
    );

    sectionBQuestions.forEach((q, idx) => {
      docChildren.push(
        new Paragraph({
          spacing: { before: 120, after: 40 },
          children: [
            new TextRun({ text: `QUESTION ${idx + 1} (${q.marks} Marks)`, font: FONT_NAME, size: 24, bold: true, underline: {} }),
          ],
        })
      );

      docChildren.push(
        new Paragraph({
          spacing: { before: 20, after: 60 },
          children: [
            new TextRun({ text: 'Question: ', font: FONT_NAME, size: 22, bold: true }),
            new TextRun({ text: cleanMathForPrint(q.question_text), font: FONT_NAME, size: 22 }),
          ],
        })
      );

      if (q.theory_data?.model_answer) {
        docChildren.push(
          new Paragraph({
            spacing: { before: 40, after: 40 },
            children: [
              new TextRun({ text: 'Model Answer: ', font: FONT_NAME, size: 22, bold: true }),
              new TextRun({ text: cleanMathForPrint(q.theory_data.model_answer), font: FONT_NAME, size: 22 }),
            ],
          })
        );
      }

      if (q.theory_data?.score_breakdown) {
        docChildren.push(
          new Paragraph({
            spacing: { before: 20, after: 80 },
            children: [
              new TextRun({ text: 'Marking Scheme: ', font: FONT_NAME, size: 22, bold: true }),
              new TextRun({ text: cleanMathForPrint(q.theory_data.score_breakdown), font: FONT_NAME, size: 22 }),
            ],
          })
        );
      }
    });
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 900, right: 760, bottom: 900, left: 760 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'CONFIDENTIAL — For examiners only  •  ROCKCRAF Academic Engine',
                    font: FONT_NAME,
                    size: 16,
                    color: 'B91C1C',
                  }),
                ],
              }),
            ],
          }),
        },
        children: docChildren,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const cleanSubject = exam.subject.replace(/[^a-zA-Z0-9]/g, '_');
  const cleanClass = exam.class_name.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `${schoolName.slice(0, 15)}_${cleanSubject}_${cleanClass}_MarkingScheme.docx`;
  saveAs(blob, filename);
}
