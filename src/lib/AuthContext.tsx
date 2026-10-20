'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface User {
  id: string;
  name: string;
  email: string;
  isDepartmentHead: boolean;
  isLecturer: boolean;
  isModerator: boolean;
  facultyBoardApproved?: boolean;
  department: string;
  contact?: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  department: string;
  contact?: string;
}

interface AuthContextType {
  user: User | null;
  authHydrated: boolean;
  login: (email: string, password: string, department: string) => Promise<boolean>;
  register: (payload: RegisterPayload) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  currentRole: 'department_head' | 'lecturer' | 'moderator';
  setCurrentRole: (role: 'department_head' | 'lecturer' | 'moderator') => void;
  updateProfile: (updates: { name?: string; contact?: string }) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authHydrated, setAuthHydrated] = useState(false);
  const [currentRole, setCurrentRole] = useState<'department_head' | 'lecturer' | 'moderator'>(
    'lecturer'
  );

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const savedRole = localStorage.getItem('currentRole');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
        if (savedRole) {
          setCurrentRole(savedRole as any);
        }
      } catch (e) {
        console.error('Failed to parse saved user:', e);
      }
    }
    setAuthHydrated(true);
  }, []);

  const login = async (email: string, password: string, department: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, department }),
      });

      if (!response.ok) {
        return false;
      }

      const authenticatedUser = await response.json();
      setUser(authenticatedUser);
      localStorage.setItem('user', JSON.stringify(authenticatedUser));

      let defaultRole: 'department_head' | 'lecturer' | 'moderator' = 'lecturer';
      if (authenticatedUser.isDepartmentHead) {
        defaultRole = 'department_head';
      } else if (authenticatedUser.isLecturer) {
        defaultRole = 'lecturer';
      } else if (authenticatedUser.isModerator) {
        defaultRole = 'moderator';
      }

      setCurrentRole(defaultRole);
      localStorage.setItem('currentRole', defaultRole);

      return true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const register = async (
    payload: RegisterPayload
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        return { ok: false, error: data?.error || 'Registration failed.' };
      }

      setUser(data);
      localStorage.setItem('user', JSON.stringify(data));
      setCurrentRole('lecturer');
      localStorage.setItem('currentRole', 'lecturer');
      return { ok: true };
    } catch (error: any) {
      return { ok: false, error: error?.message || 'Registration error occurred.' };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('currentRole');
  };

  const updateProfile = async (updates: { name?: string; contact?: string }) => {
    if (!user) return;
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const updatedUser = { ...user, ...updates };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }
    } catch (error) {
      console.error('Update profile error:', error);
    }
  };

  const changePassword = async (
    currentPassword: string,
    newPassword: string
  ): Promise<boolean> => {
    if (!user) return false;
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      return response.ok;
    } catch (error) {
      console.error('Change password error:', error);
      return false;
    }
  };

  const handleSetCurrentRole = (role: 'department_head' | 'lecturer' | 'moderator') => {
    setCurrentRole(role);
    localStorage.setItem('currentRole', role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        authHydrated,
        login,
        register,
        logout,
        currentRole,
        setCurrentRole: handleSetCurrentRole,
        updateProfile,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
