import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth';
import { listSchoolExams, deleteExamFromSupabase } from '../../lib/examRepository';
import { Exam } from '../../types';
import { exportExamToDocx, exportMarkingSchemeToDocx } from '../../utils/docxExport';
import { exportAllExamsZip } from '../../utils/zipExport';
import {
  FileText,
  Search,
  Filter,
  Download,
  Trash2,
  Eye,
  PlusCircle,
  Archive,
  Clock,
  CheckCircle2,
  Lock,
  Loader2
} from 'lucide-react';

interface ExamsListPageProps {
  navigate: (route: string) => void;
  onPreviewExam: (exam: Exam) => void;
}

export const ExamsListPage: React.FC<ExamsListPageProps> = ({
  navigate,
  onPreviewExam,
}) => {
  const { school, user, role } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('All');
  const [selectedClass, setSelectedClass] = useState('All');
  const [selectedTerm, setSelectedTerm] = useState('All');
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadExams = async () => {
    if (!school) {
      setExams([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setExams(await listSchoolExams(school.id));
    } catch (loadError) {
      console.error('Failed to load exams from Supabase', loadError);
      setExams([]);
      setError(loadError instanceof Error ? loadError.message : 'Could not load exams from the database.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadExams();
  }, [school?.id]);

  // Unique lists for filters
  const subjects = ['All', ...Array.from(new Set(exams.map((e) => e.subject)))];
  const classes = ['All', ...Array.from(new Set(exams.map((e) => e.class_name)))];
  const terms = ['All', 'First Term', 'Second Term', 'Third Term'];

  // Filtered
  const filteredExams = exams.filter((e) => {
    const matchesSearch =
      e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.exam_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.class_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSubject = selectedSubject === 'All' || e.subject === selectedSubject;
    const matchesClass = selectedClass === 'All' || e.class_name === selectedClass;
    const matchesTerm = selectedTerm === 'All' || e.term === selectedTerm;
    return matchesSearch && matchesSubject && matchesClass && matchesTerm;
  });

  const handleDownloadDocx = async (exam: Exam) => {
    setActionId(`docx_${exam.id}`);
    try {
      await exportExamToDocx(exam, school);
    } finally {
      setActionId(null);
    }
  };

  const handleDownloadScheme = async (exam: Exam) => {
    setActionId(`scheme_${exam.id}`);
    try {
      await exportMarkingSchemeToDocx(exam, school);
    } finally {
      setActionId(null);
    }
  };

  const handleExportZip = async () => {
    if (filteredExams.length === 0) return;
    setIsExportingZip(true);
    try {
      await exportAllExamsZip(filteredExams, school);
    } finally {
      setIsExportingZip(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!school || deletingId) return;
    if (!confirm(`Are you sure you want to permanently delete "${title}"?`)) return;
    setDeletingId(id);
    setError(null);
    try {
      await deleteExamFromSupabase(id, school.id);
      setExams((current) => current.filter((exam) => exam.id !== id));
    } catch (deleteError) {
      console.error('Failed to delete exam', deleteError);
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete the exam. Check your permissions and try again.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 text-left">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Exams Repository
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Archived examinations, question papers, and confidential marking schemes for {school?.name}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {filteredExams.length > 0 && (
            <button
              onClick={handleExportZip}
              disabled={isExportingZip}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-75 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
            >
              {isExportingZip ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Zipping...</span>
                </>
              ) : (
                <>
                  <Archive className="w-4 h-4" />
                  <span>Download ZIP ({filteredExams.length})</span>
                </>
              )}
            </button>
          )}

          <button
            onClick={() => navigate('create-exam')}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-800 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create Exam</span>
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="p-3 rounded-2xl border border-rose-200 bg-rose-50 text-rose-800 text-xs flex items-center gap-2">
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => void loadExams()} className="font-semibold underline">Retry</button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by subject, title, or exam code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none"
          />
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Subject</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full p-2 text-xs rounded-xl border border-slate-200 bg-white"
            >
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Class</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full p-2 text-xs rounded-xl border border-slate-200 bg-white"
            >
              {classes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Term</label>
            <select
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value)}
              className="w-full p-2 text-xs rounded-xl border border-slate-200 bg-white"
            >
              {terms.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Exams Grid */}
      {isLoading ? (
        <div className="bg-white rounded-3xl p-10 border border-slate-200 text-center text-sm text-slate-500">Loading exams and questions from Supabase...</div>
      ) : filteredExams.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 border border-slate-200 text-center">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800">{error ? 'Exams could not be loaded' : 'No exams match your filter criteria'}</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {error ? 'Check your database connection and permissions, then retry.' : 'Try adjusting your search terms or generate a new examination paper.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredExams.map((exam) => (
            <div
              key={exam.id}
              className="bg-white p-5 rounded-3xl border border-slate-200/90 hover:border-blue-300 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-500">
                  <span className="font-bold text-blue-600">{exam.subject}</span>
                  <span className="font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                    {exam.class_name}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-900 mt-1.5 leading-snug">
                  {exam.title}
                </h3>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">{exam.exam_code}</p>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 mt-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{exam.duration_minutes} mins</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    <span>{exam.questions?.length || 0} Questions</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleDownloadDocx(exam)}
                    disabled={actionId === `docx_${exam.id}`}
                    className="py-1.5 px-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-600" />
                    <span>{actionId === `docx_${exam.id}` ? 'Exporting...' : 'DOCX Paper'}</span>
                  </button>

                  <button
                    onClick={() => handleDownloadScheme(exam)}
                    disabled={actionId === `scheme_${exam.id}`}
                    className="py-1.5 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    title="Confidential Marking Scheme"
                  >
                    <Lock className="w-3 h-3 text-slate-600" />
                    <span>Scheme</span>
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={() => onPreviewExam(exam)}
                    className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Preview Paper</span>
                  </button>

                  {(role === 'school_admin' || exam.created_by === user?.id) && (
                    <button
                      onClick={() => void handleDelete(exam.id, exam.title)}
                      disabled={deletingId === exam.id}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors disabled:opacity-50"
                      title="Delete Exam"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
