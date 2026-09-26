import { requireAdmin } from "@/lib/auth/session";

export default async function AdminPage() {
  await requireAdmin("/admin");
  return (
    <div className="container">
      <h1>Admin</h1>
    </div>
  );
}
