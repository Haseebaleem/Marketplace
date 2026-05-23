"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Package, Store, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth.store";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/supplier", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/supplier/products", label: "Products", icon: Package },
  { href: "/supplier/store", label: "Store", icon: Store },
];

export const SupplierShell = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);

  const isActive = (item: (typeof NAV)[number]) =>
    item.exact ? pathname === item.href : pathname?.startsWith(item.href);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="w-full border-b bg-card md:w-64 md:border-b-0 md:border-r">
        <div className="flex h-16 items-center px-6 font-semibold">
          <Link href="/" className="text-lg">
            Marketplace
          </Link>
        </div>
        <nav className="flex flex-row gap-1 p-4 md:flex-col">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors md:flex-initial",
                isActive(item)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="hidden md:block md:px-4 md:pb-4">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => {
              logout();
              router.push("/login");
            }}
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 bg-background">
        <div className="container py-8">{children}</div>
      </main>
    </div>
  );
};
