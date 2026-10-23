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

async function getSchoolLogoRun(school?: School | null): Promise<ImageRun | null> {
  if (!school?.logo_url) return null;
  try {
    const response = await fetch(school.logo_url);
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('svg') || contentType.includes('webp')) return null;
    const type = contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' : contentType.includes('gif') ? 'gif' : contentType.includes('bmp') ? 'bmp' : 'png';
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
  // 1. OFFICIAL WAEC / JAMB SCHOOL HEADER
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
          spacing: { before: 100, after: 40 },
          children: [
            new TextRun({
              text: `${idx + 1}. `,
              font: FONT_NAME,
              size: 24, // 12pt
              bold: true,
            }),
            new TextRun({
              text: q.question_text,
              font: FONT_NAME,
              size: 24,
            }),
          ],
        })
      );

      // Options A, B, C, D (Strictly inline for compact A4 single-sheet layout)
      if (q.objective_data) {
        const { option_a, option_b, option_c, option_d } = q.objective_data;
        const totalLen = (option_a?.length || 0) + (option_b?.length || 0) + (option_c?.length || 0) + (option_d?.length || 0);

        if (totalLen < 85) {
          // All 4 options strictly on a SINGLE inline row
          docChildren.push(
            new Paragraph({
              spacing: { before: 10, after: 40 },
              indent: { left: 240 },
              children: [
                new TextRun({ text: '[A] ', font: FONT_NAME, size: 21, bold: true }),
                new TextRun({ text: `${option_a}    `, font: FONT_NAME, size: 21 }),
                new TextRun({ text: '  [B] ', font: FONT_NAME, size: 21, bold: true }),
                new TextRun({ text: `${option_b}    `, font: FONT_NAME, size: 21 }),
                new TextRun({ text: '  [C] ', font: FONT_NAME, size: 21, bold: true }),
                new TextRun({ text: `${option_c}    `, font: FONT_NAME, size: 21 }),
                new TextRun({ text: '  [D] ', font: FONT_NAME, size: 21, bold: true }),
                new TextRun({ text: option_d, font: FONT_NAME, size: 21 }),
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
                new TextRun({ text: '[A] ', font: FONT_NAME, size: 21, bold: true }),
                new TextRun({ text: `${option_a}    `, font: FONT_NAME, size: 21 }),
                new TextRun({ text: '      [B] ', font: FONT_NAME, size: 21, bold: true }),
                new TextRun({ text: option_b, font: FONT_NAME, size: 21 }),
              ],
            }),
            new Paragraph({
              spacing: { before: 10, after: 40 },
              indent: { left: 240 },
              children: [
                new TextRun({ text: '[C] ', font: FONT_NAME, size: 21, bold: true }),
                new TextRun({ text: `${option_c}    `, font: FONT_NAME, size: 21 }),
                new TextRun({ text: '      [D] ', font: FONT_NAME, size: 21, bold: true }),
                new TextRun({ text: option_d, font: FONT_NAME, size: 21 }),
              ],
            })
          );
        }
      }
    });
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
      const lines = q.question_text.split('\n');

      lines.forEach((line, lIdx) => {
        if (lIdx === 0) {
          docChildren.push(
            new Paragraph({
              spacing: { before: 140, after: 40 },
              children: [
                new TextRun({
                  text: `${idx + 1}. `,
                  font: FONT_NAME,
                  size: 24,
                  bold: true,
                }),
                new TextRun({
                  text: line,
                  font: FONT_NAME,
                  size: 24,
                }),
                new TextRun({
                  text: `   [${q.marks} Marks]`,
                  font: FONT_NAME,
                  size: 22,
                  bold: true,
                  italics: true,
                }),
              ],
            })
          );
        } else {
          docChildren.push(
            new Paragraph({
              spacing: { before: 20, after: 40 },
              indent: { left: 360 },
              children: [
                new TextRun({
                  text: line,
                  font: FONT_NAME,
                  size: 24,
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
              top: 540, // 0.375 in (tight A4 single-sheet optimization)
              right: 540,
              bottom: 540,
              left: 540,
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
                    text: '  •  ROCKCRAF Academic Engine',
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
            new TextRun({ text: q.question_text, font: FONT_NAME, size: 22 }),
          ],
        })
      );

      if (q.theory_data?.model_answer) {
        docChildren.push(
          new Paragraph({
            spacing: { before: 40, after: 40 },
            children: [
              new TextRun({ text: 'Model Answer: ', font: FONT_NAME, size: 22, bold: true, color: '1E3A8A' }),
              new TextRun({ text: q.theory_data.model_answer, font: FONT_NAME, size: 22 }),
            ],
          })
        );
      }

      if (q.theory_data?.score_breakdown) {
        docChildren.push(
          new Paragraph({
            spacing: { before: 40, after: 80 },
            children: [
              new TextRun({ text: 'Marking Breakdown: ', font: FONT_NAME, size: 22, bold: true, color: '047857' }),
              new TextRun({ text: q.theory_data.score_breakdown, font: FONT_NAME, size: 22 }),
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
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        children: docChildren,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const cleanSubject = exam.subject.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `${cleanSubject}_CONFIDENTIAL_Marking_Scheme.docx`;
  saveAs(blob, filename);
}
