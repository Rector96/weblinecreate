import React, { useEffect } from 'react';
import { ArrowRight, BookOpenCheck, ClipboardCheck, GraduationCap, Mail, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react';

type PublicInfoPageProps = { page: 'about' | 'contact' };

const WHATSAPP_URL = 'https://wa.me/2349032299387?text=Hello%20ROCKCRAFT%20Support%20Team%2C%20I%20need%20help%20with%20ROCKCRAFT.';
const EMAIL = 'rockwavedigital@gmail.com';

export const PublicInfoPage: React.FC<PublicInfoPageProps> = ({ page }) => {
  const isAbout = page === 'about';
  useEffect(() => {
    const title = isAbout ? 'About ROCKCRAFT | Better School Assessment' : 'Contact ROCKCRAFT Support';
    const summary = isAbout
      ? 'Discover how ROCKCRAFT empowers teachers and schools to prepare, organise and improve examination assessment.'
      : 'Contact ROCKCRAFT support by email or WhatsApp for help with your school workspace and examinations.';
    const canonicalUrl = `https://rockcraft.netlify.app/${page}`;
    document.title = title;

    const setMeta = (selector: string, attribute: 'name' | 'property', key: string, content: string) => {
      let element = document.querySelector(selector) as HTMLMetaElement | null;
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attribute, key);
        document.head.appendChild(element);
      }
      element.content = content;
    };

    setMeta('meta[name="description"]', 'name', 'description', summary);
    setMeta('meta[property="og:title"]', 'property', 'og:title', title);
    setMeta('meta[property="og:description"]', 'property', 'og:description', summary);
    setMeta('meta[property="og:url"]', 'property', 'og:url', canonicalUrl);
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title);
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', summary);

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;
    return () => {
      document.title = 'ROCKCRAFT | AI Exam Question & Paper Generator for Nigerian Schools';
      if (canonical) canonical.href = 'https://rockcraft.netlify.app/';
    };
  }, [isAbout, page]);
  return (
    <div className="min-h-screen overflow-hidden bg-[#f7f9fd] text-slate-900">
      <header className="relative z-10 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <a href="/" className="flex items-center gap-3" aria-label="ROCKCRAFT home">
            <img src="/rockcraft-logo.png?v=4" alt="" className="h-10 w-10 object-contain" />
            <span className="text-lg font-black tracking-tight">ROCKCRAFT</span>
          </a>
          <nav className="flex items-center gap-3 sm:gap-6 text-sm font-semibold">
            <a href="/about" className={isAbout ? 'text-blue-700' : 'text-slate-600 hover:text-blue-700'}>About</a>
            <a href="/contact" className={!isAbout ? 'text-blue-700' : 'text-slate-600 hover:text-blue-700'}>Contact</a>
            <a href="/" className="rounded-full bg-blue-700 px-4 py-2.5 text-white shadow-lg shadow-blue-900/15 transition hover:bg-blue-800">Sign in <ArrowRight className="ml-1 inline h-4 w-4" /></a>
          </nav>
        </div>
      </header>

      {isAbout ? (
        <main>
          <section className="relative isolate overflow-hidden bg-[#071b3b] text-white">
            <div className="absolute -right-24 -top-32 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl" />
            <div className="absolute -bottom-40 left-0 h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl" />
            <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1.1fr_.9fr] lg:py-28">
              <div>
                <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[.18em] text-blue-100"><GraduationCap className="h-4 w-4" /> Better assessment starts with teachers</p>
                <h1 className="max-w-3xl text-4xl font-black leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">Give educators the tools to shape better examinations.</h1>
                <p className="mt-6 max-w-2xl text-base leading-8 text-blue-100 sm:text-lg">ROCKCRAFT helps schools and teachers take control of examination preparation, question setting and assessment. It brings the work of creating, organising and preparing quality exam papers into one practical workspace.</p>
                <a href="/" className="mt-9 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-extrabold text-blue-950 shadow-xl transition hover:-translate-y-0.5">Explore ROCKCRAFT <ArrowRight className="h-4 w-4" /></a>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-white/15 bg-white/[.08] p-6 backdrop-blur"><BookOpenCheck className="h-8 w-8 text-cyan-300" /><h2 className="mt-5 text-lg font-bold">Teacher-led question setting</h2><p className="mt-2 text-sm leading-6 text-blue-100">A focused workspace for preparing questions and examination papers with clarity and control.</p></div>
                <div className="rounded-3xl border border-white/15 bg-white/[.08] p-6 backdrop-blur sm:mt-10"><ClipboardCheck className="h-8 w-8 text-cyan-300" /><h2 className="mt-5 text-lg font-bold">Stronger school assessment</h2><p className="mt-2 text-sm leading-6 text-blue-100">Support consistency, organisation and quality across school examinations.</p></div>
                <div className="rounded-3xl border border-white/15 bg-white/[.08] p-6 backdrop-blur sm:col-span-2"><Sparkles className="h-8 w-8 text-cyan-300" /><h2 className="mt-5 text-lg font-bold">AI as an assistant—not the decision-maker</h2><p className="mt-2 text-sm leading-6 text-blue-100">AI features can help educators work faster, while teachers remain responsible for reviewing, refining and approving the questions they use.</p></div>
              </div>
            </div>
          </section>
          <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-20">
            <div className="grid gap-8 md:grid-cols-3">
              {[['01','Empower teachers','Give teachers practical tools to prepare, edit and organise assessment content.'],['02','Support school leaders','Help schools maintain oversight of examination preparation and assessment workflows.'],['03','Keep quality central','Make review and educator judgement part of every examination process.']].map(([n,t,d]) => <article key={n} className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm"><span className="text-sm font-black tracking-widest text-blue-700">{n}</span><h2 className="mt-5 text-xl font-extrabold">{t}</h2><p className="mt-3 text-sm leading-7 text-slate-600">{d}</p></article>)}
            </div>
          </section>
        </main>
      ) : (
        <main className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[.95fr_1.05fr] lg:py-24">
          <section className="flex flex-col justify-center">
            <p className="text-xs font-black uppercase tracking-[.2em] text-blue-700">We’re here to help</p>
            <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Talk to the ROCKCRAFT team.</h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-slate-600">Questions about your school account, exam preparation, or using ROCKCRAFT? Reach out through either channel and our team will be glad to assist.</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#16a765] px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-900/10 transition hover:bg-[#128c55]"><MessageCircle className="h-5 w-5" /> Chat on WhatsApp</a>
              <a href={`mailto:${EMAIL}?subject=ROCKCRAFT%20Enquiry`} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3.5 text-sm font-bold text-slate-800 transition hover:border-blue-300 hover:text-blue-700"><Mail className="h-5 w-5" /> Send an email</a>
            </div>
          </section>
          <section className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_24px_80px_-36px_rgba(15,35,70,.22)] sm:p-10">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><ShieldCheck className="h-7 w-7" /></div>
            <h2 className="mt-6 text-2xl font-extrabold">Contact details</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">Choose the channel that works best for you.</p>
            <a href={`mailto:${EMAIL}`} className="mt-8 flex items-center gap-4 rounded-2xl border border-slate-200 p-4 transition hover:border-blue-300 hover:bg-blue-50/40"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Mail className="h-5 w-5" /></span><span className="min-w-0"><span className="block text-xs font-semibold text-slate-500">Email support</span><span className="block break-all text-sm font-bold text-slate-900">{EMAIL}</span></span><ArrowRight className="ml-auto h-4 w-4 shrink-0 text-slate-400" /></a>
            <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="mt-3 flex items-center gap-4 rounded-2xl border border-slate-200 p-4 transition hover:border-emerald-300 hover:bg-emerald-50/40"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><MessageCircle className="h-5 w-5" /></span><span><span className="block text-xs font-semibold text-slate-500">WhatsApp support</span><span className="block text-sm font-bold text-slate-900">Chat with ROCKCRAFT</span></span><ArrowRight className="ml-auto h-4 w-4 shrink-0 text-slate-400" /></a>
          </section>
        </main>
      )}
      <footer className="border-t border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-7 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8"><span>© {new Date().getFullYear()} ROCKCRAFT. Built to support better school assessment.</span><div className="flex gap-5"><a href="/about" className="hover:text-blue-700">About</a><a href="/contact" className="hover:text-blue-700">Contact</a><a href="/" className="hover:text-blue-700">Sign in</a></div></div></footer>
    </div>
  );
};
