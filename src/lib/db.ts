import { Exam } from '../types';

// Only unsynced offline drafts belong in browser storage. All shared school
// records (schools, classes, invitations, exams, questions, and payments) must
// be read from and written to Supabase through their respective repositories.
const OFFLINE_DRAFTS_KEY = 'examcraft_offline_drafts';

function readOfflineDrafts(): Exam[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(OFFLINE_DRAFTS_KEY);
    if (!raw) return [];
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value as Exam[] : [];
  } catch (error) {
    console.warn('Could not read offline exam drafts from this device.', error);
    return [];
  }
}

function writeOfflineDrafts(drafts: Exam[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(OFFLINE_DRAFTS_KEY, JSON.stringify(drafts));
  } catch (error) {
    console.error('Could not save offline exam drafts on this device.', error);
    throw new Error('This device could not save the offline draft. Free up storage and try again.');
  }
}

export const db = {
  // Offline drafts are intentionally device-local until the user reconnects
  // and publishes them. They are not treated as published/shared exam records.
  getOfflineDrafts(): Exam[] {
    return readOfflineDrafts();
  },

  saveOfflineDraft(draft: Exam): void {
    const drafts = readOfflineDrafts().filter((item) => item.id !== draft.id);
    drafts.unshift({
      ...draft,
      is_offline_draft: true,
      created_at: new Date().toISOString(),
    });
    writeOfflineDrafts(drafts);
  },

  removeOfflineDraft(id: string): void {
    writeOfflineDrafts(readOfflineDrafts().filter((draft) => draft.id !== id));
  },
};
