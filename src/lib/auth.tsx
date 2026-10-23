import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { UserProfile, School, UserRole, InstitutionType } from '../types';
import { isSupabaseConfigured, supabase } from './supabase';

export interface AuthContextType {
  user: UserProfile | null;
  school: School | null;
  role: UserRole;
  isAuthenticated: boolean;
  isLoading: boolean;
  isPlatformAdmin: boolean;
  login: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  registerSchoolAndAdmin: (data: {
    schoolName: string;
    adminName: string;
    email: string;
    phone: string;
    state: string;
    lga: string;
    institutionType: InstitutionType;
    password?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateUserProfile: (updates: Partial<UserProfile>) => void;
  refreshSchool: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapSchool(row: any): School {
  return {
    id: row.id,
    name: row.name,
    admin_name: row.admin_name,
    email: row.email,
    phone: row.phone,
    state: row.state,
    lga: row.lga,
    institution_type: row.institution_type as InstitutionType,
    logo_url: row.logo_url || '',
    motto: row.motto || '',
    address: row.address || '',
    subscription_status: row.subscription_status || 'trial',
    subscription_expires_at: row.subscription_expires_at || undefined,
    ai_exams_used: Number(row.ai_exams_used || 0),
    manual_exams_used: Number(row.manual_exams_used || 0),
    max_trial_ai_exams: Number(row.max_trial_ai_exams ?? 4),
    max_trial_manual_exams: Number(row.max_trial_manual_exams ?? 5),
    created_at: row.created_at,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [role, setRole] = useState<UserRole>('teacher');
  const [isLoading, setIsLoading] = useState(true);

  const loadUserContext = useCallback(async (authUser: User | null) => {
    if (!authUser) {
      setUser(null);
      setSchool(null);
      setRole('teacher');
      return;
    }
    if (!isSupabaseConfigured()) {
      setUser(null);
      setSchool(null);
      return;
    }

    const [{ data: profile, error: profileError }, { data: roleRows, error: roleError }] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', authUser.id).maybeSingle(),
      supabase.from('user_roles').select('role, school_id').eq('user_id', authUser.id),
    ]);

    if (profileError || roleError || !profile) {
      console.error('Unable to load authenticated profile', profileError || roleError);
      setUser(null);
      setSchool(null);
      return;
    }

    const roles = (roleRows || []) as Array<{ role: UserRole; school_id: string | null }>;
    const chosenRole = (roles.find((item) => item.school_id === profile.school_id)?.role
      || roles[0]?.role
      || 'teacher') as UserRole;

    setRole(chosenRole);
    setUser({
      id: profile.id,
      user_id: profile.user_id,
      full_name: profile.full_name,
      email: profile.email || authUser.email || '',
      phone: profile.phone || '',
      school_id: profile.school_id || null,
      avatar_url: profile.avatar_url || '',
      is_profile_completed: Boolean(profile.is_profile_completed),
      role: chosenRole,
      created_at: profile.created_at,
    });

    if (profile.school_id) {
      const { data: schoolRow, error: schoolError } = await supabase
        .from('schools')
        .select('*')
        .eq('id', profile.school_id)
        .maybeSingle();
      if (schoolError) {
        console.error('Unable to load school', schoolError);
        setSchool(null);
      } else {
        setSchool(schoolRow ? mapSchool(schoolRow) : null);
      }
    } else {
      setSchool(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    if (!isSupabaseConfigured()) {
      setIsLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) console.error('Unable to restore Supabase session', error);
      if (mounted) {
        return loadUserContext(data.session?.user || null).finally(() => {
          if (mounted) setIsLoading(false);
        });
      }
      return undefined;
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      // Defer database reads until after the auth callback to avoid Supabase lock contention.
      setTimeout(() => {
        if (mounted) void loadUserContext(session?.user || null);
      }, 0);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadUserContext]);

  const login = async (email: string, password?: string) => {
    if (!isSupabaseConfigured()) {
      return { success: false, error: 'Authentication is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your deployment environment.' };
    }
    if (!password || password.length < 1) {
      return { success: false, error: 'Enter your password to sign in.' };
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error || !data.user) return { success: false, error: error?.message || 'Sign-in failed.' };
    await loadUserContext(data.user);
    return { success: true };
  };

  const resetPassword = async (email: string) => {
    if (!isSupabaseConfigured()) return { success: false, error: 'Supabase authentication is not configured.' };
    if (!email.trim()) return { success: false, error: 'Enter your email address first.' };
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: window.location.origin,
    });
    return error
      ? { success: false, error: error.message }
      : { success: true };
  };

  const registerSchoolAndAdmin = async (data: {
    schoolName: string; adminName: string; email: string; phone: string;
    state: string; lga: string; institutionType: InstitutionType; password?: string;
  }) => {
    if (!isSupabaseConfigured()) return { success: false, error: 'Supabase authentication is not configured.' };
    if (!data.password || data.password.length < 8) return { success: false, error: 'Use a password with at least 8 characters.' };

    const { data: result, error } = await supabase.auth.signUp({
      email: data.email.trim().toLowerCase(),
      password: data.password,
      options: {
        data: {
          registration_type: 'school',
          full_name: data.adminName.trim(),
          phone: data.phone.trim(),
          school_name: data.schoolName.trim(),
          school_email: data.email.trim().toLowerCase(),
          school_phone: data.phone.trim(),
          school_state: data.state,
          school_lga: data.lga,
          institution_type: data.institutionType,
          school_address: `${data.lga}, ${data.state} State`,
        },
      },
    });
    if (error) return { success: false, error: error.message };
    if (result.session?.user) await loadUserContext(result.session.user);
    if (!result.session) {
      return { success: false, error: 'Account created. Check your email to confirm it, then sign in. Your school profile is created by the database signup trigger.' };
    }
    return { success: true };
  };

  const logout = async () => {
    if (isSupabaseConfigured()) await supabase.auth.signOut();
    setUser(null);
    setSchool(null);
    setRole('teacher');
  };

  const updateUserProfile = (updates: Partial<UserProfile>) => {
    if (!user) return;
    const next = { ...user, ...updates };
    setUser(next);
    const allowed: Record<string, unknown> = {};
    if (updates.full_name !== undefined) allowed.full_name = updates.full_name;
    if (updates.phone !== undefined) allowed.phone = updates.phone;
    if (updates.avatar_url !== undefined) allowed.avatar_url = updates.avatar_url;
    if (updates.is_profile_completed !== undefined) allowed.is_profile_completed = updates.is_profile_completed;
    if (Object.keys(allowed).length) {
      void supabase.from('profiles').update(allowed).eq('user_id', user.user_id).then(({ error }) => {
        if (error) console.error('Unable to save profile changes', error);
      });
    }
  };

  const refreshSchool = () => {
    if (user?.user_id) {
      void supabase.auth.getUser().then(({ data }) => loadUserContext(data.user || null));
    }
  };

  const isPlatformAdmin = role === 'platform_admin';

  return (
    <AuthContext.Provider value={{
      user, school, role, isAuthenticated: !!user, isLoading, isPlatformAdmin,
      login, resetPassword, registerSchoolAndAdmin,
      logout, updateUserProfile, refreshSchool,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
