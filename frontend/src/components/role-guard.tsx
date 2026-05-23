"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@marketplace/shared";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export const RoleGuard = ({
  role,
  children,
  fallbackHref = "/login",
}: {
  role: Role;
  children: ReactNode;
  fallbackHref?: string;
}) => {
  const router = useRouter();
  const { user, isLoading, isAuthenticated } = useCurrentUser();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace(fallbackHref);
      return;
    }
    if (user && user.role !== role) {
      router.replace("/");
    }
  }, [isLoading, isAuthenticated, user, role, router, fallbackHref]);

  if (isLoading) {
    return (
      <div className="container flex min-h-screen items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }
  if (!isAuthenticated || (user && user.role !== role)) {
    return null;
  }
  return <>{children}</>;
};
