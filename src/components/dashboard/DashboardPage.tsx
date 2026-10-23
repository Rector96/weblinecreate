import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { listSchoolExams } from '../../lib/examRepository';
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
  BookOpen
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
  const [inviteToken, setInviteToken] = useState<string>('');
  const [classesCount, setClassesCount] = useState(0);
  const [dataError, setDataError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      if (!school) {
        setExams([]);
        setClassesCount(0);
        setInviteToken('');
        return;
      }
      if (!isSupabaseConfigured()) {
        setDataError('Supabase is not configured. Dashboard records cannot be loaded.');
        setExams([]);
        setClassesCount(0);
        setInviteToken('');
        return;
      }

      setDataError(null);
      try {
        const [schoolExams, classesResult, inviteResult] = await Promise.all([
          listSchoolExams(school.id),
          supabase.from('school_classes').select('id', { count: 'exact', head: true }).eq('school_id', school.id),
          supabase.from('school_invitations').select('id, token, is_active, created_at')
            .eq('school_id', school.id).eq('is_active', true)
            .order('created_at', { ascending: false }).limit(1).maybeSingle(),
        ]);
        if (classesResult.error) throw classesResult.error;
        if (inviteResult.error) throw inviteResult.error;
        if (cancelled) return;

        setExams(schoolExams);
        setClassesCount(classesResult.count || 0);
        let token = inviteResult.data?.token || '';

        // Only school admins may issue invitation tokens. Tokens are persisted in Supabase.
        if (!token && role === 'school_admin' && user?.user_id) {
          const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
          for (let attempt = 0; attempt < 3 && !token; attempt += 1) {
            const bytes = new Uint8Array(6);
            window.crypto.getRandomValues(bytes);
            const candidate = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
            const { data, error } = await supabase.from('school_invitations')
              .insert({ school_id: school.id, token: candidate, role: 'teacher', created_by: user.user_id, is_active: true })
              .select('token').single();
            if (!error && data) token = data.token;
            else if (attempt === 2) throw error || new Error('Could not create a teacher invitation.');
          }
        }
        if (!cancelled) setInviteToken(token);
      } catch (error) {
        if (!cancelled) {
          console.error('Dashboard data load failed', error);
          setDataError('Could not load the latest school data. Please refresh and try again.');
        }
      }
    };

    void loadData();
    return () => { cancelled = true; };
  }, [school?.id, role, user?.id]);

  const copyInvite = () => {
    if (!inviteToken) return;
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

  const remainingAi = school ? Math.max(0, school.max_trial_ai_exams - school.ai_exams_used) : 0;

  return (
    <div className="space-y-6 text-left">
      {dataError && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">{dataError}</div>}
      {/* 1. Welcome Greeting Header (Smooth Blue) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-900 text-white rounded-3xl p-5 sm:p-6 shadow-lg shadow-blue-950/10">
        <div className="space-y-1">
          <div className="text-blue-200 text-xs font-semibold truncate max-w-full">
            {school?.name || 'ROCKCRAF'}
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            Hi, {user?.full_name?.split(' ')[0] || 'there'}
          </h2>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => navigate('create-exam')}
            className="px-4 py-2.5 rounded-xl bg-white text-blue-900 font-bold text-xs hover:bg-blue-50 shadow-md active:scale-95 transition-all flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4 text-blue-600" />
            <span>New exam</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Summary Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Card 1: Exams */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold text-slate-500">Exams</span>
            <FileText className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 tabular-nums">{exams.length}</div>
        </div>

        {/* Card 2: Plan */}
        <div className={`p-4 sm:p-5 rounded-2xl border shadow-xs ${
          school?.subscription_status === 'active'
            ? 'bg-emerald-50/50 border-emerald-200'
            : (school?.ai_exams_used || 0) >= 4
            ? 'bg-amber-50/60 border-amber-200'
            : 'bg-white border-slate-200/80'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">Plan</span>
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
              ? 'Active'
              : (school?.ai_exams_used || 0) >= 4
              ? 'Limit reached'
              : `${remainingAi} trials left`}
          </div>
          {school?.subscription_status !== 'active' && (
            <button onClick={onOpenPaystack} className="mt-1 text-[11px] font-semibold text-blue-600 hover:underline">
              Upgrade · ₦11,000
            </button>
          )}
        </div>

        {/* Card 3: Classes Managed */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold text-slate-500">Classes</span>
            <BookOpen className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 tabular-nums">
            {classesCount}
          </div>
        </div>

        {/* Card 4: Teacher Collaboration Token */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold text-slate-500">Invite code</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-lg font-mono font-black text-blue-600 tracking-wider">
            {inviteToken || 'No active invite'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            <button onClick={copyInvite} disabled={!inviteToken} className="hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 font-medium">
              {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy invite link'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Recent exams */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">Recent exams</h3>
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
