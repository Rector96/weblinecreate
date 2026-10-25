import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { NIGERIAN_STATES, NIGERIAN_STATES_LGAS } from '../../data/nigeriaStatesLgas';
import { InstitutionType } from '../../types';
import {
  School,
  Building,
  User,
  Mail,
  Phone,
  MapPin,
  Save,
  CheckCircle2,
  Camera,
  CreditCard,
  KeyRound,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

interface ProfilePageProps {
  onOpenPaystack: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ onOpenPaystack }) => {
  const { school, user, refreshSchool, role, isPlatformAdmin } = useAuth();
  const canEdit = role === 'school_admin' || isPlatformAdmin;

  const [name, setName] = useState(school?.name || '');
  const [adminName, setAdminName] = useState(school?.admin_name || '');
  const [email, setEmail] = useState(school?.email || '');
  const [phone, setPhone] = useState(school?.phone || '');
  const [state, setState] = useState(school?.state || 'Lagos');
  const [lga, setLga] = useState(school?.lga || 'Lagos Island');
  const [institutionType, setInstitutionType] = useState<InstitutionType>(
    school?.institution_type || 'Secondary'
  );
  const [motto, setMotto] = useState(school?.motto || '');
  const [address, setAddress] = useState(school?.address || '');
  const [logoUrl, setLogoUrl] = useState(school?.logo_url || '');

  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (school) {
      setName(school.name);
      setAdminName(school.admin_name);
      setEmail(school.email);
      setPhone(school.phone);
      setState(school.state);
      setLga(school.lga);
      setInstitutionType(school.institution_type);
      setMotto(school.motto || '');
      setAddress(school.address || '');
      setLogoUrl(school.logo_url || '');
    }
  }, [school]);

  // LGA cascading dropdown
  useEffect(() => {
    const lgas = NIGERIAN_STATES_LGAS[state] || [];
    if (lgas.length > 0 && !lgas.includes(lga)) {
      setLga(lgas[0]);
    }
  }, [state]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setMessage('Please upload your school logo as PNG, JPG or WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage('Please choose a logo smaller than 5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setMessage('Could not read that logo. Please try another image.');
        return;
      }
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 600 / Math.max(image.width, image.height));
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');
        if (!context) {
          setMessage('Your browser could not prepare the logo. Please try another image.');
          return;
        }
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        // Compact data URLs avoid oversized school rows and remain available to exam exports.
        let quality = 0.86;
        let compressed = canvas.toDataURL('image/webp', quality);
        while (compressed.length > 220000 && quality > 0.42) {
          quality -= 0.1;
          compressed = canvas.toDataURL('image/webp', quality);
        }
        if (compressed.length > 250000) {
          setMessage('This logo is still too large after compression. Please use a simpler or smaller image.');
          return;
        }
        setLogoUrl(compressed);
        setMessage('Logo prepared. Select Save School Profile Changes to store it permanently.');
      };
      image.onerror = () => setMessage('Could not decode that logo. Please try another image.');
      image.src = reader.result;
    };
    reader.onerror = () => setMessage('Could not read that logo. Please try another image.');
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!school || isSaving) return;
    if (!isSupabaseConfigured()) {
      setMessage('Supabase is not configured. School details were not saved.');
      return;
    }
    setIsSaving(true);

    const { error } = await supabase.from('schools').update({
      name,
      admin_name: adminName,
      email,
      phone,
      state,
      lga,
      institution_type: institutionType,
      motto,
      address,
      logo_url: logoUrl,
    }).eq('id', school.id);

    setIsSaving(false);
    if (error) {
      console.error('School profile update failed', error);
      setMessage('Could not save school details. Please check your connection and try again.');
      return;
    }
    await refreshSchool();
    setMessage('School details and logo saved successfully. The updated logo is now available across exam creation and exports.');
    setTimeout(() => setMessage(null), 5000);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 sm:space-y-5 text-left px-0.5 sm:px-2 pb-6">
      <div>
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
          School Profile & Identity
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          School details and subscription.
        </p>
      </div>

      {message && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-2xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{message}</span>
        </div>
      )}

      {/* Subscription Status Card */}
      {school && (
        <div className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 shadow-sm ${
          school.subscription_status === 'active'
            ? 'bg-gradient-to-r from-emerald-900 via-teal-900 to-emerald-800'
            : 'bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-800'
        }`}>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-200">
                Plan
              </span>
              {school.subscription_status === 'active' && (
                <span className="px-2 py-0.5 rounded-md bg-emerald-400 text-emerald-950 font-black text-[10px] uppercase">
                  ACTIVE
                </span>
              )}
            </div>
            <div className="text-lg font-extrabold capitalize mt-0.5">
              {school.subscription_status === 'active' ? 'Active' : 'Free trial'}
            </div>
            <p className="text-xs text-blue-100 mt-1">
              {school.subscription_status === 'active' ? (
                'Unlimited access.'
              ) : (
                <>
                  <span className="font-bold text-white">
                    {Math.max(0, 4 - school.ai_exams_used)} of 4
                  </span>{' '}
                  trials remaining.
                </>
              )}
            </p>

          </div>

          <button
            type="button"
            onClick={onOpenPaystack}
            className={`px-3 py-2 rounded-lg text-[11px] font-semibold transition-all shadow-sm shrink-0 self-start sm:self-center active:scale-95 ${
              school.subscription_status === 'active'
                ? 'bg-white text-emerald-900 hover:bg-emerald-50'
                : 'bg-white text-blue-900 hover:bg-blue-50'
            }`}
          >
            {school.subscription_status === 'active' ? 'Manage plan' : 'Upgrade · ₦11,000'}
          </button>
        </div>
      )}

      {/* Main Profile Form */}
      <form
        onSubmit={handleSave}
        className="bg-white p-4 sm:p-6 md:p-7 rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-sm space-y-4 sm:space-y-5 min-w-0"
      >
        {/* School Logo Section */}
        {!logoUrl && canEdit && (
          <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
            <strong>Action needed: add your school logo.</strong> Upload your official crest here and save your profile. ROCKCRAFT will use it in the header of your exam paper previews, print/PDF output and new DOCX exports.
          </div>
        )}
        <div className="flex flex-col min-[420px]:flex-row min-[420px]:items-center gap-3 sm:gap-4 pb-4 sm:pb-5 border-b border-slate-100 min-w-0">
          <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden shrink-0">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="School Logo"
                className="w-full h-full object-contain p-1"
                referrerPolicy="no-referrer"
              />
            ) : (
              <Building className="w-8 h-8 text-slate-400" />
            )}
            <label className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
              <Camera className="w-5 h-5 text-white" />
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
            </label>
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-900">Official School Crest / Logo</h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Your school logo appears on exam previews, printed / saved PDF papers and DOCX exports. Use PNG, JPG or WebP (maximum 1 MB).
            </p>
            <label className="inline-block mt-2 text-[11px] font-semibold text-blue-600 hover:text-blue-800 cursor-pointer">
              <span>Change Logo</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Official School Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canEdit}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none disabled:bg-slate-50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Principal / Head Admin *
            </label>
            <input
              type="text"
              required
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              disabled={!canEdit}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none disabled:bg-slate-50"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Official Email Address *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!canEdit}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none disabled:bg-slate-50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Phone Number *
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={!canEdit}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none disabled:bg-slate-50"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">State *</label>
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              disabled={!canEdit}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white disabled:bg-slate-50"
            >
              {NIGERIAN_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">L.G.A *</label>
            <select
              value={lga}
              onChange={(e) => setLga(e.target.value)}
              disabled={!canEdit}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white disabled:bg-slate-50"
            >
              {(NIGERIAN_STATES_LGAS[state] || []).map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Institution Type *
            </label>
            <select
              value={institutionType}
              onChange={(e) => setInstitutionType(e.target.value as any)}
              disabled={!canEdit}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white disabled:bg-slate-50"
            >
              <option value="Secondary">Secondary School</option>
              <option value="College">College</option>
              <option value="Comprehensive">Comprehensive</option>
              <option value="International">International</option>
              <option value="Technical">Technical College</option>
              <option value="Primary & Secondary">Primary & Secondary</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            School Motto (Optional)
          </label>
          <input
            type="text"
            placeholder="e.g. Floreat Collegium (Let the College Flourish)"
            value={motto}
            onChange={(e) => setMotto(e.target.value)}
            disabled={!canEdit}
            className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none disabled:bg-slate-50"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            School Physical Address *
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. 3 Catholic Mission Street, Lagos Island, Lagos"
            disabled={!canEdit}
            className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none disabled:bg-slate-50"
          />
        </div>

        {canEdit ? (
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="w-fit max-w-full py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-800 disabled:opacity-75 text-white font-semibold text-[11px] flex items-center justify-center gap-1.5 shadow-sm transition-all"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Updating...' : 'Save School Profile Changes'}</span>
            </button>
            <span className="text-[10px] sm:text-[11px] text-slate-400 leading-relaxed">
              Changes reflect instantly on all exported exam documents.
            </span>
          </div>
        ) : (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] sm:text-xs text-slate-600">
            You are currently viewing as a Subject Teacher.
          </div>
        )}
      </form>
    </div>
  );
};
