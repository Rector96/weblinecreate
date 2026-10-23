import JSZip from 'jszip';
import { saveAs } from 'file-saver';
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
} from 'docx';
import { Exam, School } from '../types';

const FONT_NAME = 'Times New Roman';

async function generateExamBlob(exam: Exam, school?: School | null): Promise<Blob> {
  const schoolName = (school?.name || 'EXAMCRAFT SECONDARY SCHOOL').toUpperCase();
  const address = school?.address || `${school?.lga || 'Ikeja'}, ${school?.state || 'Lagos'} State, Nigeria`;

  const sectionAQuestions = (exam.questions || []).filter((q) => q.section === 'A');
  const sectionBQuestions = (exam.questions || []).filter((q) => q.section === 'B');

  const docChildren: any[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: schoolName, font: FONT_NAME, size: 30, bold: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [new TextRun({ text: address, font: FONT_NAME, size: 20 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: `${exam.term.toUpperCase()} EXAMINATION - ${exam.session}`,
          font: FONT_NAME,
          size: 24,
          bold: true,
          underline: {},
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 80, after: 120 },
      children: [
        new TextRun({ text: `SUBJECT: ${exam.subject.toUpperCase()}    |    CLASS: ${exam.class_name}    |    DURATION: ${exam.duration_minutes} MINS`, font: FONT_NAME, size: 22, bold: true }),
      ],
    }),
  ];

  if (sectionAQuestions.length > 0) {
    docChildren.push(
      new Paragraph({
        spacing: { before: 140, after: 80 },
        children: [new TextRun({ text: 'SECTION A: OBJECTIVE QUESTIONS', font: FONT_NAME, size: 24, bold: true, underline: {} })],
      })
    );

    sectionAQuestions.forEach((q, idx) => {
      docChildren.push(
        new Paragraph({
          spacing: { before: 60, after: 20 },
          children: [
            new TextRun({ text: `${idx + 1}. `, font: FONT_NAME, size: 22, bold: true }),
            new TextRun({ text: q.question_text, font: FONT_NAME, size: 22 }),
          ],
        })
      );
      if (q.objective_data) {
        docChildren.push(
          new Paragraph({
            indent: { left: 300 },
            spacing: { before: 10, after: 40 },
            children: [
              new TextRun({ text: `[A] ${q.objective_data.option_a}    [B] ${q.objective_data.option_b}    [C] ${q.objective_data.option_c}    [D] ${q.objective_data.option_d}`, font: FONT_NAME, size: 20 }),
            ],
          })
        );
      }
    });
  }

  if (sectionBQuestions.length > 0) {
    docChildren.push(
      new Paragraph({
        spacing: { before: 180, after: 80 },
        children: [new TextRun({ text: 'SECTION B: THEORY / ESSAY', font: FONT_NAME, size: 24, bold: true, underline: {} })],
      })
    );

    sectionBQuestions.forEach((q, idx) => {
      docChildren.push(
        new Paragraph({
          spacing: { before: 80, after: 40 },
          children: [
            new TextRun({ text: `${idx + 1}. `, font: FONT_NAME, size: 22, bold: true }),
            new TextRun({ text: q.question_text, font: FONT_NAME, size: 22 }),
            new TextRun({ text: `  [${q.marks} Marks]`, font: FONT_NAME, size: 20, bold: true }),
          ],
        })
      );
    });
  }

  const doc = new Document({
    sections: [{ children: docChildren }],
  });

  return await Packer.toBlob(doc);
}

export async function exportAllExamsZip(exams: Exam[], school?: School | null): Promise<void> {
  const zip = new JSZip();
  const folderName = `${(school?.name || 'ExamCraft').replace(/[^a-zA-Z0-9]/g, '_')}_Exams_Bundle`;
  const folder = zip.folder(folderName);

  for (const exam of exams) {
    const cleanSubj = exam.subject.replace(/[^a-zA-Z0-9]/g, '_');
    const cleanClass = exam.class_name.replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `${cleanSubj}_${cleanClass}_${exam.term.replace(/\s+/g, '')}.docx`;

    const blob = await generateExamBlob(exam, school);
    folder?.file(fileName, blob);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, `${folderName}.zip`);
}
