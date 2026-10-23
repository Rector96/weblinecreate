import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { SchoolClass } from '../../types';
import { normalizeClassName } from '../../data/nigerianCurriculum';
import {
  BookOpen,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
  Layers
} from 'lucide-react';

export const ClassesPage: React.FC = () => {
  const { school, role } = useAuth();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Array<{ id: string; name: string }>>([]);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [isSavingSubject, setIsSavingSubject] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newLevel, setNewLevel] = useState<'Junior' | 'Senior'>('Junior');
  const [armsInput, setArmsInput] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadClasses = async () => {
    if (!school) {
      setClasses([]);
      return;
    }
    if (!isSupabaseConfigured()) {
      setError('Class management requires Supabase configuration. Local demo data is not shown.');
      setClasses([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    const { data, error: queryError } = await supabase
      .from('school_classes')
      .select('*')
      .eq('school_id', school.id)
      .order('display_order', { ascending: true });
    setIsLoading(false);
    if (queryError) {
      setError(`Could not load classes: ${queryError.message}`);
      setClasses([]);
      return;
    }
    setClasses((data || []).map((row) => ({
      id: row.id,
      school_id: row.school_id,
      name: row.name,
      level: row.level,
      arms: row.arms || [],
      display_order: row.display_order,
      created_at: row.created_at,
    })) as SchoolClass[]);
  };

  const loadSubjects = async () => {
    if (!school || !isSupabaseConfigured()) {
      setSubjects([]);
      return;
    }
    const { data, error: queryError } = await supabase
      .from('school_subjects')
      .select('id, name')
      .eq('school_id', school.id)
      .eq('is_active', true)
      .order('name', { ascending: true });
    if (queryError) {
      setError('Could not load school subjects. Apply the school-subjects SQL migration and retry.');
      setSubjects([]);
      return;
    }
    setSubjects(data || []);
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newSubjectName.trim().replace(/\s+/g, ' ');
    if (!school || !name || isSavingSubject) return;
    if (!isSupabaseConfigured()) {
      setError('Supabase is not configured. The subject was not saved.');
      return;
    }
    if (subjects.some((item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setError('This subject is already in your school subject list.');
      return;
    }
    setIsSavingSubject(true);
    setError(null);
    const { data, error: insertError } = await supabase
      .from('school_subjects')
      .insert({ school_id: school.id, name, is_active: true })
      .select('id, name')
      .single();
    setIsSavingSubject(false);
    if (insertError || !data) {
      setError(insertError?.code === '23505' ? 'This subject already exists for your school.' : `Could not save subject: ${insertError?.message || 'No record returned.'}`);
      return;
    }
    setSubjects((current) => [...current, data].sort((a, b) => a.name.localeCompare(b.name)));
    setNewSubjectName('');
    setMessage(`Subject "${name}" added.`);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleRemoveSubject = async (id: string, name: string) => {
    if (!school || !confirm(`Remove ${name} from the available subject list? Past exams will be kept.`)) return;
    const { error: updateError } = await supabase
      .from('school_subjects')
      .update({ is_active: false })
      .eq('id', id)
      .eq('school_id', school.id);
    if (updateError) {
      setError(`Could not remove subject: ${updateError.message}`);
      return;
    }
    setSubjects((current) => current.filter((item) => item.id !== id));
  };

  useEffect(() => {
    void loadClasses();
    void loadSubjects();
  }, [school?.id]);

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!school || !newClassName.trim() || isSaving) return;
    if (!isSupabaseConfigured()) {
      setError('Supabase is not configured. The class was not saved.');
      return;
    }

    const normalized = normalizeClassName(newClassName);
    const armsList = armsInput
      ? armsInput.split(',').map((a) => a.trim()).filter(Boolean)
      : ['A', 'B'];

    setIsSaving(true);
    setError(null);
    const { data, error: insertError } = await supabase
      .from('school_classes')
      .insert({
        school_id: school.id,
        name: normalized,
        level: newLevel,
        arms: armsList,
        display_order: classes.length + 1,
      })
      .select('*')
      .single();
    setIsSaving(false);
    if (insertError || !data) {
      setError(`Could not save class: ${insertError?.message || 'No record returned.'}`);
      return;
    }

    setClasses((current) => [...current, {
      id: data.id,
      school_id: data.school_id,
      name: data.name,
      level: data.level,
      arms: data.arms || [],
      display_order: data.display_order,
      created_at: data.created_at,
    } as SchoolClass].sort((a, b) => a.display_order - b.display_order));
    setNewClassName('');
    setArmsInput('');
    setMessage(`Class "${normalized}" added successfully.`);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleDeleteClass = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name}?`)) return;
    if (!isSupabaseConfigured()) {
      setError('Supabase is not configured. The class was not deleted.');
      return;
    }
    setError(null);
    const { error: deleteError } = await supabase.from('school_classes').delete().eq('id', id).eq('school_id', school?.id || '');
    if (deleteError) {
      setError(`Could not delete class: ${deleteError.message}`);
      return;
    }
    setClasses((current) => current.filter((item) => item.id !== id));
  };

  return (
    <div className="space-y-6 text-left max-w-4xl mx-auto">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          Classes
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Manage your school classes.
        </p>
      </div>

      {error && (
        <div role="alert" className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-2xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <button type="button" onClick={() => void loadClasses()} className="ml-auto underline font-semibold">Retry</button>
        </div>
      )}

      {message && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-2xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{message}</span>
        </div>
      )}

      {/* Add Class Form (Admins only) */}
      {role === 'school_admin' && (
        <form
          onSubmit={handleAddClass}
          className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs space-y-4"
        >
          <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
            <GraduationCap className="w-4 h-4 text-blue-600" />
            <span>Add Class / Normalization Engine</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Class Name (e.g. ss3, jss1, Grade 10)
              </label>
              <input
                type="text"
                required
                placeholder="e.g. ss2 or jss 1"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Level
              </label>
              <select
                value={newLevel}
                onChange={(e) => setNewLevel(e.target.value as any)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white"
              >
                <option value="Junior">Junior Secondary (JSS / BECE)</option>
                <option value="Senior">Senior Secondary (SSS / WAEC)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Arms / Streams (Comma-separated)
              </label>
              <input
                type="text"
                placeholder="e.g. Gold, Silver, Diamond"
                value={armsInput}
                onChange={(e) => setArmsInput(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            className="py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-800 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Add Class'}</span>
          </button>
        </form>
      )}

      {/* Classes List */}
      {isLoading ? (
        <div className="p-8 text-center text-sm text-slate-500">Loading classes from Supabase...</div>
      ) : classes.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-500 bg-white rounded-2xl border border-slate-200">No classes have been saved for this school yet.</div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {classes.map((cls) => (
          <div
            key={cls.id}
            className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex items-start justify-between"
          >
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-base font-bold text-slate-900">{cls.name}</h4>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-600">
                  {cls.level}
                </span>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {(cls.arms || ['A', 'B']).map((arm) => (
                  <span
                    key={arm}
                    className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium"
                  >
                    Arm {arm}
                  </span>
                ))}
              </div>
            </div>

            {role === 'school_admin' && (
              <button
                onClick={() => handleDeleteClass(cls.id, cls.name)}
                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                title="Delete Class"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>
      )}

      {/* School subject catalogue */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">School Subjects</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">Choose the subjects your school teaches. Teachers will see this list when creating exams.</p>
          </div>
        </div>

        {role === 'school_admin' && (
          <form onSubmit={handleAddSubject} className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={newSubjectName}
              onChange={(e) => setNewSubjectName(e.target.value)}
              placeholder="Add a subject, e.g. Food and Nutrition"
              maxLength={100}
              required
              className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            />
            <button type="submit" disabled={isSavingSubject} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              <Plus className="h-4 w-4" /> {isSavingSubject ? 'Saving…' : 'Add subject'}
            </button>
          </form>
        )}

        {subjects.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">No active subjects found. Add subjects here after applying the school-subjects SQL migration.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {subjects.map((item) => (
              <span key={item.id} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700">
                {item.name}
                {role === 'school_admin' && (
                  <button type="button" onClick={() => void handleRemoveSubject(item.id, item.name)} aria-label={`Remove ${item.name}`} title="Remove subject" className="rounded-full p-0.5 text-slate-400 hover:bg-rose-100 hover:text-rose-700">
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
