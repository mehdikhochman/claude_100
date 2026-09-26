import { requireAdmin } from "@/lib/auth/session";
import { AdminNav } from "@/components/admin/admin-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // The proxy already redirects non-admins; this is the server-side guarantee.
  await requireAdmin("/admin");
  return (
    <div className="container admin-layout">
      <AdminNav />
      <div>{children}</div>
    </div>
  );
}
