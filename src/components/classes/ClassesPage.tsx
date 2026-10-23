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

  useEffect(() => {
    void loadClasses();
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
    </div>
  );
};
