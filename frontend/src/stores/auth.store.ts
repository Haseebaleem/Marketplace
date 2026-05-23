"use client";

import { create } from "zustand";
import type { AuthUser } from "@marketplace/shared";
import { getStoredToken, setStoredToken } from "@/lib/api";

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  hydrated: boolean;
  setSession: (token: string, user: AuthUser) => void;
  setUser: (user: AuthUser | null) => void;
  hydrate: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  hydrated: false,
  setSession: (token, user) => {
    setStoredToken(token);
    set({ token, user });
  },
  setUser: (user) => set({ user }),
  hydrate: () => {
    const token = getStoredToken();
    set({ token, hydrated: true });
  },
  logout: () => {
    setStoredToken(null);
    set({ token: null, user: null });
  },
}));
