import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../lib/auth';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { listSchoolExams } from '../../lib/examRepository';
import { Exam } from '../../types';
import { exportExamToDocx, exportMarkingSchemeToDocx } from '../../utils/docxExport';
import {
  FileText,
  Plus,
  Users,
  Copy,
  Check,
  Download,
  BookOpen,
  Share2,
  Clock,
  ChevronRight,
  Sparkles,
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
        const nowIso = new Date().toISOString();
        const [schoolExams, classesResult, inviteResult] = await Promise.all([
          listSchoolExams(school.id),
          supabase.from('school_classes').select('id', { count: 'exact', head: true }).eq('school_id', school.id),
          // Only reuse a current teacher invitation. Older links can remain active in
          // the table after their expiry time, and admin-role invites must never be
          // handed to teachers.
          supabase.from('school_invitations').select('id, token, role, is_active, expires_at, created_at')
            .eq('school_id', school.id)
            .eq('role', 'teacher')
            .eq('is_active', true)
            .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
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
              .insert({
                school_id: school.id,
                token: candidate,
                role: 'teacher',
                created_by: user.user_id,
                is_active: true,
                expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              })
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

  const getInviteUrl = () => inviteToken ? `${window.location.origin}/join/${inviteToken}` : '';

  const copyInvite = async () => {
    const inviteUrl = getInviteUrl();
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setDataError('Could not copy the invite link. Please copy it from your browser address bar after opening it.');
    }
  };

  const shareInvite = async () => {
    const inviteUrl = getInviteUrl();
    if (!inviteUrl) return;
    const shareData = {
      title: `${school?.name || 'School'} teacher exam workspace`,
      text: `Use this secure link to create exams for ${school?.name || 'our school'}. It opens the teacher exam workspace, not the school dashboard.`,
      url: inviteUrl,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(inviteUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      setDataError('Unable to share automatically. Use Copy invite link instead.');
    }
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

  const maxAi = school?.max_trial_ai_exams ?? 3;
  const usedAi = school?.ai_exams_used ?? 0;
  const remainingAi = school ? Math.max(0, maxAi - usedAi) : 0;
  const isPaid = school?.subscription_status === 'active';
  const trialExhausted = !isPaid && remainingAi <= 0;
  const creditProgress = isPaid ? 100 : maxAi > 0 ? Math.min(100, Math.round((usedAi / maxAi) * 100)) : 0;

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const firstName = user?.full_name?.split(' ')[0] || 'there';

  const quickActions = [
    {
      key: 'create',
      label: 'Create',
      hint: 'New paper',
      icon: Plus,
      onClick: () => navigate('create-exam'),
      tone: 'primary' as const,
    },
    {
      key: 'papers',
      label: 'Papers',
      hint: `${exams.length} saved`,
      icon: FileText,
      onClick: () => navigate('exams'),
      tone: 'neutral' as const,
    },
    {
      key: 'invite',
      label: 'Invite',
      hint: inviteToken || 'Teachers',
      icon: Users,
      onClick: () => {
        if (inviteToken) void shareInvite();
        else setDataError('No active teacher invite is available yet. Refresh or check your school admin role.');
      },
      tone: 'neutral' as const,
    },
    {
      key: 'classes',
      label: 'Classes',
      hint: `${classesCount} active`,
      icon: BookOpen,
      onClick: () => navigate('classes'),
      tone: 'neutral' as const,
    },
  ];

  return (
    <div className="space-y-5 text-left max-w-3xl mx-auto">
      {dataError && (
        <div role="alert" className="rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          {dataError}
        </div>
      )}

      {/* Greeting — soft, app-like */}
      <div className="px-0.5 pt-0.5">
        {school?.name && (
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 truncate">
            {school.name}
          </p>
        )}
        <h2 className="mt-0.5 text-[1.55rem] sm:text-2xl font-extrabold tracking-tight text-slate-900">
          {greeting}, {firstName}
        </h2>
        <p className="mt-0.5 text-sm text-slate-500">
          {exams.length === 0
            ? 'Your first paper is one tap away.'
            : 'Ready to set the next paper?'}
        </p>
      </div>

      {/* Credits wallet card — fintech balance feel, same blue family */}
      <div
        className={`relative overflow-hidden rounded-[1.35rem] p-4 sm:p-5 text-white shadow-md ${
          isPaid
            ? 'bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-600 shadow-emerald-900/10'
            : trialExhausted
            ? 'bg-gradient-to-br from-slate-800 via-slate-700 to-blue-900 shadow-slate-900/15'
            : 'bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-600 shadow-blue-900/15'
        }`}
      >
        <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-6 h-28 w-28 rounded-full bg-white/10 blur-2xl" />

        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-white/80">
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span className="text-[11px] font-semibold uppercase tracking-wide">
                {isPaid ? 'Subscription' : 'AI exam credits'}
              </span>
            </div>
            <p className="mt-1.5 text-2xl sm:text-3xl font-black tracking-tight tabular-nums">
              {isPaid ? 'Active plan' : `${remainingAi} left`}
            </p>
            <p className="mt-0.5 text-xs text-white/75">
              {isPaid
                ? 'Unlimited AI generation for this term'
                : trialExhausted
                ? 'Trial credits used · upgrade to continue'
                : `${usedAi} of ${maxAi} trial AI exams used`}
            </p>
          </div>

          {!isPaid && (
            <button
              type="button"
              onClick={onOpenPaystack}
              className="shrink-0 rounded-full bg-white/95 px-3.5 py-2 text-xs font-bold text-blue-800 shadow-sm transition active:scale-95 hover:bg-white"
            >
              Upgrade · ₦11k
            </button>
          )}
          {isPaid && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
              <Check className="h-3 w-3" />
              Paid
            </span>
          )}
        </div>

        {!isPaid && (
          <div className="relative mt-4">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-white/90 transition-all duration-500"
                style={{ width: `${creditProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Quick actions — 2×2 app tiles */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        {quickActions.map((action) => {
          const Icon = action.icon;
          const isPrimary = action.tone === 'primary';
          return (
            <button
              key={action.key}
              type="button"
              onClick={action.onClick}
              className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left transition active:scale-[0.98] ${
                isPrimary
                  ? 'border-blue-200 bg-blue-50/80 shadow-sm shadow-blue-600/5 hover:bg-blue-50'
                  : 'border-slate-200/80 bg-white shadow-xs hover:border-slate-300 hover:bg-slate-50/80'
              }`}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  isPrimary
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/25'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={isPrimary ? 2.5 : 2} />
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-bold ${isPrimary ? 'text-blue-900' : 'text-slate-900'}`}>
                  {action.label}
                </p>
                <p className="truncate text-[11px] font-medium text-slate-500">{action.hint}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Invite strip for admins — compact, not a full KPI card */}
      {role === 'school_admin' && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-white px-3.5 py-3 shadow-xs">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Teacher invite</p>
            <p className="font-mono text-sm font-bold tracking-wider text-blue-700">
              {inviteToken || 'Generating…'}
            </p>
          </div>
          <button
            type="button"
            onClick={copyInvite}
            disabled={!inviteToken}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            type="button"
            onClick={shareInvite}
            disabled={!inviteToken}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Share2 className="h-3.5 w-3.5" />
            Share
          </button>
        </div>
      )}

      {/* Recent exams */}
      <div className="space-y-3">
        <div className="flex items-end justify-between gap-3 px-0.5">
          <div>
            <h3 className="text-base font-bold tracking-tight text-slate-900">Recent</h3>
            <p className="text-xs text-slate-500">Tap a paper to preview or export</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('exams')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            See all{exams.length > 0 ? ` (${exams.length})` : ''}
          </button>
        </div>

        {exams.length === 0 ? (
          <div className="rounded-[1.35rem] border border-dashed border-slate-200 bg-white px-6 py-10 text-center shadow-xs">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <FileText className="h-7 w-7" />
            </div>
            <h4 className="mt-4 text-sm font-bold text-slate-900">No papers yet</h4>
            <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-slate-500">
              Create your first exam with AI or write it manually. Export comes out in official school format.
            </p>
            <button
              type="button"
              onClick={() => navigate('create-exam')}
              className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700 active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              Create with AI
            </button>
            <button
              type="button"
              onClick={() => navigate('create-exam')}
              className="mt-2 block w-full text-center text-xs font-semibold text-slate-500 hover:text-slate-700"
            >
              Or write manually
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {exams.slice(0, 5).map((exam) => {
              const isPublished = exam.status === 'published';
              return (
                <div
                  key={exam.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onPreviewExam(exam)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onPreviewExam(exam);
                    }
                  }}
                  className="group flex cursor-pointer items-stretch gap-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs transition hover:border-blue-200 hover:shadow-sm"
                >
                  <div className={`w-1 shrink-0 ${isPublished ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                  <div className="min-w-0 flex-1 p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-bold text-slate-900 group-hover:text-blue-700">
                            {exam.subject}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                              isPublished
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-amber-50 text-amber-800'
                            }`}
                          >
                            {isPublished ? 'Published' : 'Draft'}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {exam.class_name} · {exam.term} · {exam.exam_code}
                        </p>
                      </div>
                      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 group-hover:text-blue-500" />
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3 text-slate-400" />
                        {exam.duration_minutes} mins
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <FileText className="h-3 w-3 text-slate-400" />
                        {exam.questions?.length || 0} Qs
                      </span>
                      <span className="font-semibold tabular-nums text-slate-700">
                        {exam.total_marks} marks
                      </span>
                    </div>

                    <div className="mt-2.5 flex gap-2">
                      <button
                        type="button"
                        onClick={(e) => handleDownloadDocx(exam, e)}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-50 px-2.5 py-2 text-[11px] font-semibold text-blue-800 transition hover:bg-blue-100"
                      >
                        <Download className="h-3.5 w-3.5 text-blue-600" />
                        {downloadingId === exam.id ? 'Exporting…' : 'DOCX'}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDownloadScheme(exam, e)}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-2.5 py-2 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-200"
                        title="Confidential Marking Scheme"
                      >
                        <Download className="h-3.5 w-3.5 text-slate-600" />
                        {downloadingId === `scheme_${exam.id}` ? 'Exporting…' : 'Scheme'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
