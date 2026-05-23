import { RoleGuard } from "@/components/role-guard";
import { SupplierShell } from "@/components/supplier-shell";

export default function SupplierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleGuard role="SUPPLIER">
      <SupplierShell>{children}</SupplierShell>
    </RoleGuard>
  );
}
