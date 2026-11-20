import JSZip from 'jszip';
import { downloadBlob } from './downloadBlob';
import { Exam, School } from '../types';
import { buildExamDocxBlob } from './docxExport';

export async function exportAllExamsZip(exams: Exam[], school?: School | null): Promise<void> {
  if (!exams.length) throw new Error('There are no exams to include in this download.');
  const zip = new JSZip();
  const folderName = `${(school?.name || 'ROCKCRAFT').replace(/[^a-zA-Z0-9]/g, '_')}_Exams_Bundle`;
  const folder = zip.folder(folderName);

  for (const exam of exams) {
    const cleanSubj = (exam.subject || 'Subject').replace(/[^a-zA-Z0-9]/g, '_');
    const cleanClass = (exam.class_name || 'Class').replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `${cleanSubj}_${cleanClass}_${(exam.term || 'Term').replace(/\s+/g, '')}.docx`;
    const blob = await buildExamDocxBlob(exam, school);
    folder?.file(fileName, blob);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  downloadBlob(content, `${folderName}.zip`);
}
