'use client';

import { createContext, useContext, ReactNode } from 'react';

// Konteks ini sekarang menjadi placeholder untuk menjaga kompatibilitas
// tetapi tidak lagi mengelola status otentikasi aktif.

interface AuthContextType {
  user: null;
  login: () => void;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const value = {
    user: null,
    login: () => console.warn('Login functionality is temporarily disabled.'),
    logout: () => console.warn('Logout functionality is temporarily disabled.'),
    loading: false, // Langsung set ke false karena tidak ada proses loading otentikasi
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};