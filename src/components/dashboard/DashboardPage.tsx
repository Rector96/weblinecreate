import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth';
import { db, dbEvents } from '../../lib/db';
import { Exam } from '../../types';
import { exportExamToDocx, exportMarkingSchemeToDocx } from '../../utils/docxExport';
import {
  FileText,
  PlusCircle,
  Users,
  CreditCard,
  Copy,
  Check,
  Download,
  BookOpen,
  Clock,
  Sparkles
} from 'lucide-react';

interface DashboardPageProps {
  navigate: (route: string, param?: string) => void;
  onOpenPaystack: () => void;
  onPreviewExam: (exam: Exam) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  navigate,
  onOpenPaystack,
  onPreviewExam,
}) => {
  const { user, school, role } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [inviteToken, setInviteToken] = useState<string>('KC2026');
  const [copied, setCopied] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const loadData = () => {
    if (!school) return;
    const allExams = db.getExams(school.id);
    setExams(allExams);

    const invites = db.getInvites(school.id);
    if (invites.length > 0) {
      setInviteToken(invites[0].token);
    } else {
      const newInv = db.createInvite(school.id, user?.id || 'admin');
      setInviteToken(newInv.token);
    }
  };

  useEffect(() => {
    loadData();
    const unsubExams = dbEvents.subscribe('exams', loadData);
    const unsubInvites = dbEvents.subscribe('invites', loadData);
    return () => {
      unsubExams();
      unsubInvites();
    };
  }, [school?.id]);

  const copyInvite = () => {
    const inviteUrl = `${window.location.origin}/join/${inviteToken}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadDocx = async (exam: Exam, e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloadingId(exam.id);
    try {
      await exportExamToDocx(exam, school);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadScheme = async (exam: Exam, e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloadingId(`scheme_${exam.id}`);
    try {
      await exportMarkingSchemeToDocx(exam, school);
    } finally {
      setDownloadingId(null);
    }
  };

  const totalQuestions = exams.reduce((acc, ex) => acc + (ex.questions?.length || 0), 0);
  const remainingAi = school ? Math.max(0, school.max_trial_ai_exams - school.ai_exams_used) : 0;

  return (
    <div className="space-y-6 text-left">
      {/* 1. Welcome Greeting Header (Smooth Blue) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-900 text-white rounded-3xl p-6 sm:p-8 shadow-lg shadow-blue-950/10">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-blue-200 text-xs font-semibold">
            <span>{school?.name || 'School Dashboard'}</span>
            <span>·</span>
            <span>{school?.state || 'Nigeria'}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            Welcome back, {user?.full_name?.split(' ')[0] || 'Educator'}
          </h2>
          <p className="text-xs text-blue-200/90 max-w-xl">
            Author and download official WAEC, NECO, and JAMB-standard examination papers with instant Times New Roman formatting.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => navigate('create-exam')}
            className="px-4 py-2.5 rounded-xl bg-white text-blue-900 font-bold text-xs hover:bg-blue-50 shadow-md active:scale-95 transition-all flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4 text-blue-600" />
            <span>New Exam Paper</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Summary Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Card 1: Exams Created */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold text-slate-500">Exams Created</span>
            <FileText className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 tabular-nums">{exams.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            <span className="font-semibold text-slate-700 tabular-nums">{totalQuestions}</span> questions drafted
          </div>
        </div>

        {/* Card 2: Subscription Status */}
        <div className={`p-4 sm:p-5 rounded-2xl border shadow-xs ${
          school?.subscription_status === 'active'
            ? 'bg-emerald-50/50 border-emerald-200'
            : (school?.ai_exams_used || 0) >= 4
            ? 'bg-amber-50/60 border-amber-200'
            : 'bg-white border-slate-200/80'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">Subscription Status</span>
            {school?.subscription_status === 'active' ? (
              <span className="flex items-center gap-1 text-[10px] font-black uppercase bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-md">
                <Check className="w-3 h-3" />
                PAID
              </span>
            ) : (school?.ai_exams_used || 0) >= 4 ? (
              <span className="text-[10px] font-bold uppercase bg-amber-200 text-amber-900 px-2 py-0.5 rounded-md">
                Limit
              </span>
            ) : (
              <CreditCard className="w-4 h-4 text-sky-600" />
            )}
          </div>
          <div className={`text-base sm:text-lg font-black ${
            school?.subscription_status === 'active' ? 'text-emerald-800' : 'text-slate-900'
          }`}>
            {school?.subscription_status === 'active'
              ? 'Full Term Active'
              : (school?.ai_exams_used || 0) >= 4
              ? '4/4 Used (5th Pending)'
              : `${remainingAi} Trial Left`}
          </div>
          <div className="text-[11px] mt-1">
            {school?.subscription_status === 'active' ? (
              <span className="text-emerald-700 font-semibold">✓ Unlimited AI & Papers</span>
            ) : (
              <button
                onClick={onOpenPaystack}
                className={`font-semibold hover:underline ${
                  (school?.ai_exams_used || 0) >= 4 ? 'text-amber-800 font-bold' : 'text-blue-600'
                }`}
              >
                {(school?.ai_exams_used || 0) >= 4
                  ? 'Pay ₦11,000 for 5th exam'
                  : `${remainingAi} AI trials left · Upgrade`}
              </button>
            )}
          </div>
        </div>

        {/* Card 3: Classes Managed */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold text-slate-500">Standard Classes</span>
            <BookOpen className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 tabular-nums">
            {school ? db.getClasses(school.id).length : 6}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">JSS 1 – SSS 3 Levels</div>
        </div>

        {/* Card 4: Teacher Collaboration Token */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold text-slate-500">Teacher Code</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-lg font-mono font-black text-blue-600 tracking-wider">
            {inviteToken}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            <button onClick={copyInvite} className="hover:text-blue-600 flex items-center gap-1 font-medium">
              {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Link Copied' : 'Share staff invite'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Teacher Invitation Banner Card */}
      {role === 'school_admin' && (
        <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Invite Subject Teachers</h3>
              <p className="text-xs text-slate-500 mt-0.5 max-w-xl">
                Teachers can author exams for their subjects directly inside your school repository.
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="font-mono text-xs font-bold bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 text-blue-900">
                  {inviteToken}
                </span>
                <button
                  onClick={copyInvite}
                  className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Link Copied!' : 'Copy Staff Link'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Recent Examination Papers Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">Recent Exam Papers</h3>
            <p className="text-xs text-slate-500">Official WAEC/JAMB formatted printable exams</p>
          </div>
          <button
            onClick={() => navigate('exams')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
          >
            View All ({exams.length})
          </button>
        </div>

        {exams.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-slate-800">No exams generated yet</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Start by crafting your first examination paper with AI or manual input.
            </p>
            <button
              onClick={() => navigate('create-exam')}
              className="mt-4 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
            >
              Create First Exam
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {exams.slice(0, 4).map((exam) => (
              <div
                key={exam.id}
                onClick={() => onPreviewExam(exam)}
                className="bg-white p-4 rounded-2xl border border-slate-200/80 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                      <span className="font-semibold text-blue-600">{exam.subject}</span>
                      <span>·</span>
                      <span>{exam.class_name}</span>
                      <span>·</span>
                      <span>{exam.term}</span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 mt-1 group-hover:text-blue-700 transition-colors">
                      {exam.title}
                    </h4>
                  </div>
                  <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-mono shrink-0">
                    {exam.exam_code}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{exam.duration_minutes} mins</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    <span>{exam.questions?.length || 0} questions</span>
                  </span>
                  <span className="font-semibold text-slate-700 ml-auto tabular-nums">
                    {exam.total_marks} Marks
                  </span>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center gap-2 mt-3 pt-2">
                  <button
                    onClick={(e) => handleDownloadDocx(exam, e)}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-600" />
                    <span>{downloadingId === exam.id ? 'Exporting...' : 'DOCX Paper'}</span>
                  </button>

                  <button
                    onClick={(e) => handleDownloadScheme(exam, e)}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    title="Confidential Marking Scheme"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-600" />
                    <span>Marking Scheme</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
