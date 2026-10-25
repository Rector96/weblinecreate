import React, { useState } from 'react';
import { MessageCircle, MessageSquareText, X, Send, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';

export const WhatsAppButton: React.FC = () => {
  const { user, school } = useAuth();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState('Suggestion');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const phoneNumber = '2349032299387';
  const whatsappMessage = encodeURIComponent('Hello ROCKCRAFT Support Team, I need help with my account or exam papers.');
  const avatar = user?.avatar_url || school?.logo_url || '';

  const submitFeedback = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!message.trim() || message.trim().length < 8) {
      setStatus({ ok: false, text: 'Please add a little more detail (at least 8 characters).' });
      return;
    }
    if (!isSupabaseConfigured()) {
      setStatus({ ok: false, text: 'Feedback is temporarily unavailable. Please contact us on WhatsApp.' });
      return;
    }
    setBusy(true); setStatus(null);
    const { error } = await supabase.from('user_feedback').insert({
      subject: subject.trim(),
      message: message.trim(),
      user_id: user?.user_id || null,
      user_name: user?.full_name || school?.admin_name || null,
      user_email: user?.email || school?.email || null,
      school_id: school?.id || null,
      school_name: school?.name || null,
      page_path: window.location.pathname,
      browser_info: navigator.userAgent.slice(0, 500),
      account_image_url: avatar || null,
    });
    setBusy(false);
    if (error) {
      console.error('Feedback submission failed', error);
      setStatus({ ok: false, text: 'We could not send this feedback. Please try again or contact us on WhatsApp.' });
      return;
    }
    setMessage('');
    setStatus({ ok: true, text: 'Thank you! Your feedback has been sent to the ROCKCRAFT team.' });
  };

  return (
    <>
      <div className="fixed bottom-20 md:bottom-6 right-3 sm:right-6 z-40 flex flex-col items-end gap-2">
        <a href={`https://wa.me/${phoneNumber}?text=${whatsappMessage}`} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-full bg-[#25D366] hover:bg-[#1fb956] text-white px-3.5 py-3 shadow-lg shadow-emerald-950/20 transition active:scale-95 text-xs font-bold"
          aria-label="Chat with ROCKCRAFT support on WhatsApp" title="Chat with us on WhatsApp">
          <MessageCircle className="w-5 h-5 fill-white stroke-[#25D366]" />
          <span className="hidden sm:inline">WhatsApp</span>
        </a>
        <button type="button" onClick={() => { setOpen(v => !v); setStatus(null); }}
          className="flex items-center gap-2 rounded-full bg-blue-700 hover:bg-blue-800 text-white px-3.5 py-3 shadow-lg shadow-blue-950/20 transition active:scale-95 text-xs font-bold"
          aria-expanded={open} aria-label="Send feedback to ROCKCRAFT">
          {open ? <X className="w-5 h-5" /> : <MessageSquareText className="w-5 h-5" />}
          <span className="hidden sm:inline">{open ? 'Close feedback' : 'Feedback'}</span>
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          <button type="button" className="pointer-events-auto absolute inset-0 bg-slate-950/25" aria-label="Close feedback form" onClick={() => setOpen(false)} />
          <section role="dialog" aria-modal="true" aria-labelledby="feedback-title"
            className="pointer-events-auto absolute right-3 bottom-36 sm:right-6 sm:bottom-28 w-[calc(100%-1.5rem)] max-w-md max-h-[min(76dvh,680px)] overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl animate-page-enter">
            <div className="rounded-t-3xl bg-gradient-to-r from-blue-950 to-blue-700 p-5 text-white">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center overflow-hidden shrink-0">
                    {avatar ? <img src={avatar} alt="Account profile" className="w-full h-full object-cover" /> : <MessageSquareText className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0"><h2 id="feedback-title" className="font-extrabold text-lg">Help us improve</h2><p className="text-blue-100 text-xs mt-0.5">Your feedback goes directly to our team.</p></div>
                </div>
                <button type="button" onClick={() => setOpen(false)} className="p-2 rounded-xl hover:bg-white/10" aria-label="Close"><X className="w-4 h-4" /></button>
              </div>
              {(user || school) && <p className="text-[11px] text-blue-100 mt-3 truncate">Sending as {user?.full_name || school?.name || user?.email}</p>}
            </div>
            <form onSubmit={submitFeedback} className="p-5 space-y-4">
              <div><label htmlFor="feedback-subject" className="block text-xs font-bold text-slate-700 mb-1.5">What is this about?</label>
                <select id="feedback-subject" value={subject} onChange={e => setSubject(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100">
                  <option>Suggestion</option><option>Bug / something is not working</option><option>Exam paper or PDF issue</option><option>Account / school profile</option><option>Billing / subscription</option><option>Other feedback</option>
                </select>
              </div>
              <div><label htmlFor="feedback-message" className="block text-xs font-bold text-slate-700 mb-1.5">Your feedback or improvement idea</label>
                <textarea id="feedback-message" required minLength={8} maxLength={4000} rows={5} value={message} onChange={e => setMessage(e.target.value)}
                  placeholder="Tell us what happened, what you expected, or what we can improve..." className="w-full resize-y rounded-xl border border-slate-200 px-3 py-3 text-sm leading-relaxed focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
                <p className="text-right text-[10px] text-slate-400 mt-1">{message.length}/4000</p>
              </div>
              {status && <div role={status.ok ? 'status' : 'alert'} className={`rounded-xl p-3 flex items-start gap-2 text-xs ${status.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
                {status.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}{status.text}
              </div>}
              <button type="submit" disabled={busy} className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white px-4 py-3.5 text-sm font-bold transition">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}{busy ? 'Sending feedback…' : 'Send feedback'}
              </button>
              <p className="text-[10px] leading-relaxed text-slate-400">We attach the current page, browser details and available account/school information so our team can investigate. We do not collect your precise location.</p>
            </form>
          </section>
        </div>
      )}
    </>
  );
};
