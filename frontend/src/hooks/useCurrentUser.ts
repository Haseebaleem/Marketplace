"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { meRequest } from "@/lib/auth-api";
import { useAuthStore } from "@/stores/auth.store";

export const useCurrentUser = () => {
  const { token, user, hydrated, setUser, logout } = useAuthStore();

  const query = useQuery({
    queryKey: ["auth", "me", token],
    queryFn: () => meRequest(token),
    enabled: hydrated && Boolean(token),
    staleTime: 60_000,
    retry: false,
  });

  useEffect(() => {
    if (query.data?.user) {
      setUser(query.data.user);
    }
  }, [query.data, setUser]);

  useEffect(() => {
    if (query.isError && hydrated && token) {
      // Token rejected (401/403) — clear local state.
      logout();
    }
  }, [query.isError, hydrated, token, logout]);

  return {
    user: query.data?.user ?? user,
    isLoading: query.isLoading || !hydrated,
    isAuthenticated: Boolean(token) && Boolean(query.data?.user ?? user),
    isError: query.isError,
  };
};
