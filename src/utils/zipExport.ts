import JSZip from 'jszip';
import { downloadBlob } from './downloadBlob';
import { Exam, School } from '../types';
import { buildExamDocxBlob } from './docxExport';

const safeFilePart = (value: string | undefined, fallback: string): string =>
  (value || fallback).normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || fallback;

export async function exportAllExamsZip(exams: Exam[], school?: School | null): Promise<void> {
  if (!Array.isArray(exams) || exams.length === 0) {
    throw new Error('There are no class exams to include in this ZIP download.');
  }

  const zip = new JSZip();
  const folderName = `${safeFilePart(school?.name, 'ROCKCRAFT')}_Exams_Bundle`;
  const folder = zip.folder(folderName);
  if (!folder) throw new Error('Could not prepare the exam ZIP folder.');

  const usedNames = new Set<string>();
  let addedCount = 0;

  for (const exam of exams) {
    if (!exam || !Array.isArray(exam.questions)) {
      throw new Error('One of the selected exams is incomplete. Refresh the exams list and try again.');
    }

    const subject = safeFilePart(exam.subject, 'Subject');
    const className = safeFilePart(exam.class_name, 'Class');
    const term = safeFilePart((exam.term || 'Term').replace(/\s+/g, ''), 'Term');
    const session = safeFilePart(exam.session, 'Session');
    const baseName = `${subject}_${className}_${term}_${session}`;
    let fileName = `${baseName}.docx`;
    let duplicate = 2;
    while (usedNames.has(fileName.toLowerCase())) {
      fileName = `${baseName}_${duplicate++}.docx`;
    }
    usedNames.add(fileName.toLowerCase());

    const docxBlob = await buildExamDocxBlob(exam, school);
    if (!(docxBlob instanceof Blob) || docxBlob.size === 0) {
      throw new Error(`Could not generate the Word paper for ${exam.subject || 'an exam'} (${exam.class_name || 'class'}).`);
    }
    folder.file(fileName, docxBlob);
    addedCount += 1;
  }

  if (addedCount !== exams.length) {
    throw new Error('The ZIP could not include every selected class exam. Please try again.');
  }

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/zip',
    // DOCX files are already compressed; STORE avoids wasting time recompressing
    // them and reduces CPU/memory pressure on school phones.
    compression: 'STORE',
  });

  if (!zipBlob.size) throw new Error('The exam ZIP was generated empty. Please try again.');
  downloadBlob(zipBlob, `${folderName}.zip`);
}
