import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, School, UserRole } from '../types';
import { db, dbEvents } from './db';

const AUTH_STORAGE_KEY = 'examcraft_session';
export const PLATFORM_ADMIN_EMAIL = 'peteroche32@gmail.com';

export interface AuthContextType {
  user: UserProfile | null;
  school: School | null;
  role: UserRole;
  isAuthenticated: boolean;
  isLoading: boolean;
  isPlatformAdmin: boolean;
  login: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  registerSchoolAndAdmin: (data: {
    schoolName: string;
    adminName: string;
    email: string;
    phone: string;
    state: string;
    lga: string;
    institutionType: any;
    password?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  joinSchoolAsTeacher: (token: string, fullName: string, email: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateUserProfile: (updates: Partial<UserProfile>) => void;
  refreshSchool: () => void;
  switchDemoUser: (target: 'admin' | 'teacher' | 'platform') => void;
}

const DEFAULT_USERS: Record<string, { profile: UserProfile; schoolId: string }> = {
  admin: {
    profile: {
      id: 'prof_admin_lagos',
      user_id: 'usr_admin_lagos',
      full_name: 'Dr. Babatunde Alabi',
      email: 'principal@kingscollege.edu.ng',
      school_id: 'sch_kings_college_lagos',
      phone: '08031234567',
      is_profile_completed: true,
      role: 'school_admin',
      created_at: new Date().toISOString(),
    },
    schoolId: 'sch_kings_college_lagos',
  },
  teacher: {
    profile: {
      id: 'prof_teacher_adebayo',
      user_id: 'usr_teacher_adebayo',
      full_name: 'Mr. Adebayo Oladipo',
      email: 'a.oladipo@kingscollege.edu.ng',
      school_id: 'sch_kings_college_lagos',
      phone: '08091234567',
      is_profile_completed: true,
      role: 'teacher',
      created_at: new Date().toISOString(),
    },
    schoolId: 'sch_kings_college_lagos',
  },
  platform: {
    profile: {
      id: 'prof_platform_peter',
      user_id: 'usr_platform_peter',
      full_name: 'Peter Oche',
      email: PLATFORM_ADMIN_EMAIL,
      school_id: 'sch_kings_college_lagos',
      phone: '08123456789',
      is_profile_completed: true,
      role: 'platform_admin',
      created_at: new Date().toISOString(),
    },
    schoolId: 'sch_kings_college_lagos',
  }
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // Fallback
    }
    // Default to school admin for effortless first view
    return DEFAULT_USERS.admin.profile;
  });

  const [school, setSchool] = useState<School | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Sync school with user's school_id
  const refreshSchool = () => {
    if (user?.school_id) {
      const s = db.getSchool(user.school_id);
      setSchool(s);
    } else {
      setSchool(null);
    }
  };

  useEffect(() => {
    refreshSchool();
    setIsLoading(false);

    const unsubscribe = dbEvents.subscribe('schools', () => {
      refreshSchool();
    });
    return () => unsubscribe();
  }, [user?.school_id]);

  useEffect(() => {
    if (user) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }, [user]);

  const login = async (email: string): Promise<{ success: boolean; error?: string }> => {
    const trimmed = email.trim().toLowerCase();
    
    // Check if platform admin
    if (trimmed === PLATFORM_ADMIN_EMAIL.toLowerCase()) {
      setUser(DEFAULT_USERS.platform.profile);
      return { success: true };
    }

    // Check teacher
    if (trimmed.includes('teacher') || trimmed === DEFAULT_USERS.teacher.profile.email.toLowerCase()) {
      setUser(DEFAULT_USERS.teacher.profile);
      return { success: true };
    }

    // Check existing school admin by email
    const schools = db.getSchools();
    const matchedSchool = schools.find((s) => s.email.toLowerCase() === trimmed);
    if (matchedSchool) {
      const adminProfile: UserProfile = {
        id: `prof_${matchedSchool.id}`,
        user_id: `usr_${matchedSchool.id}`,
        full_name: matchedSchool.admin_name,
        email: matchedSchool.email,
        school_id: matchedSchool.id,
        phone: matchedSchool.phone,
        is_profile_completed: true,
        role: 'school_admin',
        created_at: matchedSchool.created_at,
      };
      setUser(adminProfile);
      return { success: true };
    }

    // Generic match fallback to demo admin
    const customUser: UserProfile = {
      id: `prof_${Date.now()}`,
      user_id: `usr_${Date.now()}`,
      full_name: 'School Administrator',
      email: trimmed,
      school_id: DEFAULT_USERS.admin.schoolId,
      is_profile_completed: true,
      role: 'school_admin',
      created_at: new Date().toISOString(),
    };
    setUser(customUser);
    return { success: true };
  };

  const registerSchoolAndAdmin = async (data: {
    schoolName: string;
    adminName: string;
    email: string;
    phone: string;
    state: string;
    lga: string;
    institutionType: any;
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      const createdSchool = db.createSchool({
        name: data.schoolName,
        admin_name: data.adminName,
        email: data.email,
        phone: data.phone,
        state: data.state,
        lga: data.lga,
        institution_type: data.institutionType,
        motto: '',
        address: `${data.lga}, ${data.state} State`,
      });

      const newAdmin: UserProfile = {
        id: `prof_${createdSchool.id}`,
        user_id: `usr_${Date.now()}`,
        full_name: data.adminName,
        email: data.email,
        school_id: createdSchool.id,
        phone: data.phone,
        is_profile_completed: true,
        role: 'school_admin',
        created_at: new Date().toISOString(),
      };

      setUser(newAdmin);
      setSchool(createdSchool);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Could not register school' };
    }
  };

  const joinSchoolAsTeacher = async (token: string, fullName: string, email: string): Promise<{ success: boolean; error?: string }> => {
    const invite = db.findInviteByToken(token);
    if (!invite) {
      return { success: false, error: 'Invalid or expired invite token. Please contact your school principal.' };
    }

    const targetSchool = db.getSchool(invite.school_id);
    if (!targetSchool) {
      return { success: false, error: 'Associated school could not be found.' };
    }

    const teacherProfile: UserProfile = {
      id: `prof_t_${Date.now()}`,
      user_id: `usr_t_${Date.now()}`,
      full_name: fullName,
      email,
      school_id: targetSchool.id,
      is_profile_completed: true,
      role: 'teacher',
      created_at: new Date().toISOString(),
    };

    setUser(teacherProfile);
    setSchool(targetSchool);
    return { success: true };
  };

  const logout = () => {
    setUser(null);
    setSchool(null);
  };

  const updateUserProfile = (updates: Partial<UserProfile>) => {
    if (!user) return;
    const updated = { ...user, ...updates };
    setUser(updated);
  };

  const switchDemoUser = (target: 'admin' | 'teacher' | 'platform') => {
    const selected = DEFAULT_USERS[target];
    setUser(selected.profile);
    const s = db.getSchool(selected.schoolId);
    setSchool(s);
  };

  const role: UserRole = user?.role || 'teacher';
  const isPlatformAdmin = role === 'platform_admin' || user?.email.toLowerCase() === PLATFORM_ADMIN_EMAIL.toLowerCase();

  return (
    <AuthContext.Provider
      value={{
        user,
        school,
        role,
        isAuthenticated: !!user,
        isLoading,
        isPlatformAdmin,
        login,
        registerSchoolAndAdmin,
        joinSchoolAsTeacher,
        logout,
        updateUserProfile,
        refreshSchool,
        switchDemoUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
