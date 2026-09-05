import React, { createContext, useCallback, useState, useEffect } from "react";
import { getStoredUser } from "../utils/security";

type User = {
  name: string;
  role: string;
  email: string;
  category?: string;
  username?: string;
  display_name?: string;
  entityname?: string;
} | null;

interface AuthContextType {
  user: User;
  login: (userData: User) => void;
  logout: () => void;
  loading: boolean;
  /** Merge partial fields into the current user (e.g. after saving profile settings) */
  updateUser: (updates: Partial<NonNullable<User>>) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = getStoredUser();
    if (stored) setUser(stored);
    setLoading(false);
  }, []);

  const login = (userData: User) => {
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("category");
    localStorage.removeItem("activeMenuItem");
    setUser(null);
  };

  // Merge partial updates (e.g. display_name/username after a profile save)
  // into both React state and localStorage, so every component reading
  // useAuth() reflects the change immediately — no reload needed.
  const updateUser = useCallback((updates: Partial<NonNullable<User>>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...updates };
      localStorage.setItem("user", JSON.stringify(next));
      return next;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};
